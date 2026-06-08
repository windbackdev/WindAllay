import { ToolDefinition } from '../providers/types.js';
import { ToolFunction, BuiltinTools } from './builtins.js';
import { CHAT_TOOL_DEFS, CHAT_TOOL_HANDLERS } from '../projects/chat-tools.js';
import { truncateOutput } from './truncate.js';
import { getToolHookManager } from './types.js';
import { formatToolError } from './errors.js';
import { normalizeArgs, validateArgs } from './arg-utils.js';

export interface ToolContext {
  cwd: string;
  workingDir: string;
  allowBash: boolean;
  onProgress?: (msg: string) => void;
}

export type ToolHandler = (args: Record<string, unknown>, ctx: ToolContext) => Promise<string>;

export interface RegisteredTool {
  handler: ToolHandler;
  def: ToolFunction;
  source: 'builtin' | 'mcp' | 'custom';
  serverName?: string;
}

export class ToolRegistry {
  private tools = new Map<string, RegisteredTool>();

  register(name: string, handler: ToolHandler, def: ToolFunction, source: RegisteredTool['source'] = 'custom', serverName?: string): void {
    this.tools.set(name, { handler, def, source, serverName });
  }

  get(name: string): ToolHandler | undefined {
    return this.tools.get(name)?.handler;
  }

  getInfo(name: string): RegisteredTool | undefined {
    return this.tools.get(name);
  }

  getDefinitions(filterSource?: RegisteredTool['source']): ToolDefinition[] {
    return Array.from(this.tools.values())
      .filter((t) => !filterSource || t.source === filterSource)
      .map(({ def }) => ({
        type: 'function' as const,
        function: {
          name: def.name,
          description: def.description,
          parameters: def.parameters,
        },
      }));
  }

  getBySource(source: RegisteredTool['source']): RegisteredTool[] {
    return Array.from(this.tools.values()).filter((t) => t.source === source);
  }

  async execute(name: string, args: Record<string, unknown>, ctx: ToolContext): Promise<string> {
    const tool = this.tools.get(name);
    if (!tool) {
      return JSON.stringify({ error: `Unknown tool: ${name}` });
    }

    try {
      // 1. Normalize arguments — safely parse JSON, coerce types
      const normalized = normalizeArgs(args, tool.def);

      // 2. Validate arguments against schema
      const validationError = validateArgs(normalized, tool.def);
      if (validationError) {
        return JSON.stringify({ error: validationError });
      }

      // 3. Run pre-hooks
      const hooks = getToolHookManager();
      const preResult = await hooks.runPreHooks(name, normalized, ctx);
      if (!preResult.allowed) {
        return JSON.stringify({ error: preResult.reason ?? `Tool ${name} not allowed` });
      }
      const execArgs = preResult.modifiedArgs ?? normalized;

      // 4. Execute handler
      const raw = await tool.handler(execArgs, ctx);

      let result = raw;
      try {
        const postResult = await hooks.runPostHooks(name, execArgs, raw, ctx);
        if (postResult !== null) result = postResult;
      } catch { /* post-hook failure is non-fatal */ }

      let parsed: any;
      try { parsed = JSON.parse(result); } catch { return result; }
      if (parsed && typeof parsed === 'object' && !parsed.error) {
        for (const key of ['content', 'stdout', 'results']) {
          const val = parsed[key];
          if (typeof val === 'string' && val.length > 0) {
            const t = truncateOutput(val);
            if (t.truncated) {
              parsed[key] = t.content;
              parsed._truncated = true;
              parsed._outputPath = t.outputPath;
              parsed._originalBytes = t.originalBytes;
            }
            break;
          }
        }
      }
      return JSON.stringify(parsed ?? result);
    } catch (err: unknown) {
      return JSON.stringify({ error: formatToolError(err) });
    }
  }

  remove(name: string): boolean {
    return this.tools.delete(name);
  }

  clearSource(source: RegisteredTool['source']): void {
    for (const [name, tool] of this.tools) {
      if (tool.source === source) {
        this.tools.delete(name);
      }
    }
  }

  get count(): number {
    return this.tools.size;
  }

  getAllNames(): string[] {
    return Array.from(this.tools.keys());
  }
}

let _registry: ToolRegistry | null = null;

export function getToolRegistry(): ToolRegistry {
  if (!_registry) {
    _registry = new ToolRegistry();
    for (const [name, { fn, def }] of Object.entries(BuiltinTools)) {
      _registry.register(name, fn, def, 'builtin');
    }
    for (const def of CHAT_TOOL_DEFS) {
      const handler = CHAT_TOOL_HANDLERS[def.name];
      if (handler) _registry.register(def.name, handler, def, 'builtin');
    }
  }
  return _registry;
}

export function resetToolRegistry(): void {
  _registry = null;
}
