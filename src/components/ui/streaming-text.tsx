import { Text } from 'ink';
import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from './theme-provider.js';

export interface StreamingTextProps {
  text?: string;
  stream?: AsyncIterable<string>;
  cursor?: boolean;
  cursorColor?: string;
}

export const StreamingText = ({
  text: controlledText, stream, cursor = true, cursorColor,
}: StreamingTextProps) => {
  const theme = useTheme();
  const [internalText, setInternalText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [cursorVisible, setCursorVisible] = useState(true);

  useEffect(() => {
    if (!cursor) return;
    const id = setInterval(() => setCursorVisible((v) => !v), 530);
    return () => clearInterval(id);
  }, [cursor]);

  useEffect(() => {
    if (!stream) return;
    let cancelled = false;
    setInternalText('');
    setIsStreaming(true);
    (async () => {
      let full = '';
      try {
        for await (const chunk of stream) {
          if (cancelled) break;
          full += chunk;
          setInternalText(full);
        }
      } catch { /* noop */ }
      if (!cancelled) setIsStreaming(false);
    })();
    return () => { cancelled = true; };
  }, [stream]);

  let displayText: string;
  if (stream) displayText = internalText;
  else displayText = controlledText ?? '';

  const showCursor = cursor && isStreaming && cursorVisible;
  const resolvedCursorColor = cursorColor ?? theme.colors.primary;

  return React.createElement(Text, null,
    displayText,
    showCursor ? React.createElement(Text, { color: resolvedCursorColor }, '▌') : null
  );
};
