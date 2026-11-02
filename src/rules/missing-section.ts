import { REQUIRED_SECTIONS, isRequiredRole } from '../headings.js';
import { relPath, type Graph } from '../graph.js';
import { MESSAGES } from '../messages.js';
import { finding, type Finding } from '../model.js';

// 개요와 상세 문서는 역할별 필수 H2 절을 모두 가져야 한다. 빠진 절마다 발견 하나를 낸다.
// 필수 절이 하나도 없으면 crumbs 문서가 아닐 가능성이 크므로, 발견 하나로 exclude 설정을 안내한다.
export function missingSection(graph: Graph): Finding[] {
  const out: Finding[] = [];
  for (const doc of graph.docs) {
    if (!isRequiredRole(doc.role)) continue;
    const present = new Set(doc.sections.map((section) => section.key));
    const required = REQUIRED_SECTIONS[doc.role];
    const line = doc.title?.line ?? 1;
    if (required.every((key) => !present.has(key))) {
      // 스펙 루트 바로 아래의 파일은 파일 이름을, 하위 디렉터리의 파일은 디렉터리(끝 "/")를 안내한다.
      const rel = relPath(graph.specAbs, doc.abs);
      const slash = rel.lastIndexOf('/');
      const target = slash < 0 ? rel : rel.slice(0, slash + 1);
      out.push(finding('missing-section', 'error', doc.file, MESSAGES[graph.lang].noSpecSections(target), line));
      continue;
    }
    for (const key of required) {
      if (!present.has(key)) {
        out.push(finding('missing-section', 'error', doc.file, MESSAGES[graph.lang].sectionMissing(graph.vocab[key]), line));
      }
    }
  }
  return out;
}
