# Changelog

All notable changes to this project are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.3.0] - 2026-11-03

### Fixed

- Evidence paths under `rawDir` (for example `docs/raw/contract.pdf`) are resolved against the repository root even when `codeRoot` is set, so source material cited the way the ingest skill says no longer fails `missing-code-path`.

### Changed

- The AGENTS block, the skills and the detail template say that evidence code paths are relative to `codeRoot` and that source material is cited as `<rawDir>/<file>`.
- `init` prints the CLAUDE.md guide line only when `CLAUDE.md` or `.claude/CLAUDE.md` exists without `@AGENTS.md`, and names that file. Claude Code 2.1.277 and later reads `AGENTS.md` directly when there is no CLAUDE.md, so the guide was wrong there. The README says the same.

### Documentation

- README: results of an experiment on two public RealWorld (Conduit) backends, graded against the official API test suite ([crumbs-spec-conduit](https://github.com/Sienna94/crumbs-spec-conduit)). The earlier private benchmark is kept as a short anecdote.

## [0.2.0] - 2026-11-02

### Added

- `unterminated-comment` check rule (error): an HTML comment opened with `<!--` and never closed hides everything after it from `check`.
- Generated SKILL.md files start with a comment naming the crumbs-spec version that produced them, and how to upgrade.
- `log add` rejects a title or body that contains `<!--`.
- A `prepare` script builds the package on install, so `npm i github:Sienna94/crumbs-spec` works.
- CI workflow on Linux and macOS with Node 20 and 22, plus a Windows job that may fail.
- `CHANGELOG.md` and `CONTRIBUTING.md`.

### Changed

- Heading anchors follow github-slugger: each space becomes `-`, punctuation other than `-` and `_` is dropped, and nothing is collapsed (`### Quantity & limits` becomes `#quantity--limits`).
- Inline and reference links are parsed; shortcut references such as `[label]` are not links. Only ATX headings are recognized.
- Symlinked files and directories under the spec root are followed.
- Evidence paths must contain a `/`; a repository-root file is written `./package.json`. Backtick spans without `/` in an Evidence section are ignored.
- Line suffixes `:12`, `:12-48`, `:12:5` and `:12-48,60-70` are accepted in evidence paths.
- Comment markers inside a code span are treated as code, not as the start of an HTML comment.
- A link whose spelling differs from the file on disk is reported as `broken-link` with a "spelling differs" message.
- `exclude` entries are normalized: a leading `./` is removed, an entry ending in `/` excludes a directory, and an entry without `/` excludes that exact path or directory. There are no glob patterns.
- `open-question` warns once per document and counts the open questions (markers in the "Open questions" section when there is one, otherwise markers in the whole document).
- Every finding has a `line` (1 when there is no better position). `missing-backlink` points at the "Related" heading and `unreachable` at the title line.
- A document with none of the required sections gets one `missing-section` finding that suggests adding its directory to `exclude`.
- `check` summaries are pluralized in English: `crumbs check: 1 document, 1 error, 0 warnings`.
- `log-format` reports an entry whose date is more than one day in the future.
- `duplicate-policy` also reports the same policy name twice inside one document.
- `crumbs.json`: `specDir` and `rawDir` may not point outside the repository root, and unknown `headings` keys are reported with the list of valid keys.
- `init` prints `next: npx crumbs-spec check` as its last line, prints the CLAUDE.md guide line when CLAUDE.md does not contain `@AGENTS.md`, and reports AGENTS.md as `created:`, `updated:` or `skipped:`.
- `init` fails with exit code 2 when `--root` does not exist; it no longer creates the directory.
- The Flow and Evidence placeholders in the templates say how to write "None" and root-level paths.
- README examples are in English, and the README describes the current check rules, log format and skill behavior.

## [0.1.0] - 2026-11-02

First release.
