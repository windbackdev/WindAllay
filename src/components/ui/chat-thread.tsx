import { Box } from 'ink';
import type { ReactNode } from 'react';
import React from 'react';

export interface ChatThreadProps {
  maxHeight?: number;
  autoScroll?: boolean;
  children?: ReactNode;
}

export const ChatThread = ({ maxHeight, autoScroll = true, children }: ChatThreadProps) => {
  void autoScroll;
  const containerProps = maxHeight ? { height: maxHeight } : {};
  return React.createElement(Box, { flexDirection: 'column', ...containerProps }, children);
};
