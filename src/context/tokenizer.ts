import { Message } from '../providers/types.js';

const TOKEN_PER_CHAR = 0.25;
const TOKEN_PER_MESSAGE_OVERHEAD = 4;
const TOKEN_PER_NAME = 1;
const TOKEN_PER_ROLE = 1;

export function countMessageTokens(msg: Message): number {
  let total = TOKEN_PER_MESSAGE_OVERHEAD;

  if (msg.role) total += TOKEN_PER_ROLE;
  if ('name' in msg && msg.name) total += TOKEN_PER_NAME;

  if (typeof msg.content === 'string') {
    total += Math.ceil(msg.content.length * TOKEN_PER_CHAR);
  } else if (Array.isArray(msg.content)) {
    for (const part of msg.content) {
      if (part.type === 'text') {
        total += Math.ceil(part.text.length * TOKEN_PER_CHAR);
      }
    }
  }

  if ('tool_calls' in msg && msg.tool_calls) {
    for (const tc of (msg as any).tool_calls) {
      total += Math.ceil((tc.function.name.length + tc.function.arguments.length) * TOKEN_PER_CHAR);
    }
  }

  if (msg.role === 'tool' && 'content' in msg && typeof msg.content === 'string') {
    total += Math.ceil(msg.content.length * TOKEN_PER_CHAR);
  }

  return total;
}

export function countTotalTokens(messages: Message[]): number {
  let total = 0;
  for (const msg of messages) {
    total += countMessageTokens(msg);
  }
  return total;
}
