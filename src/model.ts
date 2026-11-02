import type { Lang, VocabKey } from './headings.js';

export type Role = 'index' | 'log' | 'overview' | 'detail';

export interface Config {
  version: 1;
  specDir: string;
  index: string;
  overview: string;
  log: string;
  lang: Lang;
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
  // 링크 철자가 디스크의 파일과 다를 때 실제 파일의 저장소 루트 기준 경로다. path는 그 파일로 바뀐다.
  spellingMismatch?: string;
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
  // 파일 끝까지 닫히지 않은 HTML 주석이 시작한 줄. 닫혀 있으면 undefined다.
  unterminatedComment?: number;
  // 흐름 신호. behaviorBullets는 "현재 동작" 절 안의 불릿 줄 수이고, 그 절이 없으면 0이다.
  flow: { mermaidFences: number; tableRows: number; behaviorBullets: number };
  parent?: SpecDoc;
}

export interface Finding {
  rule: string;
  severity: 'error' | 'warning';
  file: string;
  // 위치를 모르는 발견은 1줄을 가리킨다.
  line: number;
  message: string;
}

export interface Report {
  version: 1;
  ok: boolean;
  summary: { documents: number; errors: number; warnings: number };
  findings: Finding[];
}

export function finding(
  rule: string,
  severity: Finding['severity'],
  file: string,
  message: string,
  line = 1,
): Finding {
  return { rule, severity, file, line, message };
}
