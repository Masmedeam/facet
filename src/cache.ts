import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
export { cacheKey } from './cache-key.js';
import type { CacheEntry, ResearchCache } from './cache-key.js';

export class DiskCache<T> implements ResearchCache<T> {
  constructor(private directory: string) {}
  private path(key: string) {
    if (!/^[a-f0-9]{64}$/.test(key)) throw new Error('Invalid cache key');
    return join(this.directory, `${key}.json`);
  }
  async get(key: string): Promise<CacheEntry<T> | null> {
    try {
      const entry = JSON.parse(await readFile(this.path(key), 'utf8')) as CacheEntry<T>;
      if (entry.key !== key || !Number.isFinite(entry.created_at) || !Number.isFinite(entry.expires_at)
          || entry.created_at > Date.now() || entry.expires_at <= Date.now() || !entry.value || typeof entry.value !== 'object') {
        await unlink(this.path(key)).catch(() => {}); return null;
      }
      return entry;
    } catch { return null; }
  }
  async set(entry: CacheEntry<T>) {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const destination = this.path(entry.key);
    const temporary = `${destination}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, JSON.stringify(entry), { mode: 0o600 });
      await rename(temporary, destination);
    } finally { await unlink(temporary).catch(() => {}); }
  }
}
