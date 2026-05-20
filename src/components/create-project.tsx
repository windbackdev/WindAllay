import React, { useState, useMemo, useCallback } from 'react';
import { Text, Box } from 'ink';
import { useInput } from 'ink';
import { t } from '../utils/i18n.js';
import { getConfig } from '../utils/config.js';
import { OpenAICompatibleProvider } from '../providers/openai-compat.js';
import { getAllTemplates } from '../projects/template.js';
import { Card, CardHeader, CardBody } from './card.js';
import { SetupChat } from './setup-chat.js';

interface Props {
  onBack: () => void;
  onCreated: (path: string) => void;
}

type Step = 'name' | 'language' | 'provider' | 'model' | 'setup' | 'done';

interface ProviderEntry {
  name: string;
  apiBase: string;
  apiKey: string;
  model: string;
}

export function CreateProject({ onBack, onCreated }: Props) {
  const templates = useMemo(() => getAllTemplates(process.cwd()), []);
  const config = useMemo(() => getConfig(), []);

  const [step, setStep] = useState<Step>('name');
  const [projectName, setProjectName] = useState('');
  const [nameCursor, setNameCursor] = useState(0);
  const [langIdx, setLangIdx] = useState(0);

  const [providers] = useState<ProviderEntry[]>(() => {
    try {
      const raw = (config as any).savedProviders;
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });
  const defaultProvider: ProviderEntry = {
    name: t('providerManager.defaultLabel'),
    apiBase: config.apiBase,
    apiKey: config.apiKey,
    model: config.model,
  };
  const allProviders = [defaultProvider, ...providers];

  const [provIdx, setProvIdx] = useState(0);
  const [modelIdx, setModelIdx] = useState(0);
  const [models, setModels] = useState<{ id: string }[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [createdPath, setCreatedPath] = useState('');

  const selectedLang = templates[langIdx];
  const selectedProv = allProviders[provIdx];
  const selectedModel = models[modelIdx]?.id || selectedProv.model;

  const fetchModels = useCallback(async () => {
    setModelsLoading(true);
    try {
      const prov = new OpenAICompatibleProvider(selectedProv.apiBase, selectedProv.apiKey, selectedProv.model);
      const list = await prov.listModels();
      setModels(list);
      const idx = list.findIndex((m) => m.id === selectedProv.model);
      setModelIdx(idx >= 0 ? idx : 0);
    } catch { setModels([]); }
    setModelsLoading(false);
  }, [selectedProv.apiBase, selectedProv.apiKey, selectedProv.model]);

  useInput((input, key) => {
    if (step === 'done') {
      if (key.return) onCreated(createdPath);
      return;
    }

    if (step === 'name') {
      if (key.return && projectName.trim()) { setStep('language'); return; }
      if (key.backspace || key.delete || input === '\x7f') {
        if (nameCursor > 0) {
          setProjectName((v) => v.slice(0, nameCursor - 1) + v.slice(nameCursor));
          setNameCursor((c) => c - 1);
        }
        return;
      }
      if (key.escape) { onBack(); return; }
      if (input.length === 1 && input.charCodeAt(0) >= 32 && !key.ctrl && !key.meta) {
        setProjectName((v) => v.slice(0, nameCursor) + input + v.slice(nameCursor));
        setNameCursor((c) => c + 1);
      }
      return;
    }

    if (step === 'language') {
      if (key.return) { setStep('provider'); return; }
      if (key.upArrow) setLangIdx((i) => (i > 0 ? i - 1 : templates.length - 1));
      if (key.downArrow) setLangIdx((i) => (i < templates.length - 1 ? i + 1 : 0));
      if (key.escape) { setStep('name'); return; }
      return;
    }

    if (step === 'provider') {
      if (key.return) { setStep('model'); void fetchModels(); return; }
      if (key.upArrow) setProvIdx((i) => (i > 0 ? i - 1 : allProviders.length - 1));
      if (key.downArrow) setProvIdx((i) => (i < allProviders.length - 1 ? i + 1 : 0));
      if (key.escape) { setStep('language'); return; }
      return;
    }

    if (step === 'model') {
      if (key.return && models.length > 0) { setStep('setup'); return; }
      if (key.upArrow && models.length > 0) setModelIdx((i) => (i > 0 ? i - 1 : models.length - 1));
      if (key.downArrow && models.length > 0) setModelIdx((i) => (i < models.length - 1 ? i + 1 : 0));
      if (key.escape) { setStep('provider'); return; }
      return;
    }
  });

  if (step === 'setup') {
    return (
      <SetupChat
        projectName={projectName}
        languageName={selectedLang?.name || ''}
        languageId={selectedLang?.id || ''}
        providerConfig={{
          name: selectedProv.name,
          apiBase: selectedProv.apiBase,
          apiKey: selectedProv.apiKey,
        }}
        model={selectedModel}
        onComplete={(path) => { setCreatedPath(path); setStep('done'); }}
        onBack={() => setStep('model')}
      />
    );
  }

  return (
    <Box flexDirection="column" alignItems="center" paddingY={1}>
      <Card borderColor="cyan" padding={1} marginBottom={1}>
        <CardHeader icon="📁" title={t('project.title')} titleColor="cyan" />
      </Card>

      {step === 'name' && (
        <Card borderColor="cyan" padding={1}>
          <CardHeader title={t('project.stepName')} titleColor="cyan" />
          <CardBody>
            <Text bold>  {t('project.namePrompt')}</Text>
            <Text color="yellow">  {projectName || t('project.namePlaceholder')}{'▎'}</Text>
          </CardBody>
          <Text dimColor>  {t('project.nameHint')} | ESC {t('nav.back')}</Text>
        </Card>
      )}

      {step === 'language' && (
        <>
          <Card borderColor="green" padding={1} marginBottom={1}>
            <Text bold color="green">✓ {t('project.stepName')}</Text>
            <Text color="green">  {t('project.namePrompt')} {projectName}</Text>
          </Card>
          <Card borderColor="cyan" padding={1}>
            <CardHeader title={t('project.stepLanguage')} titleColor="cyan" />
            <CardBody>
              {templates.map((pt, i) => (
                <Card key={pt.id} borderColor={langIdx === i ? 'cyan' : 'gray'} selected={langIdx === i} padding={0} marginBottom={0}>
                  <Text bold color={langIdx === i ? 'white' : 'gray'}>
                    {langIdx === i ? '  ● ' : '  ○ '}{pt.name}
                  </Text>
                  <Text dimColor>    {pt.description}</Text>
                </Card>
              ))}
            </CardBody>
            <Text dimColor>  {t('project.languageHint')}</Text>
          </Card>
        </>
      )}

      {(step === 'provider' || step === 'model') && (
        <Card borderColor="green" padding={1} marginBottom={1}>
          <CardBody>
            <Text bold color="green">✓ {t('project.stepLanguage')}</Text>
            <Text color="green">  {selectedLang?.name} — {projectName}</Text>
          </CardBody>
        </Card>
      )}

      {step === 'provider' && (
        <Card borderColor="cyan" padding={1}>
          <CardHeader title={t('project.stepProvider')} titleColor="cyan" />
          <CardBody>
            {allProviders.map((p, i) => (
              <Card key={i} borderColor={provIdx === i ? 'cyan' : 'gray'} selected={provIdx === i} padding={0} marginBottom={0}>
                <Text bold color={provIdx === i ? 'white' : 'gray'}>
                  {provIdx === i ? '  ● ' : '  ○ '}{p.name}
                </Text>
                <Text dimColor>    {p.apiBase} | {p.model}</Text>
              </Card>
            ))}
          </CardBody>
          <Text dimColor>  {t('project.providerHint')}</Text>
        </Card>
      )}

      {step === 'done' && (
        <Card borderColor="green" padding={1} marginBottom={1}>
          <CardBody>
            <Text bold color="green">{t('setup.done')}</Text>
            {createdPath && <Text dimColor>  {createdPath}</Text>}
          </CardBody>
        </Card>
      )}

      {step === 'model' && (
        <Card borderColor="cyan" padding={1}>
          <CardHeader title={t('project.stepModel')} titleColor="cyan" />
          <CardBody>
            {modelsLoading && <Text dimColor>  {t('setup.thinking')}</Text>}
            {!modelsLoading && models.length === 0 && (
              <Text color="red">  {t('project.noModels')}</Text>
            )}
            {models.slice(0, 30).map((m, i) => (
              <Card key={m.id} borderColor={modelIdx === i ? 'cyan' : 'gray'} selected={modelIdx === i} padding={0} marginBottom={0}>
                <Text bold color={modelIdx === i ? 'white' : 'gray'}>
                  {modelIdx === i ? '  ● ' : '  ○ '}{m.id}
                </Text>
              </Card>
            ))}
          </CardBody>
          <Text dimColor>  {t('project.modelHint')}</Text>
        </Card>
      )}

      <Box marginTop={1}>
        <Text dimColor>
          {step === 'name' && t('project.stepIndicator', '1', '5')}
          {step === 'language' && t('project.stepIndicator', '2', '5')}
          {step === 'provider' && t('project.stepIndicator', '3', '5')}
          {step === 'model' && t('project.stepIndicator', '4', '5')}
        </Text>
      </Box>
    </Box>
  );
}
