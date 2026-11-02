import assert from 'node:assert/strict';
import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { checkRepo } from '../src/check.js';
import { isCalendarDate, localDate as localDateOf } from '../src/dates.js';
import { formatLogHeading, parseLogHeading } from '../src/log.js';
import {
  DEFAULT_CONFIG,
  baseGraph,
  cleanup,
  localDate,
  makeRepo,
  readRepoFile,
  rulesNamed,
  runCli,
  tempDir,
} from './helpers.js';

after(cleanup);

const LOG = 'docs/specs/log.md';
const TODAY = localDate();
const USAGE = '사용법: crumbs <init|check|log add> [옵션]  (자세히: crumbs --help)';

function logOf(root: string): string {
  return readRepoFile(root, LOG);
}

test('36. 정상 경로: log add는 오늘 날짜 항목을 로그 끝에 덧붙이고 출력 한 줄을 내며, 뒤의 check에 log-format 발견이 없다', () => {
  const root = makeRepo(baseGraph());
  const before = logOf(root);
  const result = runCli(
    ['log', 'add', '--kind', 'change', '환불 기한 변경', '--body', '수정: docs/specs/billing/refunds.md'],
    root,
  );
  assert.equal(result.code, 0);
  assert.equal(result.stdout, `추가: docs/specs/log.md — [${TODAY}] change | 환불 기한 변경\n`);
  assert.equal(
    logOf(root),
    `${before.replace(/\n+$/, '')}\n\n## [${TODAY}] change | 환불 기한 변경\n수정: docs/specs/billing/refunds.md\n`,
  );

  // 항목 날짜가 픽스처보다 과거이면 log-order 경고가 날 수 있으므로, 종료 코드와 log-format만 본다.
  assert.equal(runCli(['check'], root).code, 0);
  assert.deepEqual(rulesNamed(checkRepo(root).findings, 'log-format'), []);
});

test('37. 본문 없음과 연속 추가: 본문이 없으면 제목 줄로 끝나고, 연속 추가하면 항목 사이 빈 줄은 하나이며, 빈 본문은 본문 없음과 같다', () => {
  const root = makeRepo(baseGraph());
  assert.equal(runCli(['log', 'add', '--kind', 'change', '첫째'], root).code, 0);
  assert.ok(logOf(root).endsWith(`\n\n## [${TODAY}] change | 첫째\n`));

  assert.equal(runCli(['log', 'add', '--kind', 'change', '둘째'], root).code, 0);
  assert.ok(logOf(root).includes(`## [${TODAY}] change | 첫째\n\n## [${TODAY}] change | 둘째\n`));
  assert.ok(logOf(root).endsWith(`## [${TODAY}] change | 둘째\n`));

  const plain = makeRepo(baseGraph());
  assert.equal(runCli(['log', 'add', '--kind', 'change', '제목'], plain).code, 0);
  for (const body of ['', '  \n  ']) {
    const same = makeRepo(baseGraph());
    assert.equal(runCli(['log', 'add', '--kind', 'change', '제목', '--body', body], same).code, 0);
    assert.equal(logOf(same), logOf(plain), `본문 ${JSON.stringify(body)}`);
  }
});

test('38. 끝 줄바꿈 정규화: 줄바꿈 없이 끝나거나 빈 줄 둘로 끝나는 로그, CRLF 본문, 앞뒤 빈 줄, 0바이트 파일이 규칙대로 저장된다', () => {
  const base = baseGraph();

  const noNewline = makeRepo({ ...base, [LOG]: '# 스펙 로그\n\n## [2026-10-31] change | 초기 구성' });
  assert.equal(runCli(['log', 'add', '--kind', 'change', '추가'], noNewline).code, 0);
  assert.ok(logOf(noNewline).includes('초기 구성\n\n## ['));
  assert.ok(logOf(noNewline).endsWith(`\n\n## [${TODAY}] change | 추가\n`));

  const twoBlank = makeRepo({ ...base, [LOG]: '# 스펙 로그\n\n## [2026-10-31] change | 초기 구성\n\n\n' });
  assert.equal(runCli(['log', 'add', '--kind', 'change', '추가'], twoBlank).code, 0);
  assert.ok(logOf(twoBlank).includes('초기 구성\n\n## ['));
  assert.ok(!logOf(twoBlank).includes('\n\n\n'));

  const crlf = makeRepo(baseGraph());
  assert.equal(runCli(['log', 'add', '--kind', 'change', '여러 줄', '--body', '첫 줄\r\n둘째 줄'], crlf).code, 0);
  assert.ok(logOf(crlf).endsWith(`## [${TODAY}] change | 여러 줄\n첫 줄\n둘째 줄\n`));
  assert.ok(!logOf(crlf).includes('\r'));

  const padded = makeRepo(baseGraph());
  assert.equal(runCli(['log', 'add', '--kind', 'change', '여백', '--body', '\n\n본문\n\n'], padded).code, 0);
  assert.ok(logOf(padded).endsWith(`## [${TODAY}] change | 여백\n본문\n`));

  const empty = makeRepo({ ...base, [LOG]: '' });
  assert.equal(runCli(['log', 'add', '--kind', 'change', '빈 파일'], empty).code, 0);
  assert.equal(logOf(empty), `## [${TODAY}] change | 빈 파일\n`);
});

test('39. 다섯 kind: ingest, query, lint, drift, change가 모두 받아들여지고 log-format 발견이 없다', () => {
  const root = makeRepo(baseGraph());
  for (const kind of ['ingest', 'query', 'lint', 'drift', 'change']) {
    const result = runCli(['log', 'add', '--kind', kind, `${kind} 항목`], root);
    assert.equal(result.code, 0, kind);
    assert.ok(result.stdout.startsWith(`추가: docs/specs/log.md — [${TODAY}] ${kind} | `), kind);
    assert.ok(logOf(root).includes(`] ${kind} | ${kind} 항목\n`), kind);
  }
  assert.deepEqual(rulesNamed(checkRepo(root).findings, 'log-format'), []);
});

test('40. 오류: 6.4.2 표의 조건마다 종료 2와 정해진 메시지를 내고, 사용법 줄의 유무를 지키며, 로그 파일은 바이트 단위로 그대로 남는다', () => {
  const root = makeRepo(baseGraph());
  const before = logOf(root);
  const cases: Array<[string[], string, boolean]> = [
    [['log', 'add', '--kind', 'nope', 'x'], '옵션 "--kind"의 값이 잘못됨', true],
    [['log', 'add', '--kind', 'CHANGE', 'x'], '옵션 "--kind"의 값이 잘못됨', true],
    [['log', 'add', '--kind', '', 'x'], '옵션 "--kind"의 값이 잘못됨', true],
    [['log', 'add', 'x'], '옵션 "--kind"이 없음', true],
    [['log', 'add', 'x', '--kind'], '옵션 "--kind"의 값이 잘못됨', true],
    [['log', 'add', '--kind', 'change'], '제목이 없음', true],
    [['log', 'add', '--kind', 'change', 'a', 'b'], '제목은 하나여야 함 (따옴표로 묶으세요)', true],
    [['log', 'add', '--kind', 'change', ''], '제목이 비어 있음', true],
    [['log', 'add', '--kind', 'change', '   '], '제목이 비어 있음', true],
    [['log', 'add', '--kind', 'change', 'a\nb'], '제목에 줄바꿈을 넣을 수 없음', true],
    [['log', 'add', '--kind', 'change', 'x', '--body', '본문\n## 가짜 제목'], '본문에 제목 줄(#)을 넣을 수 없음', true],
    [['log', 'add', '--kind', 'change', 'x<!--'], '제목과 본문에 "<!--"를 넣을 수 없음', true],
    [['log', 'add', '--kind', 'change', 'x', '--body', '본문 <!-- 주석'], '제목과 본문에 "<!--"를 넣을 수 없음', true],
    [['log'], '하위 명령이 없음 (log add)', true],
    [['log', 'remove'], '알 수 없는 명령 "log remove"', true],
  ];
  for (const [args, message, withUsage] of cases) {
    const result = runCli(['--lang', 'ko', ...args], root);
    assert.equal(result.code, 2, args.join(' '));
    assert.ok(result.stderr.includes(`crumbs: ${message}`), `${args.join(' ')} → ${result.stderr}`);
    assert.equal(result.stderr.includes(USAGE), withUsage, args.join(' '));
    assert.equal(result.stdout, '', args.join(' '));
    assert.equal(logOf(root), before, args.join(' '));
  }

  // 로그 문서가 없으면 사용법 줄 없이 init 안내를 낸다.
  const noLog = makeRepo(baseGraph());
  rmSync(join(noLog, LOG));
  const missingLog = runCli(['log', 'add', '--kind', 'change', 'x'], noLog);
  assert.equal(missingLog.code, 2);
  assert.ok(missingLog.stderr.includes('crumbs: 로그 문서가 없음: docs/specs/log.md. 먼저 "npx crumbs-spec init"을 실행하세요.'));
  assert.ok(!missingLog.stderr.includes('사용법'));

  // crumbs.json이 없으면 설정 오류 메시지만 낸다.
  const noConfig = tempDir();
  const missingConfig = runCli(['log', 'add', '--kind', 'change', 'x'], noConfig);
  assert.equal(missingConfig.code, 2);
  assert.ok(missingConfig.stderr.includes('npx crumbs-spec init'));
  assert.ok(!missingConfig.stderr.includes('사용법'));
});

test('41. 명령별 옵션 거부: 명령이 받지 않는 옵션은 "알 수 없는 옵션"으로 거부하고 로그는 바뀌지 않는다', () => {
  const root = makeRepo(baseGraph());
  const before = logOf(root);
  const cases: Array<[string[], string]> = [
    [['check', '--kind', 'change'], '알 수 없는 옵션 "--kind"'],
    [['init', '--body', 'x'], '알 수 없는 옵션 "--body"'],
    [['log', 'add', '--kind', 'change', 'x', '--format', 'json'], '알 수 없는 옵션 "--format"'],
    [['log', 'add', '--kind', 'change', 'x', '--spec-dir', 's'], '알 수 없는 옵션 "--spec-dir"'],
    [['log', 'add', '--kind', 'change', 'x', '--skills', 'all'], '알 수 없는 옵션 "--skills"'],
  ];
  for (const [args, message] of cases) {
    const result = runCli(['--lang', 'ko', ...args], root);
    assert.equal(result.code, 2, args.join(' '));
    assert.ok(result.stderr.includes(`crumbs: ${message}`), args.join(' '));
    assert.equal(logOf(root), before, args.join(' '));
  }
});

test('42. 경로와 설정: 설정의 specDir와 log를 따르고, --root와 --config가 동작하며, 제목은 trim하되 내부 공백은 유지하고, 하이픈 제목은 --로 받는다', () => {
  const custom = makeRepo({
    'crumbs.json': `${JSON.stringify({ ...DEFAULT_CONFIG, specDir: 'specs', log: '기록.md' }, null, 2)}\n`,
    'specs/기록.md': '# 기록\n',
  });
  const first = runCli(['log', 'add', '--kind', 'change', '경로 확인'], custom);
  assert.equal(first.code, 0);
  assert.equal(first.stdout, `추가: specs/기록.md — [${TODAY}] change | 경로 확인\n`);
  assert.ok(readRepoFile(custom, 'specs/기록.md').endsWith(`## [${TODAY}] change | 경로 확인\n`));

  // --root는 다른 작업 디렉터리에서 실행해도 지정한 저장소를 쓴다.
  const elsewhere = tempDir();
  const root = makeRepo(baseGraph());
  const viaRoot = runCli(['log', 'add', '--kind', 'change', '루트 지정', '--root', root], elsewhere);
  assert.equal(viaRoot.code, 0);
  assert.ok(logOf(root).endsWith(`## [${TODAY}] change | 루트 지정\n`));

  // --config는 다른 위치의 설정 파일이지만, 로그 경로는 --root 기준 <specDir>/<log>다.
  const cfgDir = tempDir();
  const cfgPath = join(cfgDir, 'other.json');
  writeFileSync(cfgPath, `${JSON.stringify({ ...DEFAULT_CONFIG, specDir: 'specs', log: '기록.md' }, null, 2)}\n`);
  const viaConfig = runCli(['log', 'add', '--kind', 'change', '설정 파일 지정', '--config', cfgPath], custom);
  assert.equal(viaConfig.code, 0);
  assert.ok(readRepoFile(custom, 'specs/기록.md').endsWith(`## [${TODAY}] change | 설정 파일 지정\n`));

  const spaced = runCli(['log', 'add', '--kind', 'change', '  a  b  '], root);
  assert.equal(spaced.stdout, `추가: docs/specs/log.md — [${TODAY}] change | a  b\n`);
  assert.ok(logOf(root).endsWith(`## [${TODAY}] change | a  b\n`));

  const dash = runCli(['log', 'add', '--kind', 'change', '--', '-제목'], root);
  assert.equal(dash.code, 0);
  assert.ok(dash.stdout.endsWith('| -제목\n'));
});

test('43. 단위: parseLogHeading이 형식·kind·날짜 실패를 구분하고, isCalendarDate와 localDate가 달력 규칙과 로컬 날짜를 지킨다', () => {
  assert.deepEqual(parseLogHeading('[2026-10-31] change | 제목'), {
    ok: true,
    date: '2026-10-31',
    kind: 'change',
    title: '제목',
  });
  assert.deepEqual(parseLogHeading('[2026-10-31] change | a | b'), {
    ok: true,
    date: '2026-10-31',
    kind: 'change',
    title: 'a | b',
  });

  for (const text of [
    '2026-10-31 ingest | x',
    '[2026-10-31] change |',
    '[2026-10-31] change',
    '[2026-1-5] change | x',
    '[2026-10-31] 반영 | x',
    '[2026-10-31]  change | x',
  ]) {
    assert.deepEqual(parseLogHeading(text), { ok: false, reason: 'format' }, text);
  }
  assert.deepEqual(parseLogHeading('[2026-10-31] CHANGE | x'), { ok: false, reason: 'kind', kind: 'CHANGE' });

  for (const date of ['2026-13-01', '2026-00-10', '2026-02-30', '2023-02-29', '1900-02-29']) {
    assert.deepEqual(parseLogHeading(`[${date}] change | x`), { ok: false, reason: 'date', date }, date);
  }
  assert.equal(parseLogHeading('[2024-02-29] change | x').ok, true);
  assert.equal(parseLogHeading('[2000-02-29] change | x').ok, true);

  assert.equal(isCalendarDate(2026, 4, 31), false);
  assert.equal(isCalendarDate(2026, 4, 30), true);
  assert.equal(formatLogHeading('2026-10-31', 'change', '제목'), '[2026-10-31] change | 제목');
  assert.equal(localDateOf(new Date(2026, 0, 5)), '2026-01-05');
});

test('61. decision: --kind decision이 받아들여져 "decision | 정책: 답" 제목으로 들어가고, 본문 링크가 있으면 log-format과 log-body 발견이 없다', () => {
  const root = makeRepo(baseGraph());
  const body = '결과: 30일. 이유: 기획 질문 답변. 문서: [세션 유효 기간](auth/login.md#세션-유효-기간)';
  const result = runCli(['log', 'add', '--kind', 'decision', '세션 유효 기간: 30일', '--body', body], root);
  assert.equal(result.code, 0);
  assert.equal(result.stdout, `추가: docs/specs/log.md — [${TODAY}] decision | 세션 유효 기간: 30일\n`);
  assert.ok(logOf(root).endsWith(`\n\n## [${TODAY}] decision | 세션 유효 기간: 30일\n${body}\n`));

  const findings = checkRepo(root).findings;
  assert.deepEqual(rulesNamed(findings, 'log-format'), []);
  assert.deepEqual(rulesNamed(findings, 'log-body'), []);
});
