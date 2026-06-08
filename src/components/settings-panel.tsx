import React, { useState } from 'react';
import { Text, Box } from 'ink';
import { useInput } from 'ink';
import { getConfig, setConfig } from '../utils/config.js';
import { t, getCurrentLang, setLang } from '../utils/i18n.js';
import { Card, CardHeader, CardDivider } from './card.js';
import { FullScreen } from './fullscreen.js';

interface Props {
  onBack: () => void;
}

interface SettingsItem {
  key: string;
  label: string;
  type: 'boolean' | 'number' | 'lang';
  description: string;
  get: () => string;
  toggle: () => void;
}

const SETTINGS: SettingsItem[] = [
  {
    key: 'language', label: 'app.langSwitch', type: 'lang',
    description: '',
    get: () => t('app.langName'),
    toggle: () => setLang(getCurrentLang() === 'en' ? 'zh' : 'en'),
  },
  {
    key: 'memoryEnabled', label: 'settings.memory', type: 'boolean',
    description: 'settings.memoryDesc',
    get: () => getConfig().memoryEnabled ? t('settings.on') : t('settings.off'),
    toggle: () => setConfig('memoryEnabled', !getConfig().memoryEnabled),
  },
  {
    key: 'temperature', label: 'settings.temperature', type: 'number',
    description: 'settings.temperatureDesc',
    get: () => String(getConfig().temperature),
    toggle: () => {
      const temps = [0.1, 0.3, 0.5, 0.7, 0.9, 1.0, 1.5];
      const cur = getConfig().temperature;
      const idx = temps.indexOf(cur);
      setConfig('temperature', temps[(idx + 1) % temps.length]);
    },
  },
  {
    key: 'maxTokens', label: 'settings.maxTokens', type: 'number',
    description: 'settings.maxTokensDesc',
    get: () => String(getConfig().maxTokens),
    toggle: () => {
      const opts = [1024, 2048, 4096, 8192, 16384];
      const cur = getConfig().maxTokens;
      const idx = opts.indexOf(cur);
      setConfig('maxTokens', opts[(idx + 1) % opts.length]);
    },
  },
  {
    key: 'contextLimit', label: 'settings.contextLimit', type: 'number',
    description: 'settings.contextLimitDesc',
    get: () => String(getConfig().contextLimit),
    toggle: () => {
      const opts = [32000, 64000, 128000, 200000];
      const cur = getConfig().contextLimit;
      const idx = opts.indexOf(cur);
      setConfig('contextLimit', opts[(idx + 1) % opts.length]);
    },
  },
  {
    key: 'compactionThreshold', label: 'settings.compactionThreshold', type: 'number',
    description: 'settings.compactionThresholdDesc',
    get: () => `${getConfig().compactionThreshold}%`,
    toggle: () => {
      const opts = [0, 50, 60, 70, 80, 90];
      const cur = getConfig().compactionThreshold;
      const idx = opts.indexOf(cur);
      setConfig('compactionThreshold', opts[(idx + 1) % opts.length]);
    },
  },
];

const ITEMS_PER_PAGE = 4; // items per settings page
const TOTAL_PAGES = Math.ceil(SETTINGS.length / ITEMS_PER_PAGE);

export function SettingsPanel({ onBack }: Props) {
  const [selected, setSelected] = useState(0);
  const [page, setPage] = useState(0);
  const config = getConfig();
  const totalSelectable = ITEMS_PER_PAGE + 2; // items + "back" + "summary"

  const pageItems = SETTINGS.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);
  const pageStartIdx = page * ITEMS_PER_PAGE;

  useInput((_input, key) => {
    // Up/Down: navigate within page
    if (key.upArrow) {
      if (selected > 0) {
        setSelected((i) => i - 1);
      } else if (page > 0) {
        // Jump to last item of previous page
        setPage((p) => p - 1);
        setSelected(ITEMS_PER_PAGE - 1);
      }
    } else if (key.downArrow) {
      if (selected < pageItems.length) {
        // Within items or at items end
        if (selected < pageItems.length - 1) {
          setSelected((i) => i + 1);
        } else if (selected === pageItems.length - 1 && page < TOTAL_PAGES - 1) {
          // Move to next page
          setPage((p) => p + 1);
          setSelected(0);
        } else {
          setSelected((i) => i + 1); // Move to back button
        }
      } else if (selected === pageItems.length) {
        setSelected(pageItems.length + 1); // Move to summary
      } else if (selected === pageItems.length + 1 && page < TOTAL_PAGES - 1) {
        setPage((p) => p + 1);
        setSelected(0);
      }
    } else if (key.return) {
      if (selected < pageItems.length) {
        // Toggle a setting
        SETTINGS[pageStartIdx + selected].toggle();
      } else if (selected === pageItems.length) {
        onBack();
      }
    } else if (key.escape || _input === 'q') {
      onBack();
    }
  });

  return (
    <FullScreen justifyContent="center">
      <Card borderColor="cyan" padding={1} marginBottom={1}>
        <CardHeader icon="🔧" title={t('settings.title')} titleColor="cyan" />
      </Card>

      {/* Settings items for current page */}
      {pageItems.map((s, i) => {
        const globalIdx = i;
        const sel = selected === globalIdx;
        const val = s.get();
        return (
          <Card key={s.key} borderColor={sel ? 'cyan' : 'gray'} selected={sel} padding={1} marginBottom={0}>
            <Box>
              <Box flexGrow={1}>
                <Text bold color={sel ? 'white' : 'gray'}>
                  {sel ? '❯ ' : '  '}{t(s.label)}
                </Text>
                {s.description && <Text dimColor> — {t(s.description)}</Text>}
              </Box>
              <Box marginLeft={1}>
                <Text color={
                  s.type === 'boolean' ? (val === t('settings.on') ? 'green' : 'red') :
                  s.type === 'lang' ? 'cyan' : 'yellow'
                }>
                  [{val}]
                </Text>
              </Box>
            </Box>
          </Card>
        );
      })}

      <CardDivider />

      {/* Page indicator */}
      {TOTAL_PAGES > 1 && (
        <Box marginBottom={1} justifyContent="center">
          <Text dimColor>{t('settings.page', page + 1, TOTAL_PAGES)}</Text>
        </Box>
      )}

      {/* Back button */}
      <Card borderColor={selected === pageItems.length ? 'cyan' : 'gray'} selected={selected === pageItems.length} padding={1} marginBottom={1}>
        <Text bold color={selected === pageItems.length ? 'white' : 'gray'}>
          {selected === pageItems.length ? '❯ ' : '  '}← {t('settings.back')}
        </Text>
      </Card>

      {/* Config summary */}
      <Card borderColor="gray" padding={1} marginBottom={0}>
        <Box flexDirection="column">
          <Text bold>{t('settings.currentConfig')}</Text>
          <Text dimColor>  {t('settings.context', String(config.contextLimit / 1000))}</Text>
          <Text dimColor>  {t('settings.memoryStatus', config.memoryEnabled)}</Text>
          <Text dimColor>  {t('settings.tempAndTokens', String(config.temperature), String(config.maxTokens))}</Text>
          <Text dimColor>  {t('settings.compactionThreshold')}: {config.compactionThreshold === 0 ? t('settings.off') : `${config.compactionThreshold}%`}</Text>
        </Box>
      </Card>

      <CardDivider />
      <Text dimColor>  {t('settings.navHint')}</Text>
    </FullScreen>
  );
}
