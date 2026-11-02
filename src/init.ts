import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { ConfigError, defaultConfig, loadConfig, parseConfig } from './config.js';
import { localDate } from './dates.js';
import type { Lang } from './headings.js';
import { MESSAGES, type Messages } from './messages.js';
import type { Config } from './model.js';
import { agentsOf, skillFiles } from './skills.js';
import { AGENTS_END, AGENTS_START, agentsBlock } from './templates/agents.js';
import { en } from './templates/en.js';
import { ko } from './templates/ko.js';

// AGENTS.md의 새 내용을 돌려준다. 표시가 있으면 그 사이만 바꾸고, 표시가 없으면 빈 줄 하나와 블록을 덧붙인다.
function mergeAgents(current: string | undefined, block: string, m: Messages): string {
  if (current === undefined) return `${block}\n`;
  const start = current.indexOf(AGENTS_START);
  const end = current.indexOf(AGENTS_END);
  if (start >= 0 && end > start) {
    return current.slice(0, start) + block + current.slice(end + AGENTS_END.length);
  }
  if (start < 0 && end < 0) {
    if (current === '') return `${block}\n`;
    const base = current.endsWith('\n') ? current : `${current}\n`;
    return `${base}\n${block}\n`;
  }
  throw new ConfigError(m.agentsMarkers);
}

// 파일은 없을 때만 만든다. 기존 파일은 절대 덮어쓰지 않는다. AGENTS.md는 자기 표시 블록만 바꾼다.
// 쓰기 전에 설정과 AGENTS.md를 모두 검사하므로, 실패하면 아무 파일도 바뀌지 않는다.
// skillsOption이 있으면 스킬 파일을 다섯 파일 뒤에 같은 방식으로 만든다.
// langOption은 새로 만드는 저장소의 lang이다. 기존 crumbs.json이 있으면 그 lang을 쓰고 langOption은 무시한다.
// 출력 줄과 만들 파일의 언어는 설정의 lang을 따른다.
export function runInit(
  root: string,
  specDirOption: string | undefined,
  skillsOption?: 'claude' | 'codex' | 'all',
  langOption?: Lang,
): string[] {
  const out: string[] = [];
  const configAbs = join(root, 'crumbs.json');
  const requested: Lang = langOption ?? 'en';

  let config: Config;
  let configText: string | undefined;
  if (existsSync(configAbs)) {
    config = loadConfig(configAbs, root, requested);
    const kept = MESSAGES[config.lang];
    if (specDirOption !== undefined) out.push(kept.configKept('--spec-dir'));
    if (langOption !== undefined) out.push(kept.configKept('--lang'));
    out.push(kept.skipped('crumbs.json'));
  } else {
    config = parseConfig(JSON.stringify(defaultConfig(specDirOption, requested)), requested);
    configText = `${JSON.stringify(config, null, 2)}\n`;
    out.push(MESSAGES[config.lang].created('crumbs.json'));
  }
  const m = MESSAGES[config.lang];
  const templates = config.lang === 'en' ? en : ko;

  const paths = {
    specDir: config.specDir,
    index: config.index,
    overview: config.overview,
    log: config.log,
    rawDir: config.rawDir,
  };
  const files: Array<[string, string]> = [
    [`${config.specDir}/${config.index}`, templates.index(paths)],
    [`${config.specDir}/${config.log}`, templates.log(localDate())],
    [`${config.specDir}/templates/overview.md`, templates.overview(paths)],
    [`${config.specDir}/templates/detail.md`, templates.detail(paths)],
    [`${config.rawDir}/README.md`, templates.rawReadme(paths)],
  ];
  if (skillsOption !== undefined) files.push(...skillFiles(agentsOf(skillsOption), paths, config.lang));

  const agentsAbs = join(root, 'AGENTS.md');
  const agentsCurrent = existsSync(agentsAbs) ? readFileSync(agentsAbs, 'utf8') : undefined;
  const agentsNext = mergeAgents(agentsCurrent, agentsBlock(paths, config.lang), m);

  mkdirSync(root, { recursive: true });
  if (configText !== undefined) writeFileSync(configAbs, configText);
  for (const [rel, content] of files) {
    const abs = join(root, rel);
    if (existsSync(abs)) {
      out.push(m.skipped(rel));
    } else {
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, content);
      out.push(m.created(rel));
    }
  }
  if (agentsNext !== agentsCurrent) writeFileSync(agentsAbs, agentsNext);
  out.push(m.updated('AGENTS.md'));

  // CLAUDE.md는 고치지 않고, 가져오기 줄이 없을 때만 안내한다.
  const claudeAbs = join(root, 'CLAUDE.md');
  if (existsSync(claudeAbs) && !readFileSync(claudeAbs, 'utf8').includes('@AGENTS.md')) {
    out.push(m.claudeGuide);
  }
  out.push(m.next);
  return out;
}
