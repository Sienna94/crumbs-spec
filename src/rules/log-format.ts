import type { Graph } from '../graph.js';
import { LOG_KINDS, parseLogHeading, type ParsedLogHeading } from '../log.js';
import { MESSAGES, type Messages } from '../messages.js';
import { finding, type Finding } from '../model.js';

// 로그 문서의 H2 항목 제목이 "[YYYY-MM-DD] kind | 제목" 형식이고 날짜가 실제 달력 날짜인지 본다. 어긋난 제목마다 오류 하나다.
export function logFormat(graph: Graph): Finding[] {
  const log = graph.docs.find((doc) => doc.role === 'log');
  if (log === undefined) return [];
  const out: Finding[] = [];
  for (const heading of log.headings.filter((h) => h.level === 2)) {
    const parsed = parseLogHeading(heading.text);
    if (!parsed.ok) {
      out.push(finding('log-format', 'error', log.file, message(MESSAGES[graph.lang], parsed, heading.text), heading.line));
    }
  }
  return out;
}

function message(m: Messages, parsed: Exclude<ParsedLogHeading, { ok: true }>, text: string): string {
  switch (parsed.reason) {
    case 'format':
      return m.logHeadingFormat(text);
    case 'kind':
      return m.logKindUnknown(parsed.kind, LOG_KINDS.join(', '));
    case 'date':
      return m.logDateInvalid(parsed.date);
  }
}
