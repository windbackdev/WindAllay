import React from 'react';
import { Box } from 'ink';
import { useTerminalSize } from './responsive.js';

// FullScreen — fills the entire terminal viewport vertically
// All sub-pages wrap content in this to avoid empty space
export function FullScreen({ children, justifyContent = 'center' }: { children: React.ReactNode; justifyContent?: 'center' | 'flex-start' | 'flex-end' | 'space-between' | 'space-around' }) {
  const { rows } = useTerminalSize();
  return (
    <Box height={rows} width="100%" flexDirection="column" alignItems="center" justifyContent={justifyContent}>
      {children}
    </Box>
  );
}
