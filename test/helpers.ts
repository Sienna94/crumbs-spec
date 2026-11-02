import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildGraph } from '../src/graph.js';
import { loadConfig } from '../src/config.js';
import type { Finding } from '../src/model.js';

const here = dirname(fileURLToPath(import.meta.url));
const cliPath = join(here, '..', 'src', 'cli.js');
const packageVersion = (JSON.parse(readFileSync(join(here, '..', '..', 'package.json'), 'utf8')) as { version: string })
  .version;

export const DEFAULT_CONFIG = {
  version: 1,
  specDir: 'docs/specs',
  index: 'index.md',
  overview: 'overview.md',
  log: 'log.md',
  lang: 'ko',
  headings: {},
  exclude: ['templates/'],
  codeRoot: '.',
  rawDir: 'docs/raw',
};

const createdDirs: string[] = [];

// 테스트용 빈 임시 디렉터리를 os.tmpdir() 아래에 만든다. removeTempDirs()가 지운다.
export function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'crumbs-'));
  createdDirs.push(dir);
  return dir;
}

export function removeTempDirs(): void {
  for (const dir of createdDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
}

export function writeFiles(root: string, files: Record<string, string>): void {
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(root, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  }
}

// 파일 맵으로 임시 저장소를 만든다. crumbs.json이 맵에 없으면 기본 설정을 쓴다.
export function makeRepo(files: Record<string, string>): string {
  const root = tempDir();
  const withConfig = {
    'crumbs.json': `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`,
    ...files,
  };
  writeFiles(root, withConfig);
  return root;
}

export function runCli(args: string[], cwd: string): { code: number; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, [cliPath, ...args], { cwd, encoding: 'utf8' });
  return { code: result.status ?? -1, stdout: result.stdout, stderr: result.stderr };
}

export function packageVersionString(): string {
  return packageVersion;
}

// 저장소 루트의 crumbs.json을 읽어 그래프를 만든다.
export function graphOf(root: string) {
  return buildGraph(root, loadConfig(join(root, 'crumbs.json'), root));
}

// 유효한 픽스처: 인덱스 → 개요 → 상세, 인덱스 → 로그. 발견이 0이어야 한다. 문서 4개.
export function baseGraph(): Record<string, string> {
  return {
    'src/auth/session.ts': 'export const session = true;\n',
    'docs/specs/index.md': [
      '# 스펙 인덱스',
      '',
      '## 도메인',
      '- [인증](auth/overview.md) — 로그인 세션',
      '',
      '## 기록',
      '- [로그](log.md) — 변경 기록',
      '',
    ].join('\n'),
    'docs/specs/log.md': ['# 스펙 로그', '', '## [2026-10-31] change | 초기 구성', '초기 항목.', ''].join('\n'),
    'docs/specs/auth/overview.md': [
      '# 인증',
      '',
      '## 목적',
      '인증 영역을 맡는다.',
      '',
      '## 문서 목록',
      '- [로그인](login.md) — 로그인 세션',
      '',
      '## 관련 문서',
      '- [스펙 인덱스](../index.md)',
      '',
    ].join('\n'),
    'docs/specs/auth/login.md': [
      '# 로그인 세션',
      '',
      '## 목적',
      '로그인 세션이 만들어지고 끝나는 방식.',
      '',
      '## 현재 동작',
      '로그인하면 세션이 시작된다.',
      '',
      '## 정책',
      '### 세션 유효 기간',
      '활동이 30일 동안 없으면 세션이 만료된다.',
      '',
      '## 근거',
      '- `src/auth/session.ts` — 세션 생성',
      '',
      '## 확인 필요 사항',
      '- 없음',
      '',
      '## 관련 문서',
      '- [인증 개요](overview.md)',
      '',
    ].join('\n'),
  };
}

// 이름 있는 규칙의 발견만 고른다.
export function rulesNamed(findings: Finding[], rule: string): Finding[] {
  return findings.filter((finding) => finding.rule === rule);
}

// 문자열에서 needle이 처음 나오는 줄 번호(1부터).
export function lineOf(text: string, needle: string): number {
  const index = text.split('\n').findIndex((line) => line.includes(needle));
  if (index < 0) throw new Error(`줄을 찾을 수 없음: ${needle}`);
  return index + 1;
}

// 로컬 날짜를 YYYY-MM-DD로 쓴다. 구현에 의존하지 않도록 init.test.ts와 같은 계산을 따로 둔다.
export function localDate(): string {
  const now = new Date();
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// 저장소 루트 기준 파일을 UTF-8로 읽는다.
export function readRepoFile(root: string, rel: string): string {
  return readFileSync(join(root, rel), 'utf8');
}

// 도구별 스킬 파일의 저장소 루트 기준 경로.
export function skillPath(agent: 'claude' | 'codex', name: string): string {
  return `${agent === 'claude' ? '.claude/skills' : '.agents/skills'}/${name}/SKILL.md`;
}

// 테스트 파일 끝에서 호출해 임시 디렉터리를 지운다.
export function cleanup(): void {
  removeTempDirs();
}
