import { Message, StreamChunk } from '../providers/types.js';
import { countTotalTokens } from './tokenizer.js';
import { estimateTokens } from '../utils/helpers.js';

export const TAIL_TURNS = 2;
export const COMPACTION_BUFFER = 20000;
export const MAX_PRESERVE_RECENT_TOKENS = 8000;
export const MIN_PRESERVE_RECENT_TOKENS = 2000;

function countMessageTokens(msg: Message): number {
  let total = 4;
  if (typeof msg.content === 'string') {
    total += estimateTokens(msg.content);
  }
  if (msg.role) total += 1;
  if ('name' in msg && msg.name) total += 1;
  if ('tool_calls' in msg && msg.tool_calls) {
    for (const tc of (msg as any).tool_calls) {
      total += estimateTokens(tc.function.name + tc.function.arguments);
    }
  }
  return total;
}

interface TurnGroup {
  startIdx: number;
  tokens: number;
  messages: Message[];
}

function groupTurns(messages: Message[]): TurnGroup[] {
  const groups: TurnGroup[] = [];
  let current: TurnGroup | null = null;

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.role === 'user') {
      if (current) groups.push(current);
      current = { startIdx: i, tokens: 0, messages: [] };
    }
    if (current) {
      current.messages.push(msg);
      current.tokens += countMessageTokens(msg);
    }
  }
  if (current) groups.push(current);
  return groups;
}

export interface CompactionPlan {
  shouldCompact: boolean;
  tailMessages: Message[];
  compactableMessages: Message[];
  totalTokens: number;
  usableTokens: number;
}

export function shouldCompact(
  messages: Message[],
  contextLimit: number,
): CompactionPlan {
  const totalTokens = countTotalTokens(messages);
  const usableTokens = contextLimit - COMPACTION_BUFFER;
  const shouldCompact = totalTokens >= usableTokens;

  const groups = groupTurns(messages);
  const tailGroups = groups.slice(-TAIL_TURNS);
  const compactableGroups = groups.slice(0, -TAIL_TURNS);
  const tailTokens = tailGroups.reduce((s, g) => s + g.tokens, 0);
  const preserveBudget = Math.min(
    MAX_PRESERVE_RECENT_TOKENS,
    Math.max(MIN_PRESERVE_RECENT_TOKENS, Math.floor(usableTokens * 0.25)),
  );
  const needMoreTurns = tailTokens < preserveBudget;
  let actualTailGroups = tailGroups;
  if (needMoreTurns) {
    for (let i = compactableGroups.length - 1; i >= 0; i--) {
      const g = compactableGroups[i];
      if (tailTokens + g.tokens > preserveBudget) break;
      actualTailGroups = [g, ...actualTailGroups];
    }
  }
  const actualCompactable: TurnGroup[] = [];
  const compactableSet = new Set(actualTailGroups);
  for (const g of compactableGroups) {
    if (!compactableSet.has(g)) actualCompactable.push(g);
  }

  const tailMessages = actualTailGroups.flatMap((g) => (g as TurnGroup).messages);
  const compactableMessages = actualCompactable.flatMap((g) => (g as TurnGroup).messages);

  return {
    shouldCompact,
    tailMessages,
    compactableMessages,
    totalTokens,
    usableTokens,
  };
}

const SUMMARY_TEMPLATE = `Summarize the conversation so far. Focus on:
- Goal: What is the user trying to accomplish?
- Progress: What has been done? What is working?
- Key Decisions: Architecture choices, design patterns, configuration changes.
- Next Steps: What remains to be done?
- Critical Context: Important details the assistant must remember.

Keep the summary concise and factual (under 1000 tokens).`;

export async function compactMessages(
  messages: Message[],
  contextLimit: number,
  provider: { chat(req: { messages: Message[]; maxTokens?: number }): AsyncGenerator<StreamChunk> },
): Promise<{ messages: Message[]; summary: string | null }> {
  const plan = shouldCompact(messages, contextLimit);
  if (!plan.shouldCompact || plan.compactableMessages.length === 0) {
    return { messages, summary: null };
  }

  const compactableContent = plan.compactableMessages
    .map((m) => {
      const role = m.role;
      const content = typeof m.content === 'string'
        ? m.content.slice(0, 2000)
        : '[complex content]';
      if (role === 'tool') return `[Tool result: ${content.slice(0, 500)}]`;
      if ('tool_calls' in m && m.tool_calls) return `[Assistant: tool call - ${(m as any).tool_calls.map((tc: any) => tc.function.name).join(', ')}]`;
      return `[${role}]: ${content}`;
    })
    .join('\n\n');

  const summaryPrompt: Message[] = [
    { role: 'system', content: SUMMARY_TEMPLATE },
    { role: 'user', content: `Here is the conversation history to summarize:\n\n${compactableContent}` },
  ];

  let summary = '';
  try {
    const stream = provider.chat({ messages: summaryPrompt, maxTokens: 2000 });
    for await (const chunk of stream) {
      if (chunk.type === 'content') {
        summary += chunk.delta;
      }
    }
  } catch {
    summary = '[Compaction failed: unable to summarize]';
  }

  if (!summary) summary = '[Compaction produced empty summary]';

  const summaryMsg: Message = {
    role: 'system',
    content: `--- Compressed Context ---\nPrevious conversation summary:\n${summary}\n--- End Compressed Context ---`,
  };

  const result = [summaryMsg, ...plan.tailMessages];

  return { messages: result, summary };
}

export function pruneToolOutputs(
  messages: Message[],
  turnsToKeep = 3,
): Message[] {
  const groups = groupTurns(messages);
  const protectedGroups = groups.slice(-turnsToKeep);
  const protectedMessages = new Set<Message>();
  for (const g of (protectedGroups as TurnGroup[])) {
    for (const m of (g as TurnGroup).messages) {
      protectedMessages.add(m);
    }
  }

  return messages.map((msg) => {
    if (msg.role === 'tool' && !protectedMessages.has(msg)) {
      if (typeof msg.content === 'string' && msg.content.length > 200) {
        return { ...msg, content: '[Old tool result content cleared to save context]' };
      }
    }
    return msg;
  });
}
