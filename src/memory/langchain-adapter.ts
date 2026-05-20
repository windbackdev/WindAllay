import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { getApiBase, getApiKey, getConfig } from '../utils/config.js';
import { Message } from '../providers/types.js';
import { MemoryManager } from './manager.js';

interface MemoryVector {
  id: string;
  vector: number[];
  content: string;
  metadata: Record<string, unknown>;
}

export class LangChainMemoryAdapter {
  private llm: ChatOpenAI;
  private embeddings: OpenAIEmbeddings;
  private enabled = false;
  private baseManager: MemoryManager;
  private vectors: MemoryVector[] = [];
  private summary = '';
  private dims = 1536;

  constructor(baseManager: MemoryManager) {
    this.baseManager = baseManager;
    const config = getConfig();
    const apiKey = getApiKey();
    const apiBase = getApiBase();

    this.llm = new ChatOpenAI({
      openAIApiKey: apiKey,
      configuration: { baseURL: apiBase },
      model: config.model,
      temperature: 0.3,
      maxTokens: 512,
    });

    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: apiKey,
      configuration: { baseURL: apiBase },
      model: 'text-embedding-ada-002',
    });
  }

  async enable(): Promise<void> {
    this.enabled = true;
    const messages = this.baseManager.getMessages();
    for (const msg of messages) {
      await this.indexMessage(msg);
    }
  }

  disable(): void {
    this.enabled = false;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0, magA = 0, magB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      magA += a[i] * a[i];
      magB += b[i] * b[i];
    }
    const denom = Math.sqrt(magA) * Math.sqrt(magB);
    return denom === 0 ? 0 : dot / denom;
  }

  private async getEmbedding(text: string): Promise<number[]> {
    try {
      const result = await this.embeddings.embedQuery(text.slice(0, 8000));
      return result;
    } catch {
      return Array.from<number>({ length: this.dims }).fill(0);
    }
  }

  private async indexMessage(msg: Message): Promise<void> {
    if (!this.enabled) return;
    const content = typeof msg.content === 'string' ? msg.content : '';
    if (!content || content.length < 10) return;

    try {
      const vector = await this.getEmbedding(content);
      this.vectors.push({
        id: `mem_${Date.now()}_${this.vectors.length}`,
        vector,
        content: content.slice(0, 500),
        metadata: { role: msg.role, timestamp: Date.now() },
      });
    } catch { }
  }

  async addAndIndex(msg: Message): Promise<void> {
    await this.indexMessage(msg);
  }

  async generateSummary(messages: Message[]): Promise<string> {
    if (!this.enabled || messages.length < 4) return '';

    const recentText = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .slice(-10)
      .map((m) => `[${m.role}] ${typeof m.content === 'string' ? m.content.slice(0, 300) : ''}`)
      .join('\n');

    try {
      const result = await this.llm.invoke([
        new SystemMessage('Summarize the key points of this conversation concisely:'),
        new HumanMessage(recentText),
      ]);
      const summary = result.content.toString();
      this.summary = summary;
      this.baseManager.setSummary(summary);
      return summary;
    } catch {
      return this.summary;
    }
  }

  async getSummary(): Promise<string> {
    if (this.summary) return this.summary;
    const existing = this.baseManager.getSummary();
    if (existing) this.summary = existing;
    return this.summary;
  }

  async searchSimilar(query: string, k = 5): Promise<{ content: string; role: string; score: number }[]> {
    if (!this.enabled || this.vectors.length === 0) return [];
    try {
      const queryVec = await this.getEmbedding(query);
      const scored = this.vectors
        .map((v) => ({ ...v, score: this.cosineSimilarity(queryVec, v.vector) }))
        .filter((v) => v.score > 0.7)
        .sort((a, b) => b.score - a.score)
        .slice(0, k);

      return scored.map((v) => ({
        content: v.content,
        role: (v.metadata.role as string) || 'unknown',
        score: v.score,
      }));
    } catch {
      return [];
    }
  }

  async getRelevantContext(query: string, _maxTokens = 2000): Promise<string> {
    if (!this.enabled) return '';

    const parts: string[] = [];

    const summary = await this.getSummary();
    if (summary) {
      parts.push(`[Conversation Summary]\n${summary}`);
    }

    const similar = await this.searchSimilar(query, 8);
    if (similar.length > 0) {
      const relevant = similar
        .filter((s) => s.score > 0.75)
        .slice(0, 4)
        .map((s) => `[${s.role}] ${s.content}`)
        .join('\n');
      if (relevant) {
        parts.push(`[Relevant Past Context]\n${relevant}`);
      }
    }

    return parts.join('\n\n');
  }

  async pruneMessages(messages: Message[], _maxTokens: number): Promise<Message[]> {
    if (!this.enabled) return messages;

    await this.generateSummary(messages);
    const summary = await this.getSummary();
    if (!summary) return messages;

    const recentMessages = messages.slice(-15);
    const summaryMsg: Message = {
      role: 'system',
      content: `Previous conversation summary:\n${summary}\n\n(Continued below)`,
    };

    return [summaryMsg, ...recentMessages];
  }
}
