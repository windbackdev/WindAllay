import { ModelInfo } from '../providers/types.js';
import { OpenAICompatibleProvider } from '../providers/openai-compat.js';
import { getApiBase, getApiKey, getConfig } from '../utils/config.js';

export interface FetchedModel extends ModelInfo {
  context_length?: number;
}

const MODEL_CONTEXT_MAP: Record<string, number> = {
  'gpt-4o': 128000,
  'gpt-4o-mini': 128000,
  'gpt-4-turbo': 128000,
  'gpt-4': 8192,
  'gpt-3.5-turbo': 16384,
  'claude-3-opus': 200000,
  'claude-3-sonnet': 200000,
  'claude-3-haiku': 200000,
  'claude-3.5-sonnet': 200000,
  'claude-3.5-haiku': 200000,
  'deepseek-chat': 128000,
  'deepseek-reasoner': 128000,
  'gemini-pro': 128000,
  'gemini-1.5-pro': 1048576,
  'gemini-1.5-flash': 1048576,
};

export async function fetchModels(): Promise<FetchedModel[]> {
  const config = getConfig();
  const provider = new OpenAICompatibleProvider(
    getApiBase(),
    getApiKey(),
    config.model
  );
  const models = await provider.listModels();
  return models.map((m) => ({
    ...m,
    context_length:
      MODEL_CONTEXT_MAP[m.id] ||
      MODEL_CONTEXT_MAP[Object.keys(MODEL_CONTEXT_MAP).find((k) =>
        m.id.startsWith(k)
      ) as string] ||
      8192,
  }));
}
