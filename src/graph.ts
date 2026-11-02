import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { VOCAB, type VocabKey } from './headings.js';
import {
  buildSections,
  classifyTarget,
  evidenceCandidates,
  normTitle,
  scanMarkdown,
} from './markdown.js';
import type { Config, EvidencePath, Link, Role, SpecDoc } from './model.js';

export interface Graph {
  root: string;
  config: Config;
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

// specDir 아래 .md 파일을 찾는다. node_modules와 점으로 시작하는 디렉터리는 들어가지 않는다.
function listSpecFiles(dirAbs: string, relDir: string, out: string[]): void {
  let entries;
  try {
    entries = readdirSync(dirAbs, { withFileTypes: true });
  } catch (error) {
    if (isMissingDir(error)) return;
    throw error;
  }
  entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  for (const entry of entries) {
    const rel = relDir === '' ? entry.name : `${relDir}/${entry.name}`;
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      listSpecFiles(join(dirAbs, entry.name), rel, out);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      out.push(rel);
    }
  }
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
    if (config.exclude.some((prefix) => prefix !== '' && rel.startsWith(prefix))) continue;
    const abs = join(specAbs, rel);
    const scan = scanMarkdown(readFileSync(abs, 'utf8'));
    const sections = buildSections(scan, vocab);

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
      resolved: resolve(codeRootAbs, candidate.path),
    }));

    const policies = sections
      .filter((section) => section.key === 'policies')
      .flatMap((section) =>
        section.children
          .filter((child) => child.level === 3)
          .map((heading) => ({ heading, normalized: normTitle(heading.text) })),
      );

    // 현재 동작 절의 범위 안에 있는 불릿 줄만 센다(절이 없으면 0).
    const behavior = sections.find((section) => section.key === 'behavior');
    const behaviorBullets = behavior
      ? scan.bulletLines.filter((line) => line >= behavior.startLine && line <= behavior.endLine).length
      : 0;

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
      markerCount: scan.markerLines.length,
      firstMarkerLine: scan.markerLines[0],
      flow: { mermaidFences: scan.mermaidFences, tableRows: scan.tableRows, behaviorBullets },
    });
  }

  docs.sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));
  const byAbs = new Map(docs.map((doc) => [doc.abs, doc] as const));
  const index = byAbs.get(indexAbs);

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

  return { root, config, vocab, specAbs, indexAbs, logAbs, docs, byAbs, index, slugCache: new Map() };
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
