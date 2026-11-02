import { dirname, join, resolve } from 'node:path';
import { MARKERS, VOCAB_KEYS, type VocabKey } from './headings.js';
import type { Heading, Section } from './model.js';

const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})/;
const FENCE_CLOSE = /^ {0,3}(`{3,}|~{3,})[ \t]*$/;
const ATX = /^ {0,3}(#{1,6})[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/;
const CODE_SPAN = /`([^`\n]+)`/g;
const LINK = /(?<!!)\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const SCHEME = /^[a-z][a-z0-9+.-]*:/i;
// 표 구분선(| --- | --- |)과 불릿 줄. 흐름 신호(7.3)를 셀 때만 쓴다.
const TABLE_RULE = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/;
const BULLET = /^\s*[-*+]\s+/;

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
  // 흐름 신호: mermaid 펜스 수, 표 구분선 줄 수, 불릿 줄 번호. 펜스·주석 밖의 줄만 센다.
  mermaidFences: number;
  tableRows: number;
  bulletLines: number[];
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

// GitHub 방식 슬러그. 유니코드 문자·숫자·결합 기호·_·-만 남긴다.
export function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}\s_-]/gu, '')
    .replace(/\s+/g, '-');
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

// 제목 텍스트에서 인라인 표기를 걷어 낸다: 코드 스팬, 링크, 강조 기호.
function cleanInline(text: string): string {
  return text
    .replace(/`([^`\n]+)`/g, '$1')
    .replace(/\[([^\]]*)\]\([^)\s]*(?:\s+"[^"]*")?\)/g, '$1')
    .replace(/\*+/g, '')
    .replace(/(?<![\p{L}\p{N}])_+|_+(?![\p{L}\p{N}])/gu, '')
    .trim();
}

function stripAngles(target: string): string {
  return target.startsWith('<') && target.endsWith('>') ? target.slice(1, -1) : target;
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
  let mermaidFences = 0;
  let tableRows = 0;
  const bulletLines: number[] = [];
  const usedSlugs = new Set<string>();
  let fence: { ch: string; len: number } | undefined;
  let inComment = false;

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
        if (raw.slice(open[0].length).trim().toLowerCase().startsWith('mermaid')) mermaidFences++;
        continue;
      }
    }

    // 주석 밖 텍스트만 남긴다. 주석은 여러 줄에 걸칠 수 있다.
    let visible = '';
    let rest = raw;
    for (;;) {
      if (inComment) {
        const end = rest.indexOf('-->');
        if (end < 0) break;
        rest = rest.slice(end + 3);
        inComment = false;
      } else {
        const start = rest.indexOf('<!--');
        if (start < 0) {
          visible += rest;
          break;
        }
        visible += rest.slice(0, start);
        rest = rest.slice(start + 4);
        inComment = true;
      }
    }

    for (const marker of MARKERS) {
      for (let pos = visible.indexOf(marker); pos >= 0; pos = visible.indexOf(marker, pos + marker.length)) {
        markerLines.push(line);
      }
    }

    if (TABLE_RULE.test(visible)) tableRows++;
    if (BULLET.test(visible)) bulletLines.push(line);

    // 코드 스팬은 기록한 뒤 같은 길이의 공백으로 가려서 링크 추출에서 뺀다.
    const masked = visible.replace(CODE_SPAN, (match: string, content: string) => {
      codeSpans.push({ line, content });
      return ' '.repeat(match.length);
    });
    for (const m of masked.matchAll(LINK)) {
      links.push({ line, text: m[1], rawTarget: stripAngles(m[2]) });
    }

    const atx = ATX.exec(visible);
    if (atx) {
      const text = cleanInline(atx[2]);
      headings.push({ level: atx[1].length, text, slug: uniqueSlug(slugify(text), usedSlugs), line });
    }
  }

  return { lineCount: lines.length, headings, links, codeSpans, markerLines, mermaidFences, tableRows, bulletLines };
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

// 근거 경로 후보. 공백이 없고, http로 시작하지 않고, / 또는 .을 포함해야 하며, :N 또는 :N-M 접미사는 뗀다.
export function evidenceCandidate(content: string): string | undefined {
  if (/\s/.test(content) || content.startsWith('http') || !/[/.]/.test(content)) return undefined;
  return content.replace(/:\d+(-\d+)?$/, '');
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
