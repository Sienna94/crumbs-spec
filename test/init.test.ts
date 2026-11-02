import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { cleanup, runCli, tempDir } from './helpers.js';

after(cleanup);

// init이 만드는 파일 일곱 개(기본 설정 기준)
const SEVEN_FILES = [
  'crumbs.json',
  'docs/specs/index.md',
  'docs/specs/log.md',
  'docs/specs/templates/overview.md',
  'docs/specs/templates/detail.md',
  'docs/raw/README.md',
  'AGENTS.md',
];

const START = '<!-- crumbs:start -->';
const END = '<!-- crumbs:end -->';

// 로컬 날짜를 YYYY-MM-DD로(init이 쓰는 방식과 같다).
function localDate(): string {
  const now = new Date();
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function count(text: string, needle: string): number {
  return text.split(needle).length - 1;
}

test('29. 빈 디렉터리 init: 일곱 파일을 만들고, 이어서 check는 문서 2개와 발견 0으로 종료 0이다', () => {
  const root = tempDir();
  const init = runCli(['init'], root);
  assert.equal(init.code, 0);
  assert.ok(init.stdout.includes('다음: crumbs check'));
  for (const rel of SEVEN_FILES) {
    assert.ok(existsSync(join(root, rel)), `있어야 함: ${rel}`);
  }

  const config = JSON.parse(readFileSync(join(root, 'crumbs.json'), 'utf8')) as { lang: string };
  assert.equal(config.lang, 'ko');

  const log = readFileSync(join(root, 'docs/specs/log.md'), 'utf8');
  assert.ok(log.includes(`## [${localDate()}] change | crumbs-spec 초기화`));

  const agents = readFileSync(join(root, 'AGENTS.md'), 'utf8');
  assert.equal(count(agents, START), 1);

  const check = runCli(['check'], root);
  assert.equal(check.code, 0);
  assert.equal(check.stdout, 'crumbs check: 문서 2개, 오류 0개, 경고 0개\n');
});

test('30. --spec-dir specs: 설정에 반영되고, 인덱스·로그·템플릿이 specs/ 아래에 생기며, AGENTS 블록이 specs 경로를 언급한다', () => {
  const root = tempDir();
  const init = runCli(['init', '--spec-dir', 'specs'], root);
  assert.equal(init.code, 0);

  const config = JSON.parse(readFileSync(join(root, 'crumbs.json'), 'utf8')) as { specDir: string };
  assert.equal(config.specDir, 'specs');
  for (const rel of ['specs/index.md', 'specs/log.md', 'specs/templates/overview.md', 'specs/templates/detail.md']) {
    assert.ok(existsSync(join(root, rel)), `있어야 함: ${rel}`);
  }
  const agents = readFileSync(join(root, 'AGENTS.md'), 'utf8');
  assert.ok(agents.includes('specs/index.md'));
  assert.ok(agents.includes('specs/log.md'));

  const check = runCli(['check'], root);
  assert.equal(check.code, 0);
  assert.ok(check.stdout.includes('문서 2개'));
});

test('31. 두 번째 실행: 아무것도 덮어쓰지 않고, 기존 파일마다 건너뜀을 출력하며, AGENTS 블록은 중복 없이 교체된다', () => {
  const root = tempDir();
  assert.equal(runCli(['init'], root).code, 0);
  const before = new Map(SEVEN_FILES.map((rel) => [rel, readFileSync(join(root, rel))]));

  const second = runCli(['init'], root);
  assert.equal(second.code, 0);
  for (const rel of SEVEN_FILES.filter((rel) => rel !== 'AGENTS.md')) {
    assert.ok(second.stdout.includes(`이미 있음, 건너뜀: ${rel}`), `건너뜀 출력: ${rel}`);
  }
  for (const rel of SEVEN_FILES) {
    assert.ok(before.get(rel)?.equals(readFileSync(join(root, rel))), `바이트가 같아야 함: ${rel}`);
  }

  // 블록 사이의 내용만 바뀌고, 바깥 문장은 그대로 남는다.
  const edited = `# 내 지침\n\n${START}\n오래된 내용\n${END}\n\n꼬리 문단\n`;
  writeFileSync(join(root, 'AGENTS.md'), edited);
  assert.equal(runCli(['init'], root).code, 0);
  const replaced = readFileSync(join(root, 'AGENTS.md'), 'utf8');
  assert.ok(replaced.startsWith(`# 내 지침\n\n${START}\n## 스펙 문서 (crumbs)`));
  assert.ok(replaced.endsWith(`${END}\n\n꼬리 문단\n`));
  assert.ok(!replaced.includes('오래된 내용'));
  assert.equal(count(replaced, START), 1);
  assert.equal(count(replaced, END), 1);
});

test('32. 표시가 없는 기존 AGENTS.md: 원래 내용이 위에 보존되고 블록이 한 번 덧붙는다', () => {
  const root = tempDir();
  const original = '# 기존 지침\n\n기존 내용이다.\n';
  writeFileSync(join(root, 'AGENTS.md'), original);
  assert.equal(runCli(['init'], root).code, 0);
  const agents = readFileSync(join(root, 'AGENTS.md'), 'utf8');
  assert.ok(agents.startsWith(`${original}\n${START}`));
  assert.equal(count(agents, START), 1);
});

test('33. CLAUDE.md: @AGENTS.md가 없으면 안내만 출력하고, 있으면 안내가 없으며, CLAUDE.md는 절대 고치지 않는다', () => {
  const withoutImport = tempDir();
  const claudeText = '# 프로젝트 지침\n';
  writeFileSync(join(withoutImport, 'CLAUDE.md'), claudeText);
  const first = runCli(['init'], withoutImport);
  assert.ok(first.stdout.includes('안내: Claude Code가 crumbs 규칙을 읽도록 CLAUDE.md에 "@AGENTS.md"를 추가하세요'));
  assert.equal(readFileSync(join(withoutImport, 'CLAUDE.md'), 'utf8'), claudeText);

  const withImport = tempDir();
  const claudeWithImport = '# 프로젝트 지침\n\n@AGENTS.md\n';
  writeFileSync(join(withImport, 'CLAUDE.md'), claudeWithImport);
  const second = runCli(['init'], withImport);
  assert.ok(!second.stdout.includes('안내:'));
  assert.equal(readFileSync(join(withImport, 'CLAUDE.md'), 'utf8'), claudeWithImport);
});

test('34. 기존 crumbs.json: --spec-dir는 무시하고 참고를 출력하며, lang이 en이면 init은 설정 오류로 종료 2', () => {
  const root = tempDir();
  writeFileSync(join(root, 'crumbs.json'), '{"version": 1, "specDir": "spec"}\n');
  const init = runCli(['init', '--spec-dir', 'other'], root);
  assert.equal(init.code, 0);
  assert.ok(init.stdout.includes('참고: crumbs.json이 이미 있어 그 설정을 사용함 (--spec-dir 무시)'));
  assert.ok(existsSync(join(root, 'spec/index.md')));
  assert.ok(!existsSync(join(root, 'other')));

  const english = tempDir();
  writeFileSync(join(english, 'crumbs.json'), '{"version": 1, "lang": "en"}\n');
  const failed = runCli(['init'], english);
  assert.equal(failed.code, 2);
  assert.ok(failed.stderr.includes('crumbs.json: "lang" 값이 잘못됨: 1단계는 "ko"만 지원'));
  assert.ok(!existsSync(join(english, 'docs')), '설정 오류면 아무 파일도 만들지 않는다');
});

test('35. rawDir: sources: 설정대로 sources/README.md를 만들고 AGENTS 블록이 sources/를 언급한다', () => {
  const root = tempDir();
  writeFileSync(join(root, 'crumbs.json'), '{"version": 1, "rawDir": "sources"}\n');
  assert.equal(runCli(['init'], root).code, 0);
  assert.ok(existsSync(join(root, 'sources/README.md')));
  assert.ok(readFileSync(join(root, 'AGENTS.md'), 'utf8').includes('`sources/`'));
});
