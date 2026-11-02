#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { checkRepo } from './check.js';
import { ConfigError, loadRepoConfig } from './config.js';
import { runInit } from './init.js';
import { addLogEntry, assertLogDocument, hasHeadingLine, isLogKind, normalizeLogBody } from './log.js';
import { formatJson, formatText } from './report.js';

const USAGE = '사용법: crumbs <init|check|log add> [옵션]  (자세히: crumbs --help)';

const HELP = `crumbs <command> [options]

명령
  init       crumbs.json, 스펙 인덱스, 로그, 템플릿, 원본 자료 디렉터리, 에이전트 지침 블록을 만든다
  check      스펙 링크 그래프와 문서 구조를 검사한다
  log add    로그 문서에 항목을 추가한다

공통 옵션
  --root <dir>      저장소 루트 (기본값: 현재 디렉터리)
  -h, --help        도움말 표시
  -v, --version     버전 표시

init 옵션
  --spec-dir <dir>             저장소 루트 기준 스펙 루트 (기본값: docs/specs)
  --skills <claude|codex|all>  에이전트 스킬 4종을 설치한다 (.claude/skills/, .agents/skills/)

check 옵션
  --format <text|json>   출력 형식 (기본값: text)
  --config <path>        설정 파일 경로 (기본값: <root>/crumbs.json)

log add 옵션
  --kind <ingest|query|lint|drift|change|decision>   항목 종류 (필수)
  --body "<본문>"                                      제목 아래에 붙일 본문 (선택)
  --config <path>                                    설정 파일 경로 (기본값: <root>/crumbs.json)

예
  crumbs init --skills all
  crumbs log add --kind change "환불 기한을 14일로 변경" --body "결과: 환불 신청 기한 14일. 이유: 정책 변경 요청. 문서: [환불 기한](billing/refunds.md#환불-기한)"
`;

// 사용법 오류. 메시지 뒤에 한 줄 사용법을 덧붙여 stderr에 낸다(종료 코드 2).
class UsageError extends Error {}

const OPTIONS = {
  root: { type: 'string' },
  help: { type: 'boolean', short: 'h' },
  version: { type: 'boolean', short: 'v' },
  'spec-dir': { type: 'string' },
  format: { type: 'string' },
  config: { type: 'string' },
  kind: { type: 'string' },
  body: { type: 'string' },
  skills: { type: 'string' },
} as const;

// 명령마다 받는 옵션(6.4.4 표). --root는 모든 명령이 받으므로 여기에 없다.
const SCOPED_OPTIONS = ['spec-dir', 'format', 'config', 'kind', 'body', 'skills'] as const;
type ScopedOption = (typeof SCOPED_OPTIONS)[number];
const INIT_OPTIONS: readonly ScopedOption[] = ['spec-dir', 'skills'];
const CHECK_OPTIONS: readonly ScopedOption[] = ['format', 'config'];
const LOG_ADD_OPTIONS: readonly ScopedOption[] = ['config', 'kind', 'body'];

type Values = ReturnType<typeof parse>['values'];

function readVersion(): string {
  const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { version: string };
  return pkg.version;
}

// parseArgs 오류를 한국어 사용법 오류로 바꾼다. 옵션 이름은 오류 메시지에서 꺼낸다.
function toUsageError(error: unknown): Error {
  if (!(error instanceof Error)) return new UsageError(String(error));
  const code = (error as { code?: string }).code;
  const name = /(--?[A-Za-z][\w-]*)/.exec(error.message)?.[1] ?? error.message;
  if (code === 'ERR_PARSE_ARGS_UNKNOWN_OPTION') return new UsageError(`알 수 없는 옵션 "${name}"`);
  if (code === 'ERR_PARSE_ARGS_INVALID_OPTION_VALUE') return new UsageError(`옵션 "${name}"의 값이 잘못됨`);
  return error;
}

function parse(argv: string[]) {
  try {
    return parseArgs({ args: argv, options: OPTIONS, allowPositionals: true, strict: true });
  } catch (error) {
    throw toUsageError(error);
  }
}

// 명령이 받지 않는 옵션을 "알 수 없는 옵션"으로 거부한다.
function rejectForeignOptions(values: Values, allowed: readonly ScopedOption[]): void {
  for (const name of SCOPED_OPTIONS) {
    if (values[name] !== undefined && !allowed.includes(name)) {
      throw new UsageError(`알 수 없는 옵션 "--${name}"`);
    }
  }
}

// --skills 값을 검사한다. 옵션이 없으면 undefined다.
function skillsOption(value: string | undefined): 'claude' | 'codex' | 'all' | undefined {
  if (value === undefined) return undefined;
  if (value === 'claude' || value === 'codex' || value === 'all') return value;
  throw new UsageError('옵션 "--skills"의 값이 잘못됨');
}

// log add(6.4). 검증은 6.4.2 표의 순서대로 하고, 처음 걸린 조건만 보고한다.
function logAdd(root: string, values: Values, args: string[]): number {
  if (values.kind === undefined) throw new UsageError('옵션 "--kind"이 없음');
  const kind = values.kind;
  if (!isLogKind(kind)) throw new UsageError('옵션 "--kind"의 값이 잘못됨');
  if (args.length === 0) throw new UsageError('제목이 없음');
  if (args.length > 1) throw new UsageError('제목은 하나여야 함 (따옴표로 묶으세요)');
  const [rawTitle] = args;
  if (rawTitle.trim() === '') throw new UsageError('제목이 비어 있음');
  if (/[\r\n]/.test(rawTitle)) throw new UsageError('제목에 줄바꿈을 넣을 수 없음');
  const body = values.body === undefined ? undefined : normalizeLogBody(values.body);
  if (body !== undefined && hasHeadingLine(body)) throw new UsageError('본문에 제목 줄(#)을 넣을 수 없음');

  const config = loadRepoConfig(root, values.config);
  assertLogDocument(root, config);
  rejectForeignOptions(values, LOG_ADD_OPTIONS);
  process.stdout.write(`${addLogEntry(root, config, kind, rawTitle.trim(), body)}\n`);
  return 0;
}

function run(argv: string[]): number {
  const { values, positionals } = parse(argv);

  if (values.help) {
    process.stdout.write(HELP);
    return 0;
  }
  if (values.version) {
    process.stdout.write(`${readVersion()}\n`);
    return 0;
  }

  if (positionals.length === 0) throw new UsageError('명령이 없음');
  const [command, ...rest] = positionals;
  if (command === 'log') {
    if (rest[0] === undefined) throw new UsageError('하위 명령이 없음 (log add)');
    if (rest[0] !== 'add') throw new UsageError(`알 수 없는 명령 "log ${rest[0]}"`);
  } else if (command !== 'init' && command !== 'check') {
    throw new UsageError(`알 수 없는 명령 "${command}"`);
  } else if (rest.length > 0) {
    throw new UsageError(`알 수 없는 명령 "${rest[0]}"`);
  }
  if (values.root === '') throw new UsageError('옵션 "--root"의 값이 잘못됨');
  const root = resolve(values.root ?? '.');

  if (command === 'log') return logAdd(root, values, rest.slice(1));

  if (command === 'init') {
    rejectForeignOptions(values, INIT_OPTIONS);
    const skills = skillsOption(values.skills);
    process.stdout.write(`${runInit(root, values['spec-dir'], skills).join('\n')}\n`);
    return 0;
  }

  rejectForeignOptions(values, CHECK_OPTIONS);
  const format = values.format ?? 'text';
  if (format !== 'text' && format !== 'json') throw new UsageError('옵션 "--format"의 값이 잘못됨');
  const report = checkRepo(root, values.config);
  process.stdout.write(format === 'json' ? formatJson(report) : formatText(report));
  return report.ok ? 0 : 1;
}

function main(): void {
  let code: number;
  try {
    code = run(process.argv.slice(2));
  } catch (error) {
    if (error instanceof UsageError) {
      process.stderr.write(`crumbs: ${error.message}\n${USAGE}\n`);
    } else if (error instanceof ConfigError) {
      process.stderr.write(`${error.message}\n`);
    } else {
      process.stderr.write(`crumbs: ${error instanceof Error ? error.message : String(error)}\n`);
    }
    code = 2;
  }
  process.exitCode = code;
}

main();
