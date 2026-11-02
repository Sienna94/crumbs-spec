import type { Graph } from '../graph.js';
import { MESSAGES } from '../messages.js';
import { finding, type Finding } from '../model.js';

// 미확정 정책 마커가 있는 문서마다 경고 하나를 낸다. 경고는 check를 실패시키지 않는다.
export function openQuestion(graph: Graph): Finding[] {
  const out: Finding[] = [];
  for (const doc of graph.docs) {
    if (doc.markerCount > 0) {
      out.push(
        finding('open-question', 'warning', doc.file, MESSAGES[graph.lang].openQuestions(doc.markerCount), doc.firstMarkerLine),
      );
    }
  }
  return out;
}
