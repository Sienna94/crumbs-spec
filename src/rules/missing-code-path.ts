import { pathExists, type Graph } from '../graph.js';
import { finding, type Finding } from '../model.js';

// 근거 절의 코드 경로 후보가 실제 파일이나 디렉터리로 존재해야 한다.
export function missingCodePath(graph: Graph): Finding[] {
  const out: Finding[] = [];
  for (const doc of graph.docs) {
    for (const evidence of doc.evidencePaths) {
      if (!pathExists(evidence.resolved)) {
        out.push(finding('missing-code-path', 'error', doc.file, `코드 경로가 없음: ${evidence.raw}`, evidence.line));
      }
    }
  }
  return out;
}
