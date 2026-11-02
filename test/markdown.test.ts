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

test('1. 슬러그: GitHub 방식이며 한국어 글자를 유지하고 중복에는 -1, -2를 붙인다', () => {
  assert.equal(slugify('Current behavior'), 'current-behavior');
  assert.equal(slugify('현재 동작'), '현재-동작');
  assert.equal(slugify('Session lifetime (v2)'), 'session-lifetime-v2');
  assert.equal(slugify('A.B/C'), 'abc');
  assert.equal(slugify('C# notes'), 'c-notes');
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

test('5. 근거 후보: 허용되는 형태만 받아들이고, 근거 절 밖의 후보는 무시한다', () => {
  assert.equal(evidenceCandidate('src/a.ts'), 'src/a.ts');
  assert.equal(evidenceCandidate('src/a.ts:10'), 'src/a.ts');
  assert.equal(evidenceCandidate('src/a.ts:10-20'), 'src/a.ts');
  assert.equal(evidenceCandidate('src/'), 'src/');
  assert.equal(evidenceCandidate('UserService'), undefined);
  assert.equal(evidenceCandidate('http://x'), undefined);
  assert.equal(evidenceCandidate('a b/c'), undefined);

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

test('6a. 흐름 신호: mermaid 펜스·표 구분선·불릿 줄을 펜스와 주석 밖에서만 세고, mermaid는 정보 문자열을 trim·소문자화한 뒤 비교한다', () => {
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
    ].join('\n'),
  );
  assert.equal(scan.mermaidFences, 1);
  assert.equal(scan.tableRows, 1);
  assert.deepEqual(scan.bulletLines, [3, 4, 20]);
});
