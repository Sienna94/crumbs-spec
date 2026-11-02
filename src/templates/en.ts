import type { TemplatePaths } from './ko.js';

// 영어 템플릿. ko.ts와 같은 다섯 템플릿을 문장 단위로 대응한다. 제목은 VOCAB.en을 따른다.
// 파일 이름 부분은 설정 값으로 바꿔 넣는다. 기본 설정에서는 영어 기본 문서의 원문과 같다.
export const en = {
  index: (p: TemplatePaths): string => `# Spec index

This document is the entry point to every spec document in the repository. Each linked overview
document covers one area of the system, and each detail document owns one responsibility and describes its current behavior.

## Domains

<!-- One line per domain: - [Domain name](domain/${p.overview}) — one-line scope -->

## Records
- [Log](${p.log}) — what was done to the documents, newest last; add an entry after applying source material or changing a document
`,

  overview: (p: TemplatePaths): string => `# <Domain name>
<!-- Read ../${p.index} first. After changing this document, add an entry to ../${p.log} -->

## Purpose
<The responsibility this area owns and what it does not cover, in one paragraph>

## Flow
<One Mermaid flowchart with one node per detail document. Arrows follow the order the user experiences. If there is only one document, write "None">

## Documents
- [<detail document title>](<file>.md) — <one-line responsibility>

## Terms
<!-- Optional section. Keep only names that specs, code, or other documents call differently. Do not write definitions; link to the policy of the owning document. If there are no aliases, delete the whole section -->
- <standard term>(<alias1>, <alias2>) — [<policy title>](<file>.md#<policy-anchor>)

## Related
- [Spec index](../${p.index})
`,

  detail: (p: TemplatePaths): string => `# <Responsibility title>
<!-- Read ../${p.index} first. After changing this document, add an entry to ../${p.log} -->

## Purpose
<What this document owns. One responsibility only. If a channel or platform applies to the whole document, one sentence>

## Current behavior
<How the system behaves now, as the reader experiences it. Present tense. If there are three or more steps, split them under ### step-name subheadings>

## Flow
<If current behavior has two or more steps, one Mermaid diagram (flowchart; use stateDiagram-v2 for screen or state transitions).
A branch with two or more comparison axes, such as channel or state, goes in a table. If there is only one step, write "None">

## Policies
### <policy name>
<Rule. If code, tests, or approved material do not confirm it, write the current behavior as a declarative sentence on the first line,
then write [needs confirmation] and the question on the next line>

## Evidence
- \`<path/to/file.ext>\` — <what it implements> (the path must contain a "/"; write a root file as ./file)

## Open questions
- [needs confirmation] [<policy name>](#<policy-anchor>) — <question that would change behavior or scope>

## Related
- [<domain> overview](${p.overview})
`,

  log: (today: string): string => `# Spec log

A chronological record of what was done to the documents. The newest entry comes last.
Entry heading: \`## [YYYY-MM-DD] kind | title\`; kind is one of ingest, query, lint, drift, change, decision.

## [${today}] change | crumbs-spec initialized
`,

  rawReadme: (p: TemplatePaths): string => `# Source material

Keep source material that must not change here, such as contracts, exported tickets, planning notes, and screenshots.
Agents only read files here and never edit them. Spec documents under \`${p.specDir}/\` cite these files in their "Evidence" section.
`,
};
