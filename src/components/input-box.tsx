import React, { useState, useRef, useCallback } from 'react';
import { Text, Box } from 'ink';
import { useInput } from 'ink';

const MAX_HISTORY = 100;

interface Props {
  onSubmit: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  focus?: boolean;
}

export function InputBox({ onSubmit, disabled, placeholder, focus = true }: Props) {
  const [value, setValue] = useState('');
  const [historyIndex, setHistoryIndex] = useState(-1);
  const stagedRef = useRef('');
  const historyRef = useRef<string[]>([]);
  const idxRef = useRef(-1);

  const commitHistory = useCallback((text: string) => {
    if (!text.trim()) return;
    const h = historyRef.current;
    if (h[0] === text.trim()) return;
    h.unshift(text.trim());
    if (h.length > MAX_HISTORY) h.length = MAX_HISTORY;
  }, []);

  useInput((input, key) => {
    if (disabled || !focus) return;

    if (key.return) {
      if (value.trim()) {
        commitHistory(value.trim());
        setHistoryIndex(-1);
        idxRef.current = -1;
        stagedRef.current = '';
        const v = value.trim();
        setValue('');
        onSubmit(v);
      }
      return;
    }

    if (key.backspace || key.delete || input === '\x7f') {
      setValue((v) => v.slice(0, -1));
      return;
    }

    if (key.upArrow) {
      const h = historyRef.current;
      if (h.length === 0) return;
      if (idxRef.current === -1) {
        stagedRef.current = value;
      }
      const next = Math.min(idxRef.current + 1, h.length - 1);
      idxRef.current = next;
      setHistoryIndex(next);
      setValue(h[next]);
      return;
    }

    if (key.downArrow) {
      const h = historyRef.current;
      if (idxRef.current === -1) return;
      const prev = idxRef.current - 1;
      if (prev < 0) {
        idxRef.current = -1;
        setHistoryIndex(-1);
        setValue(stagedRef.current);
        stagedRef.current = '';
      } else {
        idxRef.current = prev;
        setHistoryIndex(prev);
        setValue(h[prev]);
      }
      return;
    }

    if (key.escape) {
      setValue('');
      setHistoryIndex(-1);
      idxRef.current = -1;
      stagedRef.current = '';
      return;
    }

    if (key.ctrl && input === 'u') {
      setValue('');
      return;
    }

    if (key.ctrl && input === 'w') {
      setValue((v) => v.replace(/\s*\S+\s*$/, ''));
      return;
    }

    if (input.length > 0 && !key.ctrl && !key.meta) {
      setValue((v) => {
        if (historyIndex !== -1) {
          idxRef.current = -1;
          setHistoryIndex(-1);
        }
        return v + input;
      });
    }
  }, { isActive: focus && !disabled });

  const isActive = focus && !disabled;
  const cursor = isActive ? '▎' : '';
  const displayValue = value + cursor;
  const promptColor = disabled ? 'gray' : 'cyan';
  const statusText = disabled ? '⏳ AI is thinking...' : (placeholder || 'Type a message...');

  return (
    <Box marginTop={0}>
      <Text bold color={promptColor}>❯ </Text>
      <Box flexGrow={1}>
        {displayValue ? (
          <Text wrap="wrap">{displayValue}</Text>
        ) : (
          <Text dimColor>{statusText}</Text>
        )}
      </Box>
    </Box>
  );
}
