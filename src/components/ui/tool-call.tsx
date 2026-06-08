import { Box, Text } from 'ink';
import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from './theme-provider.js';
import { useAnimation } from '../../hooks/use-animation.js';

export type ToolCallStatus = 'pending' | 'running' | 'success' | 'error';

export interface ToolCallProps {
  name: string;
  args?: Record<string, unknown>;
  status: ToolCallStatus;
  result?: unknown;
  duration?: number;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

export const ToolCall = ({
  name, args, status, result, duration,
  collapsible = true, defaultCollapsed = true,
}: ToolCallProps) => {
  const theme = useTheme();
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());
  const frame = useAnimation(12);
  const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  const spinnerIcon = spinnerFrames[frame % spinnerFrames.length] ?? '⠋';

  useEffect(() => {
    if (status !== 'running') return;
    startRef.current = Date.now();
    const id = setInterval(() => setElapsed(Date.now() - startRef.current), 100);
    return () => clearInterval(id);
  }, [status]);

  const statusIcon = () => {
    switch (status) {
      case 'pending': return React.createElement(Text, { dimColor: true }, '○');
      case 'running': return React.createElement(Text, { color: theme.colors.primary }, spinnerIcon);
      case 'success': return React.createElement(Text, { color: theme.colors.success }, '✓');
      case 'error': return React.createElement(Text, { color: theme.colors.error }, '✗');
    }
  };

  const durationText = duration !== undefined ? `${duration}ms` : (status === 'running' ? `${elapsed}ms` : null);

  let nameColor: string;
  if (status === 'error') nameColor = theme.colors.error;
  else if (status === 'success') nameColor = theme.colors.success;
  else if (status === 'running') nameColor = theme.colors.primary;
  else nameColor = theme.colors.mutedForeground;

  return React.createElement(Box, { flexDirection: 'column' },
    React.createElement(Box, { gap: 1 },
      statusIcon(),
      React.createElement(Text, { color: nameColor, bold: status !== 'pending' }, name),
      durationText ? React.createElement(Text, { dimColor: true, color: theme.colors.mutedForeground }, `(${durationText})`) : null,
      collapsible ? React.createElement(Text, { dimColor: true, color: theme.colors.mutedForeground }, collapsed ? '▶' : '▼') : null,
    ),
    !collapsed && React.createElement(Box, { flexDirection: 'column', paddingLeft: 2 },
      args && Object.keys(args).length > 0 && React.createElement(Box, { flexDirection: 'column' },
        React.createElement(Text, { dimColor: true, color: theme.colors.mutedForeground }, 'Args:'),
        ...Object.entries(args).map(([k, v]) =>
          React.createElement(Box, { key: k, gap: 1 },
            React.createElement(Text, { color: theme.colors.accent }, `${k}:`),
            React.createElement(Text, { dimColor: true }, JSON.stringify(v)),
          )
        ),
      ),
      result !== undefined && React.createElement(Box, { flexDirection: 'column' },
        React.createElement(Text, { dimColor: true, color: theme.colors.mutedForeground }, 'Result:'),
        React.createElement(Box, null,
          typeof result === 'string'
            ? React.createElement(Text, { dimColor: true }, result)
            : React.isValidElement(result)
              ? result
              : React.createElement(Text, { dimColor: true },
                  (() => { try { return JSON.stringify(result, null, 2); } catch { return String(result); } })()
                ),
        ),
      ),
    ),
  );
};
