import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

const cases = [
  { name: 'x-posting-limits', grok: 'https://x.com/grok/status/2105365806192140296',
    claim: 'According to the X Help Center About X limits, unverified accounts have a daily limit of 50 original posts and 200 replies.',
    source_url: 'https://x.com/POZTIV33/status/2105365646175596649' },
  { name: 'video-authenticity', grok: 'https://x.com/grok/status/2105348060213637256',
    claim: 'The media shared in this X conversation is almost certainly AI-generated because no credible reports confirm a meeting between Lamine Yamal and Mia Khalifa.',
    source_url: 'https://x.com/iamcidixz/status/2105347800120873282' },
  { name: 'iphone-chip-specificity', grok: 'https://x.com/grok/status/2105340893494382722',
    claim: 'The iPhone 17e contains both the Apple C1X modem and the N1 wireless chip.',
    source_url: 'https://x.com/phriend75/status/2105340758496817438' },
  { name: 'cockpit-doors-control', grok: 'https://x.com/grok/status/2105384064039399892',
    claim: 'Permanent reinforced cockpit doors meeting FAA intrusion and ballistic standards were installed across the US commercial fleet by April 9, 2003.',
    source_url: 'https://x.com/facemullet/status/2105383953289146624' },
];
const config = loadConfig({ ...process.env, ORIGIN_API_KEY: randomBytes(32).toString('hex'), DEMO_MODE: 'false' });
const server = createApp(config).listen(0, '127.0.0.1');
await new Promise<void>((resolve) => server.once('listening', resolve));
const address = server.address();
if (!address || typeof address === 'string') throw new Error('No origin address.');
await mkdir('.claimcheck', { recursive: true });
const results = [];
try {
  for (const item of cases.filter((c) => !process.argv.includes('--full-source-retest') || ['iphone-chip-specificity', 'cockpit-doors-control'].includes(c.name))) {
    const started = Date.now();
    const request = { claim: item.claim, source_url: item.source_url, sources: ['web', 'x'] };
    const response = await fetch(`http://127.0.0.1:${address.port}/v1/verify`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Origin-Key': config.originKey },
      body: JSON.stringify(request), signal: AbortSignal.timeout(180_000),
    });
    const result = await response.json();
    if (process.argv.includes('--cache-check')) {
      const repeated = await fetch(`http://127.0.0.1:${address.port}/v1/verify`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Origin-Key': config.originKey }, body: JSON.stringify(request),
      });
      const cached = await repeated.json();
      console.log(JSON.stringify({ repeated_case: item.name, cache: cached.cache, milliseconds: cached.request_duration_ms, costs: cached.billing?.costs }));
    }
    results.push({ ...item, request, status: response.status, result });
    await writeFile(process.argv.includes('--full-source-retest') ? '.claimcheck/full-source-comparisons.json' : '.claimcheck/pitch-comparisons.json', JSON.stringify(results, null, 2));
    console.log(JSON.stringify({ case: item.name, status: response.status, seconds: (Date.now() - started) / 1000,
      verdict: result.verdict, summary: result.summary, atomic_claims: result.atomic_claims,
      page_retrieval: result.research?.page_retrieval,
      citations: result.citations?.map((c: { evidence_id: string; quote: string }) => ({
        ...c, url: result.evidence.find((e: { id: string }) => e.id === c.evidence_id)?.url,
      })), costs: result.billing?.costs, error: result.error }, null, 2));
  }
} finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
