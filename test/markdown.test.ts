import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test, after } from 'node:test';
import { VOCAB } from '../src/headings.js';
import {
  buildSections,
  classifyTarget,
  evidenceCandidate,
  evidenceCandidates,
  scanMarkdown,
  slugify,
} from '../src/markdown.js';
import { cleanup } from './helpers.js';

after(cleanup);

test('1. 슬러그: github-slugger와 같은 결과를 내고 한국어 글자를 유지하며 중복에는 -1, -2를 붙인다', () => {
  assert.equal(slugify('Current behavior'), 'current-behavior');
  assert.equal(slugify('현재 동작'), '현재-동작');
  assert.equal(slugify('Session lifetime (v2)'), 'session-lifetime-v2');
  assert.equal(slugify('A.B/C'), 'abc');
  assert.equal(slugify('C# notes'), 'c-notes');
  // 공백은 압축하지 않고 하나씩 -로 바꾼다. 문자가 아닌 기호는 지운다.
  assert.equal(slugify('정액권 & 쿠폰'), '정액권--쿠폰');
  assert.equal(slugify('로그인 / 로그아웃'), '로그인--로그아웃');
  assert.equal(slugify('A — B'), 'a--b');
  // 단어 경계의 _는 슬러그에 남고, 짝을 이룬 강조의 _만 제목 정리에서 지워진다.
  assert.equal(slugify('_private_api'), '_private_api');
  assert.equal(scanMarkdown('## _private_api\n').headings[0].slug, '_private_api');
  assert.equal(scanMarkdown('## _emph_ text\n').headings[0].slug, 'emph-text');
  assert.deepEqual(scanMarkdown('## x\n## x\n## x\n').headings.map((h) => h.slug), ['x', 'x-1', 'x-2']);
  assert.deepEqual(scanMarkdown('## 목적\n## 목적\n').headings.map((h) => h.slug), ['목적', '목적-1']);
  assert.equal(scanMarkdown('## `foo` bar\n').headings[0].slug, 'foo-bar');
  assert.equal(scanMarkdown('## [로그인](login.md) 흐름\n').headings[0].slug, '로그인-흐름');
});

test('2. 펜스와 HTML 주석 안의 제목·링크·마커는 무시하고, ~~~ 펜스와 짧은 닫는 펜스를 올바르게 다룬다', () => {
  const tilde = scanMarkdown('```\n## 숨김\n```\n## 보임\n~~~\n## 숨김2\n~~~\n');
  assert.deepEqual(tilde.headings.map((h) => h.text), ['보임']);

  // 여는 것보다 짧은 ``` 는 ````를 닫지 못한다.
  const shortClose = scanMarkdown('````\n```\n## 숨김\n````\n## 보임\n');
  assert.deepEqual(shortClose.headings.map((h) => h.text), ['보임']);

  // 한 줄 주석과 여러 줄 주석 모두 링크·제목·마커를 만들지 않는다.
  const comments = scanMarkdown(
    '<!-- - [도메인 이름](domain/overview.md) -->\n<!--\n## 숨김\n[숨김](x.md)\n[확인 필요]\n-->\n## 보임\n',
  );
  assert.deepEqual(comments.headings.map((h) => h.text), ['보임']);
  assert.equal(comments.links.length, 0);
  assert.equal(comments.markerLines.length, 0);

  // 펜스 안의 <!--는 주석을 열지 않는다.
  const fenceComment = scanMarkdown('```\n<!--\n```\n## 보임\n');
  assert.deepEqual(fenceComment.headings.map((h) => h.text), ['보임']);
});

test('2a. 주석 감지: 코드 스팬 안의 <!--는 주석을 열지 않고, 파일 끝까지 닫히지 않은 주석은 시작 줄을 기록한다', () => {
  const inline = scanMarkdown('본문 `<!--` 설명\n## 근거\n');
  assert.deepEqual(inline.headings.map((h) => h.text), ['근거']);
  assert.equal(inline.unterminatedComment, undefined);

  const open = scanMarkdown('<!-- 열림\n## 숨김\n');
  assert.deepEqual(open.headings, []);
  assert.equal(open.unterminatedComment, 1);
});

test('3. 링크: 줄 번호와 함께 추출하고 이미지·코드 스팬·펜스 안은 건너뛰며, 외부·fragment·루트 기준을 분류한다', () => {
  const source = [
    '# 제목',
    '[a](a.md) ![img](i.png)',
    '`[b](b.md)` 텍스트',
    '```',
    '[c](c.md)',
    '```',
    '[d](<d.md>) [e](https://example.com) [f](mailto:x@y.z)',
    '[g](#목적) [h](/abs/path.md) [j](login.md#%EC%A0%95%EC%B1%85)',
  ].join('\n');
  const scan = scanMarkdown(source);
  assert.deepEqual(
    scan.links.map((link) => [link.line, link.rawTarget]),
    [
      [2, 'a.md'],
      [7, 'd.md'],
      [7, 'https://example.com'],
      [7, 'mailto:x@y.z'],
      [8, '#목적'],
      [8, '/abs/path.md'],
      [8, 'login.md#%EC%A0%95%EC%B1%85'],
    ],
  );

  const root = '/repo';
  const docAbs = join(root, 'docs/specs/auth/login.md');
  assert.deepEqual(classifyTarget('https://example.com', docAbs, root), { kind: 'external' });
  assert.deepEqual(classifyTarget('mailto:x@y.z', docAbs, root), { kind: 'external' });
  assert.deepEqual(classifyTarget('#목적', docAbs, root), { kind: 'internal', path: docAbs, fragment: '목적' });
  assert.deepEqual(classifyTarget('/abs/path.md', docAbs, root), { kind: 'internal', path: join(root, 'abs/path.md') });
  const percent = classifyTarget('login.md#%EC%A0%95%EC%B1%85', docAbs, root);
  assert.deepEqual(percent, { kind: 'internal', path: docAbs, fragment: '정책' });
});

test('3a. 링크 대상: 균형 잡힌 괄호, <…> 공백, 작은따옴표·괄호 제목, 참조 링크를 읽고, 단독 [라벨]과 정의 줄은 링크가 아니다', () => {
  const source = [
    '[괄호](my%20(v2).md)',
    '[공백](<my file.md>)',
    "[제목](a.md 'single')",
    '[제목](a.md (paren title))',
    '[참조][ref] 본문',
    '[Ref][] 본문',
    '[확인 필요] 질문',
    '[x]()',
    '![그림](img.png)',
    '[ref]: ref.md "T"',
  ].join('\n');
  const scan = scanMarkdown(source);
  assert.deepEqual(scan.links.map((link) => [link.line, link.rawTarget]), [
    [1, 'my%20(v2).md'],
    [2, 'my file.md'],
    [3, 'a.md'],
    [4, 'a.md'],
    [5, 'ref.md'],
    [6, 'ref.md'],
  ]);
  assert.equal(scan.links[4].text, '참조');
  // 단독 [확인 필요]는 링크가 아니지만 마커로는 그대로 센다.
  assert.deepEqual(scan.markerLines, [7]);

  const root = '/repo';
  const docAbs = join(root, 'docs/specs/auth/login.md');
  assert.deepEqual(classifyTarget('my%20(v2).md', docAbs, root), {
    kind: 'internal',
    path: join(root, 'docs/specs/auth/my (v2).md'),
  });

  // 정의는 펜스 안에 있으면 세지 않으므로 그 라벨을 쓰는 참조도 풀리지 않는다.
  assert.equal(scanMarkdown('```\n[ref]: fenced.md\n```\n[x][ref]\n').links.length, 0);
});

test('4. 절: H2로 나누고 H3 이상을 자식으로 기록하며, 어휘 키는 대소문자와 공백 차이를 무시하고 맞춘다', () => {
  const scan = scanMarkdown('# 제목\n## 목적\n### 세부\n#### 더 깊은\n##  현재   동작\n## 근거\n');
  const sections = buildSections(scan, VOCAB.ko);
  assert.deepEqual(sections.map((section) => section.key), ['purpose', 'behavior', 'evidence']);
  assert.deepEqual(sections[0].children.map((child) => child.text), ['세부', '더 깊은']);
  assert.equal(sections[0].startLine, 2);
  assert.equal(sections[0].endLine, 4);
  assert.ok(!sections[0].children.some((child) => child.text === '제목'), '첫 H2 앞의 제목은 절에 들지 않는다');

  const english = scanMarkdown('## PURPOSE\n');
  assert.deepEqual(buildSections(english, { ...VOCAB.ko, purpose: 'Purpose' }).map((s) => s.key), ['purpose']);
});

test('5. 근거 후보: 줄 범위를 떼고 /가 있는 경로만 받아들이며, URL·도트 식별자·파일 이름은 거부하고, 근거 절 밖의 후보는 무시한다', () => {
  const accepted: [string, string][] = [
    ['src/a.ts', 'src/a.ts'],
    ['src/a.ts:10', 'src/a.ts'],
    ['src/a.ts:10-20', 'src/a.ts'],
    ['src/a.ts:12:5', 'src/a.ts'],
    ['src/a.ts:12-48,60-70', 'src/a.ts'],
    ['src/', 'src/'],
    ['./package.json', './package.json'],
  ];
  for (const [input, path] of accepted) assert.equal(evidenceCandidate(input), path, input);

  const rejected = [
    'Navigator.push',
    'v1.2',
    'api.example.com',
    'user.id',
    'UserService',
    'ftp://host/x',
    'http://x/y',
    'mailto:x@y.z',
    'a b/c',
  ];
  for (const input of rejected) assert.equal(evidenceCandidate(input), undefined, input);

  const scan = scanMarkdown('`src/outside.ts`\n## 근거\n`src/a.ts:10`\n## 기타\n`src/later.ts`\n');
  const sections = buildSections(scan, VOCAB.ko);
  assert.deepEqual(evidenceCandidates(scan, sections).map((c) => c.raw), ['src/a.ts:10']);
});

test('6. 마커: [확인 필요]와 [needs confirmation]을 모두 세고 펜스와 주석 안은 세지 않는다', () => {
  const scan = scanMarkdown(
    '## 정책\n[확인 필요] 질문 하나.\n[needs confirmation] 영문 질문.\n```\n[확인 필요]\n```\n<!-- [확인 필요] -->\n',
  );
  assert.equal(scan.markerLines.length, 2);
  assert.deepEqual(scan.markerLines, [2, 3]);
});

test('6a. 흐름 신호: mermaid 펜스·표 구분선·불릿과 번호 목록 줄을 펜스와 주석 밖에서 줄 번호로 기록하고, mermaid는 정보 문자열을 trim·소문자화한 뒤 비교한다', () => {
  const scan = scanMarkdown(
    [
      '# 제목',
      '## 현재 동작',
      '- 첫째',
      '  * 둘째',
      '```  Mermaid  ',
      'flowchart LR',
      '- 펜스 안',
      '| --- | --- |',
      '```',
      '```text',
      '| a | b |',
      '|---|---|',
      '```',
      '| 채널 | 결과 |',
      '|:---|---:|',
      '<!--',
      '- 주석 안',
      '|---|---|',
      '-->',
      '+ 넷째',
      '---',
      '1. 셋째',
    ].join('\n'),
  );
  assert.deepEqual(scan.mermaidFenceLines, [5]);
  assert.deepEqual(scan.tableRuleLines, [15]);
  assert.deepEqual(scan.bulletLines, [3, 4, 20, 22]);
});
