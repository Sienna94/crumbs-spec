# crumbs-spec 🍞

[한국어](README.ko.md) · **English**

[![CI](https://github.com/Sienna94/crumbs-spec/actions/workflows/ci.yml/badge.svg)](https://github.com/Sienna94/crumbs-spec/actions/workflows/ci.yml) [![npm](https://img.shields.io/npm/v/crumbs-spec)](https://www.npmjs.com/package/crumbs-spec)

crumbs-spec leaves breadcrumbs (links) on every document so an agent never gets lost, and keeps a **living spec** that leads from the index to the detail document in one path. It describes how the repository behaves *right now* in responsibility-sized documents, checks with one command that those documents are properly linked, and ships the procedures an agent follows to write, find, ask about and ingest them as skills.

## Why we built it

While we ran dozens of spec documents with agents on a real app repository, the same three things kept happening.

1. Specs only survived as change units (per-feature `spec.md`, tickets), so months later there was no document that answered "what is the rule right now?".
2. Piling them up like a wiki put the same rule into several documents with slightly different wording, and nobody knew which one was right. A later benchmark had an agent find three such contradictions.
3. When agents read documents they leaned on folder structure and search, so they wandered into other areas or fell back to grep. One question cost eight documents.

"Write better documents" did not fix it. We needed **a tool that enforces structure by machine**. When every policy has exactly one owner, the link graph is checked by a machine, and the unknown is written as a question instead of a guess, agents and people reach the document by the same path. So we started scattering breadcrumbs.

## How it differs from other tools

Spec Kit is good at pre-implementation planning and LLM Wiki at accumulating sources. crumbs-spec fills the gap between them: **the current state that must survive after implementation**. It complements them rather than replacing them.

| | GitHub Spec Kit | OpenSpec | Karpathy's LLM Wiki | **crumbs-spec** |
|---|---|---|---|---|
| Document unit | One change (feature): `spec.md`, `plan.md`, `tasks.md` | Current-state spec + change deltas | Entity, concept and source-summary pages | **One responsibility (user flow)**. Each policy is owned by exactly one document |
| Point in time | Before implementation | Before and after | When a source is ingested | **Current behavior after implementation** |
| Existing code | States that it "does not infer" | Has onboarding, but no code-to-spec drafting | Targets sources, not code | **The crumbs-writer skill drafts from code and tests; the unknown becomes a `[needs confirmation]` question** |
| Navigation | Folders and file names | Folders and file names | Index first | **Index → overview → detail by links only**. No IDs, no front matter |
| Machine checks | Consistency across spec, plan and tasks | `openspec validate` (structure) and delta merge on archive | Orphan page and broken link lint (with LLM judgment) | **16 structural rules**: links, anchors, reachability, backlinks, duplicate policy names, evidence paths, section order, flow diagrams, log format, unterminated comments |
| Sync after implementation | The team picks a maintenance model | `archive`/`sync` for the change in hand | Feeds query results back into the wiki | **Agent rule ("update the owning document in the same change, even unasked") and a decision log** |
| Human readability | Prose | Prose | Prose | **Flow diagrams (Mermaid) and branch tables in the template** |

Kiro specs and BMAD sit close to Spec Kit (per-feature, before implementation) and are not listed separately; the Korean plan document compares all five.

From LLM Wiki we kept the raw/wiki/schema split, index-first navigation, the append-only log and human-supervised ingest. Three things are deliberately different: documents are organized by responsibility rather than entity (only concepts that several flows branch on get a page under `concepts/`), documents are maintained by agents but owned by people, and lint is deterministic with no LLM judgment. See section 1 of [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) (Korean) for the full comparison.

## What we cared about

- **A single source of truth for the current state.** No change directories. Documents explain "how it behaves now", not "what changed".
- **No guessing.** A rule not confirmed by code, tests or approved sources is written only as "right now it behaves like this" plus a `[needs confirmation]` (`[확인 필요]` with `lang: ko`) question. `check` reports one `open-question` warning per document that still has questions. Whether a statement is a guess is the skill's rule and the reviewer's job; `check` cannot tell.
- **One owner per policy, checked at the name level.** `check` rejects the same policy name in two documents (or twice in one). Two policies that say the same thing under different names are not detected; the writer skill's naming rules exist for that.
- **People-first prose.** No IDs, no status tables, no enforced grammar. Navigation lives in links and headings only.
- **Deterministic checks, human judgment.** `check` looks at structure only. Style, content and staleness are for skill guidance and people.
- **Decisions in one place.** When a question gets its answer, a `decision` entry goes into the log and the document points at it with a single dated link.
- **Two languages.** `lang` in `crumbs.json` selects the language of the templates, skills, messages and AGENTS block for the whole repository. It defaults to English (`en`); `ko` gives Korean. This README is the English guide.

## Does it work on code it has never seen? (RealWorld experiment)

We ran the writer skill on two open-source backends of the [RealWorld](https://github.com/realworld-apps/realworld) "Conduit" API and graded the documents against the project's official API test suite. The generated documents, prompts, ground truth and every grading row are published in [crumbs-spec-conduit](https://github.com/Sienna94/crumbs-spec-conduit).

- **Setup.** Two pinned implementations of the same API: [Nitro + Prisma](https://github.com/realworld-apps/nitro-prisma-zod-realworld-example-app) (TypeScript) and [Django Ninja](https://github.com/c4ffein/realworld-django-ninja) (Python). One Opus 5.5 agent per implementation wrote the documents from code and tests only. The official spec repository was not in the experiment repository while they wrote; it was added in a later commit.
- **Ground truth.** Each request in the official Hurl suite, at the version both implementations pin, is one row: 130 rows after dropping setup and cleanup requests.
- **Grading.** A different model (Sonnet 5.5) graded every row. `correct` means the documents state the status and every essential asserted value, `partial` that one is left out, `wrong` that the documents contradict it, `missing` that no document covers it. It also checked every policy against the code.

| | Nitro + Prisma | Django Ninja |
|---|---|---|
| Code / tests in the repository | ~1,400 lines / 2 unit test files | ~2,300 lines / endpoint tests for each app |
| Documents / policies | 28 / 51 | 26 / 91 |
| Policies confirmed by tests / left as questions | 6 / 45 | 50 / 41 |
| Suite rows correct | **125 / 130** | **116 / 130** |
| Suite rows partial / wrong / missing | 5 / 0 / 0 | 14 / 0 / 0 |
| Invented policies (code does not do it) | 0 | 0 |
| Policies partly overstated | 1 | 6 |
| Writer tokens / wall time | 165k / 2 h 40 min | 202k / 2 h 47 min |

- **Nothing contradicted the suite and nothing was invented.** Every miss is a detail left out. Nitro's five partials are `null` inputs the documents never mention and the order of tags. Twelve of Django's fourteen come from one honest question: the app's error handler and its tests disagree on the 401 body, so the writer stated both and asked.
- **Statements under a question were mostly right.** 12 Nitro rows and 32 Django rows were graded correct on a statement still marked `[needs confirmation]`. "This is what it does now" plus a question kept the documents useful without claiming more than the tests prove.
- **Fewer tests, more questions.** Nitro has two unit test files, so 45 of its 51 policies stayed questions. The suite answers 29 of them, which is the list a maintainer would confirm first.
- **The writers raised what no suite row tests.** As questions: Django's article list ignores the token and reads the session user, and its `createUser` command looks users up by a field a migration renamed. The Nitro documents also say plainly that the email format is not checked, which a newer version of the suite does test.

Limits: one run per implementation and one writer model. The grader is also a model; the author checked that every cited anchor exists and spot-checked rows. RealWorld is well known, so the writer may have seen it in training even without the spec in the repository. The suite asserts only part of what the documents say: 20 of Nitro's and 41 of Django's policies were checked against the code alone. The Django grader ran the code with unpinned dependencies, so some of its "partly" verdicts may depend on library versions.

### An earlier run on a private app (anecdote)

Before this we rewrote three areas of a private app (about 40,000 lines) and asked the existing spec system and crumbs the same 18 questions, documents only. crumbs answered 15 against 17, read 64 files against 70 and used 18% fewer tokens. Its three partial answers were details the writer had dropped, which led to the skill rule "do not drop values that carry a condition". The author graded it, the questions came from the existing specs, and the data cannot be published, so read it as an anecdote. The navigation comparison has not been repeated on public code yet.

## Install and quick start

Node.js 20 or later, no runtime dependencies.

```bash
npx crumbs-spec init --skills all   # document structure + the four agent skills
npx crumbs-spec init                # document structure only
npx crumbs-spec check               # check the link graph and structure
```

Korean repositories: pass `--lang ko`.

`init` creates these files and never overwrites one that exists. With `--skills all` it also writes eight SKILL.md files, and in AGENTS.md it only ever replaces its own block between `<!-- crumbs:start -->` and `<!-- crumbs:end -->`.

```
crumbs.json                      configuration
docs/specs/index.md              index (the entrance)
docs/specs/log.md                append-only log
docs/specs/templates/overview.md overview template
docs/specs/templates/detail.md   detail template
docs/raw/README.md               raw sources directory (read-only)
AGENTS.md                        crumbs block (agent rules)
```

If `crumbs.json` already exists, `init` keeps its settings and ignores `--spec-dir` and `--lang` (it says so). The last line of `init` is the next command to run: `npx crumbs-spec check`.

The package is on npm as [`crumbs-spec`](https://www.npmjs.com/package/crumbs-spec). To run it from a clone instead, use `npm run build` and then `node dist/src/cli.js <command>`.

## Adding it to an existing project

The order for a repository that already has code and documents. Start with one domain instead of moving everything at once.

1. **Run `init` at the repository root.** If your spec root lives elsewhere, pass `--spec-dir` (for example `docs/crumbs`). Existing files are left alone; if `AGENTS.md` already exists, only the block between `<!-- crumbs:start -->` and `<!-- crumbs:end -->` is inserted.

   ```bash
   npx crumbs-spec init --spec-dir docs/crumbs --skills claude
   ```

2. **Let the agent read the rules.** Claude Code only reads the crumbs block if `CLAUDE.md` contains the line `@AGENTS.md`. Skills are found automatically under `.claude/skills/` (Claude Code) and `.agents/skills/` (Codex).

3. **Do not migrate existing documents.** The writer treats code and tests as the only sources and does not read existing wikis, design notes or READMEs unless you name them as sources, because there is no way to know whether they still match the code. Copy the ones worth using as evidence (plans, contracts, decision records) into `docs/raw/` and ingest them one at a time with `crumbs-ingest`.

4. **Write the first domain from code.** Pick the area people ask about most and hand it to the writer's "document existing code" mode. The `[needs confirmation]` questions in the result become the list of things a person has to decide for that area.

   ```
   Document the code under src/billing/ with crumbs-writer in "document existing code" mode.
   The domain directory is docs/crumbs/billing/. Leave unconfirmed policies as questions and finish the whole thing.
   ```

5. **Put `check` in CI.** Fail only on errors (every rule marked error in the check rules table below) and ignore warnings. Markdown under the spec root that is not a crumbs document yet goes into `exclude` in `crumbs.json`: entries are paths relative to the spec root, an entry ending in `/` excludes that directory, there are no glob patterns, and `check` tells you when a document has none of the required sections.

6. **Change the document in the same change as the code.** The AGENTS block tells the agent to "update the owning document in the same change, even when nobody asked", so every PR brings `check` and a log entry with it. The index fills in as domains are added one by one.

If you already have a spec system, try asking both systems the same questions. Files read and correct answers show at once which one is easier to navigate.

## How a spec gets written

The order the writer skill follows in "document existing code" mode. In "reflect a change" mode, steps 1–2 become "find the owning document whose evidence names the changed code path" and the rest is the same.

```mermaid
flowchart TD
    A["Read the index and templates"] --> B["Follow code and tests from the entry point"]
    B --> C["Draw the responsibility boundary: one user flow = one document"]
    C --> D["Write the Current behavior section, steps as ### subheadings"]
    D --> E{"Is the rule confirmed by a test"}
    E -->|yes| F["Write it as a policy"]
    E -->|no| G["Statement of current behavior + [needs confirmation] question"]
    F --> H["Flow diagram and branch tables"]
    G --> H
    H --> I["Evidence paths and mutual related-document links"]
    I --> J["Update the overview list and the index"]
    J --> K["crumbs check"]
    K -->|errors| I
    K -->|clean| L["log add: result, reason, document"]
```

When an answer arrives, a person answers the questions produced by `crumbs-interview`, and the writer turns the question policy into a confirmed one, leaving a `decision` log entry and a decision link. When new material arrives, `crumbs-ingest` finds the affected documents, gets confirmation and then applies it.

## Document model

There are four roles. Navigation always starts at the index.

```
docs/specs/index.md              index: domain list + log link
docs/specs/<domain>/overview.md  overview: scope, flow diagram, document list, terms
docs/specs/<domain>/<topic>.md   detail: one user flow
docs/specs/log.md                log: what was done, in order
docs/specs/concepts/             concepts shared by several domains (optional)
docs/raw/                        immutable sources such as contracts and plans
```

The sections of a detail document are fixed. Headings follow `lang` (English by default, Korean with `lang: ko`) and can be renamed through `headings` in `crumbs.json`. With `lang: ko` the headings are 목적, 현재 동작, 흐름, 정책, 근거, 확인 필요 사항, 관련 문서.

| Section | Content |
|---|---|
| Purpose | The one responsibility this document owns and what it does not cover |
| Current behavior | As the user experiences it, in the present tense; three or more steps become `###` subheadings |
| Flow | A Mermaid diagram for two or more steps; a table when there are two or more comparison axes |
| Policies | `### policy name` (unique across the repository) and the rule; if unconfirmed, a statement of current behavior followed by a `[needs confirmation]` question |
| Evidence | Backticked paths that contain a `/`, each with a description; `check` verifies the path exists |
| Open questions | `- [needs confirmation] [policy name](#anchor) — question` |
| Related | Link to the overview and neighboring documents; backlinks must be mutual |

Example: a detail document the writer produced from the Nitro code in [the RealWorld experiment](#does-it-work-on-code-it-has-never-seen-realworld-experiment), unedited ([source](https://github.com/Sienna94/crumbs-spec-conduit/blob/main/nitro/docs/specs/api/articles/tag-list.md)). Usage example 3 below answers its question and adds a flow diagram.

````markdown
# Tag list
<!-- Read ../../index.md first. After changing this document, add an entry to ../../log.md -->

## Purpose
This document owns GET /api/tags, which returns the most used tag names. How tags are attached to articles is owned by [Article creation](article-create.md#article-tag-name-handling). The endpoint allows anonymous viewers as described in [Authentication token](../authentication-token.md), and the list is the same for anonymous and signed-in viewers.

## Current behavior
- The server considers only tags that at least one article uses.
- The server sorts those tags by the number of articles that use them, most used first.
- The server returns at most 10 tag names.
- The server responds with status 200 and {"tags": ["<name>"…]}.
- If no article uses a tag, the list is empty.

## Flow
None

## Policies
### Popular tag list
The tag list holds at most 10 names of tags used by at least one article, sorted by the number of articles that use each tag, most used first. The order of tags used by the same number of articles is not defined, and the list has no pagination. No test covers this rule.
[needs confirmation] What is the basis of the 10-tag limit, and what should order tags with the same usage count?

## Evidence
- `server/routes/api/tags/index.get.ts` — selects tags used by at least one article, sorts them by usage and returns at most 10 names
- `prisma/schema.prisma` — unique tag names and the relation between tags and articles

## Open questions
- [needs confirmation] [Popular tag list](#popular-tag-list) — What is the basis of the 10-tag limit, and what should order tags with the same usage count?

## Related
- [Articles API overview](overview.md)
- [Article creation](article-create.md)
- [Article update](article-update.md)
- [Article deletion](article-delete.md)
````

The overview's "Terms" section is a list of aliases linked to the owning policy (`- Subscription pass(flat-rate pass) — [Pass active check](pass.md#pass-active-check)`). A term that is only a definition stops there; only concepts that several flows branch on (channel, currency, member state) get an owning document under `concepts/`.

## Commands

```bash
npx crumbs-spec init [--spec-dir <dir>] [--lang <en|ko>] [--skills <claude|codex|all>]
npx crumbs-spec check [--format text|json] [--config <path>]
npx crumbs-spec log add --kind <ingest|query|lint|drift|change|decision> "<title>" [--body "<body>"]
```

Common options are `--root <dir>` (repository root, default: current directory), `--lang <en|ko>` (language for `init`; errors raised before `crumbs.json` is read; default `en`), `-h`/`--help` and `-v`/`--version`. Configuration lives in `crumbs.json` at the repository root (`specDir`, `index`, `overview`, `log`, `lang`, `headings`, `exclude`, `codeRoot`, `rawDir`).

`check` prints one line per finding as `file:line severity rule: message`, and a summary last.

```
docs/specs/api/articles/tag-list.md:31 error broken-link: link target not found: ../log.md#2026-11-03-decision--popular-tag-list-most-used-first-stays-ties-are-undefined-10-tags-are-cut-after-sorting-and-every-viewer-gets-the-same-unpaginated-list
docs/specs/api/articles/article-delete.md:44 warning open-question: 1 open question(s)
…
crumbs check: 28 documents, 1 error, 20 warnings
```

This is the check from usage example 3 before the writer fixed its decision link; the other 19 warnings are left out.

**Supported Markdown.** Headings must be ATX (`#` to `######`); setext headings are not recognized. Inline links and reference links (`[text][label]`, and `[label][]` with a `[label]: path` definition) are checked; a shortcut reference such as `[label]` alone is not a link. Heading anchors follow github-slugger: each space becomes `-`, punctuation other than `-` and `_` is dropped, and nothing is collapsed, so `### Quantity & limits` becomes `#quantity--limits`. Symlinked files and directories under the spec root are followed. Evidence paths are resolved against `codeRoot` (the repository root by default), except paths under `rawDir`, which are always resolved against the repository root. An evidence path must contain a `/`, so a repository-root file is written `./package.json`; line suffixes such as `:12`, `:12-48`, `:12:5` and `:12-48,60-70` are accepted. Entries in `exclude` are paths relative to the spec root, and an entry ending in `/` excludes that directory. Every finding carries a `line` (1 when there is no better position), so JSON output always includes it.

### Check rules

| Rule | Severity | What it catches |
|---|---|---|
| `index-missing` | error | The index document is missing (no other rule runs) |
| `missing-title` | error | The first heading is not an H1 |
| `broken-link` | error | The link target file does not exist, or its spelling differs from the file on disk |
| `broken-anchor` | error | The link points to a heading that does not exist |
| `unreachable` | error | A document that cannot be reached from the index by links |
| `missing-section` | error | A required section for the role is missing |
| `missing-backlink` | error | No link back to the parent (overview or index), or a detail A→B link without B→A |
| `missing-code-path` | error | An evidence code path does not exist |
| `duplicate-policy` | error | The same policy name appears in two documents, or twice in one |
| `log-format` | error | A log entry is not in the form `## [YYYY-MM-DD] kind \| title`, or the date is more than a day in the future |
| `unterminated-comment` | error | An HTML comment is opened and never closed, hiding the rest of the document |
| `open-question` | warning | One warning per document that still has open questions (the count is the number of questions) |
| `log-order` | warning | Log dates are out of order |
| `missing-flow` | warning | Current behavior has six or more steps but no diagram or table |
| `section-order` | warning | Sections are not in template order |
| `log-body` | warning | A `decision` entry has no document link |

## Log

The log is appended in one place (`docs/specs/log.md`) in chronological order. The title is **one sentence about the user outcome**, not the task name, and the body has three lines. `log add` writes the entry and refuses titles or bodies that contain `<!--`.

```bash
npx crumbs-spec log add --kind change "<one sentence about the user outcome>" \
  --body "Result: <what changed>. Reason: <why>. Document: [<policy>](<domain>/<document>.md#<anchor>)"
```

The entry written in usage example 5:

```markdown
## [2026-11-03] change | A malformed email on registration, login and account update is rejected with 422 and is invalid
Result: a malformed email on registration, login and account update gets status 422 with {"errors": {"email": ["is invalid"]}}; 3 api documents updated and 1 open question remains about accepted address forms. Reason: code change in server/schemas/user.schema.ts, reported by the user. Document: [Email format](api/users/registration.md#email-format)
```

When a `[needs confirmation]` question gets its answer, add a `decision` entry and put one decision link at the end of the confirmed policy. Instead of change-history tables inside documents, decisions accumulate in the log and documents only point at them. The slug drops the brackets, `|`, commas and colons, so the `|` leaves a double dash in the anchor. From usage example 3:

```markdown
## [2026-11-03] decision | Popular tag list: most used first stays, ties are undefined, 10 tags are cut after sorting, and every viewer gets the same unpaginated list
Result: GET /api/tags keeps the most-used-first order, leaves the order of equally used tags undefined, applies the 10-tag limit after sorting, and returns the same list without pagination to every viewer. Reason: answers from the maintainer; existing clients may rely on most-used-first and the limit keeps the tag sidebar short. Document: [Popular tag list](api/articles/tag-list.md#popular-tag-list)
```

```markdown
### Popular tag list
The tag list holds at most 10 names of tags used by at least one article, sorted by the number of articles that use each tag, most used first, and the server applies the 10-tag limit after sorting. … (decision: [2026-11-03](../../log.md#2026-11-03-decision--popular-tag-list-most-used-first-stays-ties-are-undefined-10-tags-are-cut-after-sorting-and-every-viewer-gets-the-same-unpaginated-list))
```

The kinds are `ingest` (a source was applied), `query` (an answer fed back), `lint`, `drift`, `change` (a document changed) and `decision` (a question was settled).

## Skills

`init --skills` installs the procedures an agent follows into `.claude/skills/<name>/SKILL.md` (Claude Code) and `.agents/skills/<name>/SKILL.md` (Codex). An existing `SKILL.md` is never overwritten; delete it and run `init --skills` again to upgrade. Claude Code reads the crumbs block only when `CLAUDE.md` contains `@AGENTS.md`.

Each generated SKILL.md starts with a comment naming the crumbs-spec version that produced it. Skills and templates follow the package version: a minor release may change their text, a patch release does not. To upgrade, delete the file and run `init --skills` again.

| Skill | What it does |
|---|---|
| `crumbs-writer` | Writes or updates documents in two modes: "reflect a change" (changed code → owning document) and "document existing code" (first draft from code and tests only). Carries the rules for responsibility size, style, question format, flow diagrams and concept pages |
| `crumbs-finder` | Finds the answer index → overview → detail, cites the source, and feeds good answers back as `query` log entries |
| `crumbs-interview` | Turns the unconfirmed policies a request touches into questions and stops |
| `crumbs-ingest` | Reads new material under `docs/raw/`, finds the affected documents, applies them after confirmation and leaves an `ingest` entry |

## Usage examples

Every example below was actually run on the Nitro backend from the experiment, in the [`usage/`](https://github.com/Sienna94/crumbs-spec-conduit/tree/main/usage) workspace of crumbs-spec-conduit. Example 1 is the experiment's Opus 5.5 writer. Examples 2–5 are a Claude Sonnet 5.5 agent that got only the request, read `AGENTS.md` and picked the skill itself; the author answered its questions as the maintainer would. Each example that changed files is one commit, linked below.

### 1. Document existing code for the first time

```
Document the code under ../vendor/nitro with crumbs-writer in "document existing code" mode,
from code and tests only. Leave unconfirmed policies as questions and finish the whole thing.
```

This is a shortened form of the experiment's [writer prompt](https://github.com/Sienna94/crumbs-spec-conduit/blob/main/eval/prompts/writer.md). The writer followed the code from the route handlers, split the API into four subdirectories and produced 21 detail documents with their overviews. The repository has only two unit test files, so 6 policies came out confirmed by tests and 45 as `[needs confirmation]` questions. It ended with `check` and a log entry ([commit](https://github.com/Sienna94/crumbs-spec-conduit/commit/572b0db)).

```
crumbs check: 28 documents, 0 errors, 21 warnings
```

The 21 warnings are the 21 detail documents that still have open questions. Their "Open questions" sections are the list of things the maintainer has to decide.

### 2. Find an answer

```
How many tags does GET /api/tags return, and in what order?
```

The finder went index → API overview → articles overview → [tag-list.md](https://github.com/Sienna94/crumbs-spec-conduit/blob/main/nitro/docs/specs/api/articles/tag-list.md), four spec documents and no code. It answered: at most 10 names, most used first, only tags that at least one article uses, no pagination. It also said that two points are still `[needs confirmation]`: the order of tags with the same count and the basis of the limit. No file changed.

### 3. Ask about what is unknown and record the answer as a decision

```
I want to change how the tag list is ordered. What do I need to confirm first?
```

The interview skill listed the eight policies the request touches, marked three as confirmed by code, and turned the rest into seven questions, from "does 'tag list' mean GET /api/tags or the tagList inside articles" to "do existing clients depend on the current order". It stopped without editing anything. The answer: only GET /api/tags; keep most used first; ties stay undefined on purpose; the 10-tag limit stays and applies after sorting. The writer then confirmed the policy and added a `decision` entry and the decision link (see [Log](#log)). `check` caught two things on the way: the decision link pointed at `../log.md` instead of `../../log.md` (`broken-link`), and current behavior grew to seven steps without a diagram (`missing-flow`), so the writer added one ([commit](https://github.com/Sienna94/crumbs-spec-conduit/commit/7b86052)).

### 4. Ingest a source document

```
The upstream API spec changed. Apply docs/raw/realworld-b8a37f1-validate-email-format.diff.
```

The source is the real upstream commit that added email-format validation to the RealWorld spec. The ingest skill read it, found the registration, login and account-update documents through the index and listed four claims. Then it stopped on a conflict: the source expects 422 "is invalid" for a malformed email, while the documents and the code say the format is not checked. Asked whether the source or the code wins, we chose the code, because documents describe current behavior. The skill wrote one `Email format` policy in the registration document with the current behavior and a question that cites the upstream spec, added one linking sentence to the login and update documents, and logged an `ingest` entry ([commit](https://github.com/Sienna94/crumbs-spec-conduit/commit/130946a)). Nothing was edited before the change list was confirmed.

### 5. Reflect a code change

```
I added email format validation to registration, login and account update
(server/schemas/user.schema.ts, not committed yet). A malformed email now gets 422
with {"errors":{"email":["is invalid"]}}. Update the docs.
```

The writer found the owning document with `grep -rl 'user.schema' docs/specs`, since all three documents name that file under Evidence. It rewrote `Email format` as a confirmed policy, which closed the question from example 4, and updated the linking sentences in login and update and two flow diagrams. What the code did not settle, which addresses count as valid and whether a blank email also reports "is invalid", became a new question instead of a guess; a blank email does get both messages. The code and the documents are one commit ([commit](https://github.com/Sienna94/crumbs-spec-conduit/commit/32fd2f3)).

### 6. Check in CI

A GitHub Actions job that fails on errors:

```yaml
jobs:
  specs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npx crumbs-spec check --format json > crumbs-report.json
```

Exit code 1 means there are errors. Warnings (`open-question`, `missing-flow` and so on) do not fail the build.

## Exit codes

| Code | Meaning |
|---|---|
| 0 | `check`: no errors (warnings allowed). `init` and `log add`: done |
| 1 | `check`: at least one error |
| 2 | Usage error, configuration error or unexpected I/O error |

## What we left out

- Requirement IDs, front matter and enforced grammar such as EARS. Navigation lives in links and headings only.
- Change-history tables inside documents and one file per decision. Decisions go into the single log and documents point at them.
- Definition-only term pages. The overview's terms section is enough.
- Style and content judgment in `check`. Style is handled by the skill guidance and the markdownlint sample under [docs/lint/](docs/lint/README.md).

## Tests and compatibility

`npm test` runs the node:test suite on Linux and macOS in CI (see `.github/workflows/ci.yml`). Changes are listed in [CHANGELOG.md](CHANGELOG.md). Until 1.0, a minor version may change check rules, templates and skill text; a patch version only fixes bugs.

## Roadmap

| Step | Content | Status |
|---|---|---|
| 1 | `init`, `check`, templates, AGENTS block | done |
| 2 | Four skills, `log add`, flow section, responsibility-size rules, terms and concept pages, decision log | done |
| 3 | `crumbs reverse <path>` — a command that drafts from code (the writer skill does this today) | planned |
| 4 | `crumbs drift --base <ref>` — finds documents whose evidence changed in a diff | planned |
| 5 | Public example ([crumbs-spec-conduit](https://github.com/Sienna94/crumbs-spec-conduit)) and a navigation-cost benchmark runner | example done, runner planned |

The `lang` setting (`en` by default, `ko` for Korean) selects the language of the templates, skills and messages, so one repository uses one language.
