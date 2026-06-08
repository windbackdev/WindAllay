import React, { useState } from 'react';
import { Text, Box } from 'ink';
import { useInput } from 'ink';
import { Card } from './card.js';
import { t } from '../utils/i18n.js';

interface SessionInfo {
  id: string;
  model: string;
  startedAt: string;
  messageCount: number;
  title?: string;
}

interface Props {
  sessions: SessionInfo[];
  currentSessionId?: string;
  onSelect: (sessionId: string) => void;
  onDelete?: (sessionId: string) => void;
  onClose: () => void;
}

export function SessionPicker({ sessions, currentSessionId, onSelect, onDelete, onClose }: Props) {
  const items = [
    { id: '__new__', title: t('session.newSession'), model: '', startedAt: '', messageCount: 0 },
    ...sessions.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()),
  ];

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useInput((input, key) => {
    if (confirmDelete) {
      if (input === 'y' || input === 'Y') {
        if (onDelete) onDelete(confirmDelete);
        setConfirmDelete(null);
      } else {
        setConfirmDelete(null);
      }
      return;
    }

    if (key.upArrow) setSelectedIndex((i) => Math.max(0, i - 1));
    else if (key.downArrow) setSelectedIndex((i) => Math.min(items.length - 1, i + 1));
    else if (key.return) { const item = items[selectedIndex]; if (item) onSelect(item.id); }
    else if (input === 'd' || input === 'D') {
      const item = items[selectedIndex];
      if (item && item.id !== '__new__' && item.id !== currentSessionId) setConfirmDelete(item.id);
    } else if (key.escape || input === 'q') onClose();
  });

  const formatTime = (iso: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return t('session.timeAgo.justNow');
    if (diff < 3600000) return t('session.timeAgo.minutesAgo', Math.floor(diff / 60000));
    if (diff < 86400000) return t('session.timeAgo.hoursAgo', Math.floor(diff / 3600000));
    return t('session.timeAgo.daysAgo', Math.floor(diff / 86400000));
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Card borderColor="cyan" padding={0} marginBottom={1} fillWidth>
        <Text bold color="cyan"> 📋 {t('session.title')} ({sessions.length})</Text>
      </Card>

      {confirmDelete && (
        <Box marginBottom={1}>
          <Text color="red">{t('session.confirmDelete')}</Text>
        </Box>
      )}

      <Box flexDirection="column" marginBottom={1}>
        {items.map((item, i) => {
          const isSelected = i === selectedIndex;
          const isCurrent = item.id === currentSessionId;
          const borderColor = isSelected ? 'cyan' : 'gray';

          if (item.id === '__new__') {
            return (
              <Box key={item.id} borderStyle="round" borderColor={borderColor} paddingX={1} marginBottom={0}>
                <Text color={isSelected ? 'green' : 'gray'} bold={isSelected}>
                  {isSelected ? '❯ ' : '  '}{item.title}
                </Text>
              </Box>
            );
          }

          const title = item.title || `${t('session.title')} ${item.id.slice(-6)}`;
          const timeStr = formatTime(item.startedAt);

          return (
            <Box key={item.id} borderStyle="round" borderColor={borderColor} paddingX={1} marginBottom={0}>
              <Box flexDirection="column" flexGrow={1}>
                <Text color={isSelected ? 'white' : 'gray'} bold={isSelected}>
                  {isSelected ? '❯ ' : '  '}
                  {title}
                  {isCurrent && <Text color="green"> ({t('session.current')})</Text>}
                </Text>
                <Text dimColor>
                  {'    '}{item.model} · {t('session.messagesCount', item.messageCount)} · {timeStr}
                </Text>
              </Box>
            </Box>
          );
        })}
      </Box>

      <Box>
        <Text dimColor>{t('session.hint')}</Text>
      </Box>
    </Box>
  );
}
