import type { SkillName } from '../skills.js';
import type { TemplatePaths } from './ko.js';

// 스킬 4종의 SKILL.md 본문(영어). skills-ko.ts를 문장 단위로 대응한다: 같은 frontmatter name, 같은 H2 절 수,
// 같은 번호 항목 수, 같은 명령 예시. 미확정 마커는 [needs confirmation]이다. 이 파일이 영어 스킬 원문의 유일한 원본이다.

const writer = (p: TemplatePaths): string => `---
name: crumbs-writer
description: Writes or updates a crumbs spec document (a responsibility document under ${p.specDir}/). Use it to reflect behavior or policy changed by code in the owning document, to document existing code that has no spec yet from its code and tests alone, and to create a new domain overview or detail document. For a request whose policy is unconfirmed, first create questions with crumbs-interview; when you only need to find an answer without editing documents, use crumbs-finder.
---

# crumbs-writer

Writes or updates a living spec document that explains one responsibility. The document explains how the system behaves now, not its change history, and every policy is owned by exactly one detail document.

## Read first

1. \`${p.specDir}/${p.index}\`. Always read it first. It lists the domains and overview documents.
2. The \`${p.overview}\` of the domain the request touches, then the detail documents and their "Related" sections.
3. \`crumbs.json\`. If \`specDir\`, \`overview\`, \`log\`, \`rawDir\`, or \`headings\` differ from the defaults, use those values. Code and test paths under "Evidence" are relative to \`codeRoot\` (the repository root by default); source material under \`${p.rawDir}/\` is always written from the repository root.
4. \`${p.specDir}/templates/detail.md\` and \`${p.specDir}/templates/overview.md\`. Start new documents from these templates.

## Choose a mode

- To reflect changed behavior in a document that already exists, use "Reflect a change".
- To document code that no document describes yet, using only the code and tests, use "Document existing code".
- If both apply, document the code first with "Document existing code", then do "Reflect a change".
- In "Reflect a change", if any policy the request touches is not confirmed by code, tests, or approved material, first create questions with crumbs-interview before writing. In "Document existing code", do not ask; keep the questions in the document instead (step 5 of that section).

## Reflect a change

1. Find the owning document. Go down from the index to the overview to the detail document. Find the document whose "Evidence" lists the changed code path with \`grep -rl '<path>' ${p.specDir}\`, and find the changed policy name with \`grep -rn '^### ' ${p.specDir}\`. If an API number or endpoint changed, also find the owning document under \`${p.specDir}/api/\`.
2. If more than one document looks like the owner, stop and ask which one owns it. Do not write one policy in two documents.
3. Rewrite "Current behavior" as the behavior after the change. Do not add historical narration such as "previously … now …", change dates, or requirement IDs. If the diagram or table under "Flow" holds that behavior, update it too.
4. Under "Policies", edit the body of each changed policy, add a new policy as \`### policy name\`, and delete a policy that was removed. If a policy with the same name already exists in another document, that document owns it: edit it there and keep only a link in this document. A confirmed policy may end with one decision link, \`(decision: [YYYY-MM-DD](../${p.log}#<entry-anchor>))\`, after its last sentence. This is the only exception to the rule against change history. Do not write the reason or the source; the link text carries only the decision date. The entry anchor is the slug of the \`decision\` entry title (format in step 1 of "Document existing code").
5. Update the code and test paths under "Evidence" to match the changed code. Write each path as a backtick path relative to \`codeRoot\` in \`crumbs.json\` (the repository root by default). If a line range is needed, append it like \`src/auth/session.ts:12-48\`. Attach only one range to each path; if one file has several ranges, list them on separate lines. A path must contain a "/"; write a repository-root file as \`./package.json\`.
6. Do not describe a policy that code, tests, or material the user supplied does not confirm. Write it as \`[needs confirmation]\` and a question, in the format of step 5 of "Document existing code".
7. Keep links in both directions. If you added a link to another detail document, add the link back under that document's "Related". If a document's title or scope changed, update its one-line entry in the overview's "Documents" and its line in the index.
8. Add a log entry. The title is one sentence stating the user-visible result, not the task name. The body is written in the order \`Result:\`, \`Reason:\`, \`Document:\` and does not list files. If the same task touched several documents, group it into one entry per domain and give the count under \`Result:\`.
   \`npx crumbs-spec log add --kind change "<one sentence stating the user-visible result>" --body "Result: <changed user-visible result>. Reason: <request, Jira key, interview answer, source material, or code change>. Document: [<policy name>](<domain>/<document>.md#<policy-anchor>)"\`
   If a question policy was confirmed by an answer, add a \`decision\` entry. The title is \`<policy name>: <one-sentence answer>\`, and \`Reason:\` names the person who gave the answer or the source material.
   \`npx crumbs-spec log add --kind decision "<policy name>: <one-sentence answer>" --body "Result: <confirmed value or condition>. Reason: <person who gave the answer, source material>. Document: [<policy name>](<domain>/<document>.md#<policy-anchor>)"\`

## Document existing code (first write)

The only sources are code and tests. Do not read or copy other explanatory documents that already exist in the repository (README, wiki, design notes, documents outside code comments) unless the user names them as source material, because you cannot confirm that they match the current code.

1. Set the responsibility boundary. One detail document is one user flow: from the moment the user starts something until it ends (for example, one document covers simple login from pressing the button through SDK authentication, result handling, terms agreement, and completion). Steps within a flow are not a reason to split documents; they are \`###\` subheadings under "Current behavior".
   - There are only two reasons to split: the callers (user, screen, or system) differ, or the start and end are separate flows (for example, login and password reset). A part that several flows share (an input field, a terms-agreement screen) is one document per part.
   - Only when a document has more than 12 policies or its "Current behavior" exceeds 60 lines is it a candidate for splitting. Count the 12 policies as confirmed and question policies together. If the only growth is question policies with no tests, do not split; group the rules that change together for the same reason into one policy and merge their questions into one.
   - A document with no policies should usually be a paragraph in another document.
   - If a domain directory has more than 15 detail documents, group the ones with close flows into subdirectories and put a \`${p.overview}\` in each subdirectory too (the check rules support nested overviews: the parent of a sub-overview is the upper overview).
   - Server API and SDK contracts (request and response fields, the meaning of response and error codes, retry, idempotency, authentication) are owned by \`${p.specDir}/api/<endpoint>.md\`, not by a screen document. \`api/\` is one domain with its own overview; if an API number exists, put it in the file name and the policy name. A screen document lists only the user-visible result for each code and links to the policy in that api/ document. Common transport contracts such as headers, authentication, cookies, and retries live once, in one detail document inside \`api/\`. Whenever a screen document cites an API number, check that the api/ document exists; if it does not, create it from the same template.
   - Concept pages. \`${p.specDir}/concepts/<concept>.md\` owns a concept when a flow in two or more domains uses the same rule or value table, when a code decision criterion (flag or enum) differs from the user's wording so that it has to be explained each time, or when flow documents use a concept as a branch axis (channel, member state, currency type). A term that has a definition but no rules does not get a page; keep it as one line under the overview's "Terms". If \`concepts/\` does not exist, create it like a domain and add \`- [Concepts](concepts/${p.overview}) — definitions and cross-cutting rules for concepts shared by several domains\` to the index.
   - Decision link format (shared by every skill): a confirmed policy may end with \`(decision: [YYYY-MM-DD](../${p.log}#<slug>))\`. The slug is the entry heading text after "## ", lowercased, with punctuation other than "-" and "_" removed and each space replaced by "-"; for \`## [2026-11-02] decision | Session lifetime: 30 days\` it is \`2026-11-02-decision--session-lifetime-30-days\`.
2. Start from the entry point (a route, handler, command, or screen), follow the calls while reading the code path, and check the expected behavior in the tests that cover the same path. Record only the paths that are the evidence for "Current behavior" or "Policies". Files from other areas that you read for context do not go into "Evidence".
3. Place the file.
   - Domain directory \`${p.specDir}/<domain>/\`. If it does not exist, create it and copy \`${p.specDir}/templates/overview.md\` to make \`${p.overview}\`.
   - Detail documents go at \`${p.specDir}/<domain>/<responsibility>.md\`. The file name is a short name that shows the responsibility (for example \`login-session.md\`; non-ASCII names such as \`로그인-세션.md\` are also allowed). Use \`-\` instead of spaces, and use one style throughout the repository.
   - Start by copying \`${p.specDir}/templates/detail.md\`, and replace every angle-bracket placeholder with real content. If a section has nothing to say, write "None" in it (do not delete the section heading).
4. Fill in the sections.
   - "Purpose": the one responsibility this document owns and what it does not cover. If a channel or platform applies to the whole document, add one sentence for it (if it differs by branch, write it as a branch of "Current behavior").
   - "Current behavior": if there are three or more steps, give each step a \`### step name\` subheading and write bullets under it. Describe what the user experiences, in the present tense. Explain the result, not the code structure.
     - Do not drop values that carry conditions: if a width, size, or time has a branch condition (for example, if the card width is narrower than 220, the cards stack vertically and the inner margin shrinks), write the condition and the result together. Write every branch that splits by channel, platform, permission, or login state (for example, channels A and B always, iOS only inside the review build, channel C does not show it). Values that only decorate without a condition, such as colors, fixed margins, or animations, may be omitted.
     - Sentence rules: one rule per bullet, one condition and one result per sentence. Put the default behavior first and the exceptions and branches after it. Within a sentence, put the condition first (for example, if the user is not logged in, show the guidance screen).
     - Wording rules: write screen text exactly as it appears, inside quotation marks. Do not alternate between two names for the same thing; use one name throughout the document. Expand an abbreviation or alias once, in parentheses, at its first use. For a concept that has its own page, link it at first use, as in \`[Channel](../concepts/channel.md)\`, do not define it again, and use the value names from that page exactly in the rows of branch tables.
     - Style: the body is declarative sentences, and each bullet is a complete sentence. Do not mix styles. Keep the subject as the actor (user, app, server, SDK). When the actor is known, do not use the passive voice. Do not use double negatives or future-tense narration such as "soon", "planned", or "going forward".
     - Quantities and filler: write quantities as numbers with "or more", "or less", "more than", or "fewer than"; do not write "many", "etc.", or "other". Remove words that add no meaning, such as "simply", "easily", or "note that".
     - Subheadings: a \`###\` is a noun phrase naming a user action or result. Do not use generic names such as "Other" or "Note", or directional phrases such as "above" or "below". Do not use the same subheading twice in one document.
     - If a bullet has more than three sentences, or a list inside one bullet has more than four items, split it into bullets or \`###\` subheadings.
     - Do not write class, method, DTO, or field names, internal flags, or call order here. Put them in the " — " descriptions under "Evidence". The exceptions are constant values that split user results, and API numbers.
   - "Flow": if "Current behavior" has two or more steps, draw the structure in one Mermaid diagram (flowchart for order and branches, stateDiagram-v2 for screen or state transitions). A branch with two or more comparison axes, such as channel, state, permission, or login status, goes in a table (rows = branch values, columns = comparison axes). The diagram and table show structure only; do not repeat the sentences of "Current behavior". If there is only one step, write "None".
     - When a server API, SDK, or payment window response splits the branches, the first column of the table is the response code (or error kind), and the other columns are the results that code causes (rollback, guidance text, return). Write that code on the branch edge labels of the diagram too.
     - Do not use a table that carries only one value, or one that splits background, reasons, or time order. Fill empty cells with "None" and do not merge cells.
     - Keep edge labels short, one condition each. Distinguish branches with labels and shapes, not with color.
     - Before the diagram, write one sentence on what it shows; after it, one or two sentences on the key branches and end states. Do not introduce a state or branch in the diagram that does not appear in "Current behavior".
   - "Policies": a \`### name\` and its body for each rule that the tests confirm. A rule is a condition, limit, order, or constant (branch, constant, state transition) that decides a user result. The first sentence of the body is the rule, and exceptions follow it. A rule shared by several flows is owned by a concept page, not by a flow document; the flow document states the result and links to the rule.
     - Code structure and call order are not rules. What the user sees on screen, such as layout, goes into "Current behavior"; implementation structure goes into the explanation under "Evidence". Write numbers, deadlines, and conditions exactly as read from the code.
     - A rule that exists only in code and has no tests is written as in step 5. When the tests confirm only part of a rule, split it into a confirmed policy for the confirmed part and a question policy for the rest.
     - A policy name must be unique across the repository (the \`duplicate-policy\` check). If the same name might appear in another domain, put the subject in the name (for example, "Email signup expiry notice", not "Expiry notice"). The name must read correctly without context and must not be a question.
   - "Evidence": list the code and test paths you read as backtick paths that contain a "/", and after \` — \` write what that path implements. Do not put identifiers in backticks in the explanation; \`check\` ignores spans without a "/", but identifiers belong in plain text.
   - "Open questions": every question that the code and tests do not answer. The format is in step 5.
   - "Related": one link to the overview, and the other detail documents that share the same flow.
5. Write any unconfirmed policy as a question, not as a statement. If a branch exists but you cannot tell why, there is no test, or you do not know the basis of a constant, write \`### policy name\` (the heading is the policy name, not a question), then under it write in the first paragraph the current behavior you read in the code as declarative sentences, using several sentences if needed so that no condition, number, or branch result is lost (one paragraph). On the next line write \`[needs confirmation] <question>\`. Ask about what you do not know, as is (for example: is this intended, and if not, what should it be? / what is the basis of this constant? / which is right, the comment or the code?). Do not turn a question about basis or alternatives into a question about intent. This description is an observation, not a confirmed fact, so never leave it without the marker line. Under "Open questions" put \`- [needs confirmation] [policy name](#policy-name) — <same question>\` (the link is checked by the broken-anchor rule of \`check\`). Do not invent a plausible value or intent.
6. Update the overview and the index. Changes to the overview and the index are included in the log entry of the detail document, so do not create a separate log entry for the overview.
   - Add \`- [title](<file>.md) — one-line responsibility\` to the overview's "Documents". If it is a new domain, add \`- [Domain name](<domain>/${p.overview}) — one-line scope\` under "Domains" in \`${p.specDir}/${p.index}\`. The overview's "Related" must contain \`[Spec index](../${p.index})\`.
   - The overview's "Flow" has one Mermaid flowchart with one node per detail document, with arrows drawn in the order the user experiences them. When you add or remove a document, change its node too. The sentence rules before and after the diagram are the same as for detail documents.
   - If the material, the code, or other documents call a policy or screen name differently, add one line to the overview's "Terms": \`- Standard term(alias1, alias2) — [policy title](<file>.md#<anchor>)\`. Do not write the definition; keep only the link. A term owned by another domain links to that domain's document. If the overview has no "Terms" section, add one after "Documents".
7. Add a log entry. The title and body conventions are the same as step 8 of "Reflect a change". If you created several detail documents in the same domain, do not write an entry per document; group them into one entry per domain and give the count under \`Result:\`.
   \`npx crumbs-spec log add --kind change "<one sentence stating the user-visible result>" --body "Result: <n> draft detail documents for <domain>, <m> open questions. Reason: first documented from code and tests. Document: [<policy name>](<domain>/<responsibility>.md#<policy-anchor>)"\`
   <m> is the total number of items in the "Open questions" sections of those documents.

## Do not

- Do not add change history, requirement IDs, status tables, or front matter. The only exception is the decision link at the end of a confirmed policy (step 4 of "Reflect a change").
- Do not write the same policy in two documents. Link a policy owned by another document by its title (\`[Session lifetime](../auth/login.md#session-lifetime)\`).
- Do not edit files under \`${p.rawDir}/\`.
- Do not write an unverified policy as a statement.
- Do not use alert blocks such as \`> [!NOTE]\`, headings made from bold text, or bare URLs in the body. The only label is \`[needs confirmation]\`.

## Before finishing

1. Run \`npx crumbs-spec check\` and fix every error. An \`open-question\` warning means the document still has open questions; leave it as is. A \`missing-flow\` warning means "Current behavior" has six or more steps but neither a diagram nor a table, so remove it by filling in "Flow". A \`section-order\` warning means the section order differs from the template, so remove it by moving the sections.
2. Review again: every policy you added or changed is traceable to a path under "Evidence" or is a \`[needs confirmation]\` question; every rule verified by the tests named under "Evidence" appears in some \`###\` policy; and every branch in the code you read that splits by channel, platform, permission, or login state appears in some sentence of "Current behavior".
3. Confirm that the log entry was added with \`grep '^## \\[' ${p.specDir}/${p.log} | tail -3\`.
`;

const finder = (p: TemplatePaths): string => `---
name: crumbs-finder
description: Finds current behavior and policies in the crumbs spec documents (${p.specDir}/) and answers with the file path and heading attached as the source. Use it for questions such as "how does it work now", "what is the policy", and "which document owns this". If the answer combined several documents or came from code, propose writing it back into the owning document. For writing or editing documents, use crumbs-writer; for confirming a policy before writing, use crumbs-interview.
---

# crumbs-finder

Finds an answer in the spec documents and answers with the source attached. As soon as you find the document that owns the answer, stop. If the answer was not in any document, propose writing that fact back into the document. Apply it only after the user agrees.

## Search order

1. Read \`${p.specDir}/${p.index}\` and pick the domain the question belongs to. If you cannot tell the domain, find candidates with \`grep -ril '<keyword>' ${p.specDir}\`, but give the final answer only from documents checked in the order below.
2. If the question asks for the definition or value of a term or concept, check "Terms" and "Documents" in \`${p.specDir}/concepts/${p.overview}\` first.
3. Read "Documents" in that domain's \`${p.overview}\` and pick the detail document whose responsibility matches. If the question's wording appears as an alias under "Terms", the link on that line is the owning document.
4. Read "Current behavior" and "Policies" in the detail document. If the policy's \`### heading\` is here, this document is the owner. Stop here.
5. If not, follow the document's "Related" links one step only. If it is still not there, the question is not in the documents. Do not search every other domain; answer "not in the documents".
6. If the documents are silent and the user still wants an answer, read the code paths under "Evidence" (relative to \`codeRoot\` in \`crumbs.json\`) and answer. State that the answer came from code.

## How to answer

- Attach a source to each answer: the file path and the heading. Example: \`${p.specDir}/auth/login.md > Policies > Session lifetime\`.
- Summarize the document to fit the question rather than copying it, but give numbers, deadlines, and conditions exactly as the document states them.
- Say that a policy marked \`[needs confirmation]\` is unconfirmed. Do not answer as if it were confirmed.
- If the document and the code appear to differ, quote both and say you do not know which is right. Do not guess one.
- If neither the documents nor the code contain it, answer "None". Do not invent a plausible answer.
- Give the answer first and the source after it. For one policy, use one paragraph of five sentences or fewer; for several policies, one bullet per policy; if there are two or more comparison axes, answer in a table.
- Answer with the document's standard term. If the asker used a different expression, connect the two once in parentheses in the first sentence (for example, Points (miles)). Spell out abbreviations at their first use.
- Do not refer to earlier turns ("as mentioned above", "the document below"); point to the path every time.

## Feedback (write the answer back into the document)

If any of the following is true, give the answer and then propose feedback.

- Answering required combining the contents of several documents.
- The documents were silent, so the answer came from reading code.
- The document's wording did not answer the question directly and needed interpretation.

Steps:

1. Pick one owning document. For a combined answer, it is the responsibility document of the policy's subject. Do not create a new document or an orphan page.
2. Show the sentence to add as a proposal, with the section it goes into ("Current behavior", or which \`###\` under "Policies"). Do not apply it automatically.
3. If the user agrees, apply it. If the content came from code, add that path under "Evidence". Then add a log entry.
   \`npx crumbs-spec log add --kind query "<question summary>" --body "Result: <one-sentence answer>. Document: [<policy name>](<domain>/<document>.md#<policy-anchor>)"\`
   Write the body of a query entry with \`Result:\` (the one-sentence answer) and \`Document:\` (a link to the document that gave the answer).
4. If the user declines, change nothing and leave no log entry.

## Do not

- If you only answered, do not change any file.
- Do not apply feedback without the user's agreement.
- Do not read widely into documents unrelated to the question. Stop once you find the owning document.

## Before finishing

If you changed a document, run \`npx crumbs-spec check\` and fix every error. If you only answered, confirm that the working tree has no changes.
`;

const interview = (p: TemplatePaths): string => `---
name: crumbs-interview
description: Before writing or changing a crumbs spec document, lists every policy the request touches, separates the ones confirmed by code, tests, or source material from the unconfirmed ones, asks the unconfirmed ones as questions in the "open questions" format, and then stops. Use it as the first step of any request that will change documents: a new feature request, a policy change request, or reflecting planning or contract material. The writing after the answers is done by crumbs-writer.
---

# crumbs-interview

Surface what is unknown before a document is written. Do not describe unconfirmed policies; leave them as questions, and do not start writing that changes scope until the answers arrive.

## Procedure

1. Read \`${p.specDir}/${p.index}\`, then the \`${p.overview}\` and detail documents of the domain the request touches.
2. List every policy the request touches. Separate the policies already in the documents (those that will change) from new policies, and give each one its owning document ("new" if there is none).
3. Set a status for each policy.
   - Confirmed: code, tests, material under \`${p.rawDir}/\`, or material the user supplied this time confirms the rule. Record the evidence with it (a file path, a line range if needed, or the material file).
   - Unconfirmed: none of the above confirms it. A plausible default that comes to mind still counts as unconfirmed.
4. Show the policy table and the question list in the "Output format" below.
5. If one or more policies are unconfirmed, stop and wait for answers. Do not start writing that changes scope, behavior, or policy text until the answers arrive. The only exception is when the user explicitly says to proceed with the marks left in place; then write the unconfirmed policies as \`[needs confirmation]\` questions and hand off to crumbs-writer.
6. When answers arrive, decide the source of each answer. A user's answer is approved material, so write it into the document as a confirmed statement, and after implementation add the code path under "Evidence" so it can be checked against the code.

## Output format

Policy table:

\`\`\`markdown
| Policy | Owning document | Status | Evidence |
|---|---|---|---|
| Session lifetime | auth/login.md | Confirmed | \`src/auth/session.ts:40-52\`, \`test/auth/session.test.ts\` |
| Single-device login | auth/login.md | Unconfirmed | — |
\`\`\`

Write the question list in the same format as the "Open questions" section so that it can be copied into the document as is. One question per line. The order is: the marker, the policy name, \` — \`, a complete question sentence, and the owning documents in parentheses. When it is copied into a document, crumbs-writer turns the policy name into a \`[policy name](#anchor)\` link.

\`\`\`markdown
## Open questions
- [needs confirmation] Single-device login — Does logging in on another device end the previous session? (owner: auth/login.md)
- [needs confirmation] Session expiry notice — Is the user warned before the session expires, and if so, how many days before? (owner: auth/login.md, new)
\`\`\`

Each question becomes one line of the document's "Open questions" section; \`crumbs check\` reports one \`open-question\` warning per document that still has questions.

## Criteria for choosing questions

- Ask only about things whose answer changes the document's scope, behavior description, or policy text. Do not ask about wording or style.
- Do not ask about anything the user's material already answers; record that material as the evidence.
- Ask everything at once. Do not split the questions across several rounds of back-and-forth.

## Do not

- This skill does not change documents. It outputs only the table and the questions.
- Do not leave a log entry. crumbs-writer records the answers as it reflects them, including the \`decision\` entry (body in the order \`Result:\`, \`Reason:\`, \`Document:\`) and the decision link at the end of the confirmed policy (format in step 1 of crumbs-writer "Document existing code").
- Do not put a default value into an unconfirmed policy and propose fixing it later.

## Before finishing

If you did not change any document, there is nothing to run. If the user told you to proceed with the marks left in place and you wrote the document, run \`npx crumbs-spec check\` and fix every error. When a question policy is confirmed, crumbs-writer leaves the \`decision\` entry and the decision link.
`;

const ingest = (p: TemplatePaths): string => `---
name: crumbs-ingest
description: Reads newly placed source material under ${p.rawDir}/ (contracts, planning notes, exported tickets, meeting notes, and so on), finds the affected crumbs spec documents through the index, reverse links, and evidence paths, has the user confirm the list of changes, then reflects them in the owning documents and leaves an ingest log entry. Use it for requests that move source material into the documents, such as "reflect this material in the spec". When reflecting a code change without source material, use crumbs-writer.
---

# crumbs-ingest

Applies one source file to the spec documents. The material is read only and is never edited. Show what will change and get confirmation before changing any document. Process one file at a time.

## Procedure

1. Decide the material. If the user did not give a path, show the recent files in \`${p.rawDir}/\` and ask which one to reflect. If the material is outside \`${p.rawDir}/\`, first ask the user to move it inside (the agent does not move it). Never modify the material.
2. Read the material to the end and extract only the claims about policy and behavior, as a list. Do not extract background, schedules, owners, or opinions.
3. Find candidate documents.
   - Follow \`${p.specDir}/${p.index}\` → the domain \`${p.overview}\` → detail documents, and pick the documents that match the subject of the material.
   - Search for the policy names the material uses with \`grep -rn '^### ' ${p.specDir}\` to find the owning document. If the material's wording differs from the documents, check the aliases under the overview's "Terms".
   - If the material names code, screens, or APIs, find the documents whose "Evidence" lists those paths with \`grep -rl '<path>' ${p.specDir}\`.
   - From the "Related" section of each document you found, check one more step for documents the change carries to.
4. Make the change list and show it. For each item, give the owning document, the section ("Current behavior" or \`### policy name\`), the current wording → the wording the material implies, and the part of the material that is the evidence. If the material conflicts with a current document, mark it as a conflict and ask which is right. If the material states a new policy that no document has, mark it "new" and propose which document should own it.
5. Wait for confirmation. Do not change documents without it. If only some items are approved, reflect only the approved items.
6. Update the owning documents. Edit only one owning document per policy; in other documents keep only a link to that policy. When a question policy is confirmed, leave a \`decision\` entry and put a decision link at the end of the confirmed policy text (format in step 1 of crumbs-writer "Document existing code"). If the material confirms a value, write it as a statement; if the material is ambiguous, write it as a \`[needs confirmation]\` question (format in step 5 of crumbs-writer "Document existing code"). Cite the material in "Evidence" as a backtick path (\`${p.rawDir}/<file>\`, written from the repository root even when \`codeRoot\` is set — \`check\` confirms that it exists). If you need to point to a specific part of the material, give the page or section after \` — \`.
7. If the scope changed, update the one-line entry in the overview's "Documents" and in the index. If you created a new document, follow steps 3 to 6 of crumbs-writer "Document existing code": start from the template and link it from the overview and the index.
8. Add a log entry. Name the material file and the changed document in the body.
   \`npx crumbs-spec log add --kind ingest "<one sentence stating the user-visible result>" --body "Result: <changed user-visible result>. Reason: ${p.rawDir}/<file>. Document: [<policy name>](<domain>/<document>.md#<anchor>)"\`

## Do not

- Do not create a new page that summarizes the material. The material's content goes into the document that owns the policy.
- Do not fill in anything the material does not state. Leave empty values as questions.
- Do not reflect several material files at once. Finish one, leave its log entry, then move to the next.
- Do not edit, move, or delete files under \`${p.rawDir}/\`.

## Before finishing

1. Run \`npx crumbs-spec check\` and fix every error. A wrong backtick path in the material shows up as \`missing-code-path\`.
2. Compare the change list with the result: every approved item is reflected, and no declined item is.
`;

// 스킬 이름마다 본문 생성 함수. skills.ts가 설치 내용으로 쓴다.
export const skillsEn: Record<SkillName, (p: TemplatePaths) => string> = {
  'crumbs-writer': writer,
  'crumbs-finder': finder,
  'crumbs-interview': interview,
  'crumbs-ingest': ingest,
};
