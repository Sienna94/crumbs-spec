import type { Graph } from '../graph.js';
import { MESSAGES } from '../messages.js';
import { finding, type Finding } from '../model.js';

// 상세 문서의 "현재 동작"이 여섯 단계 이상인데 흐름 도식(mermaid 펜스)도 표도 없으면 경고 하나를 낸다.
export function missingFlow(graph: Graph): Finding[] {
  const out: Finding[] = [];
  for (const doc of graph.docs) {
    if (doc.role !== 'detail') continue;
    const { mermaidFences, tableRows, behaviorBullets } = doc.flow;
    if (behaviorBullets < 6 || mermaidFences > 0 || tableRows > 0) continue;
    const behavior = doc.sections.find((section) => section.key === 'behavior');
    out.push(
      finding(
        'missing-flow',
        'warning',
        doc.file,
        MESSAGES[graph.lang].flowMissing(behaviorBullets),
        behavior?.heading.line,
      ),
    );
  }
  return out;
}
