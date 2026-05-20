import { spawn, ChildProcess } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { EventEmitter } from 'node:events';

interface LSPDiagnostic {
  range: { start: { line: number; character: number }; end: { line: number; character: number } };
  severity: 'error' | 'warning' | 'info' | 'hint';
  message: string;
  source?: string;
}

interface LSPCompletion {
  label: string;
  kind?: string;
  detail?: string;
  documentation?: string;
}

interface LSPHover {
  contents: string;
  range?: { start: { line: number; character: number }; end: { line: number; character: number } };
}

interface LSPServerConfig {
  language: string;
  command: string;
  args: string[];
  extensions: string[];
}

const KNOWN_SERVERS: LSPServerConfig[] = [
  {
    language: 'typescript',
    command: 'npx',
    args: ['typescript-language-server', '--stdio'],
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'],
  },
  {
    language: 'python',
    command: 'pylsp',
    args: [],
    extensions: ['.py'],
  },
  {
    language: 'json',
    command: 'npx',
    args: ['vscode-json-languageserver', '--stdio'],
    extensions: ['.json', '.jsonc'],
  },
];

export class LSPClient extends EventEmitter {
  private process: ChildProcess | null = null;
  private messageId = 0;
  private pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();
  private buffer = '';
  private initialized = false;
  private capabilities: Record<string, unknown> = {};
  private serverConfig: LSPServerConfig | null = null;
  private rootUri: string;
  private fileExtensions: string[] = [];

  constructor(rootDir?: string) {
    super();
    this.rootUri = rootDir ? `file:///${resolve(rootDir).replace(/\\/g, '/')}` : `file:///${process.cwd().replace(/\\/g, '/')}`;
  }

  async startForFile(filePath: string): Promise<boolean> {
    const ext = filePath.toLowerCase().split('.').pop();
    if (!ext) return false;

    const config = KNOWN_SERVERS.find((s) => s.extensions.includes(`.${ext}`));
    if (!config) return false;

    return this.start(config);
  }

  async start(config: LSPServerConfig): Promise<boolean> {
    if (this.process) return true;
    this.serverConfig = config;
    this.fileExtensions = config.extensions;

    return new Promise((resolve) => {
      try {
        this.process = spawn(config.command, config.args, {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env as Record<string, string> },
        });

        this.process.stdout?.on('data', (data: Buffer) => {
          this.buffer += data.toString();
          this.processMessages();
        });

        this.process.stderr?.on('data', (_data: Buffer) => {
          // LSP servers often log debug info to stderr
        });

        this.process.on('error', () => resolve(false));
        this.process.on('exit', () => {
          this.process = null;
          this.initialized = false;
        });

        this.initialize().then(() => resolve(true)).catch(() => resolve(false));
      } catch {
        resolve(false);
      }
    });
  }

  private async initialize(): Promise<void> {
    const result = await this.sendRequest('initialize', {
      processId: process.pid,
      rootUri: this.rootUri,
      capabilities: {
        textDocument: {
          synchronization: { didSave: true },
          completion: { completionItem: { snippetSupport: true } },
          hover: { contentFormat: ['markdown', 'plaintext'] },
          diagnostic: {},
        },
      },
    });

    this.capabilities = result.capabilities || {};
    this.initialized = true;

    await this.sendNotification('initialized', {});
  }

  private async sendRequest(method: string, params: unknown): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = ++this.messageId;
      this.pending.set(id, { resolve, reject });

      const message = JSON.stringify({
        jsonrpc: '2.0',
        id,
        method,
        params,
      });

      this.sendMessage(message);

      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`Request timeout: ${method}`));
        }
      }, 10000);
    });
  }

  private async sendNotification(method: string, params: unknown): Promise<void> {
    const message = JSON.stringify({
      jsonrpc: '2.0',
      method,
      params,
    });
    this.sendMessage(message);
  }

  private sendMessage(message: string): void {
    if (!this.process?.stdin) return;
    const header = `Content-Length: ${Buffer.byteLength(message, 'utf-8')}\r\n\r\n`;
    this.process.stdin.write(header + message);
  }

  private processMessages(): void {
    const headerMatch = this.buffer.match(/Content-Length: (\d+)\r\n\r\n/);
    if (!headerMatch) return;

    const contentLength = parseInt(headerMatch[1]);
    const headerEnd = headerMatch.index! + headerMatch[0].length;

    if (this.buffer.length < headerEnd + contentLength) return;

    const content = this.buffer.slice(headerEnd, headerEnd + contentLength);
    this.buffer = this.buffer.slice(headerEnd + contentLength);

    try {
      const msg = JSON.parse(content);
      this.handleMessage(msg);
    } catch { }

    if (this.buffer.length > 0) {
      this.processMessages();
    }
  }

  private handleMessage(msg: any): void {
    if (msg.id && this.pending.has(msg.id)) {
      const pending = this.pending.get(msg.id)!;
      this.pending.delete(msg.id);

      if (msg.error) {
        pending.reject(new Error(msg.error.message));
      } else {
        pending.resolve(msg.result);
      }
    }

    if (msg.method === 'textDocument/publishDiagnostics') {
      const diagnostics: LSPDiagnostic[] = (msg.params.diagnostics || []).map((d: any) => ({
        range: d.range,
        severity: ['error', 'warning', 'info', 'hint'][d.severity ? d.severity - 1 : 0] as LSPDiagnostic['severity'],
        message: d.message,
        source: d.source,
      }));
      this.emit('diagnostics', { uri: msg.params.uri, diagnostics });
    }
  }

  async openDocument(filePath: string): Promise<void> {
    if (!this.initialized) return;
    const uri = `file:///${resolve(filePath).replace(/\\/g, '/')}`;
    const content = existsSync(filePath) ? readFileSync(filePath, 'utf-8') : '';

    await this.sendNotification('textDocument/didOpen', {
      textDocument: {
        uri,
        languageId: this.getLanguageId(filePath),
        version: 1,
        text: content,
      },
    });
  }

  async changeDocument(filePath: string, content: string): Promise<void> {
    if (!this.initialized) return;
    const uri = `file:///${resolve(filePath).replace(/\\/g, '/')}`;

    await this.sendNotification('textDocument/didChange', {
      textDocument: { uri, version: Date.now() },
      contentChanges: [{ text: content }],
    });
  }

  async getCompletions(filePath: string, line: number, character: number): Promise<LSPCompletion[]> {
    if (!this.initialized) return [];
    const uri = `file:///${resolve(filePath).replace(/\\/g, '/')}`;

    try {
      const result = await this.sendRequest('textDocument/completion', {
        textDocument: { uri },
        position: { line, character },
        context: { triggerKind: 1 },
      });

      const items = result?.items || result || [];
      return items.map((i: any) => ({
        label: i.label,
        kind: ['', 'Text', 'Method', 'Function', 'Constructor', 'Field', 'Variable', 'Class', 'Interface', 'Module', 'Property'][i.kind] || '',
        detail: i.detail,
        documentation: i.documentation,
      }));
    } catch {
      return [];
    }
  }

  async getHover(filePath: string, line: number, character: number): Promise<LSPHover | null> {
    if (!this.initialized) return null;
    const uri = `file:///${resolve(filePath).replace(/\\/g, '/')}`;

    try {
      const result = await this.sendRequest('textDocument/hover', {
        textDocument: { uri },
        position: { line, character },
      });

      if (!result) return null;
      const contents = typeof result.contents === 'string'
        ? result.contents
        : Array.isArray(result.contents)
          ? result.contents.map((c: any) => c.value || c).join('\n')
          : result.contents?.value || '';

      return { contents, range: result.range };
    } catch {
      return null;
    }
  }

  async getDiagnostics(filePath: string): Promise<LSPDiagnostic[]> {
    if (!this.initialized || !this.serverConfig) return [];

    const ext = filePath.toLowerCase().split('.').pop();
    if (!ext || !this.fileExtensions.includes(`.${ext}`)) return [];

    await this.openDocument(filePath);

    const uri = `file:///${resolve(filePath).replace(/\\/g, '/')}`;

    try {
      const result = await this.sendRequest('textDocument/diagnostic', {
        textDocument: { uri },
      });

      const diagnostics = result?.items || [];
      return diagnostics.map((d: any) => ({
        range: d.range,
        severity: ['error', 'warning', 'info', 'hint'][d.severity ? d.severity - 1 : 1] as LSPDiagnostic['severity'],
        message: d.message,
        source: d.source,
      }));
    } catch {
      return [];
    }
  }

  private getLanguageId(filePath: string): string {
    const ext = filePath.toLowerCase().split('.').pop();
    const map: Record<string, string> = {
      ts: 'typescript', tsx: 'typescriptreact', js: 'javascript', jsx: 'javascriptreact',
      py: 'python', json: 'json', jsonc: 'jsonc', css: 'css', html: 'html',
      md: 'markdown', yaml: 'yaml', yml: 'yaml',
    };
    return map[ext || ''] || 'plaintext';
  }

  async shutdown(): Promise<void> {
    if (!this.process) return;
    try {
      await this.sendRequest('shutdown', {});
      await this.sendNotification('exit', {});
    } catch { }
    this.process.kill();
    this.process = null;
    this.initialized = false;
  }
}

// LSP Service Manager
export class LSPServiceManager {
  private clients = new Map<string, LSPClient>();

  async openFile(filePath: string): Promise<LSPClient | null> {
    const ext = filePath.toLowerCase().split('.').pop();
    if (!ext) return null;

    const config = KNOWN_SERVERS.find((s) => s.extensions.includes(`.${ext}`));
    if (!config) return null;

    if (this.clients.has(config.language)) {
      const client = this.clients.get(config.language)!;
      await client.openDocument(filePath);
      return client;
    }

    const client = new LSPClient(dirname(filePath));
    const started = await client.start(config);
    if (started) {
      this.clients.set(config.language, client);
      await client.openDocument(filePath);
      return client;
    }
    return null;
  }

  getClient(language: string): LSPClient | undefined {
    return this.clients.get(language);
  }

  async getDiagnostics(filePath: string): Promise<LSPDiagnostic[]> {
    const client = await this.openFile(filePath);
    if (!client) return [];
    return client.getDiagnostics(filePath);
  }

  async shutdownAll(): Promise<void> {
    for (const [, client] of this.clients) {
      await client.shutdown();
    }
    this.clients.clear();
  }
}

let _lspManager: LSPServiceManager | null = null;

export function getLSPServiceManager(): LSPServiceManager {
  if (!_lspManager) {
    _lspManager = new LSPServiceManager();
  }
  return _lspManager;
}
