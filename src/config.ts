import { existsSync, readFileSync } from 'node:fs';
import { join, posix, resolve } from 'node:path';
import { VOCAB_KEYS, type VocabKey } from './headings.js';
import type { Config } from './model.js';

// 설정 오류. 메시지는 사용자에게 그대로 보여 준다(stderr, 종료 코드 2).
export class ConfigError extends Error {}

const TOP_LEVEL_KEYS = ['version', 'specDir', 'index', 'overview', 'log', 'lang', 'headings', 'exclude', 'codeRoot', 'rawDir'];

// specDir/rawDir를 저장소 루트 기준 정규화 경로로 만든다. 빈 값과 "."은 "."이 된다.
function normRel(path: string): string {
  return posix.normalize(path).replace(/\/+$/, '') || '.';
}

export function defaultConfig(specDir?: string): Config {
  return {
    version: 1,
    specDir: specDir ?? 'docs/specs',
    index: 'index.md',
    overview: 'overview.md',
    log: 'log.md',
    lang: 'ko',
    headings: {},
    exclude: ['templates/'],
    codeRoot: '.',
    rawDir: 'docs/raw',
  };
}

function fail(key: string, reason: string): never {
  throw new ConfigError(`crumbs.json: "${key}" 값이 잘못됨: ${reason}`);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function optString(obj: Record<string, unknown>, key: string, fallback: string): string {
  const value = obj[key];
  if (value === undefined) return fallback;
  if (typeof value !== 'string') fail(key, '타입이 문자열이어야 함');
  return value;
}

function validate(raw: unknown): Config {
  if (!isPlainObject(raw)) throw new ConfigError('crumbs.json: 타입이 객체이어야 함');
  for (const key of Object.keys(raw)) {
    if (!TOP_LEVEL_KEYS.includes(key)) throw new ConfigError(`crumbs.json: 알 수 없는 키 "${key}"`);
  }

  const version = raw.version;
  if (version === undefined) fail('version', '1만 허용');
  if (typeof version !== 'number') fail('version', '타입이 숫자이어야 함');
  if (version !== 1) fail('version', '1만 허용');

  const specDir = normRel(optString(raw, 'specDir', 'docs/specs'));
  if (specDir === '.') fail('specDir', '"."이나 빈 값은 안 됨');

  const index = optString(raw, 'index', 'index.md');
  const overview = optString(raw, 'overview', 'overview.md');
  const log = optString(raw, 'log', 'log.md');

  const lang = optString(raw, 'lang', 'ko');
  if (lang !== 'ko') fail('lang', '1단계는 "ko"만 지원');

  const headings: Config['headings'] = {};
  if (raw.headings !== undefined) {
    const overrides = raw.headings;
    if (!isPlainObject(overrides)) fail('headings', '타입이 객체이어야 함');
    for (const [name, text] of Object.entries(overrides)) {
      if (!(VOCAB_KEYS as readonly string[]).includes(name)) fail('headings', `알 수 없는 어휘 키 "${name}"`);
      if (typeof text !== 'string') fail(`headings.${name}`, '타입이 문자열이어야 함');
      headings[name as VocabKey] = text;
    }
  }

  let exclude: string[] = ['templates/'];
  if (raw.exclude !== undefined) {
    const value = raw.exclude;
    if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
      fail('exclude', '타입이 문자열 배열이어야 함');
    }
    exclude = value as string[];
  }

  const codeRoot = optString(raw, 'codeRoot', '.');

  const rawDir = normRel(optString(raw, 'rawDir', 'docs/raw'));
  if (rawDir === '.') fail('rawDir', '"."이나 빈 값은 안 됨');
  if (rawDir === specDir || rawDir.startsWith(`${specDir}/`)) fail('rawDir', 'specDir 안에 둘 수 없음');

  return {
    version: 1,
    specDir,
    index,
    overview,
    log,
    lang: 'ko',
    headings,
    exclude,
    codeRoot,
    rawDir,
  };
}

export function parseConfig(text: string): Config {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    throw new ConfigError(`crumbs.json: ${error instanceof Error ? error.message : String(error)}`);
  }
  return validate(raw);
}

// missingLabel은 파일이 없을 때 메시지 앞에 붙는 위치 표시다(기본 설정이면 저장소 루트).
export function loadConfig(configPath: string, missingLabel: string): Config {
  if (!existsSync(configPath)) {
    throw new ConfigError(`${missingLabel}에 crumbs.json이 없음. 먼저 "crumbs init"을 실행하세요.`);
  }
  return parseConfig(readFileSync(configPath, 'utf8'));
}

// 저장소 설정을 읽는다. configPath가 없으면 저장소 루트의 crumbs.json이다(check와 log add가 함께 쓴다).
export function loadRepoConfig(root: string, configPath?: string): Config {
  return configPath === undefined
    ? loadConfig(join(root, 'crumbs.json'), root)
    : loadConfig(resolve(configPath), resolve(configPath));
}
