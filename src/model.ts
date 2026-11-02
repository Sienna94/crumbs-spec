import type { VocabKey } from './headings.js';

export type Role = 'index' | 'log' | 'overview' | 'detail';

export interface Config {
  version: 1;
  specDir: string;
  index: string;
  overview: string;
  log: string;
  lang: 'ko';
  headings: Partial<Record<VocabKey, string>>;
  exclude: string[];
  codeRoot: string;
  rawDir: string;
}

export interface Heading {
  level: number;
  text: string;
  slug: string;
  line: number;
}

export interface Link {
  line: number;
  text: string;
  rawTarget: string;
  kind: 'external' | 'internal';
  path?: string;
  fragment?: string;
}

export interface Section {
  key?: VocabKey;
  heading: Heading;
  startLine: number;
  endLine: number;
  children: Heading[];
}

export interface EvidencePath {
  line: number;
  raw: string;
  resolved: string;
}

export interface PolicyTitle {
  heading: Heading;
  normalized: string;
}

export interface SpecDoc {
  file: string;
  abs: string;
  role: Role;
  title?: Heading;
  headings: Heading[];
  sections: Section[];
  links: Link[];
  evidencePaths: EvidencePath[];
  policies: PolicyTitle[];
  markerCount: number;
  firstMarkerLine?: number;
  // 흐름 신호. behaviorBullets는 "현재 동작" 절 안의 불릿 줄 수이고, 그 절이 없으면 0이다.
  flow: { mermaidFences: number; tableRows: number; behaviorBullets: number };
  parent?: SpecDoc;
}

export interface Finding {
  rule: string;
  severity: 'error' | 'warning';
  file: string;
  line?: number;
  message: string;
}

export interface Report {
  version: 1;
  ok: boolean;
  summary: { documents: number; errors: number; warnings: number };
  findings: Finding[];
}

// line이 없는 발견은 line 키 자체를 두지 않아 JSON에서도 빠진다.
export function finding(
  rule: string,
  severity: Finding['severity'],
  file: string,
  message: string,
  line?: number,
): Finding {
  return line === undefined ? { rule, severity, file, message } : { rule, severity, file, line, message };
}
