import React from 'react';
import { Text, Box } from 'ink';

function applyInlineFormatting(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const regex = /(\*\*\*(.+?)\*\*\*)|(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`.+?`)|(\[([^\]]+)\]\(([^)]+)\))/g;
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) {
      nodes.push(text.slice(last, m.index));
    }
    if (m[1]) {
      nodes.push(<Text key={`b${m.index}`} bold italic>{m[2]}</Text>);
    } else if (m[3]) {
      nodes.push(<Text key={`b${m.index}`} bold>{m[4]}</Text>);
    } else if (m[5]) {
      nodes.push(<Text key={`i${m.index}`} italic>{m[6]}</Text>);
    } else if (m[7]) {
      nodes.push(<Text key={`c${m.index}`} color="yellow">{m[7].slice(1, -1)}</Text>);
    } else if (m[8]) {
      nodes.push(<Text key={`l${m.index}`} color="cyan">{m[8]} ({m[9]})</Text>);
    }
    last = m.index + m[0].length;
  }

  if (last < text.length) {
    nodes.push(text.slice(last));
  }

  return nodes.length > 0 ? nodes : [text];
}

function isListItem(line: string): string | null {
  const trimmed = line.trimStart();
  const prefix = trimmed.match(/^(\d+[.)]|[-*+])\s+/);
  return prefix ? prefix[1] : null;
}

function isHorizontalRule(line: string): boolean {
  return /^-{3,}\s*$/.test(line.trim());
}

function isHeading(line: string): boolean {
  return /^#{1,6}\s+/.test(line.trim());
}

function getHeadingLevel(line: string): number {
  const match = line.trim().match(/^(#{1,6})\s+/);
  return match ? match[1].length : 0;
}

function renderText(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  const result: React.ReactNode[] = [];
  const inCodeBlock = { current: false };
  const codeLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trimStart().startsWith('```')) {
      if (inCodeBlock.current) {
        result.push(
          <Box key={`cb${result.length}`} flexDirection="column">
            <Text color="gray">{codeLines.join('\n')}</Text>
          </Box>
        );
        codeLines.length = 0;
        inCodeBlock.current = false;
      } else {
        inCodeBlock.current = true;
      }
      continue;
    }

    if (inCodeBlock.current) {
      codeLines.push(line);
      continue;
    }

    // Blank line → paragraph break (empty box as spacer)
    if (line.trim() === '') {
      result.push(<Box key={`sp${result.length}`} height={1} />);
      continue;
    }

    // Horizontal rule
    if (isHorizontalRule(line)) {
      result.push(
        <Box key={`hr${result.length}`} flexDirection="column">
          <Text dimColor>{'─'.repeat(40)}</Text>
        </Box>
      );
      continue;
    }

    // Heading
    if (isHeading(line)) {
      const level = getHeadingLevel(line);
      const content = line.trim().replace(/^#+\s+/, '');
      const formatted = applyInlineFormatting(content);
      const isMajor = level <= 2;
      result.push(
        <Box key={`h${result.length}`} flexDirection="column" marginTop={isMajor && result.length > 0 ? 1 : 0}>
          <Text bold color={isMajor ? 'white' : 'cyan'}>{formatted}</Text>
        </Box>
      );
      continue;
    }

    // List item
    const listMarker = isListItem(line);
    if (listMarker) {
      const trimmed = line.trimStart();
      const content = trimmed.slice(listMarker.length).trimStart();
      const formatted = applyInlineFormatting(content);
      result.push(
        <Box key={`l${result.length}`} flexDirection="column">
          <Text wrap="wrap">
            {'  '}{listMarker} {formatted}
          </Text>
        </Box>
      );
      continue;
    }

    // Regular paragraph line
    const formatted = applyInlineFormatting(line);
    result.push(
      <Box key={`p${result.length}`} flexDirection="column">
        <Text wrap="wrap">{formatted}</Text>
      </Box>
    );
  }

  if (inCodeBlock.current && codeLines.length > 0) {
    result.push(
      <Box key={`cb${result.length}`} flexDirection="column">
        <Text color="gray">{codeLines.join('\n')}</Text>
      </Box>
    );
  }

  return result;
}

export function renderMarkdown(md: string): React.ReactNode {
  if (!md) return null;
  const nodes = renderText(md);
  if (nodes.length === 0) return md;

  // Wrap all lines in a column layout so each line renders on its own row
  return (
    <Box flexDirection="column" flexGrow={1}>
      {nodes}
    </Box>
  );
}
