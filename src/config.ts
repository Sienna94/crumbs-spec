import { existsSync, readFileSync } from 'node:fs';
import { join, posix, resolve } from 'node:path';
import { VOCAB_KEYS, isLang, type Lang, type VocabKey } from './headings.js';
import { MESSAGES, type Messages } from './messages.js';
import type { Config } from './model.js';

// 설정 오류. 메시지는 사용자에게 그대로 보여 준다(stderr, 종료 코드 2).
export class ConfigError extends Error {}

const TOP_LEVEL_KEYS = ['version', 'specDir', 'index', 'overview', 'log', 'lang', 'headings', 'exclude', 'codeRoot', 'rawDir'];

// specDir/rawDir를 저장소 루트 기준 정규화 경로로 만든다. 빈 값과 "."은 "."이 된다.
function normRel(path: string): string {
  return posix.normalize(path).replace(/\/+$/, '') || '.';
}

export function defaultConfig(specDir?: string, lang: Lang = 'en'): Config {
  return {
    version: 1,
    specDir: specDir ?? 'docs/specs',
    index: 'index.md',
    overview: 'overview.md',
    log: 'log.md',
    lang,
    headings: {},
    exclude: ['templates/'],
    codeRoot: '.',
    rawDir: 'docs/raw',
  };
}

// 설정 값 오류. 메시지 언어는 validate가 정한다.
function fail(m: Messages, key: string, reason: string): never {
  throw new ConfigError(m.invalid(key, reason));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// 설정 내용의 오류 메시지 언어. 값이 en·ko인 lang을 쓰고, 그 밖이면 호출자가 준 언어(--lang 또는 en)를 쓴다.
function messageLang(raw: unknown, fallback: Lang): Lang {
  if (isPlainObject(raw) && typeof raw.lang === 'string' && isLang(raw.lang)) return raw.lang;
  return fallback;
}

function optString(m: Messages, obj: Record<string, unknown>, key: string, fallback: string): string {
  const value = obj[key];
  if (value === undefined) return fallback;
  if (typeof value !== 'string') fail(m, key, m.reasonString);
  return value;
}

function validate(raw: unknown, fallback: Lang): Config {
  const m = MESSAGES[messageLang(raw, fallback)];
  if (!isPlainObject(raw)) throw new ConfigError(m.configNotObject);
  for (const key of Object.keys(raw)) {
    if (!TOP_LEVEL_KEYS.includes(key)) throw new ConfigError(m.unknownKey(key));
  }

  const version = raw.version;
  if (version === undefined) fail(m, 'version', m.reasonOne);
  if (typeof version !== 'number') fail(m, 'version', m.reasonNumber);
  if (version !== 1) fail(m, 'version', m.reasonOne);

  const specDir = normRel(optString(m, raw, 'specDir', 'docs/specs'));
  if (specDir === '.') fail(m, 'specDir', m.reasonDot);

  const index = optString(m, raw, 'index', 'index.md');
  const overview = optString(m, raw, 'overview', 'overview.md');
  const log = optString(m, raw, 'log', 'log.md');

  const lang = optString(m, raw, 'lang', 'en');
  if (!isLang(lang)) throw new ConfigError(m.langInvalid);

  const headings: Config['headings'] = {};
  if (raw.headings !== undefined) {
    const overrides = raw.headings;
    if (!isPlainObject(overrides)) fail(m, 'headings', m.reasonObject);
    for (const [name, text] of Object.entries(overrides)) {
      if (!(VOCAB_KEYS as readonly string[]).includes(name)) fail(m, 'headings', m.reasonUnknownHeading(name));
      if (typeof text !== 'string') fail(m, `headings.${name}`, m.reasonString);
      headings[name as VocabKey] = text;
    }
  }

  let exclude: string[] = ['templates/'];
  if (raw.exclude !== undefined) {
    const value = raw.exclude;
    if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
      fail(m, 'exclude', m.reasonStringArray);
    }
    exclude = value as string[];
  }

  const codeRoot = optString(m, raw, 'codeRoot', '.');

  const rawDir = normRel(optString(m, raw, 'rawDir', 'docs/raw'));
  if (rawDir === '.') fail(m, 'rawDir', m.reasonDot);
  if (rawDir === specDir || rawDir.startsWith(`${specDir}/`)) fail(m, 'rawDir', m.reasonInsideSpec);

  return {
    version: 1,
    specDir,
    index,
    overview,
    log,
    lang,
    headings,
    exclude,
    codeRoot,
    rawDir,
  };
}

// fallback은 설정 내용이 lang으로 언어를 정하지 못할 때 쓰는 언어다(--lang 값 또는 en).
export function parseConfig(text: string, fallback: Lang = 'en'): Config {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    throw new ConfigError(`crumbs.json: ${error instanceof Error ? error.message : String(error)}`);
  }
  return validate(raw, fallback);
}

// missingLabel은 파일이 없을 때 메시지 앞에 붙는 위치 표시다(기본 설정이면 저장소 루트).
export function loadConfig(configPath: string, missingLabel: string, fallback: Lang = 'en'): Config {
  if (!existsSync(configPath)) {
    throw new ConfigError(MESSAGES[fallback].fileMissing(missingLabel));
  }
  return parseConfig(readFileSync(configPath, 'utf8'), fallback);
}

// 저장소 설정을 읽는다. configPath가 없으면 저장소 루트의 crumbs.json이다(check와 log add가 함께 쓴다).
export function loadRepoConfig(root: string, configPath?: string, fallback: Lang = 'en'): Config {
  return configPath === undefined
    ? loadConfig(join(root, 'crumbs.json'), root, fallback)
    : loadConfig(resolve(configPath), resolve(configPath), fallback);
}
