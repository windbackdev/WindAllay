export class ToolExecutionError extends Error {
  constructor(
    message: string,
    public readonly exitCode?: number,
    public readonly stdout?: string,
    public readonly stderr?: string,
  ) {
    super(message);
    this.name = 'ToolExecutionError';
  }
}

const MAX_ERROR_CHARS = 10000;
const ERROR_TRUNC_PREVIEW = 5000;

export function formatToolError(err: unknown): string {
  if (err instanceof ToolExecutionError) {
    const parts: string[] = [];
    if (err.message) parts.push(`Error: ${err.message}`);
    if (err.exitCode !== undefined) parts.push(`Exit code: ${err.exitCode}`);
    if (err.stderr) parts.push(`Stderr: ${truncateErrorText(err.stderr)}`);
    if (err.stdout) parts.push(`Stdout: ${truncateErrorText(err.stdout)}`);
    return parts.join('\n');
  }

  if (err instanceof Error) {
    const msg = err.message || String(err);
    return `Error: ${truncateErrorText(msg)}`;
  }

  if (typeof err === 'string') {
    return `Error: ${truncateErrorText(err)}`;
  }

  return `Error: ${truncateErrorText(String(err))}`;
}

function truncateErrorText(text: string): string {
  if (text.length <= MAX_ERROR_CHARS) return text;
  const head = text.slice(0, ERROR_TRUNC_PREVIEW);
  const tail = text.slice(-ERROR_TRUNC_PREVIEW);
  const omitted = text.length - 2 * ERROR_TRUNC_PREVIEW;
  return `${head}\n[... ${omitted} chars truncated ...]\n${tail}`;
}
