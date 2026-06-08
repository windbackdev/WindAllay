import { getSkillRegistry } from './registry.js';
import type { Skill } from './registry.js';
import { getConfig } from '../utils/config.js';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const EXAMPLE_SKILL = `# My Custom Skill

## Description
This is an example skill for WindAllay.

## Instructions
You are an expert in the subject matter of this skill.
Always follow these instructions carefully:

1. Be thorough and precise
2. Provide detailed explanations
3. Use tools when needed to complete tasks

## Tools
- bash, read, write, edit, glob, grep
`;

export function loadSkills(): Skill[] {
  const config = getConfig();
  const registry = getSkillRegistry();

  // 1. Load from flat skills/ directory (backward-compatible)
  const flatDir = config.skillsDir || join(process.cwd(), 'skills');
  if (!existsSync(flatDir)) {
    mkdirSync(flatDir, { recursive: true });
    writeFileSync(join(flatDir, 'example.skill.md'), EXAMPLE_SKILL, 'utf-8');
  }
  registry.loadFromDir(flatDir);

  // 2. Auto-load from .windallay/skills/<name>/SKILL.md (directory-based)
  const dotDir = join(process.cwd(), '.windallay', 'skills');
  registry.loadFromSkillDirs(dotDir);

  return registry.getAll();
}

export function createSkill(name: string, instructions: string): Skill {
  const config = getConfig();
  const skillsDir = config.skillsDir || join(process.cwd(), 'skills');

  if (!existsSync(skillsDir)) {
    mkdirSync(skillsDir, { recursive: true });
  }

  const filePath = join(skillsDir, `${name}.skill.md`);
  const content = `# ${name}\n\n## Description\n\n## Instructions\n${instructions}\n\n## Tools\n- bash, read, write, edit, glob, grep\n`;

  writeFileSync(filePath, content, 'utf-8');

  const registry = getSkillRegistry();
  registry.loadFromDir(skillsDir);
  return registry.get(name) as Skill;
}
