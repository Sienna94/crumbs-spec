import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isCalendarDate, localDate } from './dates.js';
import type { Config } from './model.js';

// 로그 항목의 kind(4.4.5). 2단계는 lint와 drift를 쓰는 도구를 만들지 않지만 값은 모두 받는다.
// decision은 확인 필요 질문이 답을 얻어 확정된 정책이나 확정 정책의 값·조건이 바뀐 결정이다(11.2).
export const LOG_KINDS = ['ingest', 'query', 'lint', 'drift', 'change', 'decision'] as const;
export type LogKind = (typeof LOG_KINDS)[number];

export function isLogKind(value: string): value is LogKind {
  return (LOG_KINDS as readonly string[]).includes(value);
}

export type ParsedLogHeading =
  | { ok: true; date: string; kind: LogKind; title: string }
  | { ok: false; reason: 'format' }
  | { ok: false; reason: 'kind'; kind: string }
  | { ok: false; reason: 'date'; date: string };

// kind 자리는 느슨하게 받는다. CHANGE 같은 대문자를 다음 단계에서 kind 오류로 안내하기 위해서다.
const HEADING = /^\[(\d{4}-\d{2}-\d{2})\] ([A-Za-z]+) \| (.+)$/;

// H2의 text(4.5 규칙 2로 정리된 값)를 받아 항목 제목인지 판정한다. 형식, kind, 날짜 순서로 본다.
export function parseLogHeading(text: string): ParsedLogHeading {
  const match = HEADING.exec(text);
  if (match === null) return { ok: false, reason: 'format' };
  const [, date, kind, title] = match;
  if (!isLogKind(kind)) return { ok: false, reason: 'kind', kind };
  const [year, month, day] = date.split('-').map(Number);
  if (!isCalendarDate(year, month, day)) return { ok: false, reason: 'date', date };
  return { ok: true, date, kind, title };
}

// 항목 제목 줄에서 앞의 "## "를 뺀 부분.
export function formatLogHeading(date: string, kind: LogKind, title: string): string {
  return `[${date}] ${kind} | ${title}`;
}

// 사용자가 고칠 수 있는 로그 상황(로그 문서 없음 등). cli.ts가 'crumbs: ' 접두사를 붙여 종료 코드 2로 낸다.
export class LogError extends Error {}

// 본문의 줄바꿈을 \n으로 맞추고 앞뒤 공백과 빈 줄을 뗀다. 남는 것이 없으면 undefined(본문 없음).
export function normalizeLogBody(text: string): string | undefined {
  const body = text.replace(/\r\n?/g, '\n').trim();
  return body === '' ? undefined : body;
}

// 본문의 어떤 줄이 제목 줄(ATX)이면 로그 구조가 깨지므로 거부한다.
export function hasHeadingLine(body: string): boolean {
  return /^ {0,3}#{1,6}[ \t]/m.test(body);
}

// 로그 문서 경로(저장소 루트 기준, 설정 값 그대로).
function logRelPath(config: Config): string {
  return `${config.specDir}/${config.log}`;
}

// 로그 문서가 있는지 확인한다. 없으면 LogError.
export function assertLogDocument(root: string, config: Config): void {
  const rel = logRelPath(config);
  if (!existsSync(join(root, rel))) {
    throw new LogError(`로그 문서가 없음: ${rel}. 먼저 "crumbs init"을 실행하세요.`);
  }
}

// 로그 문서 끝에 오늘 날짜 항목을 덧붙이고 출력할 한 줄을 돌려준다. 호출 전에 assertLogDocument로 확인한다.
// 파일은 한 번에 쓴다. 끝의 줄바꿈을 모두 떼고 빈 줄 하나를 두고 항목을 붙이므로 파일은 항상 줄바꿈 하나로 끝난다.
export function addLogEntry(root: string, config: Config, kind: LogKind, title: string, body?: string): string {
  const rel = logRelPath(config);
  const abs = join(root, rel);
  const heading = formatLogHeading(localDate(), kind, title);
  const text = body === undefined ? undefined : normalizeLogBody(body);
  const entry = text === undefined ? `## ${heading}` : `## ${heading}\n${text}`;
  const current = readFileSync(abs, 'utf8').replace(/[\r\n]+$/, '');
  writeFileSync(abs, current === '' ? `${entry}\n` : `${current}\n\n${entry}\n`);
  return `추가: ${rel} — ${heading}`;
}
