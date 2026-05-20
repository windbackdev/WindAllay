import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export interface Skill {
  name: string;
  description: string;
  instructions: string;
  tools?: string[];
  filePath: string;
}



export class SkillRegistry {
  private skills = new Map<string, Skill>();

  loadFromDir(dirPath: string): void {
    if (!existsSync(dirPath)) return;

    const entries = readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && (entry.name.endsWith('.md') || entry.name.endsWith('.skill.md'))) {
        const filePath = join(dirPath, entry.name);
        try {
          const skill = this.parseSkillFile(filePath);
          if (skill) {
            this.skills.set(skill.name, skill);
          }
        } catch (err) {
          console.error(`Failed to load skill: ${entry.name}`, err);
        }
      }
    }
  }

  private parseSkillFile(filePath: string): Skill | null {
    const content = readFileSync(filePath, 'utf-8');
    const name = filePath.split(/[\\/]/).pop()?.replace(/\.(skill\.)?md$/, '') ?? 'unknown';
    const description = `Skill loaded from ${filePath}`;

    const lines = content.split('\n');
    const tools: string[] = [];

    let foundTools = false;
    for (const line of lines) {
      if (line.startsWith('### Tools')) {
        foundTools = true;
        continue;
      }
      if (foundTools) {
        if (line.startsWith('#') || line.trim() === '') {
          break;
        }
        const trimmed = line.trim();
        if (trimmed.startsWith('- ')) {
          tools.push(
            ...trimmed
              .replace(/^- /, '')
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean)
          );
        }
      }
    }

    return {
      name,
      description,
      instructions: content,
      tools: tools.length > 0 ? tools : undefined,
      filePath,
    };
  }

  get(name: string): Skill | undefined {
    return this.skills.get(name);
  }

  getAll(): Skill[] {
    return Array.from(this.skills.values());
  }

  getSystemInstructions(skillName?: string): string {
    if (skillName && this.skills.has(skillName)) {
      return this.skills.get(skillName)!.instructions;
    }
    return '';
  }

  unload(name: string): void {
    this.skills.delete(name);
  }
}

let _skillRegistry: SkillRegistry | null = null;

export function getSkillRegistry(): SkillRegistry {
  if (!_skillRegistry) {
    _skillRegistry = new SkillRegistry();
  }
  return _skillRegistry;
}
