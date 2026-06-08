import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Text, Box } from 'ink';
import { useInput } from 'ink';
import { t } from '../utils/i18n.js';

const MAX_HISTORY = 100;

interface Props {
  onSubmit: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  focus?: boolean;
}

export function InputBox({ onSubmit, disabled, placeholder, focus = true }: Props) {
  const [value, setValue] = useState('');
  const [cursorPos, setCursorPos] = useState(0);
  const cursorPosRef = useRef(0);
  useEffect(() => { cursorPosRef.current = cursorPos; }, [cursorPos]);
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
        setCursorPos(0);
        onSubmit(v);
      }
      return;
    }

    if (key.leftArrow) {
      setCursorPos((c) => Math.max(0, c - 1));
      return;
    }

    if (key.rightArrow) {
      setCursorPos((c) => Math.min(value.length, c + 1));
      return;
    }

    if (key.backspace || key.delete || input === '\x7f') {
      const pos = cursorPosRef.current;
      if (pos > 0) {
        setValue(value.slice(0, pos - 1) + value.slice(pos));
        setCursorPos(pos - 1);
      }
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
      setCursorPos(h[next].length);
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
        setCursorPos(stagedRef.current.length);
        stagedRef.current = '';
      } else {
        idxRef.current = prev;
        setHistoryIndex(prev);
        setValue(h[prev]);
        setCursorPos(h[prev].length);
      }
      return;
    }

    if (key.escape) {
      setValue('');
      setCursorPos(0);
      setHistoryIndex(-1);
      idxRef.current = -1;
      stagedRef.current = '';
      return;
    }

    if (key.ctrl && input === 'u') {
      setValue('');
      setCursorPos(0);
      return;
    }

    if (key.ctrl && input === 'w') {
      const pos = cursorPosRef.current;
      if (pos > 0) {
        const before = value.slice(0, pos);
        const after = value.slice(pos);
        const trimmed = before.replace(/\s*\S+\s*$/, '');
        setValue(trimmed + after);
        setCursorPos(trimmed.length);
      }
      return;
    }

    if (input.length > 0 && !key.ctrl && !key.meta) {
      const pos = cursorPosRef.current;
      if (historyIndex !== -1) {
        idxRef.current = -1;
        setHistoryIndex(-1);
      }
      setValue(value.slice(0, pos) + input + value.slice(pos));
      setCursorPos(pos + input.length);
    }
  }, { isActive: focus && !disabled });

  const isActive = focus && !disabled;
  const cursorChar = isActive ? '▎' : '';
  const displayValue = value.slice(0, cursorPos) + cursorChar + value.slice(cursorPos);
  const promptColor = disabled ? 'gray' : 'cyan';
  const statusText = disabled ? t('input.thinking') : (placeholder || t('input.placeholder'));

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
