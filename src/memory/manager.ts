import { MemoryStorage, Session } from './storage.js';
import { LangChainMemoryAdapter } from './langchain-adapter.js';
import { Message } from '../providers/types.js';
import { getConfig } from '../utils/config.js';

export class MemoryManager {
  private storage: MemoryStorage;
  private currentSessionId: string;
  private session: Session;
  private langchain: LangChainMemoryAdapter;
  private langchainEnabled = false;

  constructor() {
    this.storage = new MemoryStorage();
    this.currentSessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.session = {
      id: this.currentSessionId,
      model: getConfig().model,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messageCount: 0,
      totalTokens: 0,
      messages: [],
      title: '',
    };
    this.langchain = new LangChainMemoryAdapter(this);
  }

  async enableLangChainMemory(): Promise<void> {
    if (!this.langchainEnabled) {
      try {
        await this.langchain.enable();
        this.langchainEnabled = true;
      } catch {
        this.langchainEnabled = false;
      }
    }
  }

  disableLangChainMemory(): void {
    this.langchain.disable();
    this.langchainEnabled = false;
  }

  isLangChainEnabled(): boolean {
    return this.langchainEnabled;
  }

  getLangChainAdapter(): LangChainMemoryAdapter {
    return this.langchain;
  }

  async addMessage(msg: Message, tokens = 0): Promise<void> {
    this.session.messages.push(msg);
    this.session.messageCount++;
    this.session.totalTokens += tokens;
    this.session.updatedAt = new Date().toISOString();

    // Auto-generate title from first user message
    if (!this.session.title && msg.role === 'user' && typeof msg.content === 'string') {
      this.session.title = msg.content.slice(0, 50) + (msg.content.length > 50 ? '...' : '');
    }

    // Debounced persist - don't block on file I/O for every message
    this.schedulePersist();

    // Index in background - don't await to avoid blocking tool call loops
    if (this.langchainEnabled) {
      this.langchain.addAndIndex(msg).catch(() => {});
    }
  }

  private persistTimer: ReturnType<typeof setTimeout> | null = null;

  private schedulePersist(): void {
    if (this.persistTimer) return;
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      this.persist();
    }, 1000);
  }

  /** Force immediate persist (e.g. before session switch) */
  flushPersist(): void {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    this.persist();
  }

  getMessages(): Message[] {
    return this.session.messages;
  }

  setMessages(msgs: Message[]): void {
    this.session.messages = msgs;
    this.session.messageCount = msgs.length;
    this.persist();
  }

  getSession(): Session {
    return { ...this.session };
  }

  getSessionTitle(): string {
    return this.session.title || '';
  }

  setSessionTitle(title: string): void {
    this.session.title = title;
    this.persist();
  }

  getSummary(): string {
    return this.session.summary || '';
  }

  setSummary(summary: string): void {
    this.session.summary = summary;
    this.persist();
  }

  persist(): void {
    if (getConfig().memoryEnabled) {
      this.storage.saveSession(this.session);
    }
  }

  loadSession(id: string): boolean {
    const session = this.storage.loadSession(id);
    if (session) {
      this.session = session;
      this.currentSessionId = session.id;
      return true;
    }
    return false;
  }

  /** Create a brand new session, persisting the current one first */
  newSession(): void {
    // Auto-generate a summary of the current session before switching
    if (this.session.messages.length > 0 && !this.session.summary) {
      const userMsgs = this.session.messages
        .filter((m) => m.role === 'user')
        .map((m) => typeof m.content === 'string' ? m.content.slice(0, 100) : '')
        .filter(Boolean)
        .slice(0, 5);
      if (userMsgs.length > 0) {
        this.session.summary = `Topics discussed: ${userMsgs.join('; ')}`;
      }
    }

    // Persist current session before creating new one (immediate flush)
    this.flushPersist();

    this.currentSessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.session = {
      id: this.currentSessionId,
      model: getConfig().model,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messageCount: 0,
      totalTokens: 0,
      messages: [],
      title: '',
    };
  }

  deleteSession(id: string): void {
    this.storage.deleteSession(id);
  }

  listSessions() {
    return this.storage.listSessions();
  }

  clear(): void {
    this.session.messages = [];
    this.session.messageCount = 0;
    this.session.totalTokens = 0;
    this.session.summary = undefined;
    this.session.title = '';
    this.persist();
  }

  private sessionSummaryCache: string | null = null;
  private sessionSummaryCacheTime = 0;

  async getHistoryContext(query?: string): Promise<string> {
    const { messageCount, model, startedAt, summary } = this.session;
    const parts: string[] = [];
    if (summary) parts.push(`Previous session summary: ${summary}`);
    parts.push(`Session started: ${startedAt}`);
    parts.push(`Total messages: ${messageCount}`);
    parts.push(`Model: ${model}`);

    // Semantic search with timeout - don't block if embedding API is slow
    if (this.langchainEnabled && query) {
      try {
        const searchPromise = this.langchain.searchSimilar(query, 3);
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 3000)
        );
        const relevant = await Promise.race([searchPromise, timeoutPromise]);
        if (relevant.length > 0) {
          const ctx = relevant
            .map((r) => `[${r.role}] ${r.content.slice(0, 200)}`)
            .join('\n');
          parts.push(`\nRelevant past context:\n${ctx}`);
        }
      } catch { }
    }

    // Cache session summaries for 60 seconds to avoid repeated disk reads
    const now = Date.now();
    if (!this.sessionSummaryCache || now - this.sessionSummaryCacheTime > 60000) {
      try {
        const sessions = this.storage.listSessions();
        const recentSessions = sessions
          .filter((s) => s.id !== this.currentSessionId)
          .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
          .slice(0, 3);

        if (recentSessions.length > 0) {
          const sessionCtx = recentSessions.map((s) => {
            const full = this.storage.loadSession(s.id);
            if (full?.summary) {
              return `[Session "${full.title || s.id}" - ${s.startedAt}]: ${full.summary}`;
            }
            return null;
          }).filter(Boolean);

          this.sessionSummaryCache = sessionCtx.length > 0
            ? `\nRecent session history:\n${sessionCtx.join('\n')}`
            : '';
        } else {
          this.sessionSummaryCache = '';
        }
        this.sessionSummaryCacheTime = now;
      } catch {
        this.sessionSummaryCache = '';
      }
    }

    if (this.sessionSummaryCache) {
      parts.push(this.sessionSummaryCache);
    }

    return parts.join('\n');
  }
}
