import { randomUUID, createHash } from 'node:crypto';
import type { Config } from './config.js';
import type { Evidence, VerifyRequest } from './contracts.js';
import { fetchableUrl, planQueries, selectPages } from './research-plan.js';

export const MAX_PROVIDER_CALLS = 12;
const MAX_EVIDENCE = 40;
type RecordValue = Record<string, unknown>;
function object(value: unknown): RecordValue {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {};
}
function string(value: unknown): string | undefined {
  return typeof value === 'string' && value.length ? value : undefined;
}
function array(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function publicUrl(value: unknown): string | undefined {
  try {
    const url = new URL(String(value));
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : undefined;
  } catch { return undefined; }
}

export interface ProviderRun {
  provider: string;
  endpoint: string;
  status: string;
  charge_usd: string;
  usable: boolean;
  cost_unknown?: boolean;
}
export interface Retrieval {
  evidence: Evidence[];
  runs: ProviderRun[];
  warnings: string[];
  queries: string[];
  page_retrieval: { requested: string[]; retrieved: string[]; failed: string[] };
}
export interface ProviderClient {
  run(provider: string, endpoint: string, input: RecordValue): Promise<{ output: unknown; run: ProviderRun }>;
}

export class GlasserClient implements ProviderClient {
  constructor(private config: Config) {}
  async run(provider: string, endpoint: string, input: RecordValue) {
    const headers = { Authorization: `Bearer ${this.config.glasserKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': randomUUID() };
    let response = await fetch(`${this.config.glasserBase}/v1/runs`, {
      method: 'POST', headers, body: JSON.stringify({ provider, endpoint, input }), signal: AbortSignal.timeout(65000),
    });
    if (!response.ok) throw new Error(`Provider request refused: ${response.status}`);
    let result = object(await response.json());
    const deadline = Date.now() + 65000;
    while (['QUEUED', 'RUNNING'].includes(String(result.status)) && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      response = await fetch(`${this.config.glasserBase}/v1/runs/${encodeURIComponent(String(result.id))}`, { headers, signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error('Provider polling failed');
      result = object(await response.json());
    }
    const output = object(result.output);
    const status = string(result.status) ?? 'UNKNOWN';
    const basis = object(result.charge_basis);
    return {
      output,
      run: {
        provider, endpoint, status,
        charge_usd: string(result.charge_usd) ?? '0',
        usable: status === 'COMPLETED' && basis.clause !== 'PROVIDER_ERROR'
          && Number(object(result.provider_response).http_status ?? 200) < 300
          && (!output.code || output.code === 200),
      },
    };
  }
}

export function normalize(source: Evidence['source'], output: unknown, now: string): Omit<Evidence, 'id'>[] {
  const root = object(output);
  const data = object(root.data);
  const results: Omit<Evidence, 'id'>[] = [];
  const seen = new Set<string>();
  function add(url: string | undefined, text: string | undefined, scope: Evidence['scope'], author?: string, date?: string) {
    if (!url || !text || seen.has(url + text)) return;
    seen.add(url + text);
    results.push({ source, url, text: text.slice(0, 6000), scope,
      retrieved_at: now, ...(author ? { author } : {}), ...(date ? { published_at: date } : {}) });
  }
  if (source === 'web') {
    for (const item of array(root.results ?? data.results)) {
      const row = object(item);
      const text = string(row.text);
      const url = publicUrl(row.url);
      if (!url) continue;
      if (!text) {
        add(url, [string(row.title), ...array(row.highlights).filter((v): v is string => typeof v === 'string')].filter(Boolean).join('\n'), 'search_snippet', string(row.author), string(row.publishedDate));
        continue;
      }
      results.push({ source, url, text: text.slice(0, 18000), scope: 'source_document', retrieved_at: now,
        ...(string(row.title) ? { title: string(row.title) } : {}),
        ...(string(row.author) ? { author: string(row.author) } : {}),
        ...(string(row.publishedDate) ? { published_at: string(row.publishedDate) } : {}),
        content_truncated: text.length >= 10000,
        content_sha256: createHash('sha256').update(text.slice(0, 18000)).digest('hex'),
        retrieval_provider: 'exa',
      });
    }
    const pageText = string(root.markdown) ?? string(root.text);
    if (pageText && results.length === 0) {
      const url = publicUrl(root.url) ?? publicUrl(data.url);
      if (url) results.push({ source, url, text: pageText.slice(0, 18000), scope: 'source_document', retrieved_at: now,
        title: string(object(root.metadata).title), retrieval_provider: 'serper',
        content_truncated: pageText.length > 18000,
        content_sha256: createHash('sha256').update(pageText.slice(0, 18000)).digest('hex') });
    }
    for (const item of array(root.organic ?? root.organic_results ?? data.organic ?? data.organic_results)) {
      const row = object(item);
      add(publicUrl(row.link), [string(row.title), string(row.snippet)].filter(Boolean).join('\n'), 'search_snippet', undefined, string(row.date));
    }
    return results;
  }
  function walk(value: unknown) {
    if (Array.isArray(value)) { for (const item of value) walk(item); return; }
    const row = object(value);
    const author = object(row.author);
    const user = string(author.screen_name) ?? string(row.author);
    const id = string(row.tweet_id) ?? string(row.id_str) ?? string(row.id);
    if (source === 'x') {
      const url = publicUrl(row.url) ?? (id && /^\d+$/.test(id) ? `https://x.com/${user ?? 'i'}/status/${id}` : undefined);
      add(url, string(row.text) ?? string(row.full_text), 'post', user, string(row.created_at));
    } else {
      const permalink = string(row.permalink);
      const url = publicUrl(permalink?.startsWith('/') ? `https://www.reddit.com${permalink}` : permalink)
        ?? publicUrl(row.url);
      const text = [string(row.title), string(row.selftext) ?? string(row.body) ?? string(row.text)].filter(Boolean).join('\n');
      const timestamp = typeof row.created_utc === 'number' ? new Date(row.created_utc * 1000).toISOString() : undefined;
      add(url, text, row.body ? 'thread_comment' : 'post', user, timestamp);
    }
    for (const nested of Object.values(row)) if (nested && typeof nested === 'object') walk(nested);
  }
  walk(output);
  return results;
}

export async function retrieve(request: VerifyRequest, client: ProviderClient): Promise<Retrieval> {
  const evidence: Evidence[] = [];
  const runs: ProviderRun[] = [];
  const warnings: string[] = [];
  let calls = 0;
  const seen = new Set<string>();
  const operations = new Set<string>();
  const pageRetrieval = { requested: [] as string[], retrieved: [] as string[], failed: [] as string[] };
  async function fetchSource(source: Evidence['source'], provider: string, endpoint: string, input: RecordValue) {
    const operation = `${provider}:${endpoint}:${JSON.stringify(input)}`;
    if (operations.has(operation)) return;
    if (calls >= MAX_PROVIDER_CALLS) return;
    operations.add(operation);
    calls++;
    try {
      const result = await client.run(provider, endpoint, input);
      runs.push(result.run);
      if (!result.run.usable) { warnings.push(`${source}: provider returned no usable response.`); return; }
      const output = endpoint === '/scrape' ? { ...object(result.output), url: input.url } : result.output;
      for (const row of normalize(source, output, new Date().toISOString())) {
        const key = row.url.replace(/\/$/, '');
        const existing = evidence.find((e) => e.url.replace(/\/$/, '') === key);
        if (row.scope === 'source_document') {
          pageRetrieval.retrieved.push(row.url);
          if (existing) { Object.assign(existing, row); continue; }
        }
        if (!seen.has(key) && evidence.length < MAX_EVIDENCE) {
          seen.add(key);
          evidence.push({ ...row, id: `e${evidence.length + 1}` });
        }
      }
    } catch {
      warnings.push(`${source}: retrieval failed or timed out. Charges for this attempt could not be confirmed.`);
    }
  }
  const plan = planQueries(request);
  const query = plan.discovery;
  const searches: Promise<void>[] = [];
  if (request.sources.includes('web')) {
    searches.push(fetchSource('web', 'serper', '/search', { q: query, num: 8 }));
    searches.push(fetchSource('web', 'serper', '/search', { q: plan.counterevidence, num: 5 }));
  }
  if (request.sources.includes('x')) searches.push(fetchSource('x', 'tikhub', '/api/v1/twitter/web/fetch_search_timeline', { keyword: query, search_type: 'Latest' }));
  if (request.sources.includes('reddit')) searches.push(fetchSource('reddit', 'scrapecreators', '/v1/reddit/search', { query, sort: 'relevance', timeframe: 'all', trim: false }));
  // Supplied URLs only select known provider operations; never fetched directly.
  if (request.source_url) {
    const url = new URL(request.source_url);
    const tweet = /\/(?:[^/]+\/)?status\/(\d+)/.exec(url.pathname);
    if (['x.com', 'twitter.com', 'www.x.com', 'www.twitter.com'].includes(url.hostname) && tweet?.[1]) {
      searches.push(fetchSource('x', 'tikhub', '/api/v1/twitter/web/fetch_post_comments', { tweet_id: tweet[1] }));
    } else if (['reddit.com', 'www.reddit.com', 'old.reddit.com'].includes(url.hostname) && /\/comments\/[a-z0-9]+\//i.test(url.pathname)) {
      searches.push(fetchSource('reddit', 'scrapecreators', '/v1/reddit/post/comments', { url: url.href, trim: false }));
    } else if (!request.sources.includes('web') || !fetchableUrl(url.href)) {
      warnings.push('The supplied URL was not directly retrieved; enable web sources for public document retrieval.');
    }
  }
  await Promise.all(searches);
  if (request.sources.includes('web')) {
    // Broaden discovery when keyword search produces little usable coverage.
    if (evidence.filter((e) => e.source === 'web').length < 4) {
      await fetchSource('web', 'exa', '/search', { query: request.claim.slice(0, 500), numResults: 5 });
    }
    if (evidence.filter((e) => e.source === 'web').length < 2 && client instanceof GlasserClient) {
      await fetchSource('web', 'serpapi', '/search?engine=bing', { q: query });
    }
    const pages = selectPages(evidence, request.source_url);
    pageRetrieval.requested = pages;
    if (pages.length) await fetchSource('web', 'exa', '/contents', {
      urls: pages, maxCharacters: 10000, maxAgeHours: 0, livecrawlTimeout: 10000,
    });
    const missing = pages.filter((url) => !pageRetrieval.retrieved.some((p) => p.replace(/\/$/, '') === url.replace(/\/$/, '')));
    // Bounded fallback; no model-generated summaries substituted for source text.
    await Promise.all(missing.slice(0, 2).map((url) => fetchSource('web', 'serper', '/scrape', { url, includeMarkdown: true })));
    pageRetrieval.failed = pages.filter((url) => !pageRetrieval.retrieved.some((p) => p.replace(/\/$/, '') === url.replace(/\/$/, '')));
    for (const url of pageRetrieval.failed) warnings.push(`Full-source retrieval unavailable: ${url}. Only discovery evidence may be available.`);
  }
  // Search results supply discovery; fetch a small number of original discussions.
  const candidates = [...evidence];
  for (const source of ['x', 'reddit'] as const) {
    for (const item of candidates.filter((e) => e.source === source).slice(0, 2)) {
      if (calls >= MAX_PROVIDER_CALLS) break;
      if (source === 'x') {
        const id = /\/status\/(\d+)/.exec(item.url)?.[1];
        if (id) await fetchSource('x', 'tikhub', '/api/v1/twitter/web/fetch_post_comments', { tweet_id: id });
      } else if (new URL(item.url).hostname.endsWith('reddit.com') && item.url.includes('/comments/')) {
        await fetchSource('reddit', 'scrapecreators', '/v1/reddit/post/comments', { url: item.url, trim: false });
      }
    }
  }
  if (!evidence.length) warnings.push('No usable evidence was retrieved; no decisive verdict can be justified.');
  // Documents and short discovery evidence get priority over potentially long social threads.
  evidence.sort((a, b) => Number(b.scope === 'source_document') - Number(a.scope === 'source_document'));
  return { evidence, runs, warnings, queries: request.sources.includes('web') ? [query, plan.counterevidence] : [query], page_retrieval: pageRetrieval };
}
