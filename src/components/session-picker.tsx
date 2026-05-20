import React, { useState } from 'react';
import { Text, Box } from 'ink';
import { useInput } from 'ink';
import { Card } from './card.js';

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
  // Add "New Session" as the first item
  const items = [
    { id: '__new__', title: '+ 新建对话', model: '', startedAt: '', messageCount: 0 },
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

    if (key.upArrow) {
      setSelectedIndex((i) => Math.max(0, i - 1));
    } else if (key.downArrow) {
      setSelectedIndex((i) => Math.min(items.length - 1, i + 1));
    } else if (key.return) {
      const item = items[selectedIndex];
      if (item) onSelect(item.id);
    } else if (input === 'd' || input === 'D') {
      const item = items[selectedIndex];
      if (item && item.id !== '__new__' && item.id !== currentSessionId) {
        setConfirmDelete(item.id);
      }
    } else if (key.escape || input === 'q') {
      onClose();
    }
  });

  const formatTime = (iso: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
    return `${Math.floor(diff / 86400000)} 天前`;
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Card borderColor="cyan" padding={0} marginBottom={1} fillWidth>
        <Text bold color="cyan"> 📋 对话历史 ({sessions.length} 个会话)</Text>
      </Card>

      {confirmDelete && (
        <Box marginBottom={1}>
          <Text color="red">确认删除此会话？(y/n)</Text>
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

          const title = item.title || `会话 ${item.id.slice(-6)}`;
          const timeStr = formatTime(item.startedAt);

          return (
            <Box key={item.id} borderStyle="round" borderColor={borderColor} paddingX={1} marginBottom={0}>
              <Box flexDirection="column" flexGrow={1}>
                <Text color={isSelected ? 'white' : 'gray'} bold={isSelected}>
                  {isSelected ? '❯ ' : '  '}
                  {title}
                  {isCurrent && <Text color="green"> (当前)</Text>}
                </Text>
                <Text dimColor>
                  {'    '}{item.model} · {item.messageCount} 条消息 · {timeStr}
                </Text>
              </Box>
            </Box>
          );
        })}
      </Box>

      <Box>
        <Text dimColor>↑↓ 导航 · Enter 选择 · d 删除 · ESC/q 关闭</Text>
      </Box>
    </Box>
  );
}
