import type { Graph } from '../graph.js';
import { finding, type Finding } from '../model.js';

// (a) 개요와 상세 문서는 부모로 돌아가는 내부 링크가 있어야 한다.
// (b) 상세 문서 A가 상세 문서 B를 링크하면 B도 A를 링크해야 한다(동료 대칭).
export function missingBacklink(graph: Graph): Finding[] {
  const out: Finding[] = [];

  for (const doc of graph.docs) {
    if (doc.role !== 'overview' && doc.role !== 'detail') continue;
    const parent = doc.parent;
    if (parent === undefined) continue;
    const linksToParent = doc.links.some((link) => link.kind === 'internal' && link.path === parent.abs);
    if (!linksToParent) {
      out.push(finding('missing-backlink', 'error', doc.file, `${parent.file}로 돌아가는 링크가 없음`));
    }
  }

  for (const source of graph.docs) {
    if (source.role !== 'detail') continue;
    const reported = new Set<string>();
    for (const link of source.links) {
      if (link.kind !== 'internal' || link.path === undefined) continue;
      const target = graph.byAbs.get(link.path);
      if (target === undefined || target === source || target.role !== 'detail') continue;
      if (reported.has(target.abs)) continue;
      reported.add(target.abs);
      const linksBack = target.links.some((back) => back.kind === 'internal' && back.path === source.abs);
      if (!linksBack) {
        out.push(
          finding(
            'missing-backlink',
            'error',
            target.file,
            `${source.file}에서 링크했지만 되돌아가는 링크가 없음`,
            target.title?.line,
          ),
        );
      }
    }
  }

  return out;
}
