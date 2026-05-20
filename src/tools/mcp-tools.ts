import { ToolRegistry } from './registry.js';
import type { ToolHandler } from './registry.js';
import { getMCPServerManager } from '../mcp/mcp-client.js';
import { getToolRegistry } from './registry.js';

export function registerMCPTools(registry: ToolRegistry): void {
  const mcpManager = getMCPServerManager();
  const mcpClients = mcpManager.getAllClients();

  for (const client of mcpClients) {
    const tools = client.getTools();
    for (const mcpTool of tools) {
      const handler: ToolHandler = async (args, ctx) => {
        try {
          // Merge common context params
          const callArgs = { ...args, cwd: ctx.cwd, workingDir: ctx.workingDir };
          const result = await client.callTool(mcpTool.name, callArgs);
          return result;
        } catch (err: any) {
          return JSON.stringify({ error: err.message });
        }
      };

      registry.register(`mcp_${client.name}_${mcpTool.name}`, handler, {
        name: `mcp_${client.name}_${mcpTool.name}`,
        description: `[MCP ${client.name}] ${mcpTool.description}`,
        parameters: {
          type: 'object',
          properties: mcpTool.inputSchema?.properties || {},
          required: mcpTool.inputSchema?.required || [],
          additionalProperties: true,
        },
      });
    }
  }
}

export function refreshMCPTools(): void {
  registerMCPTools(getToolRegistry());
}

// Watch for new MCP connections and auto-register tools
export function watchMCPConnections(): void {
  const interval = setInterval(() => {
    refreshMCPTools();
  }, 5000);

  // Allow cleanup
  (interval as any).unref?.();
}
