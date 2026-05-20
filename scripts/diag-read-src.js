import { promises as fs } from 'node:fs';
import path from 'node:path';

async function walk(dir, files) {
  const ents = await fs.readdir(dir, { withFileTypes: true });
  for (const e of ents) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) await walk(p, files);
    else files.push(p);
  }
}

(async () => {
  try {
    const base = path.resolve(process.cwd(), 'src');
    const files = [];
    await walk(base, files);
    const start = process.hrtime.bigint();
    let totalBytes = 0;
    const perFile = [];
    for (const f of files) {
      const t0 = process.hrtime.bigint();
      try {
        const content = await fs.readFile(f, 'utf8');
        const t1 = process.hrtime.bigint();
        const ms = Number(t1 - t0) / 1e6;
        totalBytes += Buffer.byteLength(content, 'utf8');
        perFile.push({ file: path.relative(process.cwd(), f), ms });
      } catch (e) {
        const t1 = process.hrtime.bigint();
        const ms = Number(t1 - t0) / 1e6;
        perFile.push({ file: path.relative(process.cwd(), f), ms, error: String(e) });
      }
    }
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1e6;
    perFile.sort((a, b) => (b.ms || 0) - (a.ms || 0));
    const slow = perFile.slice(0, 10);
    console.log(JSON.stringify({ totalFiles: files.length, totalBytes, durationMs, topSlow: slow }, null, 2));
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();