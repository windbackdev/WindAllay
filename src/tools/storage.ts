import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';

export const DEFAULT_MAX_RESULT_SIZE_CHARS = 50_000;
export const MAX_TOOL_RESULTS_PER_MESSAGE_CHARS = 200_000;
export const PREVIEW_SIZE = 2000;

let storageDir: string | null = null;

function getStorageDir(): string {
  if (!storageDir) {
    storageDir = join(tmpdir(), 'windallay-tool-results');
    mkdirSync(storageDir, { recursive: true });
  }
  return storageDir;
}

export interface PersistedToolResult {
  path: string;
  preview: string;
  originalSize: number;
}

export function persistToolResult(
  content: string,
  toolName: string,
  toolCallId: string,
): PersistedToolResult {
  const dir = getStorageDir();
  const hash = createHash('md5').update(content).digest('hex').slice(0, 12);
  const fileName = `${toolName}-${toolCallId}-${hash}.txt`;
  const filePath = join(dir, fileName);

  if (!existsSync(filePath)) {
    writeFileSync(filePath, content, 'utf-8');
  }

  const preview = content.length > PREVIEW_SIZE
    ? content.slice(0, PREVIEW_SIZE) + '\n... (preview truncated)'
    : content;

  return {
    path: filePath,
    preview,
    originalSize: content.length,
  };
}

export function buildPersistedResultMessage(
  result: PersistedToolResult,
  toolName: string,
): string {
  return [
    `<persisted-output>`,
    `Tool "${toolName}" output (${formatSize(result.originalSize)}) was large and has been saved to disk.`,
    `Use 'read' tool with file_path="${result.path}" to view the complete output.`,
    ``,
    `Preview (first ${PREVIEW_SIZE} chars):`,
    result.preview,
    `</persisted-output>`,
  ].join('\n');
}

export interface ToolResultBudget {
  totalChars: number;
  exceedsBudget: boolean;
  persisted: PersistedToolResult[];
}

export function enforceToolResultBudget(
  results: { toolCallId: string; toolName: string; content: string }[],
): ToolResultBudget {
  let totalChars = 0;
  for (const r of results) {
    totalChars += r.content.length;
  }

  if (totalChars <= MAX_TOOL_RESULTS_PER_MESSAGE_CHARS) {
    return { totalChars, exceedsBudget: false, persisted: [] };
  }

  const persisted: PersistedToolResult[] = [];
  const sorted = [...results].sort((a, b) => b.content.length - a.content.length);

  for (const r of sorted) {
    if (totalChars <= MAX_TOOL_RESULTS_PER_MESSAGE_CHARS) break;
    if (r.content.length > DEFAULT_MAX_RESULT_SIZE_CHARS) {
      const p = persistToolResult(r.content, r.toolName, r.toolCallId);
      persisted.push(p);
      totalChars -= r.content.length;
    }
  }

  return { totalChars, exceedsBudget: totalChars > MAX_TOOL_RESULTS_PER_MESSAGE_CHARS, persisted };
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
