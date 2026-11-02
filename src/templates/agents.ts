import type { Lang } from '../headings.js';

export const AGENTS_START = '<!-- crumbs:start -->';
export const AGENTS_END = '<!-- crumbs:end -->';

export interface AgentsPaths {
  specDir: string;
  index: string;
  log: string;
  rawDir: string;
}

// AGENTS.md에 들어가는 자기 표시 블록. 경로는 설정 값으로 바꿔 넣는다. 표시 두 줄은 두 언어가 같다.
export function agentsBlock(p: AgentsPaths, lang: Lang): string {
  return lang === 'en' ? agentsBlockEn(p) : agentsBlockKo(p);
}

function agentsBlockKo(p: AgentsPaths): string {
  return `${AGENTS_START}
## 스펙 문서 (crumbs)

스펙 문서는 \`${p.specDir}/\` 아래에 있고 시스템이 지금 어떻게 동작하는지 설명한다.
매번 \`${p.specDir}/${p.index}\`를 먼저 읽는다. \`${p.rawDir}/\` 아래 원본 자료는 읽기 전용이다.

탐색 순서: 인덱스 → 도메인 개요 → 상세 문서 → 그 문서의 "관련 문서".
답을 소유한 문서를 찾는 즉시 멈추고 그 문서를 인용한다.

동작을 바꿀 때의 규칙:
- 모든 정책은 정확히 하나의 상세 문서가 소유한다. 아무도 문서 갱신을 요청하지 않았더라도
  코드와 같은 변경에서 그 문서를 갱신한다.
- 변경이 아니라 현재 동작을 설명한다. 변경 이력이나 요구사항 ID를 넣지 않는다.
- 근거로 삼은 코드를 "근거" 절에 \`crumbs.json\`의 \`codeRoot\` 기준 경로로 적고, 원본 자료는 \`${p.rawDir}/<파일>\`로 적는다. 링크는 양방향으로 유지한다: 상세 문서는 개요와
  관련 문서로 링크하고, 그 문서들도 되돌아오는 링크를 둔다.
- 코드·테스트·승인된 자료로 확인할 수 없는 정책은 \`[확인 필요]\`와 질문을 적는다.
  추측하지 않는다.
- 새 자료를 반영하거나 문서를 바꾼 뒤에는 \`${p.specDir}/${p.log}\`에
  \`## [YYYY-MM-DD] kind | 제목\` 형식으로 항목을 추가한다
  (kind: ingest, query, lint, drift, change, decision).
- 마치기 전에 \`npx crumbs-spec check\`를 실행하고 보고된 오류를 모두 고친다.
${AGENTS_END}`;
}

function agentsBlockEn(p: AgentsPaths): string {
  return `${AGENTS_START}
## Spec documents (crumbs)

Spec documents live under \`${p.specDir}/\` and describe how the system works now.
Always read \`${p.specDir}/${p.index}\` first. Raw source material under \`${p.rawDir}/\` is read-only.

Navigation order: index → domain overview → detail document → that document's "Related" section.
Stop as soon as you find the document that owns the answer, and quote it.

Rules when behavior changes:
- Every policy is owned by exactly one detail document. Even if nobody asks you to update the document,
  update it in the same change as the code.
- Describe the current behavior, not the change. Do not add change history or requirement IDs.
- List the code you relied on in the "Evidence" section, with paths relative to \`codeRoot\` in \`crumbs.json\`; cite source material as \`${p.rawDir}/<file>\`. Keep links in both directions: detail documents link to the overview
  and related documents, and those documents link back.
- If code, tests, or approved material cannot confirm a policy, write \`[needs confirmation]\` and a question.
  Do not guess.
- After reflecting new material or changing a document, add an entry to \`${p.specDir}/${p.log}\` in the form
  \`## [YYYY-MM-DD] kind | title\` (kind: ingest, query, lint, drift, change, decision).
- Before finishing, run \`npx crumbs-spec check\` and fix every reported error.
${AGENTS_END}`;
}
