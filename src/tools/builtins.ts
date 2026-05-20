import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { ToolHandler } from './registry.js';
import { MAX_TOOL_BYTES } from './truncate.js';

export interface ToolFunction {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export function buildToolDef(
  name: string,
  description: string,
  properties: Record<string, unknown>,
  required: string[] = []
): ToolFunction {
  return {
    name,
    description,
    parameters: {
      type: 'object',
      properties,
      required,
      additionalProperties: false,
    },
  };
}

function safePath(base: string, input: string): string {
  const resolved = resolve(base, input);
  const normalizedBase = resolve(base);
  const sep = process.platform === 'win32' ? '\\' : '/';
  if (resolved !== normalizedBase && !resolved.startsWith(normalizedBase + sep)) {
    throw new Error(`Path traversal detected: ${input}`);
  }
  return resolved;
}

export const ShellTool: ToolHandler = async (args, ctx) => {
  const command = args.command as string;
  const timeout = (args.timeout as number) ?? 30000;

  if (!command) return JSON.stringify({ error: 'No command provided' });
  if (!ctx.allowBash) return JSON.stringify({ error: 'Command execution not allowed' });

  const isWin = process.platform === 'win32';

  try {
    if (isWin) {
      const result = execSync(command, {
        cwd: ctx.cwd,
        timeout,
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024,
        windowsHide: true,
        shell: 'cmd.exe',
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
      });
      return JSON.stringify({ stdout: result, stderr: '', exitCode: 0 });
    }
    const result = execSync(command, {
      cwd: ctx.cwd,
      timeout,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
      shell: '/bin/bash',
    });
    return JSON.stringify({ stdout: result, stderr: '', exitCode: 0 });
  } catch (err: any) {
    return JSON.stringify({
      stdout: err.stdout ?? '',
      stderr: err.stderr ?? err.message,
      exitCode: err.status ?? -1,
    });
  }
};

interface ReadFileResult {
  file: string;
  content: string;
  totalLines: number;
  offset: number;
  truncated: boolean;
  error?: string;
}

function readSingleFile(filePath: string, offset: number, limit: number, cwd: string): ReadFileResult {
  const resolved = safePath(cwd, filePath);
  if (!existsSync(resolved)) return { file: filePath, content: '', totalLines: 0, offset, truncated: false, error: 'File not found' };

  const content = readFileSync(resolved, 'utf-8');
  const allLines = content.split('\n');
  const maxLineLen = 2000;
  let bytesUsed = 0;
  const maxBytes = MAX_TOOL_BYTES;
  const resultLines: string[] = [];

  for (let i = offset; i < allLines.length && resultLines.length < limit; i++) {
    let line = allLines[i];
    if (Buffer.byteLength(line, 'utf-8') > maxLineLen) {
      line = line.slice(0, maxLineLen) + `... (line truncated to ${maxLineLen} chars)`;
    }
    const lineBytes = Buffer.byteLength(line + '\n', 'utf-8');
    if (bytesUsed + lineBytes > maxBytes) {
      resultLines.push(`(Output capped at ${Math.round(maxBytes / 1024)} KB. Showing lines ${offset}-${i - 1} of ${allLines.length}. Use offset=${i} to continue.)`);
      break;
    }
    resultLines.push(line);
    bytesUsed += lineBytes;
  }

  const isTruncated = offset + resultLines.length < allLines.length || bytesUsed >= maxBytes;
  return { file: filePath, content: resultLines.join('\n'), totalLines: allLines.length, offset, truncated: isTruncated };
}

export const ReadTool: ToolHandler = async (args, ctx) => {
  const filePath = args.file_path as string;
  const offset = (args.offset as number) ?? 0;
  const limit = (args.limit as number) ?? 2000;

  if (!filePath) return JSON.stringify({ error: 'No file path provided' });

  const result = readSingleFile(filePath, offset, limit, ctx.cwd);
  return JSON.stringify(result);
};

export const ReadMultipleTool: ToolHandler = async (args, ctx) => {
  const raw = args.file_paths;
  const filePaths: string[] = Array.isArray(raw) ? raw.map(String) : typeof raw === 'string' ? raw.split(',').map((s) => s.trim()).filter(Boolean) : [];
  const offset = (args.offset as number) ?? 0;
  const limit = (args.limit as number) ?? 2000;

  if (filePaths.length === 0) return JSON.stringify({ error: 'No file paths provided. Pass file_paths as an array of strings.' });
  if (filePaths.length > 10) return JSON.stringify({ error: `Too many files (${filePaths.length}). Maximum is 10.` });

  const results = filePaths.map((fp) => readSingleFile(fp, offset, limit, ctx.cwd));
  return JSON.stringify({ results, count: results.length });
};

export const WriteTool: ToolHandler = async (args, ctx) => {
  const filePath = args.file_path as string;
  const content = args.content as string;

  if (!filePath) return JSON.stringify({ error: 'No file path provided' });
  if (content === undefined) return JSON.stringify({ error: 'No content provided' });

  const resolved = safePath(ctx.cwd, filePath);
  writeFileSync(resolved, content, 'utf-8');
  return JSON.stringify({ success: true, path: filePath, bytes: Buffer.byteLength(content) });
};

export const EditTool: ToolHandler = async (args, ctx) => {
  const filePath = args.file_path as string;
  const oldString = args.old_string as string;
  const newString = args.new_string as string;

  if (!filePath || !oldString || newString === undefined) {
    return JSON.stringify({ error: 'Missing required parameters (file_path, old_string, new_string)' });
  }

  const resolved = safePath(ctx.cwd, filePath);
  if (!existsSync(resolved)) return JSON.stringify({ error: 'File not found', path: filePath });

  const content = readFileSync(resolved, 'utf-8');
  const idx = content.indexOf(oldString);
  if (idx === -1) return JSON.stringify({ error: 'old_string not found in file' });

  const newContent = content.replace(oldString, newString);
  writeFileSync(resolved, newContent, 'utf-8');
  return JSON.stringify({ success: true, path: filePath, replacements: 1 });
};

const MAX_GLOB_RESULTS = 100;

function walkDir(dir: string, ext: string, maxResults = MAX_GLOB_RESULTS): string[] {
  const results: string[] = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true, recursive: true });
    for (const entry of entries) {
      if (results.length >= maxResults) break;
      if (entry.isFile()) {
        const fullPath = join(dir, entry.name);
        if (!ext || fullPath.endsWith(ext)) {
          results.push(fullPath);
        }
      }
    }
  } catch {}
  return results;
}

export const GlobTool: ToolHandler = async (args, ctx) => {
  const pattern = (args.pattern as string) || '';
  if (!pattern) return JSON.stringify({ error: 'No pattern provided' });

  try {
    const extMatch = pattern.match(/\.(\w+)$/);
    const ext = extMatch ? `.${extMatch[1]}` : '';
    const recursive = pattern.includes('**') || pattern.includes('*');

    if (recursive || ext) {
      const files = walkDir(ctx.cwd, ext);
      return JSON.stringify({ results: files, count: files.length });
    }

    const entries = readdirSync(ctx.cwd, { withFileTypes: true });
    const files = entries.filter((e) => e.isFile()).map((e) => join(ctx.cwd, e.name));
    return JSON.stringify({ results: files, count: files.length });
  } catch (err: any) {
    return JSON.stringify({ results: [], error: err.message });
  }
};

export const MAX_GREP_MATCHES = 100;
export const GREP_LINE_MAX = 300;

export const GrepTool: ToolHandler = async (args, ctx) => {
  const pattern = args.pattern as string;
  const include = args.include as string;
  const caseSensitive = args.caseSensitive !== false;

  if (!pattern) return JSON.stringify({ error: 'No pattern provided' });

  try {
    const ext = include ? include.replace('*.', '.') : '';
    const files = walkDir(ctx.cwd, ext, 200);
    const matches: { file: string; line: number; content: string }[] = [];
    const flags = caseSensitive ? 'g' : 'gi';
    const re = new RegExp(pattern, flags);

    for (const file of files) {
      try {
        const content = readFileSync(file, 'utf-8');
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (re.test(lines[i])) {
            const trimmed = lines[i].trim();
            matches.push({
              file,
              line: i + 1,
              content: trimmed.length > GREP_LINE_MAX
                ? trimmed.slice(0, GREP_LINE_MAX) + '...'
                : trimmed,
            });
            if (matches.length >= MAX_GREP_MATCHES) break;
          }
        }
      } catch {}
      if (matches.length >= MAX_GREP_MATCHES) break;
    }

    const truncated = matches.length >= MAX_GREP_MATCHES;
    return JSON.stringify({
      results: matches,
      count: matches.length,
      ...(truncated ? { note: `Found at least ${MAX_GREP_MATCHES} matches (showing first ${MAX_GREP_MATCHES})` } : {}),
    });
  } catch (err: any) {
    return JSON.stringify({ results: [], error: err.message });
  }
};

export const WebSearchTool: ToolHandler = async (args) => {
  const query = args.query as string;
  if (!query) return JSON.stringify({ error: 'No query provided' });
  return JSON.stringify({ note: 'Web search results (simulated):', query });
};

export const WebFetchTool: ToolHandler = async (args) => {
  const url = args.url as string;
  if (!url) return JSON.stringify({ error: 'No URL provided' });

  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(15000) });
    const text = await resp.text();
    return JSON.stringify({
      url,
      status: resp.status,
      content: text.slice(0, 10000),
      truncated: text.length > 10000,
    });
  } catch (err: any) {
    return JSON.stringify({ error: err.message });
  }
};

export const BuiltinTools: Record<string, { fn: ToolHandler; def: ToolFunction }> = {
  bash: {
    fn: ShellTool,
    def: buildToolDef(
      'bash',
      'Execute a shell command. Windows uses PowerShell (UTF-8), Linux/macOS uses /bin/bash. Use this to run code, install packages, etc.',
      {
        command: { type: 'string', description: 'The command to execute' },
        timeout: { type: 'number', description: 'Timeout in ms (default 30000)' },
      },
      ['command']
    ),
  },
  read: {
    fn: ReadTool,
    def: buildToolDef(
      'read',
      'Read the contents of a single file.',
      {
        file_path: { type: 'string', description: 'Path to the file (relative to cwd)' },
        offset: { type: 'number', description: 'Line offset to start reading from' },
        limit: { type: 'number', description: 'Max lines to read (default 2000)' },
      },
      ['file_path']
    ),
  },
  read_multiple: {
    fn: ReadMultipleTool,
    def: buildToolDef(
      'read_multiple',
      'Read multiple files at once. Use this when you need to examine several files simultaneously (e.g. related source files). Each file is read with the same offset/limit. Max 10 files per call.',
      {
        file_paths: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of file paths to read (relative to cwd), or comma-separated string',
        },
        offset: { type: 'number', description: 'Line offset to start reading from (applied to all files)' },
        limit: { type: 'number', description: 'Max lines to read per file (default 2000)' },
      },
      ['file_paths']
    ),
  },
  write: {
    fn: WriteTool,
    def: buildToolDef(
      'write',
      'Write content to a file (overwrites existing).',
      {
        file_path: { type: 'string', description: 'Path to the file' },
        content: { type: 'string', description: 'Content to write' },
      },
      ['file_path', 'content']
    ),
  },
  edit: {
    fn: EditTool,
    def: buildToolDef(
      'edit',
      'Edit a file by finding and replacing text.',
      {
        file_path: { type: 'string', description: 'Path to the file' },
        old_string: { type: 'string', description: 'Text to find' },
        new_string: { type: 'string', description: 'Text to replace with' },
      },
      ['file_path', 'old_string', 'new_string']
    ),
  },
  glob: {
    fn: GlobTool,
    def: buildToolDef(
      'glob',
      'Search for files matching a glob pattern.',
      {
        pattern: { type: 'string', description: 'Glob pattern (e.g. **/*.ts)' },
      },
      ['pattern']
    ),
  },
  grep: {
    fn: GrepTool,
    def: buildToolDef(
      'grep',
      'Search file contents for a regex pattern.',
      {
        pattern: { type: 'string', description: 'Regex pattern to search' },
        include: { type: 'string', description: 'File pattern filter (e.g. *.ts)' },
      },
      ['pattern']
    ),
  },
  web_search: {
    fn: WebSearchTool,
    def: buildToolDef(
      'web_search',
      'Search the web for information (simulated).',
      {
        query: { type: 'string', description: 'Search query' },
      },
      ['query']
    ),
  },
  web_fetch: {
    fn: WebFetchTool,
    def: buildToolDef(
      'web_fetch',
      'Fetch content from a URL.',
      {
        url: { type: 'string', description: 'The URL to fetch' },
      },
      ['url']
    ),
  },
};
