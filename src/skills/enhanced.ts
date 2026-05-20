import { getSkillRegistry } from './registry.js';
import type { Skill } from './registry.js';
import { getMCPServerManager } from '../mcp/mcp-client.js';

export interface EnhancedSkill extends Skill {
  allowedTools: string[];
  restrictedTools: string[];
  mcpServers: string[];
  variables: Record<string, string>;
  requires: string[];
  chain: string[];
}

const SKILL_METADATA_REGEX = /^@(\w+):\s*(.+)$/m;
const FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---/;

export class EnhancedSkillLoader {
  private parsed = new Map<string, EnhancedSkill>();

  parseFrontmatter(content: string): Record<string, unknown> {
    const match = content.match(FRONTMATTER_REGEX);
    if (!match) return {};

    const frontmatter: Record<string, unknown> = {};
    for (const line of match[1].split('\n')) {
      const [key, ...rest] = line.split(':').map((s) => s.trim());
      if (key && rest.length > 0) {
        const value = rest.join(':').trim();
        if (value.startsWith('[') && value.endsWith(']')) {
          frontmatter[key] = value.slice(1, -1).split(',').map((s) => s.trim()).filter(Boolean);
        } else {
          frontmatter[key] = value;
        }
      }
    }
    return frontmatter;
  }

  enhanceSkill(skill: Skill): EnhancedSkill {
    if (this.parsed.has(skill.name)) {
      return this.parsed.get(skill.name)!;
    }

    const frontmatter = this.parseFrontmatter(skill.instructions);
    const metadata: Record<string, string> = {};
    const lines = skill.instructions.split('\n');
    for (const line of lines) {
      const m = line.match(SKILL_METADATA_REGEX);
      if (m) metadata[m[1]] = m[2];
    }

    const toolRequire = (frontmatter.tools as string[]) || (skill.tools) || [];
    const mcpFromMeta = metadata.mcp ? metadata.mcp.split(',').map((s) => s.trim()).filter(Boolean) : [];

    const enhanced: EnhancedSkill = {
      ...skill,
      allowedTools: (frontmatter.allowedTools as string[]) || toolRequire,
      restrictedTools: (frontmatter.restrictedTools as string[]) || [],
      mcpServers: (frontmatter.mcpServers as string[]) || mcpFromMeta,
      variables: (frontmatter.variables as Record<string, string>) || {},
      requires: (frontmatter.requires as string[]) || [],
      chain: (frontmatter.chain as string[]) || [],
    };

    this.parsed.set(skill.name, enhanced);
    return enhanced;
  }

  getEnhanced(name: string): EnhancedSkill | undefined {
    const skill = getSkillRegistry().get(name);
    if (!skill) return undefined;
    return this.enhanceSkill(skill);
  }

  getAllEnhanced(): EnhancedSkill[] {
    return getSkillRegistry().getAll().map((s) => this.enhanceSkill(s));
  }

  async resolveDependencies(skill: EnhancedSkill): Promise<void> {
    const mcpManager = getMCPServerManager();

    for (const serverName of skill.mcpServers) {
      const config = mcpManager.getConfig(serverName);
      if (config && !mcpManager.getClient(serverName)) {
        try {
          await mcpManager.connect(serverName);
        } catch {
          console.error(`Failed to connect MCP server "${serverName}" for skill "${skill.name}"`);
        }
      }
    }
  }

  getSystemPromptWithVars(skill: EnhancedSkill, userVars?: Record<string, string>): string {
    let prompt = skill.instructions;
    const vars = { ...skill.variables, ...userVars };

    for (const [key, value] of Object.entries(vars)) {
      prompt = prompt.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g'), value);
    }

    return prompt;
  }
}

let _enhancedLoader: EnhancedSkillLoader | null = null;

export function getEnhancedSkillLoader(): EnhancedSkillLoader {
  if (!_enhancedLoader) {
    _enhancedLoader = new EnhancedSkillLoader();
  }
  return _enhancedLoader;
}

// Example enhanced skill template
export const ENHANCED_SKILL_TEMPLATE = `---
name: custom-skill
description: A custom WindAllay skill
allowedTools: [bash, read, write, edit, glob, grep]
restrictedTools: []
mcpServers: []
variables:
  language: TypeScript
requires: []
chain: []
---

# {{ name }}

## Description
{{ description }}

## Instructions
You are an expert {{ language }} developer.
Follow these guidelines:
1. Write clean, well-structured {{ language }} code
2. Follow community best practices
3. Use the available tools when needed

## Tools
- bash, read, write, edit, glob, grep
`;
