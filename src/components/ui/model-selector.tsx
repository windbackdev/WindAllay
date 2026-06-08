import { Box, Text } from 'ink';
import React, { useState } from 'react';
import { useTheme } from './theme-provider.js';
import { useInput } from '../../hooks/use-input.js';

export interface ModelOption {
  id: string;
  name: string;
  provider?: string;
  contextLength?: number;
}

export interface ModelSelectorProps {
  models: ModelOption[];
  activeModel?: string;
  onSelect: (modelId: string) => void;
  onClose: () => void;
}

export const ModelSelector = ({ models, activeModel, onSelect, onClose }: ModelSelectorProps) => {
  const theme = useTheme();
  const [selectedIndex, setSelectedIndex] = useState(
    Math.max(0, models.findIndex((m) => m.id === activeModel))
  );

  useInput((input, key) => {
    if (key.upArrow) setSelectedIndex((i) => (i > 0 ? i - 1 : models.length - 1));
    else if (key.downArrow) setSelectedIndex((i) => (i < models.length - 1 ? i + 1 : 0));
    else if (key.return) onSelect(models[selectedIndex]?.id);
    else if (key.escape || input === 'q') onClose();
  });

  return React.createElement(Box, { flexDirection: 'column', width: 60 },
    React.createElement(Box, { borderStyle: 'round', borderColor: theme.colors.primary, paddingX: 1 },
      React.createElement(Text, { bold: true, color: theme.colors.primary }, 'Select Model'),
      React.createElement(Text, { dimColor: true }, ` (${models.length})`),
    ),
    React.createElement(Box, { flexDirection: 'column' },
      ...models.map((model, idx) => {
        const sel = selectedIndex === idx;
        const isActive = activeModel === model.id;
        const ctx = model.contextLength;
        const ctxStr = ctx ? ` (ctx:${ctx >= 100000 ? Math.round(ctx / 1000) + 'k' : ctx})` : '';
        const prefix = sel ? '❯' : ' ';
        const indicator = isActive ? '●' : '○';

        return React.createElement(Box, { key: model.id },
          React.createElement(Text, {
            bold: sel,
            color: sel ? theme.colors.primary : isActive ? theme.colors.success : undefined,
          }, `${prefix} ${indicator} ${model.name}${ctxStr}`),
        );
      }),
    ),
    React.createElement(Text, { dimColor: true, color: theme.colors.mutedForeground },
      `${selectedIndex + 1}/${models.length} · ↑↓ · Enter · Esc`
    ),
  );
};
