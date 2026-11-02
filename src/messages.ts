import { VOCAB_KEYS, type Lang } from './headings.js';

// 사용자에게 보이는 문자열 모음(12.2). 한국어 문구는 1단계 출력과 바이트 단위로 같다.
// 명령·옵션 이름·규칙 id·파일 경로·식별자는 두 언어 모두 원문 그대로 둔다.
// 영어 수 표기: 1이면 단수, 그 밖이면 복수다.
const counted = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

export interface Messages {
  // 명령줄 (cli.ts)
  usage: string;
  help: string;
  unknownOption: (name: string) => string;
  optionValue: (name: string) => string;
  optionRequired: (name: string) => string;
  unknownCommand: (name: string) => string;
  noCommand: string;
  noSubcommand: string;
  titleMissing: string;
  titleCount: string;
  titleEmpty: string;
  titleLineBreak: string;
  bodyHeading: string;
  commentForbidden: string;

  // init (init.ts)
  configKept: (option: string) => string;
  skipped: (path: string) => string;
  created: (path: string) => string;
  updated: (path: string) => string;
  next: string;
  claudeGuide: string;
  agentsMarkers: string;
  rootMissing: (root: string) => string;

  // 설정 (config.ts)
  fileMissing: (where: string) => string;
  configNotObject: string;
  unknownKey: (key: string) => string;
  invalid: (key: string, reason: string) => string;
  langInvalid: string;
  reasonString: string;
  reasonNumber: string;
  reasonOne: string;
  reasonDot: string;
  reasonObject: string;
  reasonUnknownHeading: (name: string) => string;
  reasonStringArray: string;
  reasonInsideSpec: string;
  reasonInsideRoot: string;
  reasonRelativePath: string;

  // 로그 (log.ts)
  logDocMissing: (path: string) => string;
  logAdded: (path: string, heading: string) => string;
  logDateFuture: (date: string) => string;

  // 요약 (report.ts)
  summary: (documents: number, errors: number, warnings: number) => string;

  // 검사 규칙 (check.ts, rules/*.ts, graph.ts)
  h1Title: string;
  indexMissing: (path: string) => string;
  linkMissing: (rawTarget: string) => string;
  anchorMissing: (rawTarget: string) => string;
  unreachable: (indexPath: string) => string;
  sectionMissing: (title: string) => string;
  backlinkMissing: (parentPath: string) => string;
  backlinkOneWay: (sourcePath: string) => string;
  codePathMissing: (raw: string) => string;
  duplicatePolicy: (name: string, others: string) => string;
  duplicatePolicyInDoc: (name: string, line: number) => string;
  noSpecSections: (target: string) => string;
  unterminatedComment: string;
  spellingMismatch: (rawTarget: string, actual: string) => string;
  openQuestions: (count: number) => string;
  logHeadingFormat: (text: string) => string;
  logKindUnknown: (kind: string, kinds: string) => string;
  logDateInvalid: (date: string) => string;
  logOrder: (previous: string, date: string) => string;
  decisionLink: string;
  flowMissing: (steps: number) => string;
  sectionFirst: (title: string) => string;
  sectionLast: (title: string) => string;
  sectionOrder: (before: string, after: string) => string;
}

export const MESSAGES: Record<Lang, Messages> = {
  en: {
    usage: 'usage: crumbs <init|check|log add> [options]  (details: crumbs --help)',
    help: `crumbs <command> [options]

Commands
  init       create crumbs.json, the spec index, the log, templates, the raw source directory, and the agent instruction block
  check      check the spec link graph and document structure
  log add    add an entry to the log document

Common options
  --root <dir>      repository root (default: current directory)
  --lang <en|ko>    spec language for init; language of errors raised before crumbs.json is read (default: en)
  -h, --help        show help
  -v, --version     show version

init options
  --spec-dir <dir>             spec root relative to the repository root (default: docs/specs)
  --skills <claude|codex|all>  install the four agent skills (.claude/skills/, .agents/skills/)

check options
  --format <text|json>   output format (default: text)
  --config <path>        config file path (default: <root>/crumbs.json)
  exclude entries in crumbs.json are paths relative to the spec root; an entry ending in "/" excludes a directory

log add options
  --kind <ingest|query|lint|drift|change|decision>   entry kind (required)
  --body "<body>"                                      body placed under the title (optional)
  --config <path>                                    config file path (default: <root>/crumbs.json)

Example
  crumbs init --skills all
  crumbs log add --kind change "Change the refund deadline to 14 days" --body "Result: refund request deadline is 14 days. Reason: policy change request. Document: [Refund deadline](billing/refunds.md#refund-deadline)"
`,
    unknownOption: (name) => `unknown option "${name}"`,
    optionValue: (name) => `option "${name}" has an invalid value`,
    optionRequired: (name) => `option "${name}" is required`,
    unknownCommand: (name) => `unknown command "${name}"`,
    noCommand: 'no command given',
    noSubcommand: 'no subcommand given (log add)',
    titleMissing: 'title is missing',
    titleCount: 'title must be a single argument (quote it)',
    titleEmpty: 'title is empty',
    titleLineBreak: 'title cannot contain a line break',
    bodyHeading: 'body cannot contain a heading line (#)',
    commentForbidden: 'title and body cannot contain "<!--"',

    configKept: (option) => `note: crumbs.json already exists, so its settings are used (${option} ignored)`,
    skipped: (path) => `skipped: ${path} (already exists)`,
    created: (path) => `created: ${path}`,
    updated: (path) => `updated: ${path}`,
    next: 'next: npx crumbs-spec check',
    claudeGuide: 'guide: add "@AGENTS.md" to CLAUDE.md so Claude Code reads the crumbs rules',
    agentsMarkers: 'AGENTS.md: crumbs markers are not paired',
    rootMissing: (root) => `root directory not found: ${root}`,

    fileMissing: (where) => `crumbs.json not found in ${where}. Run "npx crumbs-spec init" first.`,
    configNotObject: 'crumbs.json: must be an object',
    unknownKey: (key) => `crumbs.json: unknown key "${key}"`,
    invalid: (key, reason) => `crumbs.json: "${key}" has an invalid value: ${reason}`,
    // 12.2에 적힌 문구 그대로다. lang 값이 틀린 경우에는 메시지 언어를 고를 수 없어서 한 가지로 둔다.
    langInvalid: 'crumbs.json: "lang" must be "en" or "ko"',
    reasonString: 'must be a string',
    reasonNumber: 'must be a number',
    reasonOne: 'only 1 is allowed',
    reasonDot: '"." or an empty value is not allowed',
    reasonObject: 'must be an object',
    reasonUnknownHeading: (name) => `unknown heading key "${name}" (valid: ${VOCAB_KEYS.join(', ')})`,
    reasonStringArray: 'must be an array of strings',
    reasonInsideSpec: 'cannot be inside specDir',
    reasonInsideRoot: 'must stay inside the repository root',
    reasonRelativePath: 'must be a path relative to the spec root',

    logDocMissing: (path) => `log document not found: ${path}. Run "npx crumbs-spec init" first.`,
    logAdded: (path, heading) => `added: ${path} — ${heading}`,
    logDateFuture: (date) => `date is in the future: ${date}`,

    summary: (documents, errors, warnings) =>
      `crumbs check: ${counted(documents, 'document')}, ${counted(errors, 'error')}, ${counted(warnings, 'warning')}`,

    h1Title: 'first heading must be an H1',
    indexMissing: (path) => `index document not found: ${path}`,
    linkMissing: (rawTarget) => `link target not found: ${rawTarget}`,
    anchorMissing: (rawTarget) => `anchor not found: ${rawTarget}`,
    unreachable: (indexPath) => `unreachable from ${indexPath}`,
    sectionMissing: (title) => `"## ${title}" section is missing`,
    backlinkMissing: (parentPath) => `no link back to ${parentPath}`,
    backlinkOneWay: (sourcePath) => `linked from ${sourcePath} but no link back`,
    codePathMissing: (raw) => `code path not found: ${raw}`,
    duplicatePolicy: (name, others) => `duplicate policy "${name}": also in ${others}`,
    duplicatePolicyInDoc: (name, line) => `duplicate policy "${name}": already defined in this document at line ${line}`,
    noSpecSections: (target) =>
      `no spec sections found; if this is not a crumbs document, add "${target}" to "exclude" in crumbs.json`,
    unterminatedComment: 'HTML comment opened here is never closed; everything after it is invisible to check',
    spellingMismatch: (rawTarget, actual) => `link spelling differs from the file on disk: ${rawTarget} (file: ${actual})`,
    openQuestions: (count) => `${count} open question(s)`,
    logHeadingFormat: (text) => `log entry heading must be "## [YYYY-MM-DD] kind | title": "${text}"`,
    logKindUnknown: (kind, kinds) => `unknown kind "${kind}" (one of ${kinds})`,
    logDateInvalid: (date) => `date is not valid: ${date}`,
    logOrder: (previous, date) => `log entries are out of date order: ${date} is before ${previous}`,
    decisionLink: 'decision entry has no document link (expected: Document: [policy](domain/file.md#anchor))',
    flowMissing: (steps) => `current behavior has ${steps} steps but no flow diagram or table`,
    sectionFirst: (title) => `section order differs from the template: first section must be "## ${title}"`,
    sectionLast: (title) => `section order differs from the template: last section must be "## ${title}"`,
    sectionOrder: (before, after) =>
      `section order differs from the template: "## ${before}" must come before "## ${after}"`,
  },

  ko: {
    usage: '사용법: crumbs <init|check|log add> [옵션]  (자세히: crumbs --help)',
    help: `crumbs <command> [options]

명령
  init       crumbs.json, 스펙 인덱스, 로그, 템플릿, 원본 자료 디렉터리, 에이전트 지침 블록을 만든다
  check      스펙 링크 그래프와 문서 구조를 검사한다
  log add    로그 문서에 항목을 추가한다

공통 옵션
  --root <dir>      저장소 루트 (기본값: 현재 디렉터리)
  --lang <en|ko>    스펙 문서의 언어(init), 설정 파일을 읽기 전 오류의 언어 (기본값: en)
  -h, --help        도움말 표시
  -v, --version     버전 표시

init 옵션
  --spec-dir <dir>             저장소 루트 기준 스펙 루트 (기본값: docs/specs)
  --skills <claude|codex|all>  에이전트 스킬 4종을 설치한다 (.claude/skills/, .agents/skills/)

check 옵션
  --format <text|json>   출력 형식 (기본값: text)
  --config <path>        설정 파일 경로 (기본값: <root>/crumbs.json)
  crumbs.json의 exclude 항목은 스펙 루트 기준 경로이며, "/"로 끝나면 디렉터리를 제외한다

log add 옵션
  --kind <ingest|query|lint|drift|change|decision>   항목 종류 (필수)
  --body "<본문>"                                      제목 아래에 붙일 본문 (선택)
  --config <path>                                    설정 파일 경로 (기본값: <root>/crumbs.json)

예
  crumbs init --skills all
  crumbs log add --kind change "환불 기한을 14일로 변경" --body "결과: 환불 신청 기한 14일. 이유: 정책 변경 요청. 문서: [환불 기한](billing/refunds.md#환불-기한)"
`,
    unknownOption: (name) => `알 수 없는 옵션 "${name}"`,
    optionValue: (name) => `옵션 "${name}"의 값이 잘못됨`,
    optionRequired: (name) => `옵션 "${name}"이 없음`,
    unknownCommand: (name) => `알 수 없는 명령 "${name}"`,
    noCommand: '명령이 없음',
    noSubcommand: '하위 명령이 없음 (log add)',
    titleMissing: '제목이 없음',
    titleCount: '제목은 하나여야 함 (따옴표로 묶으세요)',
    titleEmpty: '제목이 비어 있음',
    titleLineBreak: '제목에 줄바꿈을 넣을 수 없음',
    bodyHeading: '본문에 제목 줄(#)을 넣을 수 없음',
    commentForbidden: '제목과 본문에 "<!--"를 넣을 수 없음',

    configKept: (option) => `참고: crumbs.json이 이미 있어 그 설정을 사용함 (${option} 무시)`,
    skipped: (path) => `이미 있음, 건너뜀: ${path}`,
    created: (path) => `생성: ${path}`,
    updated: (path) => `갱신: ${path}`,
    next: '다음: npx crumbs-spec check',
    claudeGuide: '안내: Claude Code가 crumbs 규칙을 읽도록 CLAUDE.md에 "@AGENTS.md"를 추가하세요',
    agentsMarkers: 'AGENTS.md: crumbs 표시가 짝이 맞지 않음',
    rootMissing: (root) => `저장소 루트 디렉터리를 찾을 수 없음: ${root}`,

    fileMissing: (where) => `${where}에 crumbs.json이 없음. 먼저 "npx crumbs-spec init"을 실행하세요.`,
    configNotObject: 'crumbs.json: 타입이 객체이어야 함',
    unknownKey: (key) => `crumbs.json: 알 수 없는 키 "${key}"`,
    invalid: (key, reason) => `crumbs.json: "${key}" 값이 잘못됨: ${reason}`,
    langInvalid: 'crumbs.json: "lang" 값이 잘못됨: en 또는 ko만 지원',
    reasonString: '타입이 문자열이어야 함',
    reasonNumber: '타입이 숫자이어야 함',
    reasonOne: '1만 허용',
    reasonDot: '"."이나 빈 값은 안 됨',
    reasonObject: '타입이 객체이어야 함',
    reasonUnknownHeading: (name) => `알 수 없는 어휘 키 "${name}" (가능한 키: ${VOCAB_KEYS.join(', ')})`,
    reasonStringArray: '타입이 문자열 배열이어야 함',
    reasonInsideSpec: 'specDir 안에 둘 수 없음',
    reasonInsideRoot: '저장소 루트 밖을 가리킬 수 없음',
    reasonRelativePath: '스펙 루트 기준 상대 경로여야 함',

    logDocMissing: (path) => `로그 문서가 없음: ${path}. 먼저 "npx crumbs-spec init"을 실행하세요.`,
    logAdded: (path, heading) => `추가: ${path} — ${heading}`,
    logDateFuture: (date) => `날짜가 미래임: ${date}`,

    summary: (documents, errors, warnings) => `crumbs check: 문서 ${documents}개, 오류 ${errors}개, 경고 ${warnings}개`,

    h1Title: '첫 제목은 H1이어야 함',
    indexMissing: (path) => `인덱스 문서가 없음: ${path}`,
    linkMissing: (rawTarget) => `링크 대상이 없음: ${rawTarget}`,
    anchorMissing: (rawTarget) => `앵커가 없음: ${rawTarget}`,
    unreachable: (indexPath) => `${indexPath}에서 도달할 수 없음`,
    sectionMissing: (title) => `"## ${title}" 절이 없음`,
    backlinkMissing: (parentPath) => `${parentPath}로 돌아가는 링크가 없음`,
    backlinkOneWay: (sourcePath) => `${sourcePath}에서 링크했지만 되돌아가는 링크가 없음`,
    codePathMissing: (raw) => `코드 경로가 없음: ${raw}`,
    duplicatePolicy: (name, others) => `중복 정책 "${name}": ${others}에도 있음`,
    duplicatePolicyInDoc: (name, line) => `중복 정책 "${name}": 이 문서의 ${line}줄에 이미 있음`,
    noSpecSections: (target) =>
      `스펙 절이 하나도 없음. crumbs 문서가 아니면 crumbs.json의 "exclude"에 "${target}"를 추가하세요`,
    unterminatedComment: '여기서 연 HTML 주석이 닫히지 않음: 이후 내용은 check가 볼 수 없음',
    spellingMismatch: (rawTarget, actual) => `링크 철자가 디스크의 파일과 다름: ${rawTarget} (파일: ${actual})`,
    openQuestions: (count) => `미해결 질문 ${count}개`,
    logHeadingFormat: (text) => `로그 항목 제목 형식이 틀림: "${text}" (형식: [YYYY-MM-DD] kind | 제목)`,
    logKindUnknown: (kind, kinds) => `알 수 없는 kind "${kind}" (${kinds} 중 하나)`,
    logDateInvalid: (date) => `날짜가 유효하지 않음: ${date}`,
    logOrder: (previous, date) => `이전 항목(${previous})보다 날짜가 앞섬: ${date}`,
    decisionLink: '결정 항목에 문서 링크가 없음 (형식: 문서: [정책](domain/file.md#앵커))',
    flowMissing: (steps) => `현재 동작이 ${steps}단계인데 흐름 도식이나 표가 없음`,
    sectionFirst: (title) => `첫 절은 "## ${title}"이어야 함`,
    sectionLast: (title) => `마지막 절은 "## ${title}"이어야 함`,
    sectionOrder: (before, after) => `"## ${before}" 절은 "## ${after}" 앞에 와야 함`,
  },
};
