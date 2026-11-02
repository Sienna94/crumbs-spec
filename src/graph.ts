import { readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { VOCAB, type Lang, type VocabKey } from './headings.js';
import {
  buildSections,
  classifyTarget,
  evidenceCandidates,
  normTitle,
  scanMarkdown,
} from './markdown.js';
import type { Config, EvidencePath, Link, Role, Section, SpecDoc } from './model.js';

export interface Graph {
  root: string;
  config: Config;
  // 규칙 메시지 언어(설정의 lang)
  lang: Lang;
  vocab: Record<VocabKey, string>;
  specAbs: string;
  indexAbs: string;
  logAbs: string;
  docs: SpecDoc[];
  byAbs: Map<string, SpecDoc>;
  index?: SpecDoc;
  slugCache: Map<string, Set<string> | undefined>;
}

export function vocabOf(config: Config): Record<VocabKey, string> {
  return { ...VOCAB[config.lang], ...config.headings };
}

export function relPath(root: string, abs: string): string {
  return relative(root, abs).split(sep).join('/');
}

export function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

export function pathExists(path: string): boolean {
  try {
    statSync(path);
    return true;
  } catch {
    return false;
  }
}

function isMissingDir(error: unknown): boolean {
  const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
  return code === 'ENOENT' || code === 'ENOTDIR';
}

function realpathOf(path: string): string | undefined {
  try {
    return realpathSync.native(path);
  } catch {
    return undefined;
  }
}

// specDir 아래 .md 파일을 찾는다. node_modules와 점으로 시작하는 디렉터리는 들어가지 않는다.
// 심볼릭 링크는 가리키는 대상의 종류로 판정한다. 실제 경로 기준으로 이미 방문한 디렉터리는 다시 들어가지 않아 순환을 끊는다.
function listSpecFiles(dirAbs: string, relDir: string, out: string[], visited = new Set<string>()): void {
  let entries;
  try {
    entries = readdirSync(dirAbs, { withFileTypes: true });
  } catch (error) {
    if (isMissingDir(error)) return;
    throw error;
  }
  const real = realpathOf(dirAbs);
  if (real === undefined || visited.has(real)) return;
  visited.add(real);
  entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  for (const entry of entries) {
    const rel = relDir === '' ? entry.name : `${relDir}/${entry.name}`;
    let kind: 'dir' | 'file' | undefined;
    if (entry.isSymbolicLink()) {
      try {
        const target = statSync(join(dirAbs, entry.name));
        kind = target.isDirectory() ? 'dir' : target.isFile() ? 'file' : undefined;
      } catch {
        kind = undefined;
      }
    } else if (entry.isDirectory()) {
      kind = 'dir';
    } else if (entry.isFile()) {
      kind = 'file';
    }
    if (kind === 'dir') {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      listSpecFiles(join(dirAbs, entry.name), rel, out, visited);
    } else if (kind === 'file' && entry.name.toLowerCase().endsWith('.md')) {
      out.push(rel);
    }
  }
}

// exclude 항목은 스펙 루트 기준 경로다. "/"로 끝나면 디렉터리 전체를, 아니면 파일 또는 디렉터리 하나를 가리킨다.
function isExcluded(rel: string, exclude: string[]): boolean {
  return exclude.some((entry) =>
    entry.endsWith('/') ? rel.startsWith(entry) : rel === entry || rel.startsWith(`${entry}/`),
  );
}

// start 자신(포함 여부는 호출자가 정함)에서 위로 올라가며 specAbs까지의 디렉터리를 가까운 순서로 준다.
function dirsUpTo(start: string, specAbs: string): string[] {
  const out: string[] = [];
  let current = start;
  while (current === specAbs || current.startsWith(specAbs + sep)) {
    out.push(current);
    if (current === specAbs) break;
    current = dirname(current);
  }
  return out;
}

// 원본 자료(rawDir 아래)는 코드가 아니므로 codeRoot가 아니라 저장소 루트 기준으로 해석한다.
function isUnderRawDir(path: string, rawDir: string): boolean {
  const normalized = path.replace(/^\.\//, '');
  return normalized === rawDir || normalized.startsWith(`${rawDir}/`);
}

export function buildGraph(root: string, config: Config): Graph {
  const specAbs = resolve(root, config.specDir);
  const indexAbs = join(specAbs, config.index);
  const logAbs = join(specAbs, config.log);
  const codeRootAbs = resolve(root, config.codeRoot);
  const vocab = vocabOf(config);

  const roleOf = (abs: string): Role => {
    if (abs === indexAbs) return 'index';
    if (abs === logAbs) return 'log';
    if (basename(abs) === config.overview) return 'overview';
    return 'detail';
  };

  const relFiles: string[] = [];
  listSpecFiles(specAbs, '', relFiles);

  const docs: SpecDoc[] = [];
  for (const rel of relFiles) {
    if (isExcluded(rel, config.exclude)) continue;
    const abs = join(specAbs, rel);
    const scan = scanMarkdown(readFileSync(abs, 'utf8'));
    const sections = buildSections(scan, vocab);
    // 미확정 정책 마커는 확인 필요 사항 절에 적힌 것을 센다. 그 절에 마커가 없으면 문서 전체의 마커를 센다.
    const questions = sections.find((section) => section.key === 'questions');
    const markersInQuestions = questions
      ? scan.markerLines.filter((line) => line >= questions.startLine && line <= questions.endLine)
      : [];
    const markers = markersInQuestions.length > 0 ? markersInQuestions : scan.markerLines;

    const links: Link[] = scan.links.map((link): Link => {
      const target = classifyTarget(link.rawTarget, abs, root);
      if (target.kind === 'external') {
        return { line: link.line, text: link.text, rawTarget: link.rawTarget, kind: 'external' };
      }
      return {
        line: link.line,
        text: link.text,
        rawTarget: link.rawTarget,
        kind: 'internal',
        path: target.path,
        fragment: target.fragment,
      };
    });

    const evidencePaths: EvidencePath[] = evidenceCandidates(scan, sections).map((candidate) => ({
      line: candidate.line,
      raw: candidate.raw,
      resolved: resolve(isUnderRawDir(candidate.path, config.rawDir) ? root : codeRootAbs, candidate.path),
    }));

    const policies = sections
      .filter((section) => section.key === 'policies')
      .flatMap((section) =>
        section.children
          .filter((child) => child.level === 3)
          .map((heading) => ({ heading, normalized: normTitle(heading.text) })),
      );

    // 흐름 신호는 현재 동작과 흐름 절 안의 줄만 센다(절이 없으면 0).
    const inRange = (line: number, s?: Section) => s !== undefined && line >= s.startLine && line <= s.endLine;
    const behavior = sections.find((section) => section.key === 'behavior');
    const flow = sections.find((section) => section.key === 'flow');
    const behaviorBullets = scan.bulletLines.filter((line) => inRange(line, behavior)).length;
    const mermaidFences = scan.mermaidFenceLines.filter((line) => inRange(line, behavior) || inRange(line, flow)).length;
    const tableRows = scan.tableRuleLines.filter((line) => inRange(line, behavior) || inRange(line, flow)).length;

    docs.push({
      file: relPath(root, abs),
      abs,
      role: roleOf(abs),
      title: scan.headings[0]?.level === 1 ? scan.headings[0] : undefined,
      headings: scan.headings,
      sections,
      links,
      evidencePaths,
      policies,
      markerCount: markers.length,
      firstMarkerLine: markers[0],
      flow: { mermaidFences, tableRows, behaviorBullets },
      unterminatedComment: scan.unterminatedComment,
    });
  }

  docs.sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));
  const byAbs = new Map(docs.map((doc) => [doc.abs, doc] as const));
  const index = byAbs.get(indexAbs);

  // 링크 대상이 문서 목록에 없지만 디스크에 파일로 있으면, 실제 경로가 문서와 같은지 본다.
  // 같으면 철자가 다른 것(대소문자 차이 등)이므로 링크를 실제 문서로 돌리고 철자 차이를 기록한다.
  const byReal = new Map<string, SpecDoc>();
  for (const doc of docs) {
    const real = realpathOf(doc.abs);
    if (real !== undefined) byReal.set(real, doc);
  }
  for (const doc of docs) {
    for (const link of doc.links) {
      if (link.kind !== 'internal' || link.path === undefined || byAbs.has(link.path) || !isFile(link.path)) continue;
      const real = realpathOf(link.path);
      const actual = real === undefined ? undefined : byReal.get(real);
      if (actual === undefined) continue;
      link.spellingMismatch = actual.file;
      link.path = actual.abs;
    }
  }

  // 개요 디렉터리 → 개요 문서. 상세 문서와 개요는 가까운 개요를 부모로 삼고, 없으면 인덱스가 부모다.
  const overviewByDir = new Map<string, SpecDoc>();
  for (const doc of docs) {
    if (doc.role === 'overview') overviewByDir.set(dirname(doc.abs), doc);
  }
  for (const doc of docs) {
    if (doc.role === 'index' || doc.role === 'log') continue;
    const dir = dirname(doc.abs);
    const start = doc.role === 'overview' ? dirname(dir) : dir;
    let parent: SpecDoc | undefined;
    for (const candidate of dirsUpTo(start, specAbs)) {
      const overview = overviewByDir.get(candidate);
      if (overview) {
        parent = overview;
        break;
      }
    }
    doc.parent = parent ?? index;
  }

  return { root, config, lang: config.lang, vocab, specAbs, indexAbs, logAbs, docs, byAbs, index, slugCache: new Map() };
}

// 문서 또는 임의의 .md 파일의 제목 슬러그 집합. 그래프 밖 파일은 한 번만 읽는다.
export function slugsOf(graph: Graph, abs: string): Set<string> | undefined {
  const known = graph.byAbs.get(abs);
  if (known) return new Set(known.headings.map((heading) => heading.slug));
  if (!graph.slugCache.has(abs)) {
    let slugs: Set<string> | undefined;
    try {
      slugs = new Set(scanMarkdown(readFileSync(abs, 'utf8')).headings.map((heading) => heading.slug));
    } catch {
      slugs = undefined;
    }
    graph.slugCache.set(abs, slugs);
  }
  return graph.slugCache.get(abs);
}
