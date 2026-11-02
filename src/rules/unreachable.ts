import { relPath, type Graph } from '../graph.js';
import { finding, type Finding } from '../model.js';

// 인덱스에서 내부 링크만 따라 도달할 수 없는 탐색된 문서를 찾는다.
export function unreachable(graph: Graph): Finding[] {
  const { index } = graph;
  if (index === undefined) return [];
  const seen = new Set([index]);
  const queue = [index];
  for (let i = 0; i < queue.length; i++) {
    for (const link of queue[i].links) {
      if (link.kind !== 'internal' || link.path === undefined) continue;
      const target = graph.byAbs.get(link.path);
      if (target && !seen.has(target)) {
        seen.add(target);
        queue.push(target);
      }
    }
  }
  const indexPath = relPath(graph.root, graph.indexAbs);
  return graph.docs
    .filter((doc) => !seen.has(doc))
    .map((doc) => finding('unreachable', 'error', doc.file, `${indexPath}에서 도달할 수 없음`));
}
