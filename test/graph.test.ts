import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { DEFAULT_CONFIG, baseGraph, cleanup, graphOf, makeRepo } from './helpers.js';

after(cleanup);

test('10. 역할 판정: index, log, overview, detail을 구분하고, 개요·로그 이름을 설정으로 바꿀 수 있다', () => {
  const graph = graphOf(makeRepo({ ...baseGraph(), 'docs/specs/auth/log.md': '# 하위 로그\n' }));
  const roles = new Map(graph.docs.map((doc) => [doc.file, doc.role]));
  assert.equal(roles.get('docs/specs/index.md'), 'index');
  assert.equal(roles.get('docs/specs/log.md'), 'log');
  assert.equal(roles.get('docs/specs/auth/overview.md'), 'overview');
  assert.equal(roles.get('docs/specs/auth/login.md'), 'detail');
  assert.equal(roles.get('docs/specs/auth/log.md'), 'detail', '하위 디렉터리의 log.md는 상세 문서다');
  assert.equal(graph.docs.find((doc) => doc.role === 'log')?.parent, undefined, '로그에는 부모가 없다');

  const renamed = makeRepo({
    'crumbs.json': `${JSON.stringify({ ...DEFAULT_CONFIG, overview: '개요.md', log: '기록.md' }, null, 2)}\n`,
    'docs/specs/index.md': '# 인덱스\n',
    'docs/specs/기록.md': '# 기록\n',
    'docs/specs/auth/개요.md': '# 인증\n',
    'docs/specs/auth/overview.md': '# 같은 디렉터리의 overview.md\n',
  });
  const customRoles = new Map(graphOf(renamed).docs.map((doc) => [doc.file, doc.role]));
  assert.equal(customRoles.get('docs/specs/기록.md'), 'log');
  assert.equal(customRoles.get('docs/specs/auth/개요.md'), 'overview');
  assert.equal(customRoles.get('docs/specs/auth/overview.md'), 'detail');
});

test('11. 부모 결정: 같은 디렉터리 개요, 조상 개요, 인덱스, 중첩 개요의 순서를 따른다', () => {
  const files = {
    ...baseGraph(),
    // 같은 디렉터리에 개요가 있는 상세 문서는 그 개요가 부모다.
    'docs/specs/auth/sub/overview.md': '# 하위\n',
    'docs/specs/auth/sub/deep.md': '# 심화\n',
    // 개요가 없는 디렉터리의 상세 문서는 가장 가까운 조상 개요가 부모다.
    'docs/specs/auth/misc/y.md': '# 기타\n',
    // 개요가 없는 최상위 디렉터리의 상세 문서는 인덱스가 부모다.
    'docs/specs/billing/refund.md': '# 환불\n',
  };
  const byFile = new Map(graphOf(makeRepo(files)).docs.map((doc) => [doc.file, doc]));
  assert.equal(byFile.get('docs/specs/auth/login.md')?.parent?.file, 'docs/specs/auth/overview.md');
  assert.equal(byFile.get('docs/specs/auth/sub/deep.md')?.parent?.file, 'docs/specs/auth/sub/overview.md');
  assert.equal(byFile.get('docs/specs/auth/misc/y.md')?.parent?.file, 'docs/specs/auth/overview.md');
  assert.equal(byFile.get('docs/specs/billing/refund.md')?.parent?.file, 'docs/specs/index.md');
  // 중첩 개요의 부모는 바깥 개요다.
  assert.equal(byFile.get('docs/specs/auth/sub/overview.md')?.parent?.file, 'docs/specs/auth/overview.md');
});

test('12. 탐색: exclude 접두사, 점 디렉터리, node_modules, .md가 아닌 파일을 무시한다', () => {
  const files = {
    ...baseGraph(),
    'docs/specs/templates/detail.md': '# 템플릿\n',
    'docs/specs/.hidden/x.md': '# 숨김\n',
    'docs/specs/node_modules/pkg/readme.md': '# 패키지\n',
    'docs/specs/auth/notes.txt': '메모\n',
    'docs/specs/auth/Upper.MD': '# 대문자 확장자\n',
  };
  const discovered = graphOf(makeRepo(files)).docs.map((doc) => doc.file);
  assert.ok(!discovered.some((file) => file.includes('/templates/')), 'exclude 접두사 아래는 제외');
  assert.ok(!discovered.some((file) => file.includes('/.hidden/')), '점 디렉터리는 제외');
  assert.ok(!discovered.some((file) => file.includes('node_modules')), 'node_modules는 제외');
  assert.ok(!discovered.some((file) => file.endsWith('.txt')), '.md가 아닌 파일은 제외');
  assert.ok(discovered.includes('docs/specs/auth/Upper.MD'), '확장자 대소문자는 무시하고 .md로 본다');
  assert.equal(discovered.length, 5, '픽스처의 문서 4개와 Upper.MD 1개');
});
