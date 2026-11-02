# Contributing

## Build and test

```bash
npm ci
npm test
```

`npm test` compiles `src/` and `test/` into `dist/` and runs the `node:test` suite. CI runs it on Linux and macOS with Node 20 and 22.

## Where things live

- Check rules are in `src/rules/`. Each rule is one pure function, registered in `src/check.ts`.
- User-visible strings are in `src/messages.ts`. Every string has an English and a Korean entry; change both in the same commit.
- Templates are in `src/templates/en.ts` and `src/templates/ko.ts`.
- Skill text is in `src/templates/skills-en.ts` and `src/templates/skills-ko.ts`. `skills-ko.ts` and section 6.3 of `docs/IMPLEMENTATION_PLAN.md` quote the same Korean text sentence by sentence, so change them together.

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/), for example `feat: add exclude normalization` or `fix(check): report unterminated comments`.

## Material

Never add company or private material to the repository, including internal specs, tickets, contracts, screenshots, or personal data. Use invented examples.
