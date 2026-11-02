import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { ConfigError, defaultConfig, loadConfig, parseConfig } from './config.js';
import { localDate } from './dates.js';
import type { Config } from './model.js';
import { agentsOf, skillFiles } from './skills.js';
import { AGENTS_END, AGENTS_START, agentsBlock } from './templates/agents.js';
import { ko } from './templates/ko.js';

// AGENTS.md의 새 내용을 돌려준다. 표시가 있으면 그 사이만 바꾸고, 표시가 없으면 빈 줄 하나와 블록을 덧붙인다.
function mergeAgents(current: string | undefined, block: string): string {
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
  throw new ConfigError('AGENTS.md: crumbs 표시가 짝이 맞지 않음');
}

// 파일은 없을 때만 만든다. 기존 파일은 절대 덮어쓰지 않는다. AGENTS.md는 자기 표시 블록만 바꾼다.
// 쓰기 전에 설정과 AGENTS.md를 모두 검사하므로, 실패하면 아무 파일도 바뀌지 않는다.
// skillsOption이 있으면 스킬 파일을 다섯 파일 뒤에 같은 방식으로 만든다.
export function runInit(
  root: string,
  specDirOption: string | undefined,
  skillsOption?: 'claude' | 'codex' | 'all',
): string[] {
  const out: string[] = [];
  const configAbs = join(root, 'crumbs.json');

  let config: Config;
  let configText: string | undefined;
  if (existsSync(configAbs)) {
    config = loadConfig(configAbs, root);
    if (specDirOption !== undefined) {
      out.push('참고: crumbs.json이 이미 있어 그 설정을 사용함 (--spec-dir 무시)');
    }
    out.push('이미 있음, 건너뜀: crumbs.json');
  } else {
    config = parseConfig(JSON.stringify(defaultConfig(specDirOption)));
    configText = `${JSON.stringify(config, null, 2)}\n`;
    out.push('생성: crumbs.json');
  }

  const paths = {
    specDir: config.specDir,
    index: config.index,
    overview: config.overview,
    log: config.log,
    rawDir: config.rawDir,
  };
  const files: Array<[string, string]> = [
    [`${config.specDir}/${config.index}`, ko.index(paths)],
    [`${config.specDir}/${config.log}`, ko.log(localDate())],
    [`${config.specDir}/templates/overview.md`, ko.overview(paths)],
    [`${config.specDir}/templates/detail.md`, ko.detail(paths)],
    [`${config.rawDir}/README.md`, ko.rawReadme(paths)],
  ];
  if (skillsOption !== undefined) files.push(...skillFiles(agentsOf(skillsOption), paths));

  const agentsAbs = join(root, 'AGENTS.md');
  const agentsCurrent = existsSync(agentsAbs) ? readFileSync(agentsAbs, 'utf8') : undefined;
  const agentsNext = mergeAgents(agentsCurrent, agentsBlock(paths));

  mkdirSync(root, { recursive: true });
  if (configText !== undefined) writeFileSync(configAbs, configText);
  for (const [rel, content] of files) {
    const abs = join(root, rel);
    if (existsSync(abs)) {
      out.push(`이미 있음, 건너뜀: ${rel}`);
    } else {
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, content);
      out.push(`생성: ${rel}`);
    }
  }
  if (agentsNext !== agentsCurrent) writeFileSync(agentsAbs, agentsNext);
  out.push('갱신: AGENTS.md');

  // CLAUDE.md는 고치지 않고, 가져오기 줄이 없을 때만 안내한다.
  const claudeAbs = join(root, 'CLAUDE.md');
  if (existsSync(claudeAbs) && !readFileSync(claudeAbs, 'utf8').includes('@AGENTS.md')) {
    out.push('안내: Claude Code가 crumbs 규칙을 읽도록 CLAUDE.md에 "@AGENTS.md"를 추가하세요');
  }
  out.push('다음: crumbs check');
  return out;
}
