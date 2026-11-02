import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { checkRepo } from '../src/check.js';
import type { Finding } from '../src/model.js';
import { DEFAULT_CONFIG, baseGraph, cleanup, graphOf, lineOf, makeRepo, rulesNamed, runCli } from './helpers.js';

after(cleanup);

const INDEX = 'docs/specs/index.md';
const LOG = 'docs/specs/log.md';
const OVERVIEW = 'docs/specs/auth/overview.md';
const LOGIN = 'docs/specs/auth/login.md';

// 유효한 기본 픽스처에서 경로별로 내용을 바꾸거나(문자열), 지운다(null).
function fixture(patch: Record<string, string | null> = {}): Record<string, string> {
  const files = baseGraph();
  for (const [path, content] of Object.entries(patch)) {
    if (content === null) delete files[path];
    else files[path] = content;
  }
  return files;
}

function check(files: Record<string, string>) {
  return checkRepo(makeRepo(files));
}

// 필수 절을 모두 갖춘 상세 문서. 개요로 돌아가는 링크를 기본으로 둔다.
function detailDoc(title: string, links: string[] = [], policies: string[] = []): string {
  const lines = [`# ${title}`, '', '## 목적', '테스트용 상세 문서.', '', '## 현재 동작', '현재 동작을 설명한다.', ''];
  if (policies.length > 0) {
    lines.push('## 정책', '');
    for (const policy of policies) lines.push(`### ${policy}`, '정책 본문.', '');
  }
  lines.push('## 근거', '- `src/auth/session.ts` — 세션 생성', '', '## 관련 문서', '- [인증 개요](overview.md)');
  for (const link of links) lines.push(`- ${link}`);
  lines.push('');
  return lines.join('\n');
}

const LOGIN_TEXT = baseGraph()[LOGIN];
const OVERVIEW_TEXT = baseGraph()[OVERVIEW];
const INDEX_TEXT = baseGraph()[INDEX];

test('13. broken-link: 없는 대상은 줄 번호와 함께 오류, 제외 템플릿과 존재하는 원본은 통과, 근거의 백틱 경로는 링크로 보지 않는다', () => {
  const loginWithLinks = `${LOGIN_TEXT}- [없음](missing.md)\n- [계약](../../raw/contract.pdf)\n`;
  const withLinks = fixture({
    [LOGIN]: loginWithLinks,
    'docs/raw/contract.pdf': '%PDF 원본\n',
    'docs/specs/templates/detail.md': '# 템플릿\n',
    [INDEX]: `${INDEX_TEXT}- [템플릿](templates/detail.md)\n`,
  });
  const broken = rulesNamed(check(withLinks).findings, 'broken-link');
  assert.equal(broken.length, 1);
  assert.equal(broken[0].file, LOGIN);
  assert.equal(broken[0].line, lineOf(loginWithLinks, 'missing.md'));
  assert.equal(broken[0].message, '링크 대상이 없음: missing.md');

  const outside = fixture({ [LOGIN]: `${LOGIN_TEXT}- [밖](../../README2.md)\n` });
  const outsideBroken = rulesNamed(check(outside).findings, 'broken-link');
  assert.deepEqual(outsideBroken.map((f) => f.message), ['링크 대상이 없음: ../../README2.md']);

  // 근거의 백틱 경로는 링크가 아니므로 missing-code-path로만 검사한다.
  const evidence = fixture({
    [LOGIN]: LOGIN_TEXT.replace('- `src/auth/session.ts` — 세션 생성\n', '- `src/auth/session.ts` — 세션 생성\n- `docs/raw/contract.pdf` — 계약\n'),
  });
  const evidenceReport = check(evidence);
  assert.equal(rulesNamed(evidenceReport.findings, 'broken-link').length, 0);
  assert.deepEqual(rulesNamed(evidenceReport.findings, 'missing-code-path').map((f) => f.message), [
    '코드 경로가 없음: docs/raw/contract.pdf',
  ]);
});

test('13a. broken-link 철자: 대소문자를 구분하지 않는 파일 시스템에서는 철자 오류 하나만 내고 도달 불가를 더하지 않으며, 구분하는 파일 시스템에서는 일반 대상 없음 오류다', () => {
  const overviewText = OVERVIEW_TEXT.replace('[로그인](login.md)', '[로그인](Login.md)');
  const root = makeRepo(fixture({ [OVERVIEW]: overviewText }));
  const report = checkRepo(root);
  const broken = rulesNamed(report.findings, 'broken-link');
  const caseInsensitive = existsSync(join(root, 'docs/specs/auth/LOGIN.md'));
  if (caseInsensitive) {
    assert.deepEqual(broken.map((f) => [f.file, f.line, f.message]), [
      [OVERVIEW, lineOf(overviewText, 'Login.md'), '링크 철자가 디스크의 파일과 다름: Login.md (파일: docs/specs/auth/login.md)'],
    ]);
    assert.equal(rulesNamed(report.findings, 'unreachable').length, 0);
  } else {
    assert.deepEqual(broken.map((f) => f.message), ['링크 대상이 없음: Login.md']);
  }
});

test('14. broken-anchor: 잘못된 fragment는 오류, 올바른 한국어 fragment는 원문과 퍼센트 인코딩 모두 통과, .md가 아닌 대상과 같은 문서 링크를 바르게 다룬다', () => {
  const overviewWithLinks = `${OVERVIEW_TEXT}- [잘못](login.md#없음)\n- [정책](login.md#정책)\n- [정책2](login.md#%EC%A0%95%EC%B1%85)\n`;
  const files = fixture({
    [OVERVIEW]: overviewWithLinks,
    'docs/raw/contract.pdf': '%PDF 원본\n',
    [LOGIN]: `${LOGIN_TEXT}- [계약](../../raw/contract.pdf#page=2)\n- [같은 문서](#목적)\n- [같은 문서 없음](#nope)\n`,
  });
  const anchors = rulesNamed(check(files).findings, 'broken-anchor');
  assert.deepEqual(anchors.map((f) => [f.file, f.message]), [
    [LOGIN, '앵커가 없음: #nope'],
    [OVERVIEW, '앵커가 없음: login.md#없음'],
  ]);
  assert.equal(anchors[1].line, lineOf(overviewWithLinks, 'login.md#없음'));
});

test('15. unreachable: 아무도 링크하지 않는 상세 문서와 도달 불가 문서에서만 링크된 문서는 오류이며, 인덱스에서 연결하면 사라진다', () => {
  const orphans = fixture({
    'docs/specs/auth/orphan.md': detailDoc('고아'),
    'docs/specs/auth/chain.md': detailDoc('체인', ['[다음](chain2.md)']),
    'docs/specs/auth/chain2.md': detailDoc('체인 둘째'),
  });
  const unreachableFiles = (files: Record<string, string>) =>
    rulesNamed(check(files).findings, 'unreachable').map((f) => f.file);
  assert.deepEqual(unreachableFiles(orphans), [
    'docs/specs/auth/chain.md',
    'docs/specs/auth/chain2.md',
    'docs/specs/auth/orphan.md',
  ]);
  assert.deepEqual(
    rulesNamed(check(orphans).findings, 'unreachable').map((f) => f.line),
    [1, 1, 1],
    '도달 불가 발견은 문서 제목 줄을 가리킨다',
  );

  const linked = fixture({
    'docs/specs/auth/orphan.md': detailDoc('고아'),
    'docs/specs/auth/chain.md': detailDoc('체인', ['[다음](chain2.md)']),
    'docs/specs/auth/chain2.md': detailDoc('체인 둘째'),
    [OVERVIEW]: `${OVERVIEW_TEXT}- [고아](orphan.md)\n- [체인](chain.md)\n`,
  });
  assert.deepEqual(unreachableFiles(linked), []);
});

test('16. missing-section: 상세 문서에서 "## 근거"를 지우면 그 제목을 담은 오류 하나이고, 개요에서 "## 문서 목록"이 없으면 오류이며, 인덱스에는 절 오류가 없다', () => {
  const noEvidence = fixture({ [LOGIN]: LOGIN_TEXT.replace('## 근거\n- `src/auth/session.ts` — 세션 생성\n\n', '') });
  const missing = rulesNamed(check(noEvidence).findings, 'missing-section');
  assert.equal(missing.length, 1);
  assert.equal(missing[0].file, LOGIN);
  assert.equal(missing[0].message, '"## 근거" 절이 없음');
  assert.equal(missing[0].line, 1, '절 오류의 줄은 제목 줄이다');

  const noDocuments = fixture({
    [OVERVIEW]: OVERVIEW_TEXT.replace('## 문서 목록\n- [로그인](login.md) — 로그인 세션\n\n', ''),
  });
  const messages = rulesNamed(check(noDocuments).findings, 'missing-section').map((f) => [f.file, f.message]);
  assert.deepEqual(messages, [[OVERVIEW, '"## 문서 목록" 절이 없음']]);

  const indexSections = rulesNamed(check(fixture()).findings, 'missing-section').filter((f) => f.file === INDEX);
  assert.equal(indexSections.length, 0);
});

test('16a. missing-section 비문서: 필수 절이 하나도 없으면 발견 하나로 exclude를 안내하고, exclude에 넣으면 사라지며, 파일이 스펙 루트 바로 아래면 파일 이름을 안내한다', () => {
  const adr = englishFixture({ 'docs/specs/adr/0001.md': '# ADR\n\n자유 형식 메모.\n', 'docs/specs/notes.md': '# Notes\n\nfree text\n' });
  const found = rulesNamed(checkRepo(makeRepo(adr)).findings, 'missing-section');
  assert.deepEqual(found.map((f) => [f.file, f.line, f.message]), [
    ['docs/specs/adr/0001.md', 1, 'no spec sections found; if this is not a crumbs document, add "adr/" to "exclude" in crumbs.json'],
    ['docs/specs/notes.md', 1, 'no spec sections found; if this is not a crumbs document, add "notes.md" to "exclude" in crumbs.json'],
  ]);

  const excluded = englishFixture({
    'docs/specs/adr/0001.md': '# ADR\n\n자유 형식 메모.\n',
    'crumbs.json': `${JSON.stringify({ ...DEFAULT_CONFIG, lang: 'en', exclude: ['adr'] }, null, 2)}\n`,
  });
  assert.deepEqual(rulesNamed(checkRepo(makeRepo(excluded)).findings, 'missing-section'), []);
});

test('17. missing-backlink: (a) 개요·상세가 부모로 돌아가지 않으면 오류, (b) 상세 A가 B를 링크하면 B도 A를 링크해야 하며, 개요→상세 링크는 (b)를 만들지 않는다', () => {
  // (a) 상세 문서가 부모 개요로 돌아가지 않음
  const bare = '# 벌거벗은\n\n## 목적\n목적.\n\n## 현재 동작\n동작.\n\n## 근거\n- `src/auth/session.ts` — 세션\n\n## 관련 문서\n- [스펙 인덱스](../index.md)\n';
  const bareReport = check(fixture({ 'docs/specs/auth/bare.md': bare, [OVERVIEW]: `${OVERVIEW_TEXT}- [벌거벗은](bare.md)\n` }));
  const backlinkA = rulesNamed(bareReport.findings, 'missing-backlink');
  assert.deepEqual(backlinkA.map((f) => [f.file, f.message]), [
    ['docs/specs/auth/bare.md', `${OVERVIEW}로 돌아가는 링크가 없음`],
  ]);
  assert.equal(backlinkA[0].line, lineOf(bare, '## 관련 문서'), '(a)의 줄은 관련 문서 절의 제목 줄이다');

  // (a) 개요가 인덱스로 돌아가지 않음
  const overviewNoIndex = OVERVIEW_TEXT.replace('- [스펙 인덱스](../index.md)\n', '');
  const overviewReport = check(fixture({ [OVERVIEW]: overviewNoIndex }));
  assert.deepEqual(rulesNamed(overviewReport.findings, 'missing-backlink').map((f) => [f.file, f.message]), [
    [OVERVIEW, `${INDEX}로 돌아가는 링크가 없음`],
  ]);
  assert.equal(rulesNamed(overviewReport.findings, 'missing-backlink')[0].line, lineOf(overviewNoIndex, '## 관련 문서'));

  // (b) login이 password-reset을 링크하는데 되돌아오는 링크가 없다. 개요→상세 링크는 (b)를 만들지 않는다.
  const oneWay = fixture({
    [LOGIN]: `${LOGIN_TEXT}- [비밀번호 재설정](password-reset.md)\n`,
    'docs/specs/auth/password-reset.md': detailDoc('비밀번호 재설정'),
    [OVERVIEW]: `${OVERVIEW_TEXT}- [비밀번호 재설정](password-reset.md)\n`,
  });
  const backlinkB = rulesNamed(check(oneWay).findings, 'missing-backlink');
  assert.deepEqual(backlinkB.map((f) => [f.file, f.message]), [
    ['docs/specs/auth/password-reset.md', `${LOGIN}에서 링크했지만 되돌아가는 링크가 없음`],
  ]);
  assert.equal(backlinkB[0].line, 1, '(b)의 줄은 대상 문서의 제목 줄이다');

  const twoWay = fixture({
    [LOGIN]: `${LOGIN_TEXT}- [비밀번호 재설정](password-reset.md)\n`,
    'docs/specs/auth/password-reset.md': detailDoc('비밀번호 재설정', ['[로그인](login.md)']),
    [OVERVIEW]: `${OVERVIEW_TEXT}- [비밀번호 재설정](password-reset.md)\n`,
  });
  assert.equal(rulesNamed(check(twoWay).findings, 'missing-backlink').length, 0);
});

test('17a. 로그 면제: 로그는 절·역링크·정책 중복 검사에서 빠지고, 도달·링크·제목 검사에는 참여한다', () => {
  const logWithPolicy = fixture({ [LOG]: '# 스펙 로그\n\n## 정책\n### 세션 유효 기간\n로그에 적은 정책 이름.\n' });
  const exempt = check(logWithPolicy).findings;
  assert.deepEqual(
    exempt.filter((f) => f.file === LOG && ['missing-section', 'missing-backlink', 'duplicate-policy'].includes(f.rule)),
    [],
  );
  assert.equal(rulesNamed(exempt, 'duplicate-policy').length, 0, '로그의 정책 이름은 상세 문서와 충돌하지 않는다');

  const unlinked = fixture({ [INDEX]: INDEX_TEXT.replace('- [로그](log.md) — 변경 기록\n', '') });
  assert.deepEqual(rulesNamed(check(unlinked).findings, 'unreachable').map((f) => f.file), [LOG]);

  const brokenInLog = fixture({ [LOG]: `${baseGraph()[LOG]}- [깨짐](없음.md)\n` });
  assert.deepEqual(rulesNamed(check(brokenInLog).findings, 'broken-link').map((f) => f.file), [LOG]);

  const h2Only = fixture({ [LOG]: '## 기록\n\n항목.\n' });
  assert.deepEqual(rulesNamed(check(h2Only).findings, 'missing-title').map((f) => f.file), [LOG]);

  const badTitle = fixture({ [LOG]: '# 스펙 로그\n\n## 2026-10-31 ingest\n항목.\n' });
  assert.deepEqual(
    check(badTitle).findings.filter((f) => f.file === LOG).map((f) => [f.rule, f.severity]),
    [['log-format', 'error']],
  );
});

test('18. missing-code-path: 없는 근거 경로는 줄 번호와 함께 오류, :N-M 접미사와 디렉터리는 통과, codeRoot가 해석 기준을 바꾼다', () => {
  const loginWithPaths = LOGIN_TEXT.replace(
    '- `src/auth/session.ts` — 세션 생성\n',
    '- `src/auth/session.ts` — 세션 생성\n- `src/missing.ts:12` — 없음\n- `src/auth/session.ts:12-30` — 범위\n- `src/auth/` — 디렉터리\n',
  );
  const missing = rulesNamed(check(fixture({ [LOGIN]: loginWithPaths })).findings, 'missing-code-path');
  assert.equal(missing.length, 1);
  assert.equal(missing[0].message, '코드 경로가 없음: src/missing.ts:12');
  assert.equal(missing[0].line, lineOf(loginWithPaths, 'src/missing.ts:12'));

  // codeRoot가 app이면 src/auth/session.ts는 app/src/auth/session.ts로 해석된다.
  const appFiles = fixture({
    'src/auth/session.ts': null,
    'app/src/auth/session.ts': 'export {};\n',
    'crumbs.json': `${JSON.stringify({ ...DEFAULT_CONFIG, codeRoot: 'app' }, null, 2)}\n`,
  });
  assert.equal(rulesNamed(check(appFiles).findings, 'missing-code-path').length, 0);

  const rootFiles = fixture({ 'src/auth/session.ts': null, 'app/src/auth/session.ts': 'export {};\n' });
  assert.deepEqual(rulesNamed(check(rootFiles).findings, 'missing-code-path').map((f) => f.message), [
    '코드 경로가 없음: src/auth/session.ts',
  ]);
});

test('18a. missing-code-path: rawDir 아래 근거는 codeRoot와 무관하게 저장소 루트 기준으로 해석한다', () => {
  const loginWithRaw = LOGIN_TEXT.replace(
    '- `src/auth/session.ts` — 세션 생성\n',
    '- `src/auth/session.ts` — 세션 생성\n- `docs/raw/contract.pdf` — 계약\n- `./docs/raw/contract.pdf` — 계약(./ 표기)\n- `docs/raw/missing.pdf` — 없는 자료\n',
  );
  const files = fixture({
    [LOGIN]: loginWithRaw,
    'src/auth/session.ts': null,
    'app/src/auth/session.ts': 'export {};\n',
    'docs/raw/contract.pdf': 'pdf\n',
    'crumbs.json': `${JSON.stringify({ ...DEFAULT_CONFIG, codeRoot: 'app' }, null, 2)}\n`,
  });
  assert.deepEqual(rulesNamed(check(files).findings, 'missing-code-path').map((f) => f.message), [
    '코드 경로가 없음: docs/raw/missing.pdf',
  ]);
});

test('19. duplicate-policy: 두 상세 문서에 같은 정책이 있으면 문서마다 오류, 한 파일 안의 중복과 로그는 제외, 대소문자·공백만 다르면 여전히 중복', () => {
  const pr = detailDoc('비밀번호 재설정', [], ['세션 유효 기간']);
  const shared = fixture({
    'docs/specs/auth/password-reset.md': pr,
    [OVERVIEW]: `${OVERVIEW_TEXT}- [비밀번호 재설정](password-reset.md)\n`,
  });
  const dups = rulesNamed(check(shared).findings, 'duplicate-policy');
  assert.deepEqual(dups.map((f) => [f.file, f.message]), [
    [LOGIN, '중복 정책 "세션 유효 기간": docs/specs/auth/password-reset.md에도 있음'],
    ['docs/specs/auth/password-reset.md', '중복 정책 "세션 유효 기간": docs/specs/auth/login.md에도 있음'],
  ]);
  assert.equal(dups[0].line, lineOf(LOGIN_TEXT, '### 세션 유효 기간'));

  const caseOnly = fixture({
    [LOGIN]: LOGIN_TEXT.replace('### 세션 유효 기간', '### Session Lifetime'),
    'docs/specs/auth/password-reset.md': detailDoc('비밀번호 재설정', [], ['session   lifetime']),
  });
  assert.equal(rulesNamed(check(caseOnly).findings, 'duplicate-policy').length, 2);

  // 한 파일 안의 중복은 두 번째부터의 제목마다 발견 하나이고, 메시지는 첫 줄을 가리킨다.
  const sameFileText = detailDoc('비밀번호 재설정', [], ['같은 이름', '같은 이름', '같은 이름']);
  const sameFile = fixture({ 'docs/specs/auth/password-reset.md': sameFileText });
  const lines = sameFileText.split('\n');
  const first = lines.indexOf('### 같은 이름') + 1;
  const second = lines.indexOf('### 같은 이름', first) + 1;
  const third = lines.lastIndexOf('### 같은 이름') + 1;
  assert.deepEqual(rulesNamed(check(sameFile).findings, 'duplicate-policy').map((f) => [f.file, f.line, f.message]), [
    ['docs/specs/auth/password-reset.md', second, `중복 정책 "같은 이름": 이 문서의 ${first}줄에 이미 있음`],
    ['docs/specs/auth/password-reset.md', third, `중복 정책 "같은 이름": 이 문서의 ${first}줄에 이미 있음`],
  ]);
});

test('20. open-question: 마커 둘이 있는 파일은 개수 2와 첫 마커 줄을 담은 경고 하나이고, 경고만 있으면 ok는 true이며 종료 코드는 0이다', () => {
  const loginWithMarkers = LOGIN_TEXT.replace('- 없음\n', '- [확인 필요] 질문 A\n- [확인 필요] 질문 B\n');
  const files = fixture({ [LOGIN]: loginWithMarkers });
  const report = check(files);
  assert.equal(report.ok, true);
  const open = rulesNamed(report.findings, 'open-question');
  assert.equal(open.length, 1);
  assert.equal(open[0].severity, 'warning');
  assert.equal(open[0].message, '미해결 질문 2개');
  assert.equal(open[0].line, lineOf(loginWithMarkers, '[확인 필요]'));

  const root = makeRepo(files);
  const cli = runCli(['check'], root);
  assert.equal(cli.code, 0);
  assert.ok(cli.stdout.includes('미해결 질문 2개'));

  // 확인 필요 사항 절의 마커가 있으면 정책 본문의 마커는 세지 않고, 첫 항목 줄을 가리킨다.
  const withPolicyMarker = loginWithMarkers.replace('활동이 30일 동안 없으면 세션이 만료된다.\n', '활동이 30일 동안 없으면 세션이 만료된다.\n[확인 필요] 기간 확인\n');
  const mixed = rulesNamed(check(fixture({ [LOGIN]: withPolicyMarker })).findings, 'open-question');
  assert.deepEqual(mixed.map((f) => [f.message, f.line]), [['미해결 질문 2개', lineOf(withPolicyMarker, '- [확인 필요] 질문 A')]]);

  // 확인 필요 사항 절에 항목이 없으면 정책 본문의 마커 수를 센다.
  const bodyOnly = LOGIN_TEXT.replace('활동이 30일 동안 없으면 세션이 만료된다.\n', '활동이 30일 동안 없으면 세션이 만료된다.\n[확인 필요] 기간 확인\n');
  const bodyFindings = rulesNamed(check(fixture({ [LOGIN]: bodyOnly })).findings, 'open-question');
  assert.deepEqual(bodyFindings.map((f) => [f.message, f.line]), [['미해결 질문 1개', lineOf(bodyOnly, '[확인 필요] 기간 확인')]]);
});

test('20a. unterminated-comment: 닫히지 않은 주석이 시작한 줄에 오류 하나를 내고, 가려진 절의 missing-section은 그대로 두며, 코드 스팬 안의 <!--는 발견이 없다', () => {
  const hidden = LOGIN_TEXT.replace('## 근거', '<!-- 열림\n## 근거');
  const report = check(fixture({ [LOGIN]: hidden }));
  assert.deepEqual(
    rulesNamed(report.findings, 'unterminated-comment').map((f) => [f.file, f.line, f.severity]),
    [[LOGIN, lineOf(hidden, '<!-- 열림'), 'error']],
  );
  assert.equal(report.ok, false);
  assert.ok(rulesNamed(report.findings, 'missing-section').some((f) => f.file === LOGIN && f.message === '"## 근거" 절이 없음'));

  const codeSpan = LOGIN_TEXT.replace('## 근거', '`<!--` 는 주석을 여는 표식이다.\n\n## 근거');
  const clean = checkRepo(makeRepo(fixture({ [LOGIN]: codeSpan })));
  assert.deepEqual(rulesNamed(clean.findings, 'unterminated-comment'), []);
  assert.equal(clean.ok, true);
});

test('21. missing-title: 첫 제목이 H2인 파일과 제목이 없는 파일은 오류다', () => {
  const files = fixture({
    'docs/specs/auth/h2.md': '## 제목이 H2\n\n## 목적\n목적.\n',
    'docs/specs/auth/none.md': '제목 없이 글만 있다.\n',
    // 맨 앞 BOM이 있어도 첫 줄의 H1은 H1이다.
    'docs/specs/auth/bom.md': '﻿# BOM 문서\n',
  });
  const titles: Finding[] = rulesNamed(check(files).findings, 'missing-title');
  assert.deepEqual(titles.map((f) => f.file), ['docs/specs/auth/h2.md', 'docs/specs/auth/none.md']);
  assert.equal(titles[0].line, 1);
  assert.equal(titles[1].line, 1, '제목이 없으면 1줄을 가리킨다');
  assert.equal(titles[0].message, '첫 제목은 H1이어야 함');
});

test('22. index-missing: 인덱스가 없으면 발견은 하나뿐이고 종료 코드는 1이며, 다른 규칙은 보고되지 않는다', () => {
  const files = fixture({ [INDEX]: null, 'docs/specs/auth/orphan.md': '# 고아\n' });
  const report = check(files);
  assert.equal(report.findings.length, 1);
  assert.equal(report.findings[0].rule, 'index-missing');
  assert.equal(report.findings[0].severity, 'error');
  assert.equal(report.findings[0].message, `인덱스 문서가 없음: ${INDEX}`);
  assert.equal(report.ok, false);

  const cli = runCli(['check'], makeRepo(files));
  assert.equal(cli.code, 1);
});

test('23. 정렬: 같은 파일의 발견은 줄 번호 오름차순이고, 전체 발견도 같은 순서를 따른다', () => {
  const sortDoc = Array.from({ length: 30 }, (_, i) => `줄 ${i + 1}`);
  sortDoc[0] = '# 정렬';
  sortDoc[4] = '[가](missing-a.md)';
  sortDoc[29] = '[나](missing-b.md)';
  const report = check(fixture({ 'docs/specs/auth/sort.md': `${sortDoc.join('\n')}\n` }));

  const mine = report.findings.filter(
    (f) => f.file === 'docs/specs/auth/sort.md' && (f.rule === 'broken-link' || f.rule === 'unreachable'),
  );
  assert.deepEqual(mine.map((f) => f.line), [1, 5, 30]);

  const keyOf = (f: Finding) => [f.file, f.line ?? Number.MAX_SAFE_INTEGER] as const;
  for (let i = 1; i < report.findings.length; i++) {
    const [fileA, lineA] = keyOf(report.findings[i - 1]);
    const [fileB, lineB] = keyOf(report.findings[i]);
    assert.ok(fileA < fileB || (fileA === fileB && lineA <= lineB), `정렬 순서 위반: ${i}`);
  }
});

// "현재 동작" 절에 불릿 n줄을 두고, extra는 "## 근거" 앞에 놓는 추가 줄이다.
function behaviorDoc(bullets: number, extra: string[] = []): string {
  const lines = ['# 로그인 세션', '', '## 목적', '로그인 세션.', '', '## 현재 동작'];
  for (let i = 1; i <= bullets; i++) lines.push(`- 단계 ${i}`);
  lines.push('', ...extra, '## 근거', '- `src/auth/session.ts` — 세션 생성', '', '## 관련 문서', '- [인증 개요](overview.md)', '');
  return lines.join('\n');
}

test('36. missing-flow: 현재 동작이 불릿 6줄 이상이고 도식도 표도 없는 상세 문서에만 경고 하나를 내며, 펜스 안의 구분선은 표로 세지 않는다', () => {
  const six = behaviorDoc(6);
  const report = check(fixture({ [LOGIN]: six }));
  const flow = rulesNamed(report.findings, 'missing-flow');
  assert.equal(flow.length, 1);
  assert.equal(flow[0].severity, 'warning');
  assert.equal(flow[0].file, LOGIN);
  assert.equal(flow[0].line, lineOf(six, '## 현재 동작'));
  assert.equal(flow[0].message, '현재 동작이 6단계인데 흐름 도식이나 표가 없음');
  assert.equal(report.ok, true);

  // 흐름 절의 mermaid 펜스 또는 현재 동작 안의 표가 있으면 경고가 없다.
  const withMermaid = behaviorDoc(6, ['## 흐름', '```mermaid', 'flowchart LR', '  A --> B', '```', '']);
  assert.equal(rulesNamed(check(fixture({ [LOGIN]: withMermaid })).findings, 'missing-flow').length, 0);
  const withTable = behaviorDoc(6, ['| 채널 | 결과 |', '|---|---|', '| 일반 | 표시 |', '']);
  assert.equal(rulesNamed(check(fixture({ [LOGIN]: withTable })).findings, 'missing-flow').length, 0);

  // 불릿이 5줄이면 경고가 없고, 개요 문서의 불릿은 세지 않는다.
  assert.equal(rulesNamed(check(fixture({ [LOGIN]: behaviorDoc(5) })).findings, 'missing-flow').length, 0);
  const overviewBullets = `${OVERVIEW_TEXT}${Array.from({ length: 10 }, (_, i) => `- 단계 ${i + 1}`).join('\n')}\n`;
  assert.equal(rulesNamed(check(fixture({ [OVERVIEW]: overviewBullets })).findings, 'missing-flow').length, 0);

  // ```text 펜스 안의 |---|는 표가 아니므로 경고가 남는다.
  const textFence = behaviorDoc(6, ['```text', '| a | b |', '|---|---|', '```', '']);
  assert.equal(rulesNamed(check(fixture({ [LOGIN]: textFence })).findings, 'missing-flow').length, 1);
});

test('37. 어휘 flow: 상세 문서에 "## 흐름"이 없어도 missing-section이 나지 않고, headings.flow 재정의가 받아들여져 그 제목이 flow 절로 인식된다', () => {
  const plain = checkRepo(makeRepo(fixture()));
  assert.equal(rulesNamed(plain.findings, 'missing-section').length, 0);
  assert.equal(plain.ok, true);

  const root = makeRepo(
    fixture({
      'crumbs.json': `${JSON.stringify({ ...DEFAULT_CONFIG, headings: { flow: '플로우' } }, null, 2)}\n`,
      [LOGIN]: LOGIN_TEXT.replace('## 근거', '## 플로우\n없음\n\n## 근거'),
    }),
  );
  const report = checkRepo(root);
  assert.equal(report.ok, true);
  assert.equal(rulesNamed(report.findings, 'missing-section').length, 0);
  const login = graphOf(root).docs.find((doc) => doc.file === LOGIN);
  assert.ok(login?.sections.some((section) => section.key === 'flow'));
});

test('38. duplicate-policy: "현재 동작" 절의 ### 소제목은 정책이 아니므로 두 상세 문서가 같은 ### 시작을 가져도 발견이 없고, 정책 절에 두면 문서마다 발견이 난다', () => {
  const behaviorStep = (text: string) => text.replace('현재 동작을 설명한다.', '### 시작\n현재 동작을 설명한다.');
  const loginStep = LOGIN_TEXT.replace('로그인하면 세션이 시작된다.', '### 시작\n로그인하면 세션이 시작된다.');
  const reset = behaviorStep(detailDoc('비밀번호 재설정'));
  const steps = fixture({
    [LOGIN]: loginStep,
    'docs/specs/auth/password-reset.md': reset,
    [OVERVIEW]: `${OVERVIEW_TEXT}- [비밀번호 재설정](password-reset.md)\n`,
  });
  const report = check(steps);
  assert.equal(rulesNamed(report.findings, 'duplicate-policy').length, 0);
  assert.equal(report.ok, true);

  // 같은 소제목이 정책 절에 있으면 두 문서 모두 발견이 난다.
  const policies = fixture({
    [LOGIN]: LOGIN_TEXT.replace('### 세션 유효 기간', '### 시작'),
    'docs/specs/auth/password-reset.md': detailDoc('비밀번호 재설정', [], ['시작']),
    [OVERVIEW]: `${OVERVIEW_TEXT}- [비밀번호 재설정](password-reset.md)\n`,
  });
  assert.equal(rulesNamed(check(policies).findings, 'duplicate-policy').length, 2);
});

test('39. section-order: 첫 절이 목적이 아니거나 마지막 절이 관련 문서가 아니거나 어휘 절 순서가 기준과 다르면 경고 하나씩이고, 기본 픽스처·용어 절·키 없는 H2·로그는 발견이 없다', () => {
  // 1. 기본 픽스처는 발견이 없고 통과한다.
  const base = check(fixture());
  assert.equal(rulesNamed(base.findings, 'section-order').length, 0);
  assert.equal(base.ok, true);

  // 2. 상세 문서에서 흐름이 현재 동작보다 앞에 오면 현재 동작 줄에 경고 하나를 낸다.
  const flowFirst = LOGIN_TEXT.replace('## 현재 동작', '## 흐름\n없음\n\n## 현재 동작');
  const flowReport = check(fixture({ [LOGIN]: flowFirst }));
  const flowFindings = rulesNamed(flowReport.findings, 'section-order');
  assert.equal(flowFindings.length, 1);
  assert.equal(flowFindings[0].severity, 'warning');
  assert.equal(flowFindings[0].file, LOGIN);
  assert.equal(flowFindings[0].line, lineOf(flowFirst, '## 현재 동작'));
  assert.equal(flowFindings[0].message, '"## 현재 동작" 절은 "## 흐름" 앞에 와야 함');
  assert.equal(flowReport.ok, true);

  // 3. 목적과 현재 동작의 블록을 맞바꾸면 첫 절 경고와 순서 경고 두 개가 난다.
  const purposeBlock = '## 목적\n로그인 세션이 만들어지고 끝나는 방식.\n\n';
  const behaviorBlock = '## 현재 동작\n로그인하면 세션이 시작된다.\n\n';
  const swapped = LOGIN_TEXT.replace(purposeBlock + behaviorBlock, behaviorBlock + purposeBlock);
  const swappedFindings = rulesNamed(check(fixture({ [LOGIN]: swapped })).findings, 'section-order');
  assert.deepEqual(
    swappedFindings.map((f) => [f.file, f.line, f.message]),
    [
      [LOGIN, lineOf(swapped, '## 현재 동작'), '첫 절은 "## 목적"이어야 함'],
      [LOGIN, lineOf(swapped, '## 목적'), '"## 목적" 절은 "## 현재 동작" 앞에 와야 함'],
    ],
  );

  // 4. 관련 문서 뒤에 메모 절이 오면 마지막 절 경고가 메모 줄에 하나 난다.
  const memoAfter = `${LOGIN_TEXT}\n## 메모\n메모.\n`;
  const memoFindings = rulesNamed(check(fixture({ [LOGIN]: memoAfter })).findings, 'section-order');
  assert.equal(memoFindings.length, 1);
  assert.equal(memoFindings[0].line, lineOf(memoAfter, '## 메모'));
  assert.equal(memoFindings[0].message, '마지막 절은 "## 관련 문서"이어야 함');

  // 5. 키 없는 H2는 순서 검사에서 제외되므로 목적과 현재 동작 사이에 있어도 발견이 없다.
  const unknownMiddle = LOGIN_TEXT.replace('## 현재 동작', '## 메모\n메모.\n\n## 현재 동작');
  assert.equal(rulesNamed(check(fixture({ [LOGIN]: unknownMiddle })).findings, 'section-order').length, 0);

  // 6. 개요에서 용어 절이 문서 목록과 관련 문서 사이에 있으면 발견도 깨진 앵커도 없다.
  const overviewTerms = OVERVIEW_TEXT.replace(
    '## 관련 문서',
    '## 용어\n- 세션(로그인 세션) — [세션 유효 기간](login.md#세션-유효-기간)\n\n## 관련 문서',
  );
  const termsReport = check(fixture({ [OVERVIEW]: overviewTerms }));
  assert.equal(rulesNamed(termsReport.findings, 'section-order').length, 0);
  assert.equal(rulesNamed(termsReport.findings, 'broken-anchor').length, 0);

  // 7. 개요에서 흐름이 문서 목록 뒤에 오면 흐름 줄에 경고 하나를 낸다.
  const overviewFlow = OVERVIEW_TEXT.replace('## 관련 문서', '## 흐름\n없음\n\n## 관련 문서');
  const overviewFindings = rulesNamed(check(fixture({ [OVERVIEW]: overviewFlow })).findings, 'section-order');
  assert.equal(overviewFindings.length, 1);
  assert.equal(overviewFindings[0].file, OVERVIEW);
  assert.equal(overviewFindings[0].line, lineOf(overviewFlow, '## 흐름'));
  assert.equal(overviewFindings[0].message, '"## 흐름" 절은 "## 문서 목록" 앞에 와야 함');

  // 8. 로그는 순서 검사 대상이 아니므로 정책 절이 먼저 와도 발견이 없다.
  const logPolicyFirst = fixture({
    [LOG]: '# 스펙 로그\n\n## 정책\n정책 본문.\n\n## [2026-10-31] change | 초기\n항목.\n',
  });
  const logReport = check(logPolicyFirst);
  assert.equal(rulesNamed(logReport.findings, 'section-order').length, 0);

  // 9. CLI는 경고만 있으므로 종료 코드 0이고, 출력에 규칙 이름이 나온다.
  const cli = runCli(['check'], makeRepo(fixture({ [LOGIN]: flowFirst })));
  assert.equal(cli.code, 0);
  assert.match(cli.stdout, /section-order/);
});

// 영어 어휘로 쓴 픽스처(lang en). 상세 문서 하나와 개요 하나, 인덱스와 로그로 이루어진다.
const LOGIN_EN = [
  '# Login session',
  '',
  '## Purpose',
  'How login sessions start and end.',
  '',
  '## Current behavior',
  'A login starts a session.',
  '',
  '## Policies',
  '### Session lifetime',
  'A session expires after 30 days without activity.',
  '',
  '## Evidence',
  '- `src/auth/session.ts` — session creation',
  '',
  '## Open questions',
  '- None',
  '',
  '## Related',
  '- [Auth](overview.md)',
  '',
].join('\n');

function englishFixture(patch: Record<string, string> = {}): Record<string, string> {
  const files: Record<string, string> = {
    'crumbs.json': `${JSON.stringify({ ...DEFAULT_CONFIG, lang: 'en' }, null, 2)}\n`,
    'src/auth/session.ts': 'export const session = true;\n',
    'docs/specs/index.md': [
      '# Spec index',
      '',
      '## Domains',
      '- [Auth](auth/overview.md) — login session',
      '',
      '## Records',
      '- [Log](log.md) — change log',
      '',
    ].join('\n'),
    'docs/specs/log.md': ['# Spec log', '', '## [2026-10-31] change | initial setup', 'Initial entry.', ''].join('\n'),
    'docs/specs/auth/overview.md': [
      '# Auth',
      '',
      '## Purpose',
      'Owns the auth area.',
      '',
      '## Documents',
      '- [Login](login.md) — login session',
      '',
      '## Related',
      '- [Spec index](../index.md)',
      '',
    ].join('\n'),
    'docs/specs/auth/login.md': LOGIN_EN,
  };
  return { ...files, ...patch };
}

test('74. 영어 어휘: 깨끗한 영어 픽스처는 발견이 없고, 빠진 절·절 순서·흐름 누락은 영어 제목과 영어 메시지로 나온다', () => {
  assert.deepEqual(checkRepo(makeRepo(englishFixture())).findings, []);

  const noEvidence = LOGIN_EN.replace('## Evidence\n- `src/auth/session.ts` — session creation\n\n', '');
  const missing = checkRepo(makeRepo(englishFixture({ [LOGIN]: noEvidence })));
  assert.deepEqual(
    missing.findings.map((finding) => finding.message),
    ['"## Evidence" section is missing'],
  );

  const misordered = LOGIN_EN.replace('## Current behavior\nA login starts a session.\n\n', '').replace(
    '## Evidence',
    '## Current behavior\nA login starts a session.\n\n## Evidence',
  );
  const order = checkRepo(makeRepo(englishFixture({ [LOGIN]: misordered })));
  assert.deepEqual(
    order.findings.map((finding) => finding.message),
    ['section order differs from the template: "## Current behavior" must come before "## Policies"'],
  );

  const sixSteps = LOGIN_EN.replace(
    'A login starts a session.\n',
    ['- one', '- two', '- three', '- four', '- five', '- six', ''].join('\n'),
  );
  const flow = checkRepo(makeRepo(englishFixture({ [LOGIN]: sixSteps })));
  assert.deepEqual(
    flow.findings.map((finding) => finding.message),
    ['current behavior has 6 steps but no flow diagram or table'],
  );
  assert.equal(flow.findings[0].severity, 'warning');
});

test('75. 영어 어휘: 링크 대상과 역링크 오류가 영어 메시지로 나온다', () => {
  const broken = LOGIN_EN.replace('- [Auth](overview.md)', '- [Auth](overview.md)\n- [Gone](missing.md)');
  const result = checkRepo(makeRepo(englishFixture({ [LOGIN]: broken })));
  assert.deepEqual(
    result.findings.map((finding) => finding.message),
    ['link target not found: missing.md'],
  );

  const oneWay = LOGIN_EN.replace('- [Auth](overview.md)', '- [Auth](overview.md)\n- [Logout](logout.md)');
  const logout = '# Logout\n\n## Purpose\nEnds the session.\n\n## Current behavior\nA logout ends the session.\n\n## Policies\n\n## Evidence\n- `src/auth/session.ts` — session end\n\n## Open questions\n- None\n\n## Related\n- [Auth](overview.md)\n';
  const linked = checkRepo(
    makeRepo(englishFixture({ [LOGIN]: oneWay, 'docs/specs/auth/logout.md': logout })),
  );
  assert.ok(
    linked.findings.some((finding) => finding.message === 'linked from docs/specs/auth/login.md but no link back'),
    JSON.stringify(linked.findings.map((finding) => finding.message)),
  );
});

test('76. 영어 어휘: [needs confirmation]만 쓴 문서는 open-question 경고 하나를 내고, 한국어 마커도 여전히 인식한다', () => {
  const asked = LOGIN_EN.replace(
    'A session expires after 30 days without activity.',
    'A session expires after 30 days without activity.\n[needs confirmation] Is the 30-day limit intended?',
  );
  const open = rulesNamed(checkRepo(makeRepo(englishFixture({ [LOGIN]: asked }))).findings, 'open-question');
  assert.deepEqual(
    open.map((finding) => finding.message),
    ['1 open question(s)'],
  );

  const korean = LOGIN_EN.replace('A login starts a session.', 'A login starts a session.\n[확인 필요] 확인할 것');
  const both = rulesNamed(checkRepo(makeRepo(englishFixture({ [LOGIN]: korean }))).findings, 'open-question');
  assert.equal(both.length, 1);
  assert.equal(both[0].message, '1 open question(s)');
});

