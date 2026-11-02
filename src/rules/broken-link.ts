import { isFile, type Graph } from '../graph.js';
import { MESSAGES } from '../messages.js';
import { finding, type Finding } from '../model.js';

// 모든 문서의 내부 링크 대상이 파일로 존재해야 한다. specDir 밖(rawDir 포함) 대상도 존재만 검사한다.
export function brokenLink(graph: Graph): Finding[] {
  const out: Finding[] = [];
  for (const doc of graph.docs) {
    for (const link of doc.links) {
      if (link.kind !== 'internal' || link.path === undefined) continue;
      if (!isFile(link.path)) {
        out.push(finding('broken-link', 'error', doc.file, MESSAGES[graph.lang].linkMissing(link.rawTarget), link.line));
      }
    }
  }
  return out;
}
