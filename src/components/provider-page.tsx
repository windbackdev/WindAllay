import React, { useState, useCallback, useRef } from 'react';
import { Text, Box } from 'ink';
import { useInput } from 'ink';
import { getConfig, setConfig, getApiBase, getApiKey } from '../utils/config.js';
import { OpenAICompatibleProvider } from '../providers/openai-compat.js';
import { t } from '../utils/i18n.js';
import { FullScreen } from './fullscreen.js';
import { Card, CardDivider } from './card.js';
import { Dialog } from './dialog.js';

interface ProviderEntry {
  name: string;
  apiBase: string;
  apiKey: string;
  model: string;
}

interface Props {
  onBack: () => void;
}

const STORAGE_KEY = 'savedProviders';
const FIELD_KEYS = ['apiBase', 'apiKey', 'model', 'maxTokens', 'temperature'] as const;

function loadProviders(): ProviderEntry[] {
  try {
    const raw = (getConfig() as any)[STORAGE_KEY];
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveProviders(providers: ProviderEntry[]): void {
  setConfig(STORAGE_KEY as any, JSON.stringify(providers));
}

export function ProviderPage({ onBack }: Props) {
  const config = getConfig();
  const [providers, setProviders] = useState<ProviderEntry[]>(loadProviders);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [view, setView] = useState<'list' | 'fields' | 'dialog' | 'modelPicker' | 'add' | 'confirmDelete'>('list');
  const [dialogField, setDialogField] = useState<string>('');
  const [dialogVal, setDialogVal] = useState('');
  const [fieldSelected, setFieldSelected] = useState(0);
  const [addName, setAddName] = useState('');
  const [testing, setTesting] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [models, setModels] = useState<{ id: string }[]>([]);
  const [modelPickIdx, setModelPickIdx] = useState(0);
  const viewRef = useRef(view);
  viewRef.current = view;

  const defaultProvider: ProviderEntry = {
    name: t('providerManager.defaultLabel'),
    apiBase: config.apiBase,
    apiKey: config.apiKey,
    model: config.model,
  };
  const allProviders = [defaultProvider, ...providers];
  const current = allProviders[selectedIdx] || defaultProvider;

  function currFieldVal(k: string): string {
    if (k === 'apiKey') return current.apiKey || (process.env.WINDALLAY_API_KEY ? t('provider.fromEnv') : '');
    if (k === 'maxTokens') return String(config.maxTokens);
    if (k === 'temperature') return String(config.temperature);
    return (current as any)[k] || '';
  }

  function setFieldValue(k: string, v: string) {
    if (selectedIdx === 0) {
      let val: any = v;
      if (k === 'maxTokens') val = parseInt(v) || 4096;
      if (k === 'temperature') val = parseFloat(v) || 0.7;
      setConfig(k as any, val);
    } else {
      const p = { ...allProviders[selectedIdx] };
      (p as any)[k] = v;
      const newProviders = [...providers];
      newProviders[selectedIdx - 1] = p;
      saveProviders(newProviders);
      setProviders(loadProviders());
    }
  }

  const handleTest = useCallback(async () => {
    setTesting(true);
    setStatusMsg(t('provider.testing'));
    try {
      const prov = new OpenAICompatibleProvider(getApiBase(), getApiKey(), config.model);
      const modelList = await prov.listModels();
      setStatusMsg(`✓ ${t('provider.connected')} ${modelList.length}`);
    } catch (err: any) {
      setStatusMsg(`✗ ${t('provider.failed')} ${err.message}`);
    }
    setTesting(false);
  }, []);

  const fetchModelsForPicker = useCallback(async () => {
    try {
      const { getModels } = await import('../models/cache.js');
      const result = await getModels(true);
      setModels(result as any);
      setStatusMsg(`✓ ${result.length} ${t('provider.connected')}`);
    } catch (err: any) {
      setStatusMsg(`✗ ${t('provider.failed')} ${err.message}`);
      setModels([]);
    }
  }, []);

  useInput((_input, key) => {
    if (viewRef.current === 'dialog') {
      return;
    }

    if (viewRef.current === 'add') {
      if (key.return && addName.trim()) {
        saveProviders([...providers, { name: addName.trim(), apiBase: config.apiBase, apiKey: '', model: config.model }]);
        setProviders(loadProviders());
        setView('list');
        setAddName('');
      } else if (key.escape) { setView('list'); setAddName(''); }
      else if (key.backspace || key.delete || _input === '\x7f') setAddName((v) => v.slice(0, -1));
      else if (_input.length === 1 && _input.charCodeAt(0) >= 32) setAddName((v) => v + _input);
      return;
    }

    if (viewRef.current === 'confirmDelete') {
      if (key.return && selectedIdx > 0) {
        const idx = selectedIdx - 1;
        saveProviders(providers.filter((_, i) => i !== idx));
        setProviders(loadProviders());
        setView('list');
        setSelectedIdx(Math.max(0, selectedIdx - 1));
      } else if (key.escape) { setView('list'); }
      return;
    }

    if (viewRef.current === 'modelPicker') {
      if (key.return && models[modelPickIdx]) {
        setFieldValue('model', models[modelPickIdx].id);
        setStatusMsg(`${t('provider.model')} ${t('provider.updated')}`);
        setView('fields');
      } else if (key.escape) { setView('fields'); }
      else if (key.upArrow) setModelPickIdx((i) => (i > 0 ? i - 1 : Math.max(0, models.length - 1)));
      else if (key.downArrow) setModelPickIdx((i) => (i < models.length - 1 ? i + 1 : 0));
      return;
    }

    if (viewRef.current === 'fields') {
      if (key.return) {
        const f = FIELD_KEYS[fieldSelected];
        if (f === 'model') {
          // Fetch models from API and show picker
          setStatusMsg(t('provider.fetching'));
          setView('modelPicker');
          setModelPickIdx(0);
          fetchModelsForPicker();
        } else {
          setDialogField(f);
          const raw = currFieldVal(f);
          setDialogVal(f === 'apiKey' && config.apiKey ? '' : raw === '(from env)' ? '' : raw);
          setView('dialog');
        }
      } else if (key.escape) { setView('list'); }
      else if (key.upArrow) setFieldSelected((i) => (i > 0 ? i - 1 : FIELD_KEYS.length));
      else if (key.downArrow) setFieldSelected((i) => (i < FIELD_KEYS.length ? i + 1 : 0));
      else if (_input === 'd' && selectedIdx > 0) { setView('confirmDelete'); }
      return;
    }

    // List view
    const totalItems = allProviders.length + 3;
    if (key.upArrow) setSelectedIdx((i) => (i > 0 ? i - 1 : totalItems - 1));
    else if (key.downArrow) setSelectedIdx((i) => (i < totalItems - 1 ? i + 1 : 0));
    else if (key.return) {
      if (selectedIdx < allProviders.length) {
        setFieldSelected(0);
        setView('fields');
      } else {
        const btn = selectedIdx - allProviders.length;
        if (btn === 0) { setView('add'); setAddName(''); }
        else if (btn === 1) handleTest();
        else onBack();
      }
    } else if (_input === 'd' && selectedIdx > 0 && selectedIdx < allProviders.length) {
      setView('confirmDelete');
    } else if (key.escape || _input === 'q') { onBack(); }
  });

  // Dialog view
  if (view === 'dialog') {
    const isSecret = dialogField === 'apiKey';
    return (
      <FullScreen justifyContent="center">
        <Dialog
          title={`${t('provider.' + dialogField)} — ${current.name}`}
          initialValue={dialogVal}
          isSecret={isSecret}
          onConfirm={(val) => {
            setFieldValue(dialogField, val);
            setStatusMsg(`${t('provider.' + dialogField)} ${t('provider.updated')}`);
            setView('fields');
          }}
          onCancel={() => setView('fields')}
        />
      </FullScreen>
    );
  }

  // Model picker view
  if (view === 'modelPicker') {
    return (
      <FullScreen justifyContent="center">
        <Card borderColor="cyan" padding={1} marginBottom={1}>
          <Text bold color="cyan">{t('provider.model')} — {current.name}</Text>
        </Card>
        {models.length === 0 ? (
          <Card borderColor="gray" padding={1} marginBottom={1}>
            <Text dimColor>{t('provider.fetching')}</Text>
          </Card>
        ) : (
          <Box flexDirection="column" width={56}>
            {models.slice(0, 30).map((m, i) => {
              const sel = modelPickIdx === i;
              const isCurrent = m.id === current.model;
              return (
                <Card key={m.id} borderColor={sel ? 'cyan' : 'gray'} selected={sel} padding={0} marginBottom={0}>
                  <Box>
                    <Text bold color={sel ? 'white' : 'gray'}>
                      {sel ? '› ' : '  '}{isCurrent ? '●' : '○'} {m.id}
                    </Text>
                  </Box>
                </Card>
              );
            })}
          </Box>
        )}
        <CardDivider />
        <Card borderColor="gray" padding={0}>
          <Text dimColor>{t('provider.modelSelect')}</Text>
        </Card>
      </FullScreen>
    );
  }

  // Add name dialog
  if (view === 'add') {
    return (
      <FullScreen justifyContent="center">
        <Dialog
          title={`+ ${t('providerManager.addProvider')}`}
          initialValue={addName}
          onConfirm={(val) => {
            saveProviders([...providers, { name: val.trim(), apiBase: config.apiBase, apiKey: '', model: config.model }]);
            setProviders(loadProviders());
            setView('list');
          }}
          onCancel={() => setView('list')}
        />
      </FullScreen>
    );
  }

  // Delete confirm
  if (view === 'confirmDelete') {
    return (
      <FullScreen justifyContent="center">
        <Card borderColor="red" padding={1} marginBottom={1}>
          <Text color="red">{t('provider.deleteConfirm', allProviders[selectedIdx]?.name ?? '')}</Text>
        </Card>
        <Card borderColor="gray" padding={1}>
          <Text dimColor>Enter confirm • ESC cancel</Text>
        </Card>
      </FullScreen>
    );
  }

  // Fields view — configure the selected provider
  if (view === 'fields') {
    return (
      <FullScreen justifyContent="center">
        <Card borderColor="cyan" padding={1} marginBottom={1}>
          <Text bold color="cyan">{current.name}</Text>
        </Card>

        {FIELD_KEYS.map((f, i) => {
          const sel = fieldSelected === i;
          const raw = currFieldVal(f);
          const display = f === 'apiKey' && config.apiKey ? '••••••••' : raw || '';
          return (
            <Card key={f} borderColor={sel ? 'cyan' : 'gray'} selected={sel} padding={0} marginBottom={0}>
              <Box>
                <Box flexGrow={1}>
                  <Text bold color={sel ? 'white' : 'gray'}>
                    {sel ? '› ' : '  '}{t('provider.' + f)}:
                  </Text>
                  <Text dimColor> {f === 'apiKey' ? (config.apiKey ? '••••••••' : '(empty)') : display}</Text>
                </Box>
              </Box>
            </Card>
          );
        })}

        <CardDivider />

        {selectedIdx > 0 && (
          <Card borderColor="gray" padding={0} marginBottom={0}>
            <Text dimColor>d — {t('providerManager.deleteProvider')}</Text>
          </Card>
        )}

        <Card borderColor="gray" padding={0} marginBottom={0}>
          <Text dimColor>↑↓·Enter edit·ESC back</Text>
        </Card>
      </FullScreen>
    );
  }

  // List view — show all providers
  const listItems = allProviders.map((p, i) => ({ id: `p${i}`, name: p.name, isDefault: p === defaultProvider }));

  return (
    <FullScreen justifyContent="center">
      <Card borderColor="cyan" padding={1} marginBottom={1}>
        <Text bold color="cyan">{t('provider.title')}</Text>
      </Card>

      <Box flexDirection="column" width={56}>
        {listItems.map((item, i) => {
          const sel = selectedIdx === i;
          return (
            <Card key={item.id} borderColor={sel ? 'cyan' : 'gray'} selected={sel} padding={0} marginBottom={0}>
              <Box>
                <Text bold color={sel ? 'white' : 'gray'}>
                  {sel ? '› ' : '  '}{item.name}
                  {item.isDefault && <Text color="green"> ({t('providerManager.defaultLabel')})</Text>}
                </Text>
              </Box>
            </Card>
          );
        })}

        {/* Buttons */}
        <CardDivider />

        {[
          { id: 'add', label: `+ ${t('providerManager.addProvider')}`, idx: allProviders.length },
          { id: 'test', label: testing ? `⏳ ${t('provider.testing')}` : `🔌 ${t('provider.testConnection')}`, idx: allProviders.length + 1 },
          { id: 'back', label: `← ${t('provider.back')}`, idx: allProviders.length + 2 },
        ].map((btn) => {
          const sel = selectedIdx === btn.idx;
          return (
            <Card key={btn.id} borderColor={sel ? 'cyan' : 'gray'} selected={sel} padding={0} marginBottom={0}>
              <Text bold color={sel ? 'white' : 'gray'}>
                {sel ? '› ' : '  '}{btn.label}
              </Text>
            </Card>
          );
        })}
      </Box>

      {statusMsg && (
        <Card borderColor={statusMsg.startsWith('✓') ? 'green' : statusMsg.startsWith('✗') ? 'red' : 'yellow'} padding={0} marginBottom={0}>
          <Text color={statusMsg.startsWith('✓') ? 'green' : statusMsg.startsWith('✗') ? 'red' : 'yellow'}>{statusMsg}</Text>
        </Card>
      )}

      <CardDivider />

      <Card borderColor="gray" padding={0}>
        <Text dimColor>↑↓·Enter·d delete·ESC/q back</Text>
      </Card>
    </FullScreen>
  );
}
