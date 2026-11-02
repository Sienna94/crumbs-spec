import { REQUIRED_SECTIONS, isRequiredRole } from '../headings.js';
import type { Graph } from '../graph.js';
import { MESSAGES } from '../messages.js';
import { finding, type Finding } from '../model.js';

// 개요와 상세 문서는 역할별 필수 H2 절을 모두 가져야 한다. 빠진 절마다 발견 하나를 낸다.
export function missingSection(graph: Graph): Finding[] {
  const out: Finding[] = [];
  for (const doc of graph.docs) {
    if (!isRequiredRole(doc.role)) continue;
    const present = new Set(doc.sections.map((section) => section.key));
    for (const key of REQUIRED_SECTIONS[doc.role]) {
      if (!present.has(key)) {
        out.push(
          finding('missing-section', 'error', doc.file, MESSAGES[graph.lang].sectionMissing(graph.vocab[key]), doc.title?.line),
        );
      }
    }
  }
  return out;
}
