import type { TemplatePaths } from './templates/ko.js';
import { skillsKo } from './templates/skills-ko.js';

// 스킬 이름. 디렉터리 이름이자 frontmatter의 name이다(6.3.1).
export const SKILL_NAMES = ['crumbs-writer', 'crumbs-finder', 'crumbs-interview', 'crumbs-ingest'] as const;
export type SkillName = (typeof SKILL_NAMES)[number];

export type SkillAgent = 'claude' | 'codex';

// 도구별 스킬 루트(저장소 루트 기준). Codex 위치는 5.1 Q10에서 확인했다.
export const SKILL_ROOTS: Record<SkillAgent, string> = { claude: '.claude/skills', codex: '.agents/skills' };

// --skills 값을 설치할 도구 목록으로 바꾼다.
export function agentsOf(option: 'claude' | 'codex' | 'all'): SkillAgent[] {
  return option === 'all' ? ['claude', 'codex'] : [option];
}

// [저장소 기준 경로, 내용] 목록을 돌려준다. 순서는 agents 순서 × SKILL_NAMES 순서다. 파일은 쓰지 않는다.
export function skillFiles(agents: SkillAgent[], paths: TemplatePaths): Array<[string, string]> {
  return agents.flatMap((agent) =>
    SKILL_NAMES.map((name): [string, string] => [`${SKILL_ROOTS[agent]}/${name}/SKILL.md`, skillsKo[name](paths)]),
  );
}
