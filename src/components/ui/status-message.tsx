import { Box, Text } from 'ink';
import type { ReactNode } from 'react';
import React from 'react';
import { useTheme } from './theme-provider.js';
import { Spinner } from './spinner.js';

export type StatusVariant = 'success' | 'error' | 'warning' | 'info' | 'loading' | 'pending';

const ICONS: Record<string, string> = { error: '✗', info: 'ℹ', pending: '○', success: '✓', warning: '⚠' };

export interface StatusMessageProps {
  variant?: StatusVariant;
  children: ReactNode;
  icon?: string;
}

export const StatusMessage = ({ variant = 'info', children, icon }: StatusMessageProps) => {
  const theme = useTheme();

  const variantColor = (() => {
    switch (variant) {
      case 'success': return theme.colors.success;
      case 'error': return theme.colors.error;
      case 'warning': return theme.colors.warning;
      case 'loading': return theme.colors.primary;
      case 'pending': return theme.colors.muted;
      default: return theme.colors.info;
    }
  })();

  return React.createElement(Box, { gap: 1, flexDirection: 'row' },
    variant === 'loading'
      ? React.createElement(Spinner, { type: 'dots', color: variantColor })
      : React.createElement(Text, { color: variantColor }, icon ?? ICONS[variant] ?? '•'),
    React.createElement(Text, null, children)
  );
};
