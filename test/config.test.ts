import assert from 'node:assert/strict';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { ConfigError, loadConfig, parseConfig } from '../src/config.js';
import { checkRepo } from '../src/check.js';
import { tempDir, makeRepo, cleanup, baseGraph, DEFAULT_CONFIG } from './helpers.js';

after(cleanup);

// 설정 텍스트를 읽어 오류 메시지를 돌려준다. 오류가 나지 않으면 테스트를 실패시킨다.
function messageOf(text: string): string {
  try {
    parseConfig(text);
  } catch (error) {
    assert.ok(error instanceof ConfigError, `ConfigError여야 함: ${String(error)}`);
    return error.message;
  }
  assert.fail(`설정 오류가 나야 함: ${text}`);
}

test('7. 설정: 키가 없으면 기본값을 쓴다', () => {
  const root = makeRepo({ 'crumbs.json': '{"version": 1}\n' });
  const config = loadConfig(join(root, 'crumbs.json'), root);
  assert.equal(config.specDir, 'docs/specs');
  assert.equal(config.index, 'index.md');
  assert.equal(config.overview, 'overview.md');
  assert.equal(config.log, 'log.md');
  assert.equal(config.lang, 'en');
  assert.deepEqual(config.exclude, ['templates/']);
  assert.equal(config.codeRoot, '.');
  assert.equal(config.rawDir, 'docs/raw');
  assert.deepEqual(config.headings, {});
});

test('8. 설정 오류: 파일 없음, JSON 오류, 알 수 없는 키, 잘못된 값을 키 이름과 함께 거부한다', () => {
  const empty = tempDir();
  assert.throws(
    () => loadConfig(join(empty, 'crumbs.json'), empty),
    (error: unknown) => error instanceof ConfigError && error.message.includes('crumbs init'),
  );
  assert.ok(messageOf('{').startsWith('crumbs.json: '));
  assert.equal(messageOf('{"version":1,"foo":1}'), 'crumbs.json: unknown key "foo"');
  assert.equal(messageOf('{"version":2}'), 'crumbs.json: "version" has an invalid value: only 1 is allowed');
  assert.equal(
    messageOf('{"version":1,"headings":{"nope":"x"}}'),
    'crumbs.json: "headings" has an invalid value: unknown heading key "nope"',
  );
  assert.equal(
    messageOf('{"version":1,"specDir":"."}'),
    'crumbs.json: "specDir" has an invalid value: "." or an empty value is not allowed',
  );
  assert.equal(
    messageOf('{"version":1,"rawDir":"docs/specs/raw"}'),
    'crumbs.json: "rawDir" has an invalid value: cannot be inside specDir',
  );
});

test('70. lang: 기본값은 en이고 en과 ko만 받으며, 다른 값은 12.2의 문구로 거부한다', () => {
  assert.equal(parseConfig('{"version":1}').lang, 'en');
  assert.equal(parseConfig('{"version":1,"lang":"en"}').lang, 'en');
  assert.equal(parseConfig('{"version":1,"lang":"ko"}').lang, 'ko');
  assert.equal(messageOf('{"version":1,"lang":"fr"}'), 'crumbs.json: "lang" 값이 잘못됨: en 또는 ko만 지원');
  assert.equal(messageOf('{"version":1,"lang":5}'), 'crumbs.json: "lang" has an invalid value: must be a string');
});

test('71. 설정 오류 언어: lang이 ko인 설정의 오류는 한국어로, lang이 없으면 영어로 낸다', () => {
  assert.equal(messageOf('{"version":2,"lang":"ko"}'), 'crumbs.json: "version" 값이 잘못됨: 1만 허용');
  assert.equal(messageOf('{"version":2,"lang":"ko","foo":1}'), 'crumbs.json: 알 수 없는 키 "foo"');
  assert.equal(messageOf('{"version":2}'), 'crumbs.json: "version" has an invalid value: only 1 is allowed');
});

test('9. headings 재정의: 필수 제목 텍스트를 바꾸고, 바뀐 제목을 쓴 문서를 받아들인다', () => {
  const withOverride = baseGraph();
  withOverride['crumbs.json'] = `${JSON.stringify({ ...DEFAULT_CONFIG, headings: { evidence: '출처' } }, null, 2)}\n`;
  withOverride['docs/specs/auth/login.md'] = withOverride['docs/specs/auth/login.md'].replace('## 근거', '## 출처');
  assert.deepEqual(checkRepo(makeRepo(withOverride)).findings, []);

  // 기본 제목 "근거"를 그대로 둔 문서는 이제 필수 절이 없다고 나온다.
  const stale = baseGraph();
  stale['crumbs.json'] = `${JSON.stringify({ ...DEFAULT_CONFIG, headings: { evidence: '출처' } }, null, 2)}\n`;
  const messages = checkRepo(makeRepo(stale)).findings.map((finding) => finding.message);
  assert.deepEqual(messages, ['"## 출처" 절이 없음']);
});
