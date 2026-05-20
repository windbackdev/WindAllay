import OpenAI from 'openai';
import {
  LLMProvider,
  CompletionRequest,
  StreamChunk,
  ModelInfo,
  Message,
} from './types.js';
import { estimateTokens } from '../utils/helpers.js';

export class OpenAICompatibleProvider extends LLMProvider {
  name = 'OpenAI-Compatible';
  private client: OpenAI;
  private model: string;

  constructor(apiBase: string, apiKey: string, model: string) {
    super();
    this.client = new OpenAI({
      baseURL: apiBase.endsWith('/') ? apiBase : apiBase + '/',
      apiKey: apiKey || 'sk-placeholder',
      dangerouslyAllowBrowser: true,
    });
    this.model = model;
  }

  async *chat(req: CompletionRequest): AsyncGenerator<StreamChunk> {
    const stream = await this.client.chat.completions.create({
      model: this.model,
      messages: req.messages,
      tools: req.tools as any,
      temperature: req.temperature ?? 0.7,
      max_tokens: req.maxTokens ?? 4096,
      stream: true,
      stream_options: { include_usage: true },
    });

    let yieldedDone = false;

    for await (const chunk of stream) {
      const choice = chunk.choices?.[0];
      const delta = choice?.delta;

      if (!delta) {
        if (chunk.usage && !yieldedDone) {
          yieldedDone = true;
          yield {
            type: 'done',
            usage: {
              promptTokens: chunk.usage.prompt_tokens,
              completionTokens: chunk.usage.completion_tokens,
              totalTokens: chunk.usage.total_tokens,
            },
          };
        }
        continue;
      }

      if (delta.content) {
        yield { type: 'content', delta: delta.content };
      }

      if ((delta as any).reasoning_content) {
        yield { type: 'reasoning', delta: (delta as any).reasoning_content };
      }

      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          yield {
            type: 'tool_call',
            index: tc.index,
            id: tc.id,
            name: tc.function?.name,
            args: tc.function?.arguments,
          };
        }
      }
    }

    if (!yieldedDone) {
      yield { type: 'done' };
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    const models = await this.client.models.list();
    return models.data
      .map((m) => ({
        id: m.id,
        object: m.object,
        created: m.created,
        owned_by: m.owned_by ?? 'unknown',
      }))
      .sort((a, b) => b.created - a.created);
  }

  countTokens(messages: Message[]): number {
    let total = 0;
    for (const msg of messages) {
      total += 4;
      if (typeof msg.content === 'string') {
        total += estimateTokens(msg.content);
      }
      if (msg.role) total += 1;
    }
    total += 2;
    return total;
  }
}
