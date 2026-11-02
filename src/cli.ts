#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { runCheck } from './check.js';
import { ConfigError, loadRepoConfig } from './config.js';
import { isLang, type Lang } from './headings.js';
import { runInit } from './init.js';
import { addLogEntry, assertLogDocument, hasHeadingLine, isLogKind, normalizeLogBody } from './log.js';
import { MESSAGES, type Messages } from './messages.js';
import { formatJson, formatText } from './report.js';

// 사용법 오류. 메시지 뒤에 한 줄 사용법을 덧붙여 stderr에 낸다(종료 코드 2). lang은 그 줄의 언어다.
class UsageError extends Error {
  readonly lang: Lang;

  constructor(message: string, lang: Lang) {
    super(message);
    this.lang = lang;
  }
}

const OPTIONS = {
  root: { type: 'string' },
  help: { type: 'boolean', short: 'h' },
  version: { type: 'boolean', short: 'v' },
  lang: { type: 'string' },
  'spec-dir': { type: 'string' },
  format: { type: 'string' },
  config: { type: 'string' },
  kind: { type: 'string' },
  body: { type: 'string' },
  skills: { type: 'string' },
} as const;

// 명령마다 받는 옵션(6.4.4 표). --root와 --lang은 모든 명령이 받으므로 여기에 없다.
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

// 설정 파일을 읽기 전의 오류 언어. --lang 값이 ko이면 ko이고, 그 밖에는 en이다.
function preLang(argv: string[]): Lang {
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--') break;
    if (argv[i] === '--lang') return argv[i + 1] === 'ko' ? 'ko' : 'en';
    if (argv[i].startsWith('--lang=')) return argv[i].slice('--lang='.length) === 'ko' ? 'ko' : 'en';
  }
  return 'en';
}

// parseArgs 오류를 사용법 오류로 바꾼다. 옵션 이름은 오류 메시지에서 꺼낸다.
function toUsageError(error: unknown, lang: Lang): Error {
  if (!(error instanceof Error)) return new UsageError(String(error), lang);
  const code = (error as { code?: string }).code;
  const name = /(--?[A-Za-z][\w-]*)/.exec(error.message)?.[1] ?? error.message;
  const m = MESSAGES[lang];
  if (code === 'ERR_PARSE_ARGS_UNKNOWN_OPTION') return new UsageError(m.unknownOption(name), lang);
  if (code === 'ERR_PARSE_ARGS_INVALID_OPTION_VALUE') return new UsageError(m.optionValue(name), lang);
  return error;
}

function parse(argv: string[], lang: Lang) {
  try {
    return parseArgs({ args: argv, options: OPTIONS, allowPositionals: true, strict: true });
  } catch (error) {
    throw toUsageError(error, lang);
  }
}

// 명령이 받지 않는 옵션을 "알 수 없는 옵션"으로 거부한다.
function rejectForeignOptions(values: Values, allowed: readonly ScopedOption[], lang: Lang): void {
  for (const name of SCOPED_OPTIONS) {
    if (values[name] !== undefined && !allowed.includes(name)) {
      throw new UsageError(MESSAGES[lang].unknownOption(`--${name}`), lang);
    }
  }
}

// --lang 값을 검사한다. 옵션이 없으면 undefined다.
function langOption(value: string | undefined, lang: Lang): Lang | undefined {
  if (value === undefined) return undefined;
  if (isLang(value)) return value;
  throw new UsageError(MESSAGES[lang].optionValue('--lang'), lang);
}

// --skills 값을 검사한다. 옵션이 없으면 undefined다.
function skillsOption(value: string | undefined, lang: Lang): 'claude' | 'codex' | 'all' | undefined {
  if (value === undefined) return undefined;
  if (value === 'claude' || value === 'codex' || value === 'all') return value;
  throw new UsageError(MESSAGES[lang].optionValue('--skills'), lang);
}

// log add(6.4). 검증은 6.4.2 표의 순서대로 하고, 처음 걸린 조건만 보고한다.
// 설정을 읽기 전 조건은 명령줄의 언어로, 설정을 읽은 뒤 조건은 설정의 lang으로 낸다.
function logAdd(root: string, values: Values, args: string[], lang: Lang): number {
  const m = MESSAGES[lang];
  if (values.kind === undefined) throw new UsageError(m.optionRequired('--kind'), lang);
  const kind = values.kind;
  if (!isLogKind(kind)) throw new UsageError(m.optionValue('--kind'), lang);
  if (args.length === 0) throw new UsageError(m.titleMissing, lang);
  if (args.length > 1) throw new UsageError(m.titleCount, lang);
  const [rawTitle] = args;
  if (rawTitle.trim() === '') throw new UsageError(m.titleEmpty, lang);
  if (/[\r\n]/.test(rawTitle)) throw new UsageError(m.titleLineBreak, lang);
  const body = values.body === undefined ? undefined : normalizeLogBody(values.body);
  if (body !== undefined && hasHeadingLine(body)) throw new UsageError(m.bodyHeading, lang);
  if (rawTitle.includes('<!--') || (body ?? '').includes('<!--')) throw new UsageError(m.commentForbidden, lang);

  const config = loadRepoConfig(root, values.config, lang);
  assertLogDocument(root, config);
  rejectForeignOptions(values, LOG_ADD_OPTIONS, config.lang);
  process.stdout.write(`${addLogEntry(root, config, kind, rawTitle.trim(), body)}\n`);
  return 0;
}

function run(argv: string[]): number {
  const lang = preLang(argv);
  const m: Messages = MESSAGES[lang];
  const { values, positionals } = parse(argv, lang);
  const specLang = langOption(values.lang, lang);

  if (values.help) {
    process.stdout.write(m.help);
    return 0;
  }
  if (values.version) {
    process.stdout.write(`${readVersion()}\n`);
    return 0;
  }

  if (positionals.length === 0) throw new UsageError(m.noCommand, lang);
  const [command, ...rest] = positionals;
  if (command === 'log') {
    if (rest[0] === undefined) throw new UsageError(m.noSubcommand, lang);
    if (rest[0] !== 'add') throw new UsageError(m.unknownCommand(`log ${rest[0]}`), lang);
  } else if (command !== 'init' && command !== 'check') {
    throw new UsageError(m.unknownCommand(command), lang);
  } else if (rest.length > 0) {
    throw new UsageError(m.unknownCommand(rest[0]), lang);
  }
  if (values.root === '') throw new UsageError(m.optionValue('--root'), lang);
  const root = resolve(values.root ?? '.');

  if (command === 'log') return logAdd(root, values, rest.slice(1), lang);

  if (command === 'init') {
    rejectForeignOptions(values, INIT_OPTIONS, lang);
    const skills = skillsOption(values.skills, lang);
    process.stdout.write(`${runInit(root, values['spec-dir'], skills, specLang).join('\n')}\n`);
    return 0;
  }

  rejectForeignOptions(values, CHECK_OPTIONS, lang);
  const format = values.format ?? 'text';
  if (format !== 'text' && format !== 'json') throw new UsageError(m.optionValue('--format'), lang);
  const config = loadRepoConfig(root, values.config, lang);
  const report = runCheck(root, config);
  process.stdout.write(format === 'json' ? formatJson(report) : formatText(report, config.lang));
  return report.ok ? 0 : 1;
}

function main(): void {
  let code: number;
  try {
    code = run(process.argv.slice(2));
  } catch (error) {
    if (error instanceof UsageError) {
      process.stderr.write(`crumbs: ${error.message}\n${MESSAGES[error.lang].usage}\n`);
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
