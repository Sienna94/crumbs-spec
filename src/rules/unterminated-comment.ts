import type { Graph } from '../graph.js';
import { MESSAGES } from '../messages.js';
import { finding, type Finding } from '../model.js';

// 파일 끝까지 닫히지 않은 HTML 주석이 있으면 주석이 시작한 줄마다 오류 하나다. 그 뒤의 내용은 check가 보지 못한다.
export function unterminatedComment(graph: Graph): Finding[] {
  const out: Finding[] = [];
  for (const doc of graph.docs) {
    if (doc.unterminatedComment === undefined) continue;
    out.push(
      finding('unterminated-comment', 'error', doc.file, MESSAGES[graph.lang].unterminatedComment, doc.unterminatedComment),
    );
  }
  return out;
}
