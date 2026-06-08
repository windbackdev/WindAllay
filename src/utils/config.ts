import Conf from 'conf';

export interface WindAllayConfig {
  apiBase: string;
  apiKey: string;
  model: string;
  maxTokens: number;
  contextLimit: number;
  memoryEnabled: boolean;
  memoryPath: string;
  skillsDir: string;
  theme: 'light' | 'dark';
  systemPrompt: string;
  temperature: number;
  language: 'en' | 'zh';
  savedProviders: string;
  compactionThreshold: number;
}

const DEFAULT_CONFIG: WindAllayConfig = {
  apiBase: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o',
  maxTokens: 4096,
  contextLimit: 128000,
  memoryEnabled: true,
  memoryPath: '',
  skillsDir: '',
  theme: 'dark',
  systemPrompt: `You are WindAllay, an AI-powered CLI assistant.
You have access to tools that let you interact with the system.
Follow the user's instructions carefully and use tools when needed.`,
  temperature: 0.7,
  language: 'en',
  savedProviders: '[]',
  compactionThreshold: 70,
};

let _store: Conf<WindAllayConfig> | null = null;

function getStore(): Conf<WindAllayConfig> {
  if (!_store) {
    _store = new Conf<WindAllayConfig>({
      projectName: 'windallay',
      defaults: DEFAULT_CONFIG,
    });
  }
  return _store;
}

export function getConfig(): WindAllayConfig {
  return getStore().store;
}

export function setConfig<K extends keyof WindAllayConfig>(
  key: K,
  value: WindAllayConfig[K]
): void {
  getStore().set(key, value);
}

export function resetConfig(): void {
  getStore().clear();
}

export function getApiBase(): string {
  return getConfig().apiBase;
}

export function getApiKey(): string {
  return process.env.WINDALLAY_API_KEY || getConfig().apiKey;
}
