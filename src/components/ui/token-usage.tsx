import { Box, Text } from 'ink';
import React from 'react';
import { useTheme } from './theme-provider.js';

const formatTokens = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
};

export interface TokenUsageProps {
  prompt: number;
  completion: number;
  model?: string;
}

export const TokenUsage = ({ prompt, completion, model }: TokenUsageProps) => {
  const theme = useTheme();
  return React.createElement(Box, { gap: 0 },
    React.createElement(Text, { dimColor: true, color: theme.colors.mutedForeground }, '⟨ '),
    React.createElement(Text, { color: theme.colors.primary }, formatTokens(prompt)),
    React.createElement(Text, { dimColor: true, color: theme.colors.mutedForeground }, ' in / '),
    React.createElement(Text, { color: theme.colors.secondary ?? theme.colors.accent }, formatTokens(completion)),
    React.createElement(Text, { dimColor: true, color: theme.colors.mutedForeground }, ' out'),
    model ? React.createElement(Text, { dimColor: true, color: theme.colors.mutedForeground }, ` · ${model}`) : null,
    React.createElement(Text, { dimColor: true, color: theme.colors.mutedForeground }, ' ⟩'),
  );
};

export interface ContextMeterProps {
  used: number;
  limit: number;
  label?: string;
  showPercent?: boolean;
  warnAt?: number;
  criticalAt?: number;
  width?: number;
}

export const ContextMeter = ({
  used, limit, label, showPercent = true,
  warnAt = 75, criticalAt = 90, width = 20,
}: ContextMeterProps) => {
  const theme = useTheme();
  const percent = Math.min(100, Math.round((used / limit) * 100));
  const filled = Math.round((percent / 100) * width);
  const empty = width - filled;

  let barColor: string;
  if (percent >= criticalAt) barColor = theme.colors.error;
  else if (percent >= warnAt) barColor = theme.colors.warning;
  else barColor = theme.colors.success;

  const bar = '█'.repeat(filled) + '░'.repeat(empty);

  return React.createElement(Box, { gap: 1 },
    label ? React.createElement(Text, { dimColor: true, color: theme.colors.mutedForeground }, label) : null,
    React.createElement(Text, { color: barColor }, bar),
    showPercent ? React.createElement(Text, { color: barColor }, `${percent}%`) : null,
    React.createElement(Text, { dimColor: true, color: theme.colors.mutedForeground }, `${formatTokens(used)}/${formatTokens(limit)}`),
  );
};
