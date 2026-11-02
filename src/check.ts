import { loadRepoConfig } from './config.js';
import type { Lang } from './headings.js';
import { buildGraph, relPath, type Graph } from './graph.js';
import { MESSAGES } from './messages.js';
import { brokenAnchor } from './rules/broken-anchor.js';
import { brokenLink } from './rules/broken-link.js';
import { duplicatePolicy } from './rules/duplicate-policy.js';
import { logBody } from './rules/log-body.js';
import { logFormat } from './rules/log-format.js';
import { logOrder } from './rules/log-order.js';
import { missingBacklink } from './rules/missing-backlink.js';
import { missingCodePath } from './rules/missing-code-path.js';
import { missingFlow } from './rules/missing-flow.js';
import { missingSection } from './rules/missing-section.js';
import { openQuestion } from './rules/open-question.js';
import { sectionOrder } from './rules/section-order.js';
import { unreachable } from './rules/unreachable.js';
import { unterminatedComment } from './rules/unterminated-comment.js';
import { finding, type Config, type Finding, type Report } from './model.js';

// 모든 문서는 첫 제목이 H1이어야 한다. 제목이 없는 문서는 1줄을 가리킨다.
function missingTitle(graph: Graph): Finding[] {
  return graph.docs
    .filter((doc) => doc.headings[0]?.level !== 1)
    .map((doc) => finding('missing-title', 'error', doc.file, MESSAGES[graph.lang].h1Title, doc.headings[0]?.line ?? 1));
}

function checkGraph(graph: Graph): Finding[] {
  if (graph.index === undefined) {
    const indexPath = relPath(graph.root, graph.indexAbs);
    // 인덱스가 없으면 다른 규칙은 돌리지 않는다.
    return [finding('index-missing', 'error', indexPath, MESSAGES[graph.lang].indexMissing(indexPath), 1)];
  }
  return [
    ...missingTitle(graph),
    ...unterminatedComment(graph),
    ...brokenLink(graph),
    ...brokenAnchor(graph),
    ...unreachable(graph),
    ...missingSection(graph),
    ...missingBacklink(graph),
    ...missingCodePath(graph),
    ...duplicatePolicy(graph),
    ...logFormat(graph),
    ...logOrder(graph),
    ...logBody(graph),
    ...sectionOrder(graph),
    ...missingFlow(graph),
    ...openQuestion(graph),
  ];
}

const compareText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

// file, line, rule, message 순으로 정렬한다.
function sortFindings(findings: Finding[]): Finding[] {
  return [...findings].sort(
    (a, b) =>
      compareText(a.file, b.file) ||
      a.line - b.line ||
      compareText(a.rule, b.rule) ||
      compareText(a.message, b.message),
  );
}

export function runCheck(root: string, config: Config): Report {
  const graph = buildGraph(root, config);
  const findings = sortFindings(checkGraph(graph));
  const errors = findings.filter((finding) => finding.severity === 'error').length;
  return {
    version: 1,
    ok: errors === 0,
    summary: { documents: graph.docs.length, errors, warnings: findings.length - errors },
    findings,
  };
}

// configPath가 없으면 저장소 루트의 crumbs.json을 읽는다. fallback은 설정을 읽기 전 오류의 언어다(--lang 또는 en).
export function checkRepo(root: string, configPath?: string, fallback?: Lang): Report {
  return runCheck(root, loadRepoConfig(root, configPath, fallback));
}
