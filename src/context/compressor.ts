import { Message } from '../providers/types.js';
import { shouldCompress } from './monitor.js';

export interface CompressionResult {
  messages: Message[];
  compressed: boolean;
  originalCount: number;
  newCount: number;
  summary?: string;
}

function buildSummaryMessage(messages: Message[]): Message {
  const userMessages = messages
    .filter((m) => m.role === 'user')
    .slice(-5)
    .map((m) => (typeof m.content === 'string' ? m.content : '[complex content]'))
    .join('\n');

  const assistantMessages = messages
    .filter((m) => m.role === 'assistant')
    .slice(-5)
    .map((m) => (typeof m.content === 'string' ? m.content : '[tool call]'))
    .join('\n');

  const summary = [
    '--- Compressed Context ---',
    `Previous conversation compressed (${messages.length} messages).`,
    userMessages ? `\nKey user topics:\n${userMessages.slice(0, 500)}` : '',
    assistantMessages ? `\nKey responses:\n${assistantMessages.slice(0, 500)}` : '',
    '\n--- End Compressed Context ---',
  ]
    .filter(Boolean)
    .join('\n');

  return {
    role: 'system',
    content: summary,
  };
}

export function compressContext(messages: Message[]): CompressionResult {
  if (!shouldCompress(messages)) {
    return {
      messages,
      compressed: false,
      originalCount: messages.length,
      newCount: messages.length,
    };
  }

  const systemMessages = messages.filter((m) => m.role === 'system');
  const nonSystemMessages = messages.filter((m) => m.role !== 'system');

  const summary = buildSummaryMessage(nonSystemMessages);
  const recentMessages = nonSystemMessages.slice(-20);

  const compressed = [...systemMessages, summary, ...recentMessages];

  const originalCount = messages.length;
  const newCount = compressed.length;

  return {
    messages: compressed,
    compressed: true,
    originalCount,
    newCount,
    summary: summary.content?.toString(),
  };
}

export function createContextWindow(
  systemPrompt: string,
  skillInstructions: string,
  history: Message[],
  newMessages: Message[]
): Message[] {
  const systemContent = [systemPrompt, skillInstructions].filter(Boolean).join('\n\n');
  const systemMessage: Message = { role: 'system', content: systemContent };

  let messages: Message[] = [systemMessage, ...history, ...newMessages];

  if (shouldCompress(messages)) {
    const result = compressContext(messages);
    messages = result.messages;
  }

  return messages;
}
