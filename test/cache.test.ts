import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cacheKey, DiskCache } from '../src/cache.js';
import { loadConfig } from '../src/config.js';
import { requestSchema } from '../src/contracts.js';
import { createVerifier } from '../src/service.js';

const base = { ORIGIN_API_KEY: 'test-cache-secret-at-least-24-characters', DEMO_MODE: 'true' };
test('hash includes context, sources, model, and version; source order is irrelevant', () => {
  const config = loadConfig(base);
  const request = requestSchema.parse({ claim: 'A vendor exports all attachments', sources: ['web', 'x'] });
  assert.equal(cacheKey(request, config), cacheKey({ ...request, sources: ['x', 'web'] }, config));
  assert.notEqual(cacheKey(request, config), cacheKey({ ...request, context: 'Different vendor' }, config));
  assert.notEqual(cacheKey(request, config), cacheKey(request, { ...config, modelName: 'other' }));
});
test('persistent hits cost zero incremental provider usage and preserve checked_at', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'claimcheck-cache-'));
  try {
    const config = loadConfig({ ...base, CACHE_DIR: directory });
    const request = requestSchema.parse({ claim: 'A vendor exports all attachments' });
    const first = await createVerifier(config)(request);
    const second = await createVerifier(config)(request);
    assert.equal(first.cache.status, 'miss');
    assert.equal(second.cache.status, 'hit');
    assert.equal(second.checked_at, first.checked_at);
    assert.notEqual(second.id, first.id);
    assert.equal(second.billing.costs.estimated_provider_total_usd, '0.000000000');
    assert.equal(second.billing.costs.suggested_cost_plus_price_usd, '0.005000');
  } finally { await rm(directory, { recursive: true, force: true }); }
});
test('expired cache entries are discarded', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'claimcheck-cache-'));
  try {
    const cache = new DiskCache<{ result: string }>(directory);
    const key = 'a'.repeat(64);
    await cache.set({ key, created_at: Date.now() - 2000, expires_at: Date.now() - 1000, value: { result: 'stale' } });
    assert.equal(await cache.get(key), null);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('concurrent identical requests share one investigation', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'claimcheck-cache-'));
  try {
    let calls = 0;
    const config = loadConfig({ ...base, DEMO_MODE: 'false', CACHE_DIR: directory,
      GLASSER_API_KEY: 'test', MODEL_API_KEY: 'test' });
    const verify = createVerifier(config, { async run(provider, endpoint) {
      calls++;
      await new Promise((r) => setTimeout(r, 25));
      return { output: { organic: [] }, run: { provider, endpoint, status: 'COMPLETED', charge_usd: '0.0011', usable: true } };
    } });
    const request = requestSchema.parse({ claim: 'A vendor exports attachments', sources: ['web'] });
    const results = await Promise.all([verify(request), verify(request), verify(request)]);
    assert.equal(calls, 3); // Keyword searches plus empty-result semantic fallback, executed only once.
    assert.equal(results.filter((r) => r.cache.status === 'coalesced').length, 2);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
