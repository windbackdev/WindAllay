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
    get: () => getCurrentLang() === 'en' ? 'English' : '中文',
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
];

export function SettingsPanel({ onBack }: Props) {
  const [selected, setSelected] = useState(0);
  const config = getConfig();

  useInput((_input, key) => {
    if (key.upArrow) setSelected((i) => (i > 0 ? i - 1 : SETTINGS.length));
    else if (key.downArrow) setSelected((i) => (i < SETTINGS.length ? i + 1 : 0));
    else if (key.return) {
      if (selected < SETTINGS.length) SETTINGS[selected].toggle();
      else onBack();
    } else if (key.escape || _input === 'q') onBack();
  });

  return (
    <FullScreen justifyContent="center">
      <Card borderColor="cyan" padding={1} marginBottom={1}>
        <CardHeader icon="🔧" title={t('settings.title')} titleColor="cyan" />
      </Card>

      {SETTINGS.map((s, i) => {
        const sel = selected === i;
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

      <Card borderColor={selected === SETTINGS.length ? 'cyan' : 'gray'} selected={selected === SETTINGS.length} padding={1} marginBottom={1}>
        <Text bold color={selected === SETTINGS.length ? 'white' : 'gray'}>
          {selected === SETTINGS.length ? '❯ ' : '  '}← {t('settings.back')}
        </Text>
      </Card>

      <Card borderColor="gray" padding={1} marginBottom={0}>
        <Text>
          <Text bold>{t('settings.currentConfig')}</Text>
          {'\n'}
          <Text dimColor>  {t('settings.context', String(config.contextLimit / 1000))}</Text>
          {'\n'}
          <Text dimColor>  {t('settings.memoryStatus', config.memoryEnabled)}</Text>
          {'\n'}
          <Text dimColor>  {t('settings.tempAndTokens', String(config.temperature), String(config.maxTokens))}</Text>
        </Text>
      </Card>

      <CardDivider />

      <Text dimColor>  {t('settings.navHint')}</Text>
    </FullScreen>
  );
}
