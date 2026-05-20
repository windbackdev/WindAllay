import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { join } from 'node:path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';

export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface MCPResourceDefinition {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface MCPPromptDefinition {
  name: string;
  description?: string;
  arguments?: { name: string; description?: string; required?: boolean }[];
}

export interface MCPServerConfig {
  name: string;
  transport: 'stdio';
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export class MCPClient {
  private client: Client;
  private transport: StdioClientTransport | null = null;
  public name: string;
  private connected = false;
  private toolsCache: MCPToolDefinition[] = [];
  private resourcesCache: MCPResourceDefinition[] = [];
  private promptsCache: MCPPromptDefinition[] = [];

  constructor(name: string) {
    this.name = name;
    this.client = new Client(
      { name: 'windallay-mcp', version: '0.1.0' },
      { capabilities: {} as any }
    );
  }

  async connect(config: MCPServerConfig): Promise<void> {
    this.transport = new StdioClientTransport({
      command: config.command,
      args: config.args,
      env: { ...process.env as Record<string, string>, ...config.env },
    });

    await this.client.connect(this.transport);
    this.connected = true;

    await this.refreshCapabilities();
  }

  async refreshCapabilities(): Promise<void> {
    if (!this.connected) return;

    try {
      const toolsResult = await this.client.listTools();
      this.toolsCache = (toolsResult.tools || []).map((t: any) => ({
        name: t.name,
        description: t.description || '',
        inputSchema: t.inputSchema || {},
      }));
    } catch { this.toolsCache = []; }

    try {
      const resourcesResult = await this.client.listResources();
      this.resourcesCache = (resourcesResult.resources || []).map((r: any) => ({
        uri: r.uri,
        name: r.name,
        description: r.description,
        mimeType: r.mimeType,
      }));
    } catch { this.resourcesCache = []; }

    try {
      const promptsResult = await this.client.listPrompts();
      this.promptsCache = (promptsResult.prompts || []).map((p: any) => ({
        name: p.name,
        description: p.description,
        arguments: p.arguments,
      }));
    } catch { this.promptsCache = []; }
  }

  getTools(): MCPToolDefinition[] {
    return this.toolsCache;
  }

  getResources(): MCPResourceDefinition[] {
    return this.resourcesCache;
  }

  getPrompts(): MCPPromptDefinition[] {
    return this.promptsCache;
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<string> {
    if (!this.connected) throw new Error('MCP client not connected');

    const result = await this.client.callTool({
      name,
      arguments: args,
    }) as any;

    if (result.isError) {
      const content = result.content?.[0];
      throw new Error(content?.text || 'Tool call failed');
    }

    const content: any[] = result.content || [];
    return content.map((c: any) => c?.text || '').filter(Boolean).join('\n');
  }

  async readResource(uri: string): Promise<string> {
    if (!this.connected) throw new Error('MCP client not connected');

    const result = await this.client.readResource({ uri }) as any;
    const contents: any[] = result.contents || [];
    return contents.map((c: any) => c?.text || c?.blob || '').filter(Boolean).join('\n');
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      try { await this.client.close(); } catch { }
      this.connected = false;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }
}

// MCP Server Manager
export class MCPServerManager {
  private clients = new Map<string, MCPClient>();
  private configs: MCPServerConfig[] = [];
  private configPath: string;

  constructor() {
    this.configPath = join(process.cwd(), '.windallay', 'mcp-servers.json');
  }

  loadConfigs(): MCPServerConfig[] {
    if (existsSync(this.configPath)) {
      try {
        this.configs = JSON.parse(readFileSync(this.configPath, 'utf-8'));
      } catch { this.configs = []; }
    }

    const hasBuiltin = this.configs.some((c) => c.name === 'builtin-filesystem');
    if (!hasBuiltin) {
      this.configs.push({
        name: 'builtin-filesystem',
        transport: 'stdio',
        command: process.execPath,
        args: ['-e', 'console.log("Built-in filesystem MCP server")'],
      });
    }

    return this.configs;
  }

  addConfig(config: MCPServerConfig): void {
    this.configs = this.configs.filter((c) => c.name !== config.name);
    this.configs.push(config);
    this.saveConfigs();
  }

  removeConfig(name: string): void {
    this.configs = this.configs.filter((c) => c.name !== name);
    this.saveConfigs();
  }

  private saveConfigs(): void {
    const dir = join(process.cwd(), '.windallay');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(this.configPath, JSON.stringify(this.configs, null, 2), 'utf-8');
  }

  getConfig(name: string): MCPServerConfig | undefined {
    return this.configs.find((c) => c.name === name);
  }

  getAllConfigs(): MCPServerConfig[] {
    return this.configs;
  }

  async connectAll(): Promise<void> {
    for (const config of this.configs) {
      if (config.name === 'builtin-filesystem') continue;
      if (this.clients.has(config.name)) continue;

      try {
        const client = new MCPClient(config.name);
        await client.connect(config);
        this.clients.set(config.name, client);
      } catch (err) {
        console.error(`Failed to connect MCP server "${config.name}":`, err);
      }
    }
  }

  async connect(configName: string): Promise<MCPClient> {
    const config = this.configs.find((c) => c.name === configName);
    if (!config) throw new Error(`MCP server "${configName}" not found`);

    const client = new MCPClient(configName);
    await client.connect(config);
    this.clients.set(configName, client);
    return client;
  }

  getClient(name: string): MCPClient | undefined {
    return this.clients.get(name);
  }

  getAllClients(): MCPClient[] {
    return Array.from(this.clients.values());
  }

  getAllTools(): MCPToolDefinition[] {
    return this.getAllClients().flatMap((c) => c.getTools());
  }

  getAllResources(): MCPResourceDefinition[] {
    return this.getAllClients().flatMap((c) => c.getResources());
  }

  async disconnectAll(): Promise<void> {
    for (const [, client] of this.clients) {
      await client.disconnect();
    }
    this.clients.clear();
  }

  async removeClient(name: string): Promise<void> {
    const client = this.clients.get(name);
    if (client) {
      await client.disconnect();
      this.clients.delete(name);
    }
    this.removeConfig(name);
  }
}

let _mcpManager: MCPServerManager | null = null;

export function getMCPServerManager(): MCPServerManager {
  if (!_mcpManager) {
    _mcpManager = new MCPServerManager();
  }
  return _mcpManager;
}
