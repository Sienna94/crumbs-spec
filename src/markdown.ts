import { dirname, join, resolve } from 'node:path';
import { MARKERS, VOCAB_KEYS, type VocabKey } from './headings.js';
import type { Heading, Section } from './model.js';

const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})/;
const FENCE_CLOSE = /^ {0,3}(`{3,}|~{3,})[ \t]*$/;
const ATX = /^ {0,3}(#{1,6})[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/;
const CODE_SPAN = /`([^`\n]+)`/g;
const SCHEME = /^[a-z][a-z0-9+.-]*:/i;
// 참조 정의 줄: [라벨]: 대상 "제목". 줄 전체가 정의일 때만 맞는다.
const REF_DEF = /^ {0,3}\[([^\]]+)\]:[ \t]*(<[^>\n]*>|\S+)(?:[ \t]+"[^"]*")?[ \t]*$/;
// 표 구분선(| --- | --- |), 불릿 줄, 번호 목록 줄. 흐름 신호(7.3)를 셀 때만 쓴다.
const TABLE_RULE = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/;
const BULLET = /^\s*[-*+]\s+/;
const ORDERED = /^\s*\d+[.)]\s+/;
// 근거 경로 뒤의 줄 범위 접미사: :N, :N-M, :N:C, :12-48,60-70
const LINE_RANGE = /(?::\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*)+$/;

export interface RawLink {
  line: number;
  text: string;
  rawTarget: string;
}

export interface CodeSpan {
  line: number;
  content: string;
}

export interface Scan {
  lineCount: number;
  headings: Heading[];
  links: RawLink[];
  codeSpans: CodeSpan[];
  // 마커 출현마다 한 번씩 그 줄 번호를 담는다.
  markerLines: number[];
  // 흐름 신호: mermaid 펜스 여는 줄, 표 구분선 줄, 불릿·번호 목록 줄 번호. 펜스·주석 밖의 줄만 기록한다.
  mermaidFenceLines: number[];
  tableRuleLines: number[];
  bulletLines: number[];
  // 파일 끝까지 닫히지 않은 HTML 주석이 시작한 줄. 닫혀 있으면 undefined다.
  unterminatedComment?: number;
}

export interface EvidenceCandidate {
  line: number;
  raw: string;
  path: string;
}

export type TargetRef = { kind: 'external' } | { kind: 'internal'; path: string; fragment?: string };

// 비교용 정규화: NFC, 앞뒤 공백 제거, 내부 공백 압축, 소문자화.
export function normTitle(text: string): string {
  return text.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
}

// GitHub(github-slugger) 방식 슬러그. 소문자화 후 문자·숫자·결합 기호·공백·_·-만 남기고, 공백 하나마다 -를 붙인다(압축하지 않는다).
export function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M} _-]/gu, '')
    .replace(/ /g, '-');
}

function uniqueSlug(base: string, used: Set<string>): string {
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  let n = 1;
  while (used.has(`${base}-${n}`)) n++;
  const slug = `${base}-${n}`;
  used.add(slug);
  return slug;
}

// 제목 텍스트에서 인라인 표기를 걷어 낸다: 코드 스팬, 링크, 강조 기호. _는 짝을 이룬 강조일 때만 지운다.
function cleanInline(text: string): string {
  return text
    .replace(/`([^`\n]+)`/g, '$1')
    .replace(/\[([^\]]*)\]\([^)\s]*(?:\s+"[^"]*")?\)/g, '$1')
    .replace(/\*+/g, '')
    .replace(/(?<![\p{L}\p{N}_])(_{1,2})([^_\n]+?)\1(?![\p{L}\p{N}_])/gu, '$2')
    .trim();
}

function stripAngles(target: string): string {
  return target.startsWith('<') && target.endsWith('>') ? target.slice(1, -1) : target;
}

// 링크 사용 하나. 인라인은 대상이 바로 있고, 참조 사용은 라벨을 정의와 맞춰 나중에 푼다.
type LinkUse = { kind: 'inline'; text: string; rawTarget: string } | { kind: 'ref'; text: string; label: string };

// 참조 라벨 비교용 정규화: 앞뒤 공백 제거, 내부 공백 압축, 소문자화.
function normLabel(label: string): string {
  return label.trim().replace(/\s+/g, ' ').toLowerCase();
}

// s[start]부터 인라인 링크의 대상과 선택적 제목을 읽는다. 대상은 <…>(공백 허용) 또는 괄호가 균형 잡힌 맨 대상이다.
// 닫는 ')'의 위치를 돌려주고, 형식이 맞지 않으면 undefined를 준다.
function readInlineDest(s: string, start: number): { target: string; end: number } | undefined {
  let p = start;
  while (s[p] === ' ' || s[p] === '\t') p++;
  let target: string;
  if (s[p] === '<') {
    const angle = /^<([^>\n]*)>/.exec(s.slice(p));
    if (!angle) return undefined;
    target = angle[1];
    p += angle[0].length;
  } else {
    // 맨 대상은 공백이나 짝 없는 ')'에서 멈춘다.
    const begin = p;
    let depth = 0;
    while (p < s.length) {
      const c = s[p];
      if (c === ' ' || c === '\t') break;
      if (c === '(') depth++;
      else if (c === ')') {
        if (depth === 0) break;
        depth--;
      }
      p++;
    }
    target = s.slice(begin, p);
  }
  while (s[p] === ' ' || s[p] === '\t') p++;
  // 제목은 "…", '…', (…) 중 하나다.
  if (s[p] === '"' || s[p] === "'" || s[p] === '(') {
    const close = s.indexOf(s[p] === '(' ? ')' : s[p], p + 1);
    if (close < 0) return undefined;
    p = close + 1;
    while (s[p] === ' ' || s[p] === '\t') p++;
  }
  if (s[p] !== ')') return undefined;
  return { target, end: p };
}

// 가려진(코드 스팬 제외) 한 줄에서 링크 사용을 찾는다. 이미지(![)와 빈 인라인 대상은 건너뛴다.
// 참조 사용은 [text][label]과 [label][]만 받는다. 단독 [label]은 링크가 아니다.
function extractLinkUses(masked: string): LinkUse[] {
  const out: LinkUse[] = [];
  for (let i = 0; i < masked.length; i++) {
    if (masked[i] !== '[') continue;
    const close = masked.indexOf(']', i + 1);
    if (close < 0) break;
    const text = masked.slice(i + 1, close);
    if (text.includes('[')) continue;
    const image = i > 0 && masked[i - 1] === '!';
    if (masked[close + 1] === '(') {
      const dest = readInlineDest(masked, close + 2);
      if (dest === undefined) continue;
      if (!image && dest.target !== '') out.push({ kind: 'inline', text, rawTarget: dest.target });
      i = dest.end;
    } else if (masked[close + 1] === '[') {
      const end = masked.indexOf(']', close + 2);
      if (end < 0) continue;
      if (!image) out.push({ kind: 'ref', text, label: masked.slice(close + 2, end) || text });
      i = end;
    }
  }
  return out;
}

function safeDecode(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

// 파일 텍스트를 줄 단위로 훑는다. 펜스 코드 블록과 HTML 주석 안은 제목·링크·코드 스팬·마커를 만들지 않는다.
export function scanMarkdown(input: string): Scan {
  // 맨 앞의 UTF-8 BOM은 첫 줄의 제목을 가리므로 제거한다.
  const lines = input.replace(/^﻿/, '').replace(/\r\n?/g, '\n').normalize('NFC').split('\n');
  const headings: Heading[] = [];
  const links: RawLink[] = [];
  const codeSpans: CodeSpan[] = [];
  const markerLines: number[] = [];
  const mermaidFenceLines: number[] = [];
  const tableRuleLines: number[] = [];
  const bulletLines: number[] = [];
  // 참조 정의는 파일 어디에 있어도 쓸 수 있으므로 모든 줄을 읽은 뒤 사용처와 맞춘다.
  const refDefs = new Map<string, string>();
  const refUses: { line: number; text: string; label: string }[] = [];
  const usedSlugs = new Set<string>();
  let fence: { ch: string; len: number } | undefined;
  let inComment = false;
  let commentStart: number | undefined;

  for (let index = 0; index < lines.length; index++) {
    const raw = lines[index];
    const line = index + 1;

    if (fence) {
      const close = FENCE_CLOSE.exec(raw);
      if (close && close[1][0] === fence.ch && close[1].length >= fence.len) {
        fence = undefined;
      }
      continue;
    }
    if (!inComment) {
      const open = FENCE_OPEN.exec(raw);
      if (open) {
        fence = { ch: open[1][0], len: open[1].length };
        // 정보 문자열은 펜스 문자 뒤의 텍스트를 trim하고 소문자로 바꾼 값이다.
        if (raw.slice(open[0].length).trim().toLowerCase().startsWith('mermaid')) mermaidFenceLines.push(line);
        continue;
      }
    }

    // 주석 밖 텍스트만 남긴다. 주석은 여러 줄에 걸칠 수 있다.
    // 주석 시작(<!--)은 코드 스팬을 가린 줄에서 찾아, `<!--` 같은 코드 스팬이 주석을 열지 못하게 한다.
    // 가려도 길이가 같으므로 위치는 원문과 그대로 맞는다. 주석 끝(-->)은 주석 안이므로 원문에서 찾는다.
    const commentView = raw.replace(CODE_SPAN, (match: string) => ' '.repeat(match.length));
    let visible = '';
    let cursor = 0;
    for (;;) {
      if (inComment) {
        const end = raw.indexOf('-->', cursor);
        if (end < 0) break;
        cursor = end + 3;
        inComment = false;
        commentStart = undefined;
      } else {
        const start = commentView.indexOf('<!--', cursor);
        if (start < 0) {
          visible += raw.slice(cursor);
          break;
        }
        visible += raw.slice(cursor, start);
        cursor = start + 4;
        inComment = true;
        commentStart = line;
      }
    }

    for (const marker of MARKERS) {
      for (let pos = visible.indexOf(marker); pos >= 0; pos = visible.indexOf(marker, pos + marker.length)) {
        markerLines.push(line);
      }
    }

    if (TABLE_RULE.test(visible)) tableRuleLines.push(line);
    if (BULLET.test(visible) || ORDERED.test(visible)) bulletLines.push(line);

    const def = REF_DEF.exec(visible);
    if (def && !refDefs.has(normLabel(def[1]))) refDefs.set(normLabel(def[1]), stripAngles(def[2]));

    // 코드 스팬은 기록한 뒤 같은 길이의 공백으로 가려서 링크 추출에서 뺀다.
    const masked = visible.replace(CODE_SPAN, (match: string, content: string) => {
      codeSpans.push({ line, content });
      return ' '.repeat(match.length);
    });
    // 참조 정의 줄은 링크를 만들지 않는다.
    if (def === null) {
      for (const use of extractLinkUses(masked)) {
        if (use.kind === 'inline') links.push({ line, text: use.text, rawTarget: use.rawTarget });
        else refUses.push({ line, text: use.text, label: normLabel(use.label) });
      }
    }

    const atx = ATX.exec(visible);
    if (atx) {
      const text = cleanInline(atx[2]);
      headings.push({ level: atx[1].length, text, slug: uniqueSlug(slugify(text), usedSlugs), line });
    }
  }

  // 정의가 있는 참조 사용만 링크가 된다. 정의가 없으면 아무것도 만들지 않는다.
  for (const use of refUses) {
    const target = refDefs.get(use.label);
    if (target !== undefined) links.push({ line: use.line, text: use.text, rawTarget: target });
  }
  // 줄 순서를 유지한다. 정렬은 안정적이라 같은 줄 안의 순서는 그대로 남는다.
  links.sort((a, b) => a.line - b.line);

  return {
    lineCount: lines.length,
    headings,
    links,
    codeSpans,
    markerLines,
    mermaidFenceLines,
    tableRuleLines,
    bulletLines,
    unterminatedComment: inComment ? commentStart : undefined,
  };
}

// 링크 대상을 문서 기준으로 해석한다. 외부 스킴은 검사하지 않는다.
export function classifyTarget(rawTarget: string, docAbs: string, root: string): TargetRef {
  const target = stripAngles(rawTarget);
  if (SCHEME.test(target)) return { kind: 'external' };
  const hash = target.indexOf('#');
  const pathPart = hash < 0 ? target : target.slice(0, hash);
  const fragPart = hash < 0 ? '' : target.slice(hash + 1);
  const decodedPath = safeDecode(pathPart);
  let path: string;
  if (pathPart === '') {
    path = docAbs;
  } else if (decodedPath.startsWith('/')) {
    path = join(root, decodedPath);
  } else {
    path = resolve(dirname(docAbs), decodedPath);
  }
  return fragPart === '' ? { kind: 'internal', path } : { kind: 'internal', path, fragment: safeDecode(fragPart) };
}

export function findVocabKey(text: string, vocab: Record<VocabKey, string>): VocabKey | undefined {
  const normalized = normTitle(text);
  return VOCAB_KEYS.find((key) => normTitle(vocab[key]) === normalized);
}

// H2 절을 나눈다. 절 범위는 제목 줄부터 다음 H2 직전 줄까지이고, H3 이상 제목은 자식이다.
export function buildSections(scan: Scan, vocab: Record<VocabKey, string>): Section[] {
  const h2 = scan.headings.filter((h) => h.level === 2);
  return h2.map((heading, i) => {
    const endLine = i + 1 < h2.length ? h2[i + 1].line - 1 : scan.lineCount;
    const children = scan.headings.filter((h) => h.level >= 3 && h.line > heading.line && h.line <= endLine);
    return { key: findVocabKey(heading.text, vocab), heading, startLine: heading.line, endLine, children };
  });
}

// 근거 경로 후보. 줄 범위 접미사(:N, :N-M, :N:C, :12-48,60-70)를 먼저 떼고, 남은 값이 다음을 모두 만족해야 한다.
// 공백이 없고, URL 스킴(scheme://)이나 mailto:가 아니며, /를 포함한다. 파일 이름만 있는 값은 후보가 아니다.
// 저장소 루트의 파일은 ./package.json처럼 적는다.
export function evidenceCandidate(content: string): string | undefined {
  const path = content.replace(LINE_RANGE, '');
  if (/\s/.test(path) || /^[a-z][a-z0-9+.-]*:\/\//i.test(path) || path.startsWith('mailto:')) return undefined;
  if (!path.includes('/')) return undefined;
  return path;
}

// 근거 절 안에 있는 코드 스팬 중 후보만 모은다.
export function evidenceCandidates(scan: Scan, sections: Section[]): EvidenceCandidate[] {
  const out: EvidenceCandidate[] = [];
  for (const section of sections) {
    if (section.key !== 'evidence') continue;
    for (const span of scan.codeSpans) {
      if (span.line < section.startLine || span.line > section.endLine) continue;
      const path = evidenceCandidate(span.content);
      if (path !== undefined) out.push({ line: span.line, raw: span.content, path });
    }
  }
  return out;
}
