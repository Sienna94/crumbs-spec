import { isFile, slugsOf, type Graph } from '../graph.js';
import { MESSAGES } from '../messages.js';
import { finding, type Finding } from '../model.js';

// 존재하는 .md 대상의 fragment가 그 파일의 제목 슬러그와 맞아야 한다. .md가 아닌 대상은 검사하지 않는다.
export function brokenAnchor(graph: Graph): Finding[] {
  const out: Finding[] = [];
  for (const doc of graph.docs) {
    for (const link of doc.links) {
      if (link.kind !== 'internal' || link.path === undefined || link.fragment === undefined) continue;
      if (!isFile(link.path) || !link.path.toLowerCase().endsWith('.md')) continue;
      const slugs = slugsOf(graph, link.path);
      if (slugs === undefined) continue;
      if (!slugs.has(link.fragment.normalize('NFC').toLowerCase())) {
        out.push(finding('broken-anchor', 'error', doc.file, MESSAGES[graph.lang].anchorMissing(link.rawTarget), link.line));
      }
    }
  }
  return out;
}
