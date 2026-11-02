import type { Graph } from '../graph.js';
import { parseLogHeading } from '../log.js';
import { MESSAGES } from '../messages.js';
import { finding, type Finding } from '../model.js';

// kind가 decision인 항목은 본문(제목 줄 다음부터 다음 H2 직전까지)에 내부 링크가 하나 이상 있어야 한다. 없으면 제목 줄마다 경고 하나다.
// 링크는 파싱된 doc.links를 쓰고, 항목 경계는 H2 제목 줄로 정한다.
export function logBody(graph: Graph): Finding[] {
  const log = graph.docs.find((doc) => doc.role === 'log');
  if (log === undefined) return [];
  const out: Finding[] = [];
  const entries = log.headings.filter((h) => h.level === 2);
  entries.forEach((heading, index) => {
    const parsed = parseLogHeading(heading.text);
    if (!parsed.ok || parsed.kind !== 'decision') return;
    const end = entries[index + 1]?.line ?? Number.MAX_SAFE_INTEGER;
    const linked = log.links.some(
      (link) => link.kind === 'internal' && link.line > heading.line && link.line < end,
    );
    if (!linked) out.push(finding('log-body', 'warning', log.file, MESSAGES[graph.lang].decisionLink, heading.line));
  });
  return out;
}
