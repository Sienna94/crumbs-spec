import type { Graph } from '../graph.js';
import { parseLogHeading } from '../log.js';
import { finding, type Finding } from '../model.js';

// 형식이 맞는 항목들은 파일 순서대로 날짜가 늘어나야 한다. 바로 앞의 형식 맞는 항목보다 앞선 날짜마다 경고 하나다.
// 같은 날짜는 허용한다. 경고만 내며, 형식이 틀린 항목은 비교에서 건너뛴다(Q13, Q15).
export function logOrder(graph: Graph): Finding[] {
  const log = graph.docs.find((doc) => doc.role === 'log');
  if (log === undefined) return [];
  const out: Finding[] = [];
  let previous: string | undefined;
  for (const heading of log.headings.filter((h) => h.level === 2)) {
    const parsed = parseLogHeading(heading.text);
    if (!parsed.ok) continue;
    if (previous !== undefined && parsed.date < previous) {
      out.push(
        finding('log-order', 'warning', log.file, `이전 항목(${previous})보다 날짜가 앞섬: ${parsed.date}`, heading.line),
      );
    }
    previous = parsed.date;
  }
  return out;
}
