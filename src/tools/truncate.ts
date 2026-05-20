import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';

export const MAX_TOOL_LINES = 2000;
export const MAX_TOOL_BYTES = 50 * 1024;

let truncDir: string | null = null;

function getTruncDir(): string {
  if (!truncDir) {
    truncDir = join(tmpdir(), 'windallay-tool-output');
    mkdirSync(truncDir, { recursive: true });
  }
  return truncDir;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export interface TruncationResult {
  content: string;
  truncated: boolean;
  originalBytes: number;
  outputPath?: string;
}

export function truncateOutput(
  output: string,
  maxLines = MAX_TOOL_LINES,
  maxBytes = MAX_TOOL_BYTES,
): TruncationResult {
  const lines = output.split('\n');
  const bytes = Buffer.byteLength(output, 'utf-8');

  if (lines.length <= maxLines && bytes <= maxBytes) {
    return { content: output, truncated: false, originalBytes: bytes };
  }

  const dir = getTruncDir();
  const hash = createHash('md5').update(output).digest('hex').slice(0, 12);
  const fileName = `tool-output-${hash}-${Date.now()}.txt`;
  const outputPath = join(dir, fileName);
  writeFileSync(outputPath, output, 'utf-8');

  const tailLines = lines.slice(-maxLines);
  let preview = tailLines.join('\n');
  if (Buffer.byteLength(preview, 'utf-8') > maxBytes) {
    preview = preview.slice(0, maxBytes) + '\n...(output truncated)';
  }

  const summary = [
    `[Tool output truncated: ${formatBytes(bytes)} total, showing last ${maxLines} lines / ${formatBytes(maxBytes)}]`,
    `Full output saved to: ${outputPath}`,
    `Use 'read' tool with file_path="${outputPath}" to view the complete output.`,
    '---',
    preview,
  ].join('\n');

  return { content: summary, truncated: true, originalBytes: bytes, outputPath };
}

export function truncateToolContent(
  content: string,
  maxChars: number,
): string {
  if (content.length <= maxChars) return content;
  const omitted = content.length - maxChars;
  return `${content.slice(0, maxChars)}\n[Tool output truncated for compaction: omitted ${omitted} chars]`;
}
