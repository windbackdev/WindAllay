import { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';

export interface ModelInfo {
  id: string;
  object: string;
  created: number;
  owned_by: string;
  context_length?: number;
}

export interface ProviderConfig {
  apiBase: string;
  apiKey: string;
  model: string;
}

export type Message = ChatCompletionMessageParam;

export type ToolDefinition = ChatCompletionTool;

export interface ToolCallResult {
  tool_call_id: string;
  role: 'tool';
  content: string;
}

export interface CompletionRequest {
  messages: Message[];
  tools?: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface CompletionResponse {
  id: string;
  content: string;
  toolCalls?: ToolCallResult[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export type StreamChunk =
  | { type: 'content'; delta: string }
  | { type: 'reasoning'; delta: string }
  | { type: 'tool_call'; index: number; id?: string; name?: string; args?: string }
  | { type: 'done'; usage?: { promptTokens: number; completionTokens: number; totalTokens: number } }
  | { type: 'error'; message: string };

export abstract class LLMProvider {
  abstract name: string;
  abstract chat(req: CompletionRequest): AsyncGenerator<StreamChunk>;
  abstract listModels(): Promise<ModelInfo[]>;
  abstract countTokens(messages: Message[]): number;
}
