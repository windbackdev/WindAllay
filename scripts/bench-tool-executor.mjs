// Filter missing files gracefully
import { promises as fs } from 'node:fs';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

function safePath(base, input) {
  const resolved = path.resolve(base, input);
  if (!resolved.startsWith(base)) throw new Error(`Path traversal: ${input}`);
  return resolved;
}

function readSingleFileSync(filePath, offset = 0, limit = 2000, cwd) {
  const resolved = safePath(cwd, filePath);
  if (!existsSync(resolved)) throw new Error(`File not found: ${filePath}`);
  const content = readFileSync(resolved, 'utf-8');
  const allLines = content.split('\n');
  const resultLines = allLines.slice(offset, offset + limit);
  return { file: filePath, content: resultLines.join('\n'), totalLines: allLines.length, offset, truncated: offset + resultLines.length < allLines.length };
}

async function readSingleFile(filePath, offset = 0, limit = 2000, cwd) {
  const resolved = safePath(cwd, filePath);
  if (!existsSync(resolved)) return { file: filePath, content: '', totalLines: 0, offset, truncated: false, error: 'not found' };
  const content = await fs.readFile(resolved, 'utf-8');
  const allLines = content.split('\n');
  const resultLines = allLines.slice(offset, offset + limit);
  return { file: filePath, content: resultLines.join('\n'), totalLines: allLines.length, offset, truncated: offset + resultLines.length < allLines.length };
}

function walkDirSync(dir, ext = '') {
  const results = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true, recursive: true });
    for (const entry of entries) {
      if (entry.isFile()) {
        const full = path.join(dir, entry.name);
        if (!ext || full.endsWith(ext)) results.push(full);
      }
    }
  } catch (e) {}
  return results;
}

async function bench() {
  const cwd = path.resolve(process.cwd());
  const results = [];

  // Test 1: Read small file (sync)
  {
    const t0 = Date.now();
    const r = readSingleFileSync('src/components/card.tsx', 0, 2000, cwd);
    const dur = Date.now() - t0;
    results.push({ name: 'Read small file (sync)', durationMs: dur, lines: r.totalLines });
  }

  // Test 2: Read many files (async) using readSingleFile
  const many = ['src/components/card.tsx','src/components/chat-view.tsx','src/memory/manager.ts','src/tools/builtins.ts','src/components/message-item.tsx'];
  {
    const t0 = Date.now();
    const promises = many.map((f) => readSingleFile(f, 0, 2000, cwd));
    const out = await Promise.all(promises);
    const dur = Date.now() - t0;
    results.push({ name: 'Read many files (parallel async)', durationMs: dur, count: out.length });
  }

  // Test 3: Glob (walkDirSync) for tsx
  {
    const t0 = Date.now();
    const files = walkDirSync(path.join(cwd, 'src'), '.tsx');
    const dur = Date.now() - t0;
    results.push({ name: 'Glob tsx (sync walk)', durationMs: dur, count: files.length });
  }

  // Test 4: Grep (read many files and search)
  {
    const t0 = Date.now();
    const files = walkDirSync(path.join(cwd, 'src'), '.ts');
    let matches = 0;
    for (const f of files.slice(0, 200)) {
      try {
        const c = readFileSync(f, 'utf-8');
        if (c.includes('function')) matches++;
      } catch {}
    }
    const dur = Date.now() - t0;
    results.push({ name: 'Grep-ish (sync read)', durationMs: dur, matches });
  }

  // Test 5: Read large directory full async
  {
    const t0 = Date.now();
    const files = walkDirSync(path.join(cwd, 'src'));
    const readable = files.filter((f) => existsSync(f));
    const out = await Promise.all(readable.map((f) => fs.readFile(f, 'utf-8')));
    const dur = Date.now() - t0;
    results.push({ name: 'Read all files (async parallel)', durationMs: dur, files: readable.length });
  }

  console.log(JSON.stringify({ results }, null, 2));
}

bench().catch((e) => { console.error(e); process.exit(1); });