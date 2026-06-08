import React from 'react';
import { Text, Box } from 'ink';
import { useTerminalSize } from './responsive.js';
import { Card as TermCard } from './ui/card.js';

type CardColor = 'cyan' | 'green' | 'yellow' | 'magenta' | 'red' | 'blue' | 'white' | 'gray';

const COLOR_MAP: Record<string, string> = {
  cyan: '#0ea5e9', green: '#22c55e', yellow: '#eab308',
  magenta: '#a855f7', red: '#ef4444', blue: '#3b82f6',
  white: '#e2e8f0', gray: '#64748b',
};

interface CardProps {
  children: React.ReactNode;
  borderColor?: CardColor;
  selected?: boolean;
  width?: number;
  height?: number;
  padding?: number;
  marginBottom?: number;
  fillWidth?: boolean;
  borderStyle?: 'round' | 'single' | 'bold' | 'double';
}

export function Card({ children, borderColor = 'cyan', selected, width, padding = 1, marginBottom = 1, fillWidth }: CardProps) {
  const { columns } = useTerminalSize();
  const cardWidth = fillWidth ? undefined : (width ?? Math.min(columns - 4, 60));
  const bc = selected ? COLOR_MAP[borderColor] : COLOR_MAP.gray;

  return (
    <Box marginBottom={marginBottom} width={cardWidth}>
      <TermCard borderColor={bc} borderStyle="round" paddingX={padding} paddingY={padding}>
        {children}
      </TermCard>
    </Box>
  );
}

export function CardHeader({ icon, title, subtitle, titleColor = 'white', rightContent }: {
  icon?: string; title: string; subtitle?: string; titleColor?: CardColor; rightContent?: React.ReactNode;
}) {
  return (
    <Box marginBottom={subtitle ? 0 : 0}>
      <Box flexGrow={1}>
        <Text bold color={COLOR_MAP[titleColor]}>
          {icon ? `${icon} ` : ''}{title}
        </Text>
        {subtitle && <Text dimColor> — {subtitle}</Text>}
      </Box>
      {rightContent && <Box>{rightContent}</Box>}
    </Box>
  );
}

export function CardBody({ children, padding = true }: { children: React.ReactNode; padding?: boolean }) {
  return <Box marginLeft={padding ? 1 : 0} flexDirection="column">{children}</Box>;
}

export function CardFooter({ children }: { children: React.ReactNode }) {
  return <Box marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>{children}</Box>;
}

export function CardDivider({ width }: { width?: number }) {
  const { columns } = useTerminalSize();
  const len = Math.min((width ?? columns) - 4, 60);
  return (
    <Box marginY={1}>
      <Text dimColor>{'─'.repeat(Math.max(10, len))}</Text>
    </Box>
  );
}

export function MenuCard({ icon, label, description, selected, badge, badgeColor = 'green' }: {
  icon: string; label: string; description: string; selected: boolean;
  badge?: string; badgeColor?: CardColor; onClick?: () => void;
}) {
  const { isNarrow } = useTerminalSize();
  return (
    <Card borderColor={selected ? 'cyan' : 'gray'} padding={1} marginBottom={0}>
      <Box>
        <Box flexGrow={1}>
          <Box marginRight={1}>
            <Text color={selected ? 'cyan' : 'gray'}>{icon}</Text>
          </Box>
          <Box flexDirection="column" flexGrow={1}>
            <Text bold color={selected ? 'white' : 'gray'}>
              {selected ? '❯ ' : '  '}{label}
            </Text>
            {!isNarrow && description && (
              <Text dimColor>{'   '}{description}</Text>
            )}
          </Box>
        </Box>
        {badge && <Box><Text color={COLOR_MAP[badgeColor]}>{badge}</Text></Box>}
      </Box>
    </Card>
  );
}

export function InfoCard({ title, children, borderColor = 'cyan' }: {
  title: string; children: React.ReactNode; borderColor?: CardColor;
}) {
  return (
    <Card borderColor={borderColor} padding={1}>
      <CardHeader title={title} titleColor={borderColor} />
      <CardBody>{children}</CardBody>
    </Card>
  );
}

/** @deprecated Use ChatMessage from termcn instead */
export function MessageCard({ role, content, timestamp, toolCalls, toolCallId, children }: {
  role: 'user' | 'assistant' | 'system' | 'tool'; content: string; timestamp?: string;
  toolCalls?: Array<{ name: string; args: string }>; toolCallId?: string; children?: React.ReactNode;
}) {
  void toolCallId;
  const cfg = {
    user: { color: 'cyan' as CardColor, icon: '▶', label: 'You' },
    assistant: { color: 'green' as CardColor, icon: '●', label: 'WindAllay' },
    system: { color: 'yellow' as CardColor, icon: '◆', label: 'System' },
    tool: { color: 'magenta' as CardColor, icon: '⚙', label: 'Tool' },
  }[role] || { color: 'yellow' as CardColor, icon: '◆', label: 'System' };

  return (
    <Card borderColor={cfg.color} padding={1} fillWidth marginBottom={0}>
      <Box flexDirection="column">
        <Box marginBottom={content ? 1 : 0}>
          <Text>
            <Text color={cfg.color}>{cfg.icon} </Text>
            <Text bold color={cfg.color}>{cfg.label}</Text>
            {timestamp && <Text dimColor> {timestamp}</Text>}
          </Text>
        </Box>
        {content && (
          <Box marginLeft={1}><Text wrap="wrap">{content}</Text></Box>
        )}
        {children && <Box marginLeft={1} marginTop={1}>{children}</Box>}
        {toolCalls && toolCalls.length > 0 && (
          <Box marginLeft={1} marginTop={1} flexDirection="column">
            {toolCalls.map((tc, i) => (
              <Box key={i}>
                <Text>
                  <Text color="yellow">└ </Text>
                  <Text color="yellow">call: </Text>
                  <Text bold>{tc.name}</Text>
                  <Text dimColor>({tc.args.slice(0, 40)}...)</Text>
                </Text>
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Card>
  );
}
