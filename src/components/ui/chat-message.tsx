import { Box, Text } from 'ink';
import React, { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useTheme } from './theme-provider.js';

export type ChatRole = 'user' | 'assistant' | 'system' | 'error';

export interface ChatMessageProps {
  sender: ChatRole;
  name?: string;
  timestamp?: Date;
  streaming?: boolean;
  collapsed?: boolean;
  children?: ReactNode;
}

const formatTime = (date: Date): string =>
  date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const wrapPlainChildren = (node: ReactNode): ReactNode =>
  typeof node === 'string' || typeof node === 'number'
    ? React.createElement(Text, null, String(node))
    : node;

export const ChatMessage = ({
  sender, name, timestamp, streaming = false,
  collapsed: initialCollapsed = false, children,
}: ChatMessageProps) => {
  const theme = useTheme();
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed);
  const [dotFrame, setDotFrame] = useState(0);

  useEffect(() => {
    if (!streaming) return;
    const id = setInterval(() => setDotFrame((f) => (f + 1) % 4), 400);
    return () => clearInterval(id);
  }, [streaming]);

  const roleColor: Record<ChatRole, string> = {
    assistant: theme.colors.success,
    error: theme.colors.error,
    system: theme.colors.mutedForeground,
    user: theme.colors.primary,
  };

  const roleLabel: Record<ChatRole, string> = {
    assistant: 'assistant', error: 'error', system: 'system', user: 'user',
  };

  const color = roleColor[sender];
  const dots = ['', '●', '●●', '●●●'][dotFrame] ?? '';
  const childrenText = typeof children === 'string' ? children : '';
  const firstLine = childrenText.split('\n')[0] ?? '';

  const renderContent = () => {
    if (streaming) {
      return React.createElement(Box, null,
        children ? wrapPlainChildren(children)
          : React.createElement(Text, { color, dimColor: true }, dots)
      );
    }
    if (isCollapsed) {
      return React.createElement(Box, null,
        React.createElement(Text, { dimColor: true },
          firstLine.slice(0, 60) + (firstLine.length > 60 || childrenText.includes('\n') ? '...' : '')
        )
      );
    }
    return React.createElement(Box, null, wrapPlainChildren(children));
  };

  return React.createElement(Box, { flexDirection: 'column', marginBottom: 1 },
    React.createElement(Box, { gap: 1 },
      React.createElement(Text, { color, bold: true }, name ?? roleLabel[sender]),
      timestamp
        ? React.createElement(Text, { dimColor: true, color: theme.colors.mutedForeground }, formatTime(timestamp))
        : null,
      isCollapsed && !streaming
        ? React.createElement(Text, { dimColor: true, color: theme.colors.mutedForeground }, '[expand]')
        : null,
    ),
    renderContent()
  );
};
