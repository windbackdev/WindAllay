import { Message, ToolDefinition } from '../providers/types.js';
import { ToolRegistry } from './registry.js';
import type { ToolContext } from './registry.js';
import { DEFAULT_MAX_RESULT_SIZE_CHARS, MAX_TOOL_RESULTS_PER_MESSAGE_CHARS, buildPersistedResultMessage, persistToolResult } from './storage.js';

export interface ToolCallRequest {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface ToolResult {
  tool_call_id: string;
  role: 'tool';
  content: string;
}

export type ToolProgressCallback = (toolName: string, toolCallId: string, status: 'executing' | 'done' | 'error') => void;

export class ToolExecutor {
  private registry: ToolRegistry;
  private ctx: ToolContext;
  private onProgress?: ToolProgressCallback;

  constructor(registry: ToolRegistry, ctx: ToolContext, onProgress?: ToolProgressCallback) {
    this.registry = registry;
    this.ctx = ctx;
    this.onProgress = onProgress;
  }

  async executeTool(tc: ToolCallRequest): Promise<ToolResult> {
    this.onProgress?.(tc.name, tc.id, 'executing');
    try {
      const result = await this.registry.execute(tc.name, tc.args, this.ctx);
      this.onProgress?.(tc.name, tc.id, 'done');
      return {
        tool_call_id: tc.id,
        role: 'tool',
        content: result,
      };
    } catch (err) {
      this.onProgress?.(tc.name, tc.id, 'error');
      return {
        tool_call_id: tc.id,
        role: 'tool',
        content: `__execution_error__:${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  async executeBatch(toolCalls: ToolCallRequest[]): Promise<ToolResult[]> {
    const tools = this.registry.getDefinitions();
    const batches = this.partitionByConcurrency(toolCalls, tools);
    const results: ToolResult[] = [];

    for (const batch of batches) {
      if (batch.isConcurrencySafe && batch.calls.length > 1) {
        const batchResults = await Promise.all(
          batch.calls.map((tc) => this.executeTool(tc))
        );
        results.push(...batchResults);
      } else {
        for (const tc of batch.calls) {
          const r = await this.executeTool(tc);
          results.push(r);
        }
      }
    }

    // Enforce per-message tool result budget: persist large results to disk
    const totalChars = results.reduce((s, r) => s + r.content.length, 0);
    if (totalChars > MAX_TOOL_RESULTS_PER_MESSAGE_CHARS) {
      for (const r of results) {
        if (r.content.length > DEFAULT_MAX_RESULT_SIZE_CHARS) {
          const toolName = (() => { try { return JSON.parse(r.content).tool || 'tool'; } catch { return 'tool'; } })();
          const persisted = persistToolResult(r.content, toolName, r.tool_call_id);
          r.content = buildPersistedResultMessage(persisted, toolName);
        }
      }
    }

    return results;
  }

  private partitionByConcurrency(
    calls: ToolCallRequest[],
    _defs: ToolDefinition[]
  ): { isConcurrencySafe: boolean; calls: ToolCallRequest[] }[] {
    const isConcurrencySafe = (name: string): boolean => {
      const readOnlyTools = ['read', 'read_multiple', 'glob', 'grep', 'web_search', 'web_fetch'];
      return readOnlyTools.includes(name) || name.startsWith('mcp_');
    };

    const batches: { isConcurrencySafe: boolean; calls: ToolCallRequest[] }[] = [];
    for (const tc of calls) {
      const safe = isConcurrencySafe(tc.name);
      const last = batches[batches.length - 1];
      if (last && last.isConcurrencySafe === safe) {
        last.calls.push(tc);
      } else {
        batches.push({ isConcurrencySafe: safe, calls: [tc] });
      }
    }
    return batches;
  }

  buildToolResults(toolCalls: ToolCallRequest[], results: ToolResult[]): Message[] {
    const msgMap = new Map<string, ToolResult>();
    for (const r of results) {
      msgMap.set(r.tool_call_id, r);
    }
    return toolCalls.map((tc) => {
      const r = msgMap.get(tc.id);
      return {
        role: 'tool' as const,
        content: r?.content ?? JSON.stringify({ error: 'No result' }),
        tool_call_id: tc.id,
      } as Message;
    });
  }
}
