import React, { createContext, useContext, useState, useEffect } from 'react';
import { Text, Box } from 'ink';
import { useStdout } from 'ink';

interface TerminalSize {
  columns: number;
  rows: number;
  isNarrow: boolean;
  isShort: boolean;
  isWide: boolean;
  isTall: boolean;
}

const SizeContext = createContext<TerminalSize>({
  columns: 80,
  rows: 24,
  isNarrow: false,
  isShort: false,
  isWide: true,
  isTall: true,
});

export function useTerminalSize(): TerminalSize {
  return useContext(SizeContext);
}

export function TerminalSizeProvider({ children }: { children: React.ReactNode }) {
  const { stdout } = useStdout();
  const [size, setSize] = useState(() => ({
    columns: stdout?.columns ?? 80,
    rows: stdout?.rows ?? 24,
  }));

  useEffect(() => {
    const handler = () => {
      setSize({
        columns: stdout?.columns ?? 80,
        rows: stdout?.rows ?? 24,
      });
    };
    stdout?.on('resize', handler);
    return () => { stdout?.off('resize', handler); };
  }, [stdout]);

  const { columns, rows } = size;

  const terminalSize: TerminalSize = {
    columns, rows,
    isNarrow: columns < 60,
    isShort: rows < 20,
    isWide: columns >= 100,
    isTall: rows >= 30,
  };

  return (
    <SizeContext.Provider value={terminalSize}>
      {children}
    </SizeContext.Provider>
  );
}

export function Spacer({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const { isShort } = useTerminalSize();
  const count = isShort ? 0 : size === 'sm' ? 0 : size === 'md' ? 1 : 2;
  return <Text>{'\n'.repeat(count)}</Text>;
}

export function Divider({ char = '─' }: { char?: string }) {
  const { columns, isNarrow } = useTerminalSize();
  const width = Math.min(columns - 4, isNarrow ? 30 : 60);
  return (
    <Box justifyContent="center">
      <Text dimColor>{char.repeat(Math.max(10, width))}</Text>
    </Box>
  );
}
