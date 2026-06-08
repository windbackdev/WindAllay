import React from 'react';
import { Text, Box } from 'ink';
import { t } from '../utils/i18n.js';

interface Props {
  filePath: string;
  content: string;
  language?: string;
  error?: string;
}

const EXT_LANG: Record<string, string> = {
  ts: 'TypeScript', tsx: 'TSX', js: 'JavaScript', jsx: 'JSX',
  json: 'JSON', md: 'Markdown', css: 'CSS', html: 'HTML',
  py: 'Python', rs: 'Rust', go: 'Go', java: 'Java',
  rb: 'Ruby', php: 'PHP', yml: 'YAML', yaml: 'YAML',
  toml: 'TOML', sh: 'Shell', bash: 'Shell', ps1: 'PowerShell',
  c: 'C', cpp: 'C++', h: 'C Header', hpp: 'C++ Header',
  svelte: 'Svelte', vue: 'Vue', txt: 'Text',
};

function detectLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  return EXT_LANG[ext] ?? ext.toUpperCase();
}

export function FilePreview({ filePath, content, language, error }: Props) {
  const lang = language ?? detectLanguage(filePath);
  const lines = content.split('\n');
  const lineCount = lines.length;
  const lineNumWidth = String(lineCount).length;
  const maxPreviewLines = 25;

  const showTruncated = lineCount > maxPreviewLines;
  const displayLines = showTruncated ? lines.slice(0, maxPreviewLines) : lines;

  if (error) {
    return (
      <Box>
        <Text color="red">✗ </Text>
        <Text bold>{filePath}</Text>
        <Text dimColor> — {error}</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Box>
        <Text>
          <Text color="cyan">● </Text>
          <Text bold>{filePath}</Text>
          <Text dimColor>  {lang}</Text>
          <Text dimColor>  {t('file.lines', lineCount)}</Text>
        </Text>
      </Box>
      <Box flexDirection="column" marginLeft={1}>
        {displayLines.map((line, i) => {
          const lineNum = String(i + 1).padStart(lineNumWidth);
          return (
            <Box key={i}>
              <Text dimColor>{lineNum} │ </Text>
              <Text wrap="wrap">{line || ' '}</Text>
            </Box>
          );
        })}
        {showTruncated && (
          <Box>
            <Text dimColor>{' '.repeat(lineNumWidth)} │ </Text>
            <Text dimColor>{t('file.truncated', lineCount - maxPreviewLines)}</Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}
