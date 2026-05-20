import React, { useState } from 'react';
import { Text, Box } from 'ink';
import { useInput } from 'ink';
import { useTerminalSize } from './responsive.js';

interface Props<T> {
  items: T[];
  renderItem: (item: T, index: number, isSelected: boolean, pageIndex: number) => React.ReactNode;
  onSelect: (item: T) => void;
  columns?: number;
  rows?: number;
  keyFn?: (item: T, index: number) => string;
  emptyMessage?: string;
}

export function PaginatedGrid<T>({
  items,
  renderItem,
  onSelect,
  columns: forcedColumns,
  rows: forcedRows,
  emptyMessage,
}: Props<T>) {
  const { isNarrow, isWide } = useTerminalSize();

  const cols = forcedColumns ?? (isNarrow ? 1 : isWide ? 3 : 2);
  const rows = forcedRows ?? (isNarrow ? 5 : 3);
  const pageSize = cols * rows;
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

  const [selectedGlobal, setSelectedGlobal] = useState(0);

  const currentPage = Math.floor(selectedGlobal / pageSize);
  const selectedOnPage = selectedGlobal % pageSize;
  const selectedRow = Math.floor(selectedOnPage / cols);
  const selectedCol = selectedOnPage % cols;

  useInput((_input, key) => {
    if (key.upArrow && selectedRow > 0) {
      setSelectedGlobal((i) => i - cols);
    } else if (key.downArrow && selectedRow < rows - 1 && selectedGlobal + cols < items.length) {
      setSelectedGlobal((i) => i + cols);
    } else if (key.leftArrow) {
      if (selectedCol > 0) {
        setSelectedGlobal((i) => i - 1);
      } else if (currentPage > 0) {
        setSelectedGlobal((currentPage - 1) * pageSize + (rows - 1) * cols + (cols - 1));
      }
    } else if (key.rightArrow) {
      if (selectedCol < cols - 1 && selectedGlobal + 1 < items.length) {
        setSelectedGlobal((i) => i + 1);
      } else if (currentPage < totalPages - 1) {
        setSelectedGlobal((currentPage + 1) * pageSize);
      }
    } else if (key.return) {
      if (items[selectedGlobal]) onSelect(items[selectedGlobal]);
    } else if (_input === 'q' || key.escape) {
      // handled by parent
    }
  });

  if (items.length === 0) {
    return (
      <Box justifyContent="center" paddingY={1}>
        <Text dimColor>{emptyMessage ?? '(empty)'}</Text>
      </Box>
    );
  }

  const rows_out: React.ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    const rowItems: React.ReactNode[] = [];
    for (let c = 0; c < cols; c++) {
      const globalIdx = currentPage * pageSize + r * cols + c;
      const item = items[globalIdx];
      const isSelected = globalIdx === selectedGlobal;
      if (item) {
        rowItems.push(
          <Box key={`cell-${c}`} flexGrow={1} flexBasis={0}>
            {renderItem(item, globalIdx, isSelected, currentPage)}
          </Box>
        );
      } else {
        rowItems.push(<Box key={`cell-${c}`} flexGrow={1} flexBasis={0} />);
      }
    }
    rows_out.push(
      <Box key={`row-${r}`} flexDirection="row" width="100%" marginBottom={0}>
        {rowItems}
      </Box>
    );
  }

  return (
    <Box flexDirection="column" width="100%" justifyContent="center" flexGrow={1}>
      <Box flexDirection="column" justifyContent="center">{rows_out}</Box>

      {/* Page indicator */}
      {totalPages > 1 && (
        <Box justifyContent="center" marginTop={1}>
          <Text dimColor>
            {currentPage > 0 && '← '}
            {Array.from({ length: totalPages }, (_, i) => (
              <Text key={i} color={i === currentPage ? 'cyan' : 'dim'}>
                {' '}{i === currentPage ? '●' : '○'}{' '}
              </Text>
            ))}
            {currentPage < totalPages - 1 && ' →'}
          </Text>
        </Box>
      )}
    </Box>
  );
}
