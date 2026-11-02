import { SECTION_ORDER, isRequiredRole } from '../headings.js';
import type { Graph } from '../graph.js';
import { finding, type Finding, type Section } from '../model.js';

// 개요와 상세 문서의 H2 절 순서를 검사한다. 첫 절은 목적, 마지막 절은 관련 문서여야 하고,
// 순서 목록에 있는 어휘 절은 역할별 기준 순서를 따라야 한다. 기준보다 앞에 온 절마다 경고 하나를 낸다.
// 키가 없는 H2나 순서 목록 밖의 어휘 절은 어디에 와도 된다. 색인과 로그는 검사하지 않는다.
export function sectionOrder(graph: Graph): Finding[] {
  const out: Finding[] = [];
  for (const doc of graph.docs) {
    if (!isRequiredRole(doc.role)) continue;
    const sections = doc.sections;
    if (sections.length === 0) continue;
    const order = SECTION_ORDER[doc.role];

    const first = sections[0];
    if (first.key !== 'purpose') {
      out.push(
        finding('section-order', 'warning', doc.file, `첫 절은 "## ${graph.vocab.purpose}"이어야 함`, first.heading.line),
      );
    }

    const last = sections[sections.length - 1];
    if (last.key !== 'related') {
      out.push(
        finding('section-order', 'warning', doc.file, `마지막 절은 "## ${graph.vocab.related}"이어야 함`, last.heading.line),
      );
    }

    let maxIndex = -1;
    let maxSection: Section | undefined;
    for (const section of sections) {
      if (section.key === undefined) continue;
      const idx = order.indexOf(section.key);
      if (idx < 0) continue;
      if (idx < maxIndex) {
        const top = maxSection?.key;
        if (top !== undefined) {
          out.push(
            finding(
              'section-order',
              'warning',
              doc.file,
              `"## ${graph.vocab[section.key]}" 절은 "## ${graph.vocab[top]}" 앞에 와야 함`,
              section.heading.line,
            ),
          );
        }
      } else if (idx > maxIndex) {
        maxIndex = idx;
        maxSection = section;
      }
    }
  }
  return out;
}
