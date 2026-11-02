import type { Graph } from '../graph.js';
import { MESSAGES } from '../messages.js';
import { finding, type Finding, type Heading, type SpecDoc } from '../model.js';

// 정책 이름은 문서 하나만 소유한다. 로그 문서는 면제다.
// 같은 정규화 이름이 한 문서 안에 두 번 이상 있으면, 두 번째부터의 제목마다 발견 하나를 낸다.
// 같은 이름이 서로 다른 두 문서 이상에 있으면, 관련 문서마다 발견 하나를 낸다.
export function duplicatePolicy(graph: Graph): Finding[] {
  const out: Finding[] = [];
  const groups = new Map<string, { doc: SpecDoc; heading: Heading }[]>();
  for (const doc of graph.docs) {
    if (doc.role === 'log') continue;
    const firstInDoc = new Map<string, Heading>();
    for (const policy of doc.policies) {
      const earlier = firstInDoc.get(policy.normalized);
      if (earlier === undefined) {
        firstInDoc.set(policy.normalized, policy.heading);
      } else {
        out.push(
          finding(
            'duplicate-policy',
            'error',
            doc.file,
            MESSAGES[graph.lang].duplicatePolicyInDoc(policy.heading.text, earlier.line),
            policy.heading.line,
          ),
        );
      }
      const entries = groups.get(policy.normalized) ?? [];
      entries.push({ doc, heading: policy.heading });
      groups.set(policy.normalized, entries);
    }
  }

  for (const entries of groups.values()) {
    const docs: SpecDoc[] = [];
    for (const entry of entries) {
      if (!docs.includes(entry.doc)) docs.push(entry.doc);
    }
    if (docs.length < 2) continue;
    for (const doc of docs) {
      const first = entries.find((entry) => entry.doc === doc);
      if (first === undefined) continue;
      const others = docs
        .filter((other) => other !== doc)
        .map((other) => other.file)
        .join(', ');
      out.push(
        finding(
          'duplicate-policy',
          'error',
          doc.file,
          MESSAGES[graph.lang].duplicatePolicy(first.heading.text, others),
          first.heading.line,
        ),
      );
    }
  }
  return out;
}
