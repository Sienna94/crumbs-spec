import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { after, test } from 'node:test';
import {
  baseGraph,
  cleanup,
  makeRepo,
  packageVersionString,
  runCli,
  tempDir,
} from './helpers.js';

after(cleanup);

test('24. 유효한 픽스처(문서 3개): 종료 0이고 stdout은 발견 없는 요약 한 줄이다', () => {
  const root = makeRepo({
    'docs/specs/index.md': '# 스펙 인덱스\n\n## 도메인\n- [인증](auth/overview.md) — 로그인\n',
    'docs/specs/auth/overview.md':
      '# 인증\n\n## 목적\n인증 영역.\n\n## 문서 목록\n- [로그인](login.md) — 로그인 세션\n\n## 관련 문서\n- [스펙 인덱스](../index.md)\n',
    'docs/specs/auth/login.md':
      '# 로그인 세션\n\n## 목적\n로그인 세션.\n\n## 현재 동작\n로그인하면 세션이 시작된다.\n\n## 근거\n- `src/auth/session.ts` — 세션 생성\n\n## 관련 문서\n- [인증 개요](overview.md)\n',
    'src/auth/session.ts': 'export {};\n',
  });
  const result = runCli(['check'], root);
  assert.equal(result.code, 0);
  assert.equal(result.stdout, 'crumbs check: 문서 3개, 오류 0개, 경고 0개\n');
});

test('25. 깨진 픽스처: 종료 1이고 발견 줄은 "경로[:줄] 심각도 규칙: 메시지" 형식이다', () => {
  const files = baseGraph();
  files['docs/specs/auth/login.md'] += '- [없음](missing.md)\n';
  const result = runCli(['check'], makeRepo(files));
  assert.equal(result.code, 1);
  const findingLines = result.stdout.split('\n').filter((line) => line !== '' && !line.startsWith('crumbs check:'));
  assert.ok(findingLines.length >= 1);
  for (const line of findingLines) {
    assert.match(line, /^docs\/specs\/.+?:\d+ (error|warning) [a-z-]+: .+$/);
  }
  assert.ok(result.stdout.endsWith('crumbs check: 문서 4개, 오류 1개, 경고 0개\n'));
});

test('26. --format json: 파싱되고 version은 1, ok는 false이며 summary 수가 findings와 일치한다', () => {
  const files = baseGraph();
  files['docs/specs/auth/login.md'] += '- [없음](missing.md)\n';
  files['docs/specs/auth/login.md'] += '- [확인 필요] 아직 모르는 정책\n';
  const result = runCli(['check', '--format', 'json'], makeRepo(files));
  assert.equal(result.code, 1);
  const report = JSON.parse(result.stdout) as {
    version: number;
    ok: boolean;
    summary: { documents: number; errors: number; warnings: number };
    findings: Array<{ severity: string }>;
  };
  assert.equal(report.version, 1);
  assert.equal(report.ok, false);
  assert.equal(report.summary.documents, 4);
  assert.equal(report.summary.errors, report.findings.filter((f) => f.severity === 'error').length);
  assert.equal(report.summary.warnings, report.findings.filter((f) => f.severity === 'warning').length);
  assert.ok(report.summary.errors >= 1 && report.summary.warnings === 1);
});

test('27. 명령줄 오류: 설정 없음은 init 안내와 함께 종료 2, 알 수 없는 명령과 옵션은 종료 2, --version과 --help는 종료 0이다', () => {
  const empty = tempDir();
  const noConfig = runCli(['check'], empty);
  assert.equal(noConfig.code, 2);
  assert.ok(noConfig.stderr.includes('npx crumbs-spec init'));

  const root = makeRepo(baseGraph());
  const unknownCommand = runCli(['--lang', 'ko', 'frobnicate'], root);
  assert.equal(unknownCommand.code, 2);
  assert.ok(unknownCommand.stderr.includes('알 수 없는 명령'));
  assert.ok(unknownCommand.stderr.includes('사용법: crumbs <init|check|log add> [옵션]  (자세히: crumbs --help)'));

  const unknownOption = runCli(['--lang', 'ko', 'check', '--bogus'], root);
  assert.equal(unknownOption.code, 2);
  assert.ok(unknownOption.stderr.includes('알 수 없는 옵션 "--bogus"'));

  const version = runCli(['--version'], root);
  assert.equal(version.code, 0);
  assert.equal(version.stdout.trim(), packageVersionString());

  const help = runCli(['--lang', 'ko', '--help'], root);
  assert.equal(help.code, 0);
  assert.ok(help.stdout.includes('명령'));
  assert.ok(help.stdout.includes('check 옵션'));
  assert.ok(help.stdout.includes('exclude 항목은 스펙 루트 기준 경로이며'));
});

test('28. --root <dir>: 다른 작업 디렉터리에서도 지정한 저장소를 검사한다', () => {
  const root = makeRepo(baseGraph());
  const elsewhere = tempDir();
  writeFileSync(join(elsewhere, 'README.txt'), '관계없는 파일\n');
  const result = runCli(['check', '--root', root], elsewhere);
  assert.equal(result.code, 0);
  assert.ok(result.stdout.includes('문서 4개'));
});
