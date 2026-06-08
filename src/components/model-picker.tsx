import React, { useState } from 'react';
import { Text, Box } from 'ink';
import { useInput } from 'ink';
import { FetchedModel } from '../models/fetcher.js';
import { useTerminalSize } from './responsive.js';
import { t } from '../utils/i18n.js';

interface Props {
  models: FetchedModel[];
  activeModel: string;
  onSelect: (modelId: string) => void;
  onClose: () => void;
}

function sanitize(str: string): string {
  // oxlint-disable-next-line no-control-regex
  return str.replace(/[\x00-\x1f\x7f-\x9f]/g, '');
}

function getWidth(str: string): number {
  return str.length;
}

export function ModelPicker({ models, activeModel, onSelect, onClose }: Props) {
  const { rows, columns } = useTerminalSize();
  const width = Math.min(columns - 4, 68);
  const visibleHeight = Math.max(1, Math.min(rows - 10, 16));
  const [selectedIndex, setSelectedIndex] = useState(
    Math.max(0, models.findIndex((m) => m.id === activeModel))
  );

  const total = models.length;
  const half = Math.floor(visibleHeight / 2);
  const startIdx = Math.max(0, Math.min(selectedIndex - half, total - visibleHeight));
  const endIdx = Math.min(total, startIdx + visibleHeight);
  const visibleModels = models.slice(startIdx, endIdx);

  useInput((_input, key) => {
    if (key.upArrow) setSelectedIndex((i) => Math.max(0, i - 1));
    else if (key.downArrow) setSelectedIndex((i) => Math.min(total - 1, i + 1));
    else if (key.pageUp) setSelectedIndex((i) => Math.max(0, i - visibleHeight));
    else if (key.pageDown) setSelectedIndex((i) => Math.min(total - 1, i + visibleHeight));
    else if (key.return) onSelect(models[selectedIndex]?.id);
    else if (key.escape || _input === 'q') onClose();
  }, { isActive: true });

  return (
    <Box width={width} flexDirection="column" marginX={1}>
      <Box borderStyle="round" borderColor="cyan" paddingX={1} paddingY={0}>
        <Text bold color="cyan"> {t('models.title', total)}</Text>
        <Text dimColor> | ↑↓PgUpPgDn | ↵ | Esc</Text>
      </Box>

      <Box flexDirection="column">
        {visibleModels.map((model, idx) => {
          const globalIdx = startIdx + idx;
          const sel = selectedIndex === globalIdx;
          const isActive = activeModel === model.id;
          const ctx = (model as any).context_length;
          const ctxStr = ctx ? ` (ctx:${ctx >= 100000 ? Math.round(ctx / 1000) + 'k' : ctx})` : '';

          const name = sanitize(model.id).slice(0, width - 15);
          const nameWithIndicator = (sel ? '❯' : ' ') + ' ' + (isActive ? '●' : '○') + ' ' + name;
          const remaining = width - 2 - getWidth(nameWithIndicator) - getWidth(ctxStr);
          const padding = remaining > 0 ? ' '.repeat(remaining) : '';

          return (
            <Box key={model.id} width={width - 2}>
              <Text
                bold={sel}
                color={sel ? 'cyan' : isActive ? 'green' : 'white'}
                backgroundColor={sel ? 'blue' : undefined}
              >
                {nameWithIndicator}{ctxStr}{padding}
              </Text>
            </Box>
          );
        })}
      </Box>

      <Box>
        <Text dimColor>
          {selectedIndex + 1}/{total}
        </Text>
      </Box>
    </Box>
  );
}