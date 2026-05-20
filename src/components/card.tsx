import React from 'react';
import { Text, Box } from 'ink';
import { useTerminalSize } from './responsive.js';

type CardColor = 'cyan' | 'green' | 'yellow' | 'magenta' | 'red' | 'blue' | 'white' | 'gray';

interface CardProps {
  children: React.ReactNode;
  borderColor?: CardColor;
  selected?: boolean;
  width?: number;
  height?: number;
  padding?: number;
  marginBottom?: number;
  fillWidth?: boolean;
}

export function Card({
  children,
  borderColor = 'cyan',
  selected,
  width,
  height,
  padding = 1,
  marginBottom = 1,
  fillWidth,
}: CardProps) {
  const { columns } = useTerminalSize();
  const cardWidth = fillWidth ? undefined : (width ?? Math.min(columns - 4, 60));

  return (
    <Box
      borderStyle="round"
      borderColor={selected ? borderColor : 'gray'}
      paddingX={padding}
      paddingY={padding}
      width={cardWidth}
      height={height}
      flexDirection="column"
      marginBottom={marginBottom}
    >
      {children}
    </Box>
  );
}

interface CardHeaderProps {
  icon?: string;
  title: string;
  subtitle?: string;
  titleColor?: CardColor;
  rightContent?: React.ReactNode;
}

export function CardHeader({ icon, title, subtitle, titleColor = 'white', rightContent }: CardHeaderProps) {
  return (
    <Box marginBottom={subtitle ? 0 : 0}>
      <Box flexGrow={1}>
        <Text bold color={titleColor}>
          {icon ? `${icon} ` : ''}{title}
        </Text>
        {subtitle && (
          <Text dimColor> — {subtitle}</Text>
        )}
      </Box>
      {rightContent && (
        <Box>{rightContent}</Box>
      )}
    </Box>
  );
}

interface CardBodyProps {
  children: React.ReactNode;
  padding?: boolean;
}

export function CardBody({ children, padding = true }: CardBodyProps) {
  return (
    <Box marginLeft={padding ? 1 : 0} flexDirection="column">
      {children}
    </Box>
  );
}

interface CardFooterProps {
  children: React.ReactNode;
}

export function CardFooter({ children }: CardFooterProps) {
  return (
    <Box marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>
      {children}
    </Box>
  );
}

// Divider line inside a card
export function CardDivider() {
  return (
    <Box marginY={1}>
      <Text dimColor>{'─'.repeat(40)}</Text>
    </Box>
  );
}

// A menu item card — used in main menu
interface MenuCardProps {
  icon: string;
  label: string;
  description: string;
  selected: boolean;
  badge?: string;
  badgeColor?: CardColor;
  onClick?: () => void;
}

export function MenuCard({ icon, label, description, selected, badge, badgeColor = 'green' }: MenuCardProps) {
  const { isNarrow } = useTerminalSize();

  return (
    <Card borderColor={selected ? 'cyan' : 'gray'} selected={selected} padding={1} marginBottom={0}>
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
        {badge && (
          <Box>
            <Text color={badgeColor}>{badge}</Text>
          </Box>
        )}
      </Box>
    </Card>
  );
}

// An info/status card
interface InfoCardProps {
  title: string;
  children: React.ReactNode;
  borderColor?: CardColor;
}

export function InfoCard({ title, children, borderColor = 'cyan' }: InfoCardProps) {
  return (
    <Card borderColor={borderColor} padding={1}>
      <CardHeader title={title} titleColor={borderColor} />
      <CardBody>
        {children}
      </CardBody>
    </Card>
  );
}

// A message card for chat
interface MessageCardProps {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp?: string;
  toolCalls?: Array<{ name: string; args: string }>;
  toolCallId?: string;
  children?: React.ReactNode;
}

const ROLE_CONFIG: Record<string, { color: CardColor; icon: string; label: string }> = {
  user: { color: 'cyan', icon: '▶', label: 'You' },
  assistant: { color: 'green', icon: '●', label: 'WindAllay' },
  system: { color: 'yellow', icon: '◆', label: 'System' },
  tool: { color: 'magenta', icon: '⚙', label: 'Tool' },
};

export function MessageCard({ role, content, timestamp, toolCalls, toolCallId, children }: MessageCardProps) {
  const cfg = ROLE_CONFIG[role] || ROLE_CONFIG.system;
  const { columns } = useTerminalSize();

  if (role === 'tool') {
    return (
      <Card borderColor={cfg.color} padding={1} width={columns - 2} marginBottom={0}>
        <Box flexDirection="column">
          {children || (
            <>
              <Box>
                <Text>
                  <Text color={cfg.color}>{cfg.icon} </Text>
                  <Text dimColor>{cfg.label}</Text>
                  {toolCallId && <Text dimColor> ({toolCallId.slice(-12)})</Text>}
                </Text>
              </Box>
              {content && (
                <Box marginLeft={1}>
                  <Text wrap="wrap">{content}</Text>
                </Box>
              )}
            </>
          )}
        </Box>
      </Card>
    );
  }

  return (
    <Card borderColor={cfg.color} padding={1} width={columns - 2} marginBottom={0}>
      <Box flexDirection="column">
        <Box marginBottom={content ? 1 : 0}>
          <Text>
            <Text color={cfg.color}>{cfg.icon} </Text>
            <Text bold color={cfg.color}>{cfg.label}</Text>
            {timestamp && <Text dimColor> {timestamp}</Text>}
          </Text>
        </Box>
        {content && (
          <Box marginLeft={1}>
            <Text wrap="wrap">{content}</Text>
          </Box>
        )}
        {children && (
          <Box marginLeft={1} marginTop={1}>
            {children}
          </Box>
        )}
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
