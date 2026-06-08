import { Box, Text } from 'ink';
import type { ReactNode } from 'react';
import React from 'react';
import { useTheme } from './theme-provider.js';

export type CardBorderStyle = 'single' | 'double' | 'round' | 'bold' | 'classic';

export interface CardProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  borderColor?: string;
  width?: number;
  borderStyle?: CardBorderStyle;
  paddingX?: number;
  paddingY?: number;
  footerDividerChar?: string;
}

export const Card = ({
  title, subtitle, children, footer,
  borderColor, width, borderStyle = 'round',
  paddingX = 1, paddingY = 0, footerDividerChar = '─',
}: CardProps) => {
  const theme = useTheme();
  const resolvedBorderColor = borderColor ?? theme.colors.border;

  return React.createElement(Box, {
    flexDirection: 'column',
    borderStyle,
    borderColor: resolvedBorderColor,
    paddingX,
    paddingY,
    width,
  },
    (title || subtitle) && React.createElement(Box, { marginBottom: 1 },
      title ? React.createElement(Text, { bold: true }, title) : null,
      subtitle ? React.createElement(Text, { dimColor: true }, ` — ${subtitle}`) : null,
    ),
    children,
    footer && React.createElement(Box, { marginTop: 1, flexDirection: 'column' },
      React.createElement(Text, { dimColor: true, color: theme.colors.mutedForeground },
        footerDividerChar.repeat(30)
      ),
      footer,
    ),
  );
};
