import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { checkRepo } from '../src/check.js';
import type { Finding } from '../src/model.js';
import { DEFAULT_CONFIG, baseGraph, cleanup, lineOf, makeRepo, rulesNamed, runCli, tempDir } from './helpers.js';

after(cleanup);

const LOG = 'docs/specs/log.md';
const INDEX = 'docs/specs/index.md';
const LOGIN = 'docs/specs/auth/login.md';

// baseGraph의 로그 문서를 주어진 H2 제목들로 바꾼다. 항목마다 본문 한 줄을 둔다.
function logWith(headings: string[]): Record<string, string> {
  const body = headings.map((heading) => `## ${heading}\n항목.\n`).join('\n');
  return { ...baseGraph(), [LOG]: `# 스펙 로그\n\n${body}` };
}

test('44. log-format 통과: 기본 픽스처, 다섯 kind와 | 가 든 제목, 강조·영문·이모지, 펜스와 주석 안의 H2, 링크가 든 항목은 발견이 없다', () => {
  assert.deepEqual(rulesNamed(checkRepo(makeRepo(baseGraph())).findings, 'log-format'), []);

  const log = [
    '# 스펙 로그',
    '',
    '## [2026-10-31] ingest | 원문 자료',
    '## [2026-10-31] query | 질문 | 답',
    '## [2026-10-31] lint | *강조* 제목',
    '## [2026-10-31] drift | English title 🚀',
    '## [2026-10-31] change | [로그인](auth/login.md) 흐름',
    '',
    '[로그인](auth/login.md) 문서를 보라.',
    '',
    '```',
    '## 잘못된 제목',
    '```',
    '',
    '<!--',
    '## 잘못된 제목',
    '-->',
    '',
  ].join('\n');
  assert.deepEqual(rulesNamed(checkRepo(makeRepo({ ...baseGraph(), [LOG]: log })).findings, 'log-format'), []);

  for (const text of ['# 스펙 로그\n', '# 스펙 로그\n\n### 세부\n내용\n']) {
    assert.deepEqual(rulesNamed(checkRepo(makeRepo({ ...baseGraph(), [LOG]: text })).findings, 'log-format'), []);
  }
});

test('45. log-format 실패: 어긋난 H2마다 오류 하나이고 줄과 메시지가 정확하며, 로그 문서에 다른 규칙 발견은 없고, CLI는 종료 1이다', () => {
  const cases: Array<[string, string]> = [
    ['## 2026-10-31 ingest | x', '로그 항목 제목 형식이 틀림: "2026-10-31 ingest | x" (형식: [YYYY-MM-DD] kind | 제목)'],
    ['## [2026-10-31] 반영 | x', '로그 항목 제목 형식이 틀림: "[2026-10-31] 반영 | x" (형식: [YYYY-MM-DD] kind | 제목)'],
    ['## [2026-10-31] CHANGE | x', '알 수 없는 kind "CHANGE" (ingest, query, lint, drift, change, decision 중 하나)'],
    ['## [2026-13-01] change | x', '날짜가 유효하지 않음: 2026-13-01'],
    ['## [2026-10-31] change', '로그 항목 제목 형식이 틀림: "[2026-10-31] change" (형식: [YYYY-MM-DD] kind | 제목)'],
    ['## [2026-10-31] change |', '로그 항목 제목 형식이 틀림: "[2026-10-31] change |" (형식: [YYYY-MM-DD] kind | 제목)'],
    ['## 참고', '로그 항목 제목 형식이 틀림: "참고" (형식: [YYYY-MM-DD] kind | 제목)'],
  ];
  for (const [heading, message] of cases) {
    const findings = checkRepo(makeRepo({ ...baseGraph(), [LOG]: `# 스펙 로그\n\n${heading}\n항목.\n` })).findings;
    assert.deepEqual(
      findings.filter((f) => f.file === LOG),
      [{ rule: 'log-format', severity: 'error', file: LOG, line: 3, message }],
      heading,
    );
  }

  const two = '# 스펙 로그\n\n## 참고\n항목.\n\n## 2026-10-31 ingest\n항목.\n';
  const twoFindings = checkRepo(makeRepo({ ...baseGraph(), [LOG]: two })).findings.filter((f) => f.file === LOG);
  assert.deepEqual(twoFindings.map((f) => [f.rule, f.line]), [
    ['log-format', 3],
    ['log-format', 6],
  ]);

  const root = makeRepo({ ...baseGraph(), [LOG]: '# 스펙 로그\n\n## 참고\n항목.\n' });
  const cli = runCli(['check', '--format', 'json'], root);
  assert.equal(cli.code, 1);
  const report = JSON.parse(cli.stdout) as { findings: Array<{ rule: string }> };
  assert.ok(report.findings.some((f) => f.rule === 'log-format'));
});

test('46. 대상 한정: 상세 문서의 H2, 하위 디렉터리의 log.md, 설정으로 바꾼 로그 이름이 대상을 정하고, 로그 문서가 없으면 두 규칙 모두 발견이 없다', () => {
  const inDetail = checkRepo(
    makeRepo({ ...baseGraph(), [LOGIN]: `${baseGraph()[LOGIN]}\n## 2026-10-31 ingest\n항목.\n` }),
  ).findings;
  assert.deepEqual(rulesNamed(inDetail, 'log-format'), []);

  const subdirLog = checkRepo(
    makeRepo({ ...baseGraph(), 'docs/specs/auth/log.md': `${baseGraph()[LOGIN]}\n## 2026-10-31 ingest\n항목.\n` }),
  ).findings;
  assert.deepEqual(rulesNamed(subdirLog, 'log-format'), []);

  const renamed = checkRepo(
    makeRepo({
      ...baseGraph(),
      'crumbs.json': `${JSON.stringify({ ...DEFAULT_CONFIG, log: '기록.md' }, null, 2)}\n`,
      'docs/specs/기록.md': '# 기록\n\n## 2026-10-31 ingest\n항목.\n',
    }),
  ).findings;
  assert.deepEqual(rulesNamed(renamed, 'log-format').map((f) => f.file), ['docs/specs/기록.md']);

  const noLog = baseGraph();
  delete noLog[LOG];
  noLog[INDEX] = noLog[INDEX].replace('- [로그](log.md) — 변경 기록\n', '');
  const absent = checkRepo(makeRepo(noLog)).findings;
  assert.deepEqual(rulesNamed(absent, 'log-format'), []);
  assert.deepEqual(rulesNamed(absent, 'log-order'), []);
});

test('47. log-order: 날짜가 늘어나면 발견이 없고, 앞선 날짜는 경고 하나이며, 같은 날짜와 형식 오류 항목은 규칙을 어기지 않는다', () => {
  const orderOf = (headings: string[]): Finding[] => rulesNamed(checkRepo(makeRepo(logWith(headings))).findings, 'log-order');

  assert.deepEqual(orderOf(['[2026-10-31] change | a', '[2026-11-01] change | b']), []);
  assert.deepEqual(orderOf(['[2026-10-31] change | a', '[2026-10-31] change | b']), []);

  const files = logWith(['[2026-10-31] change | a', '[2026-10-30] change | b']);
  const report = checkRepo(makeRepo(files));
  assert.deepEqual(rulesNamed(report.findings, 'log-order'), [
    {
      rule: 'log-order',
      severity: 'warning',
      file: LOG,
      line: lineOf(files[LOG], '[2026-10-30] change | b'),
      message: '이전 항목(2026-10-31)보다 날짜가 앞섬: 2026-10-30',
    },
  ]);
  assert.equal(report.ok, true);
  const cli = runCli(['check'], makeRepo(files));
  assert.equal(cli.code, 0);
  assert.ok(cli.stdout.includes('경고 1개'));

  assert.deepEqual(orderOf(['[2026-10-29] change | a', '[2026-10-31] change | b', '[2026-10-30] change | c']).map((f) => f.message), [
    '이전 항목(2026-10-31)보다 날짜가 앞섬: 2026-10-30',
  ]);

  // 형식이 틀린 항목은 비교에서 건너뛴다. 그래서 10-28은 바로 앞의 형식 맞는 항목 10-29와 비교된다.
  const broken = checkRepo(makeRepo(logWith(['[2026-10-29] change | a', '깨짐', '[2026-10-28] change | c'])));
  assert.deepEqual(rulesNamed(broken.findings, 'log-format').map((f) => f.message), [
    '로그 항목 제목 형식이 틀림: "깨짐" (형식: [YYYY-MM-DD] kind | 제목)',
  ]);
  assert.deepEqual(rulesNamed(broken.findings, 'log-order').map((f) => f.message), [
    '이전 항목(2026-10-29)보다 날짜가 앞섬: 2026-10-28',
  ]);

  assert.equal(orderOf(['[2026-10-31] change | a', '[2026-10-30] change | b', '[2026-10-29] change | c']).length, 2);
});

test('62. log-body: decision 항목은 본문에 내부 링크가 없으면 제목 줄에 경고 하나이고, 링크가 있거나 다른 kind면 발견이 없으며, init 직후 check는 발견이 없다', () => {
  const bare = '# 스펙 로그\n\n## [2026-10-31] decision | 세션 유효 기간: 30일\n결과: 30일.\n';
  const bareFindings = rulesNamed(checkRepo(makeRepo({ ...baseGraph(), [LOG]: bare })).findings, 'log-body');
  assert.deepEqual(bareFindings, [
    {
      rule: 'log-body',
      severity: 'warning',
      file: LOG,
      line: lineOf(bare, '## [2026-10-31] decision'),
      message: '결정 항목에 문서 링크가 없음',
    },
  ]);

  // 링크는 항목 본문 안에 있어야 한다. 제목 줄의 링크나 다음 항목의 링크는 이 항목의 본문이 아니다.
  const onlyNext = '# 스펙 로그\n\n## [2026-10-31] decision | 세션 유효 기간\n결과: 30일.\n\n## [2026-10-31] change | 다음\n[로그인](auth/login.md)\n';
  assert.equal(rulesNamed(checkRepo(makeRepo({ ...baseGraph(), [LOG]: onlyNext })).findings, 'log-body').length, 1);

  const linked = '# 스펙 로그\n\n## [2026-10-31] decision | 세션 유효 기간\n결과: 30일.\n\n### 근거\n[로그인](auth/login.md#세션-유효-기간)\n';
  assert.deepEqual(rulesNamed(checkRepo(makeRepo({ ...baseGraph(), [LOG]: linked })).findings, 'log-body'), []);

  const change = '# 스펙 로그\n\n## [2026-10-31] change | 본문 없음\n';
  assert.deepEqual(rulesNamed(checkRepo(makeRepo({ ...baseGraph(), [LOG]: change })).findings, 'log-body'), []);

  const initRoot = tempDir();
  assert.equal(runCli(['init'], initRoot).code, 0);
  assert.deepEqual(checkRepo(initRoot).findings, []);
});
