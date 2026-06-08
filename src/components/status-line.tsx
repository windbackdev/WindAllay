import React from 'react';
import { Box } from 'ink';
import { ContextStats } from '../context/monitor.js';
import { useTerminalSize } from './responsive.js';
import { StatusMessage } from './ui/status-message.js';
import { ContextMeter } from './ui/token-usage.js';

interface Props {
  model: string;
  contextStats?: ContextStats;
  status: 'idle' | 'thinking' | 'streaming' | 'error' | 'tool_call';
  messageCount: number;
  executingTool?: string | null;
}

const STATUS_MAP: Record<string, { variant: 'loading' | 'info' | 'success' | 'error' | 'pending'; label: string }> = {
  idle: { variant: 'success', label: 'Ready' },
  thinking: { variant: 'loading', label: 'Thinking' },
  streaming: { variant: 'info', label: 'Streaming' },
  error: { variant: 'error', label: 'Error' },
  tool_call: { variant: 'pending', label: 'Tool' },
};

export function StatusLine({ model, contextStats, status, messageCount, executingTool }: Props) {
  const { columns } = useTerminalSize();
  const cfg = STATUS_MAP[status] || { variant: 'info' as const, label: status };
  const label = executingTool ? `⚙ ${executingTool}` : cfg.label;
  const isNarrow = columns < 60;

  return (
    <Box flexDirection={isNarrow ? 'column' : 'row'} gap={1} width="100%">
      <Box>
        <StatusMessage variant={cfg.variant}>{label}</StatusMessage>
      </Box>
      {!isNarrow && (
        <>
          <Box>
            <StatusMessage variant="info" icon="●">{model.split('-')[0]}</StatusMessage>
          </Box>
          {contextStats && (
            <Box flexGrow={1}>
              <ContextMeter
                used={contextStats.totalTokens}
                limit={contextStats.maxTokens}
                width={15}
                showPercent={true}
                warnAt={75}
                criticalAt={90}
              />
            </Box>
          )}
          <Box>
            <StatusMessage variant="info" icon="💬">{String(messageCount)}</StatusMessage>
          </Box>
        </>
      )}
    </Box>
  );
}
