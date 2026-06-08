import React from 'react';
import { Text, Box } from 'ink';
import { useInput } from 'ink';
import { t } from '../utils/i18n.js';
import { useTerminalSize } from './responsive.js';
import { Card } from './card.js';
import { PaginatedGrid } from './paginated-grid.js';

export type MenuPage =
  | 'main'
  | 'chat'
  | 'provider'
  | 'project'
  | 'skills'
  | 'settings'
  | 'exit';

interface Props {
  onNavigate: (page: MenuPage) => void;
}

interface MenuItem {
  id: MenuPage;
  icon: string;
  labelKey: string;
}

const MENU_ITEMS: MenuItem[] = [
  { id: 'chat', icon: '💬', labelKey: 'menu.startChat' },
  { id: 'provider', icon: '⚙', labelKey: 'menu.configureProvider' },
  { id: 'project', icon: '📁', labelKey: 'menu.createProject' },
  { id: 'skills', icon: '🧩', labelKey: 'menu.manageSkills' },
  { id: 'settings', icon: '🔧', labelKey: 'menu.settings' },
  { id: 'exit', icon: '🚪', labelKey: 'menu.exit' },
];

export function MainMenu({ onNavigate }: Props) {
  const { isNarrow, rows: termRows } = useTerminalSize();
  const menuWidth = 60;

  useInput((_input, key) => {
    if (key.escape || _input === 'q') process.exit(0);
  });

  const gridRows = termRows < 20 ? 2 : termRows < 28 ? 3 : 4;

  return (
    <Box width="100%" flexDirection="column" alignItems="center" paddingY={0}>
      <Card borderColor="cyan" padding={0} marginBottom={0}>
        <Text bold color="cyan">
          {isNarrow ? 'WindAllay v0.1.0' : 'WindAllay AI Agent CLI'}
        </Text>
      </Card>

      {termRows >= 20 && (
        <Box marginBottom={1}>
          <Text dimColor italic>{t('app.tagline')}</Text>
        </Box>
      )}

      <Box width={menuWidth} justifyContent="center" flexDirection="column">
        <PaginatedGrid
          items={MENU_ITEMS}
          columns={2}
          rows={gridRows}
          keyFn={(item) => item.id}
          onSelect={(item) => onNavigate(item.id)}
          renderItem={(item, _i, isSelected) => (
            <Box
              borderStyle="bold"
              borderColor={isSelected ? 'cyan' : 'gray'}
              paddingX={1}
              paddingY={1}
              width="100%"
            >
              <Box flexGrow={1} justifyContent="center" alignItems="center">
                <Text color={isSelected ? 'cyan' : 'gray'}>{item.icon}</Text>
                <Text bold color={isSelected ? 'white' : 'gray'}> {t(item.labelKey)}</Text>
                {isSelected && <Text color="cyan"> ›</Text>}
              </Box>
            </Box>
          )}
        />
      </Box>

      <Box marginTop={1}>
        <Card borderColor="gray" padding={0} marginBottom={0}>
          <Text>
            <Text dimColor>↑↓·←→·Enter·q</Text>
          </Text>
        </Card>
      </Box>
    </Box>
  );
}
