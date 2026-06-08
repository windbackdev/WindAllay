import { countTotalTokens } from './tokenizer.js';
import { Message } from '../providers/types.js';
import { getConfig } from '../utils/config.js';
import { formatContextUsage } from '../utils/helpers.js';

export interface ContextStats {
  totalTokens: number;
  maxTokens: number;
  usagePercent: number;
  formatted: string;
  isNearLimit: boolean;
  isOverLimit: boolean;
}

export function getContextStats(messages: Message[]): ContextStats {
  const config = getConfig();
  const totalTokens = countTotalTokens(messages);
  const maxTokens = config.contextLimit;
  const usagePercent = totalTokens > 0 ? (totalTokens / maxTokens) * 100 : 0;
  const threshold = config.compactionThreshold;

  return {
    totalTokens,
    maxTokens,
    usagePercent,
    formatted: formatContextUsage(totalTokens, maxTokens),
    isNearLimit: threshold > 0 && usagePercent > threshold,
    isOverLimit: usagePercent >= 100,
  };
}

export function shouldCompress(messages: Message[]): boolean {
  const config = getConfig();
  if (config.compactionThreshold === 0) return false; // auto-compression disabled
  const stats = getContextStats(messages);
  return stats.isNearLimit || stats.isOverLimit;
}

export function getTokenBudget(messages: Message[]): number {
  const stats = getContextStats(messages);
  return Math.max(0, stats.maxTokens - stats.totalTokens);
}
