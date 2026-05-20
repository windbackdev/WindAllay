import React from 'react';
import { Text, Box } from 'ink';
import { ContextStats } from '../context/monitor.js';
import { t } from '../utils/i18n.js';
import { useTerminalSize } from './responsive.js';

interface Props {
  model: string;
  contextStats?: ContextStats;
  status: 'idle' | 'thinking' | 'streaming' | 'error' | 'tool_call';
  messageCount: number;
  executingTool?: string | null;
}

const STATUS_KEYS: Record<string, string> = {
  idle: 'chat.ready',
  thinking: 'chat.thinking',
  streaming: 'chat.streaming',
  error: 'chat.error',
  tool_call: 'chat.toolCall',
};

const STATUS_COLORS: Record<string, string> = {
  idle: 'green',
  thinking: 'yellow',
  streaming: 'cyan',
  error: 'red',
  tool_call: 'magenta',
};

const SPINNER_FRAMES: Record<string, string[]> = {
  thinking: ['◐', '◓', '◑', '◒'],
  streaming: ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█', '▇', '▆', '▅', '▄', '▃', '▂', '▁'],
  tool_call: ['◴', '◷', '◶', '◵'],
};

export function StatusLine({ model, contextStats, status, messageCount, executingTool }: Props) {
  const { isNarrow } = useTerminalSize();
  const color = STATUS_COLORS[status] || 'white';
  let label = t(STATUS_KEYS[status] || status);
  if (executingTool) label = `⚙ ${executingTool}`;
  const frames = SPINNER_FRAMES[status];
  const spinner = frames ? frames[Math.floor(Date.now() / 150) % frames.length] : '';

  const items: { text: string; color: string }[] = [
    { text: `${spinner} ${label}`, color },
  ];

  if (!isNarrow) {
    items.push({ text: `| ${model}`, color: 'cyan' });
    items.push({ text: `| ${t('chat.msgs')}: ${messageCount}`, color: 'white' });
    if (contextStats) {
      items.push({
        text: `| ${t('chat.ctx')}: ${contextStats.formatted}`,
        color: contextStats.isNearLimit ? 'yellow' : 'gray',
      });
    }
  } else {
    items.push({ text: `| ${model.split('-')[0]}`, color: 'cyan' });
  }

  return (
    <Box>
      <Text>
        {items.map((item, i) => (
          <Text key={i} color={item.color}>
            {item.text}{' '}
          </Text>
        ))}
      </Text>
    </Box>
  );
}
