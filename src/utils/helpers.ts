export function formatTokens(n: number): string {
  if (n < 1000) return `${n}`;
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

export function formatContextUsage(used: number, limit: number): string {
  const pct = ((used / limit) * 100).toFixed(1);
  return `${formatTokens(used)} / ${formatTokens(limit)} (${pct}%)`;
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
