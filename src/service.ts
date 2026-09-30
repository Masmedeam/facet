import { randomUUID } from 'node:crypto';
import type { Config } from './config.js';
import { ServiceError, type VerifyRequest } from './contracts.js';
import { demoResult } from './demo.js';
import { assess } from './model.js';
import { GlasserClient, retrieve, type ProviderClient } from './providers.js';
import { costBreakdown } from './costs.js';
import { cacheKey, type CacheEntry, type ResearchCache } from './cache-key.js';
import { DirectClient } from './direct-provider.js';

export function ready(config: Config) { return config.demo || Boolean(config.modelKey && (config.dataProvider === 'glasser' ? config.glasserKey : config.directKeys.serper)); }

function createUncachedVerifier(config: Config, provider: ProviderClient) {
  return async (request: VerifyRequest) => {
    if (!ready(config)) throw new ServiceError(503, 'not_configured', 'Configure GLASSER_API_KEY and MODEL_API_KEY before enabling live verification.');
    if (request.as_of && Date.parse(request.as_of) < Date.now() - 60_000) {
      throw new ServiceError(422, 'historical_verification_unavailable', 'Historical as-of verification is not supported by this version. Omit as_of for current evidence.');
    }
    const started = Date.now();
    const result = config.demo ? demoResult(request) : await (async () => {
      const retrieved = await retrieve(request, provider);
      return { ...retrieved, assessment: await assess(request, retrieved.evidence, config) };
    })();
    const { token_usage: usage, ...assessment } = { token_usage: null, ...result.assessment };
    const glasserCost = result.runs.reduce((sum, r) => sum + Number(r.charge_usd), 0);
    const costs = costBreakdown(glasserCost, usage, config,
      !result.runs.some((r) => r.cost_unknown) && !result.warnings.some((w) => w.includes('could not be confirmed')), config.demo || !result.evidence.length);
    return {
      id: randomUUID(), claim: request.claim, checked_at: new Date().toISOString(),
      mode: config.demo ? 'demo' : 'live',
      ...assessment, evidence: result.evidence,
      research: {
        provider_runs: result.runs,
        known_provider_cost_usd: result.runs.reduce((sum, r) => sum + Number(r.charge_usd), 0).toFixed(5),
        model: config.demo ? null : config.modelName,
        duration_ms: Date.now() - started, warnings: result.warnings,
        queries: 'queries' in result ? result.queries : [],
        page_retrieval: 'page_retrieval' in result ? result.page_retrieval : { requested: [], retrieved: [], failed: [] },
        note: 'Known provider cost excludes model charges and failed calls with unknown charges. Source counts do not imply independent corroboration.',
      },
      billing: { price_usd: '0.05', currency: 'USDC', protocol: 'pay.sh HTTP 402',
        collection_mode: 'fixed_upfront', costs,
        note: 'The gateway collects $0.05 upfront. The cost-plus figure is a calculated suggested price, not a second charge or an automatic refund. Payment buys a research attempt.' },
    };
  };
}

export function createVerifier(config: Config, provider?: ProviderClient, storage?: ResearchCache<unknown>) {
  provider ??= config.dataProvider === 'glasser' ? new GlasserClient(config) : new DirectClient(config);
  const investigate = createUncachedVerifier(config, provider);
  type Result = Awaited<ReturnType<typeof investigate>>;
  const cache: ResearchCache<Result> = {
    async get(key) {
      if (storage) return await storage.get(key) as CacheEntry<Result> | null;
      const { DiskCache } = await import('./cache.js');
      return new DiskCache<Result>(config.cacheDir).get(key);
    },
    async set(entry) {
      if (storage) return storage.set(entry);
      const { DiskCache } = await import('./cache.js');
      await new DiskCache<Result>(config.cacheDir).set(entry);
    },
  };
  const inFlight = new Map<string, Promise<CacheEntry<Result>>>();
  return async (request: VerifyRequest) => {
    const started = Date.now();
    const key = cacheKey(request, config);
    const wrap = (entry: CacheEntry<Result>, status: 'hit' | 'miss' | 'coalesced' | 'disabled') => {
      const reused = status === 'hit' || status === 'coalesced';
      return {
        ...entry.value,
        id: reused ? randomUUID() : entry.value.id,
        cache: { status, key, created_at: new Date(entry.created_at).toISOString(),
          expires_at: new Date(entry.expires_at).toISOString(),
          age_seconds: Math.max(0, Math.floor((Date.now() - entry.created_at) / 1000)),
          evidence_checked_at: entry.value.checked_at },
        request_duration_ms: Date.now() - started,
        billing: { ...entry.value.billing,
          original_research_costs: reused ? entry.value.billing.costs : undefined,
          costs: reused ? costBreakdown(0, null, config, true, true) : entry.value.billing.costs,
          note: reused
            ? 'Cached evidence reused; no provider or model calls were made for this response. The gateway still collects its configured fixed $0.05. Original research costs are shown separately.'
            : entry.value.billing.note,
        },
      };
    };
    if (config.cacheTtl === 0) {
      const now = Date.now();
      return wrap({ key, created_at: now, expires_at: now, value: await investigate(request) }, 'disabled');
    }
    const saved = await cache.get(key);
    if (saved) return wrap(saved, 'hit');
    const running = inFlight.get(key);
    if (running) return wrap(await running, 'coalesced');
    const pending = (async () => {
      const value = await investigate(request);
      const now = Date.now();
      // Unresolved results expire earlier; avoid retaining transient retrieval failures.
      const ttl = value.verdict === 'insufficient_evidence' ? Math.min(config.cacheTtl, 120) : config.cacheTtl;
      const entry = { key, value, created_at: now, expires_at: now + ttl * 1000 };
      if (!value.research.warnings.some((w) => /failed|unavailable|no usable|timed out/i.test(w))) {
        await cache.set(entry).catch(() => {});
      }
      return entry;
    })();
    inFlight.set(key, pending);
    try { return wrap(await pending, 'miss'); }
    finally { inFlight.delete(key); }
  };
}
