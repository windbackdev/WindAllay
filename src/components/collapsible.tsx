import React from 'react';
import { Text, Box } from 'ink';
import { t } from '../utils/i18n.js';

interface Props {
  children?: React.ReactNode;
  maxLines?: number;
  label?: string;
  text?: string;
}

export function CollapsibleBox({ children, maxLines = 15, text, label }: Props) {

  if (text) {
    const lines = text.split('\n');
    const totalLines = lines.length;

    if (totalLines <= maxLines) {
      return <Text wrap="wrap">{text}</Text>;
    }

    const visible = lines.slice(0, maxLines).join('\n');
    const hidden = totalLines - maxLines;

    return (
      <Box flexDirection="column">
        <Text wrap="wrap">{visible}</Text>
        <Box>
          <Text dimColor>
            {`[... ${hidden} more line${hidden > 1 ? 's' : ''}]`}
          </Text>
        </Box>
      </Box>
    );
  }

  return <>{children}</>;
}
