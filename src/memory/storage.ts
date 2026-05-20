import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { getConfig } from '../utils/config.js';
import { Message } from '../providers/types.js';

export interface Session {
  id: string;
  model: string;
  startedAt: string;
  updatedAt: string;
  messageCount: number;
  totalTokens: number;
  messages: Message[];
  summary?: string;
  title?: string;
}

export class MemoryStorage {
  private baseDir: string;

  constructor() {
    const config = getConfig();
    this.baseDir = config.memoryPath || join(process.cwd(), '.windallay', 'memory');
    if (!existsSync(this.baseDir)) {
      mkdirSync(this.baseDir, { recursive: true });
    }
  }

  private sessionPath(id: string): string {
    return join(this.baseDir, `${id}.json`);
  }

  saveSession(session: Session): void {
    writeFileSync(this.sessionPath(session.id), JSON.stringify(session, null, 2), 'utf-8');
  }

  loadSession(id: string): Session | null {
    const path = this.sessionPath(id);
    if (!existsSync(path)) return null;
    try {
      return JSON.parse(readFileSync(path, 'utf-8'));
    } catch {
      return null;
    }
  }

  listSessions(): { id: string; model: string; startedAt: string; messageCount: number; title?: string }[] {
    if (!existsSync(this.baseDir)) return [];
    const files = readdirSync(this.baseDir);
    return files
      .filter((f: string) => f.endsWith('.json'))
      .map((f: string) => {
        const session = this.loadSession(f.replace('.json', ''));
        if (!session) return null;
        return {
          id: session.id,
          model: session.model,
          startedAt: session.startedAt,
          messageCount: session.messageCount,
          title: session.title,
        };
      })
      .filter((s): s is NonNullable<typeof s> => s != null);
  }

  deleteSession(id: string): void {
    const path = this.sessionPath(id);
    if (existsSync(path)) {
      unlinkSync(path);
    }
  }
}
