import type { ToolContext } from './registry.js';

export type { ToolContext };

export type ToolHookFn = (
  toolName: string,
  args: Record<string, unknown>,
  ctx: ToolContext,
) => Promise<{ allowed: boolean; reason?: string; modifiedArgs?: Record<string, unknown> } | null>;

export type ToolPostHookFn = (
  toolName: string,
  args: Record<string, unknown>,
  result: string,
  ctx: ToolContext,
) => Promise<string | null>;

export class ToolHookManager {
  private preHooks: ToolHookFn[] = [];
  private postHooks: ToolPostHookFn[] = [];

  addPreHook(hook: ToolHookFn): void {
    this.preHooks.push(hook);
  }

  addPostHook(hook: ToolPostHookFn): void {
    this.postHooks.push(hook);
  }

  async runPreHooks(
    toolName: string,
    args: Record<string, unknown>,
    ctx: ToolContext,
  ): Promise<{ allowed: boolean; reason?: string; modifiedArgs?: Record<string, unknown> }> {
    let currentArgs = args;
    for (const hook of this.preHooks) {
      const result = await hook(toolName, currentArgs, ctx);
      if (result) {
        if (!result.allowed) return { allowed: false, reason: result.reason };
        if (result.modifiedArgs) currentArgs = result.modifiedArgs;
      }
    }
    return { allowed: true, modifiedArgs: currentArgs };
  }

  async runPostHooks(
    toolName: string,
    args: Record<string, unknown>,
    result: string,
    ctx: ToolContext,
  ): Promise<string> {
    let currentResult = result;
    for (const hook of this.postHooks) {
      const modified = await hook(toolName, args, currentResult, ctx);
      if (modified !== null) currentResult = modified;
    }
    return currentResult;
  }

  clear(): void {
    this.preHooks = [];
    this.postHooks = [];
  }
}

let _hookManager: ToolHookManager | null = null;

export function getToolHookManager(): ToolHookManager {
  if (!_hookManager) _hookManager = new ToolHookManager();
  return _hookManager;
}

