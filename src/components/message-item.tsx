import React from 'react';
import { Text, Box } from 'ink';
import { MessageCard } from './card.js';
import { Message } from '../providers/types.js';
import { renderMarkdown } from '../utils/markdown.js';
import { CollapsibleBox } from './collapsible.js';
import { FilePreview } from './file-preview.js';

interface Props {
  message: Message;
  isLast?: boolean;
}

function parseToolResult(content: string): {
  kind: 'file' | 'terminal' | 'error' | 'raw';
  title: string;
  body: React.ReactNode;
} {
  let parsed: any;
  try { parsed = JSON.parse(content); } catch {
    return { kind: 'raw', title: 'Output', body: <Text>{content}</Text> };
  }

  if (parsed.error && parsed.stdout === undefined && parsed.file === undefined) {
    return { kind: 'error', title: 'Error', body: <Text color="red">{parsed.error}</Text> };
  }

  if (parsed.file !== undefined || (parsed.results && Array.isArray(parsed.results) && parsed.results[0]?.file !== undefined)) {
    const results = Array.isArray(parsed.results) ? parsed.results : [parsed];
    return {
      kind: 'file',
      title: `Read ${results.length} file${results.length > 1 ? 's' : ''}`,
      body: (
        <Box flexDirection="column">
          {results.map((r: any, i: number) => (
            r.error
              ? <Box key={i}><Text color="red">✗ {r.file}: {r.error}</Text></Box>
              : <Box key={i} marginBottom={i < results.length - 1 ? 1 : 0}>
                  <FilePreview filePath={r.file} content={r.content ?? ''} />
                </Box>
          ))}
        </Box>
      ),
    };
  }

  if (parsed.stdout !== undefined) {
    const stdout = (parsed.stdout as string).trim();
    const stderr = (parsed.stderr as string).trim();
    const exitCode = parsed.exitCode as number;
    const parts: string[] = [];
    if (stdout) parts.push(stdout);
    if (stderr) parts.push(stderr);
    const output = parts.join('\n');

    return {
      kind: 'terminal',
      title: exitCode === 0 ? 'Success' : `Exit code ${exitCode}`,
      body: (
        <Box flexDirection="column">
          <CollapsibleBox maxLines={15} text={output} label="expand" />
          {stderr && exitCode !== 0 && (
            <Text color="red">stderr: {stderr}</Text>
          )}
        </Box>
      ),
    };
  }

  if (parsed.content !== undefined && typeof parsed.content === 'string') {
    return {
      kind: 'raw',
      title: 'Content',
      body: <CollapsibleBox maxLines={15} text={parsed.content} label="expand" />,
    };
  }

  return {
    kind: 'raw',
    title: 'Result',
    body: <Text>{JSON.stringify(parsed, null, 2)}</Text>,
  };
}

export function MessageItem({ message }: Props) {
  const content = typeof message.content === 'string'
    ? message.content
    : message.content
      ? JSON.stringify(message.content)
      : '';

  const role = message.role as 'user' | 'assistant' | 'system' | 'tool';

  if (role === 'tool') {
    const result = parseToolResult(content);
    const kindColor = result.kind === 'error' ? 'red' : result.kind === 'file' ? 'cyan' : result.kind === 'terminal' ? 'green' : 'magenta';

    return (
      <MessageCard
        role="tool"
        content=""
        toolCallId={(message as any).tool_call_id}
      >
        <Box flexDirection="column">
          <Box>
            <Text>
              <Text color={kindColor}>{result.kind === 'error' ? '✗' : result.kind === 'file' ? '○' : result.kind === 'terminal' ? '$' : '⚙'} </Text>
              <Text bold>{result.title}</Text>
            </Text>
          </Box>
          <Box marginLeft={1} marginTop={0}>
            {result.body}
          </Box>
        </Box>
      </MessageCard>
    );
  }

  const rendered = role === 'assistant' && content && content.includes('\n')
    ? renderMarkdown(content)
    : null;

  if (role === 'assistant' && (message as any).tool_calls) {
    const toolCalls = (message as any).tool_calls.map((tc: any) => ({
      name: tc.function?.name || 'unknown',
      args: tc.function?.arguments || '',
    }));
    return (
      <MessageCard role="assistant" content={content} toolCalls={toolCalls} />
    );
  }

  if (rendered) {
    return (
      <MessageCard role={role} content={''}>
        {rendered}
      </MessageCard>
    );
  }

  return (
    <MessageCard role={role} content={content} />
  );
}
