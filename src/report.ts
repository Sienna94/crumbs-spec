import type { Report } from './model.js';

// 발견마다 한 줄, 발견이 있으면 빈 줄 하나, 그다음 요약 한 줄.
export function formatText(report: Report): string {
  const lines = report.findings.map(
    (finding) =>
      `${finding.file}${finding.line === undefined ? '' : `:${finding.line}`} ${finding.severity} ${finding.rule}: ${finding.message}`,
  );
  if (lines.length > 0) lines.push('');
  const { documents, errors, warnings } = report.summary;
  lines.push(`crumbs check: 문서 ${documents}개, 오류 ${errors}개, 경고 ${warnings}개`);
  return `${lines.join('\n')}\n`;
}

export function formatJson(report: Report): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}
