import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

export interface Skill {
  name: string;
  description: string;
  instructions: string;
  tools?: string[];
  filePath: string;
}

const FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---\n/;

export class SkillRegistry {
  private skills = new Map<string, Skill>();

  /** Load skills from a flat directory of .md / .skill.md files */
  loadFromDir(dirPath: string): void {
    if (!existsSync(dirPath)) return;

    const entries = readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && (entry.name.endsWith('.md') || entry.name.endsWith('.skill.md'))) {
        const filePath = join(dirPath, entry.name);
        try {
          const skill = this.parseSkillFile(filePath);
          if (skill && !this.skills.has(skill.name)) {
            this.skills.set(skill.name, skill);
          }
        } catch (err) {
          console.error(`Failed to load skill: ${entry.name}`, err);
        }
      }
    }
  }

  /**
   * Load skills from subdirectory structure: baseDir/<skill-name>/SKILL.md
   * The directory name becomes the skill name.
   * SKILL.md frontmatter can override name/description.
   */
  loadFromSkillDirs(baseDir: string): void {
    if (!existsSync(baseDir)) return;

    const entries = readdirSync(baseDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const skillDir = join(baseDir, entry.name);
      const skillFile = join(skillDir, 'SKILL.md');
      if (existsSync(skillFile) && statSync(skillFile).isFile()) {
        try {
          const skill = this.parseSkillFile(skillFile, entry.name);
          if (skill && !this.skills.has(skill.name)) {
            this.skills.set(skill.name, skill);
          }
        } catch (err) {
          console.error(`Failed to load skill from ${skillFile}`, err);
        }
      }
    }
  }

  /**
   * Parse a SKILL.md file into a Skill object.
   * Supports YAML frontmatter (--- blocks) for name/description overrides.
   * @param filePath - path to the .md file
   * @param defaultName - fallback name (used for directory-based skills)
   */
  private parseSkillFile(filePath: string, defaultName?: string): Skill | null {
    const content = readFileSync(filePath, 'utf-8');
    let instructions = content;
    let name: string | undefined;
    let description: string | undefined;

    // Extract YAML frontmatter
    const fmMatch = content.match(FRONTMATTER_REGEX);
    if (fmMatch) {
      const fmLines = fmMatch[1].split('\n');
      for (const line of fmLines) {
        const [key, ...rest] = line.split(':').map((s) => s.trim());
        if (key === 'name' && rest.length > 0) name = rest.join(':').trim();
        if (key === 'description' && rest.length > 0) description = rest.join(':').trim();
      }
      // Strip frontmatter from instructions
      instructions = content.slice(fmMatch[0].length);
    }

    // Derive name: frontmatter > defaultName > filename
    if (!name) {
      if (defaultName) {
        name = defaultName;
      } else {
        name = filePath.split(/[\\/]/).pop()?.replace(/\.(skill\.)?md$/i, '') ?? 'unknown';
      }
    }

    // Derive description
    if (!description) {
      description = `Skill loaded from ${filePath}`;
    }

    // Parse ## Tools section
    const tools: string[] = [];
    const lines = instructions.split('\n');
    let foundTools = false;
    for (const line of lines) {
      if (line.startsWith('### Tools') || line.startsWith('## Tools')) {
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
      instructions,
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
