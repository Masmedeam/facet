import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

const allCases = [
  { name: 'commercial-universal', body: { claim: 'FundingPips has never denied a single payout.', source_url: 'https://x.com/risers343/status/2033028565550379505', sources: ['x'] } },
  { name: 'true-basic-fact', body: { claim: 'Apollo 11 landed humans on the Moon in July 1969.', sources: ['web'] } },
  { name: 'false-basic-fact', body: { claim: 'Apollo 11 landed humans on Mars in July 1969.', sources: ['web'] } },
  { name: 'scientific-causality', body: { claim: 'The sunscreen study proves that sunscreen causes cancer.', source_url: 'https://x.com/robbdavis/status/2080292487424585990', sources: ['web', 'x'] } },
  { name: 'opinion', body: { claim: 'Blue is the most beautiful color.', sources: ['web'] } },
  { name: 'invalid-body', body: { claim: 'x' } },
  { name: 'historical', body: { claim: 'Apollo 11 landed on the Moon.', as_of: '2020-01-01T00:00:00Z' } },
];
const cases = process.argv.includes('--retest') ? allCases.filter((c) => c.name === 'false-basic-fact') : allCases;
const config = loadConfig({ ...process.env, ORIGIN_API_KEY: randomBytes(32).toString('hex'), DEMO_MODE: 'false' });
const server = createApp(config).listen(0, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const address = server.address();
if (!address || typeof address === 'string') throw new Error('No listening address.');
const results: unknown[] = [];
try {
  // Sequential to bound spend and make individual timings readable.
  for (const item of cases) {
    const started = Date.now();
    const response = await fetch(`http://127.0.0.1:${address.port}/v1/verify`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Origin-Key': config.originKey },
      body: JSON.stringify(item.body), signal: AbortSignal.timeout(180_000),
    });
    const result = await response.json();
    results.push({ name: item.name, request: item.body, status: response.status, result });
    console.log(JSON.stringify({ case: item.name, status: response.status, seconds: (Date.now() - started) / 1000,
      verdict: result.verdict, evidence: result.evidence?.length, citations: result.citations?.length,
      summary: result.summary, costs: result.billing?.costs, error: result.error }));
  }
} finally {
  await new Promise<void>((r) => server.close(() => r()));
  await mkdir('.claimcheck', { recursive: true });
  const path = process.argv.includes('--retest') ? '.claimcheck/endpoint-retest.json' : '.claimcheck/endpoint-tests.json';
  await writeFile(path, JSON.stringify(results, null, 2));
  console.log(`Full results saved to ${path}. These calls exercised the authenticated origin; payment handshake is tested separately.`);
}
