import { test } from 'node:test';
import assert from 'node:assert/strict';
import { retrieve, normalize } from '../src/providers.js';
import { requestSchema } from '../src/contracts.js';
import { fetchableUrl, planQueries } from '../src/research-plan.js';

test('source documents replace snippets and expose text, metadata, and content fingerprints', async () => {
  const calls: string[] = [];
  const result = await retrieve(requestSchema.parse({ claim: 'FAA doors comply with ballistic standards', sources: ['web'] }), {
    async run(provider, endpoint) {
      calls.push(endpoint);
      const output = endpoint === '/search'
        ? { organic: [{ link: 'https://www.faa.gov/doors', title: 'FAA door rule', snippet: 'Doors resist intrusion.' }] }
        : { results: [{ url: 'https://www.faa.gov/doors', title: 'Door rule', publishedDate: '2002-01-11', text: 'Doors resist intrusion and small arms fire or fragmentation.' }] };
      return { output, run: { provider, endpoint, status: 'COMPLETED', charge_usd: '0.0011', usable: true } };
    },
  });
  assert.equal(result.evidence.length, 1);
  assert.equal(result.evidence[0]?.scope, 'source_document');
  assert.match(result.evidence[0]?.text ?? '', /small arms fire/);
  assert.equal(result.evidence[0]?.content_sha256?.length, 64);
  assert.equal(result.evidence[0]?.published_at, '2002-01-11');
  assert.deepEqual(calls, ['/search', '/search', '/search', '/contents']);
  assert.equal(result.page_retrieval.failed.length, 0);
});

test('semantic discovery preserves titles as snippets and second-engine results normalize without inventing page text', () => {
  const semantic = normalize('web', { results: [{ url: 'https://example.org/paper', title: 'A primary paper', publishedDate: '2020-01-01' }] }, '2026-09-30T00:00:00Z');
  assert.equal(semantic[0]?.scope, 'search_snippet');
  assert.equal(semantic[0]?.text, 'A primary paper');
  const bing = normalize('web', { organic_results: [{ link: 'https://example.org/other', title: 'Another source', snippet: 'A contradictory observation.' }] }, '2026-09-30T00:00:00Z');
  assert.match(bing[0]?.text ?? '', /contradictory observation/);
  assert.equal(bing[0]?.scope, 'search_snippet');
});

test('failed batch retrieval falls back to readable source text', async () => {
  const result = await retrieve(requestSchema.parse({ claim: 'Vendor export includes everything', sources: ['web'] }), {
    async run(provider, endpoint) {
      const output = endpoint === '/search' ? { organic: [{ link: 'https://vendor.example.com/policy', snippet: 'Policy' }] }
        : endpoint === '/contents' ? { results: [] } : { text: 'Exports exclude attachments.' };
      return { output, run: { provider, endpoint, status: 'COMPLETED', charge_usd: '0.0011', usable: true } };
    },
  });
  assert.equal(result.evidence[0]?.retrieval_provider, 'serper');
  assert.equal(result.evidence[0]?.scope, 'source_document');
});

test('reject local/IP crawler targets and remove claim polarity from discovery', () => {
  for (const url of ['http://127.0.0.1/', 'http://[::1]/', 'https://localhost/', 'http://metadata.google.internal/', 'http://site.local/', 'https://example.com:8080/']) {
    assert.equal(fetchableUrl(url), undefined);
  }
  assert.equal(fetchableUrl('https://www.faa.gov/rule#section'), 'https://www.faa.gov/rule');
  const query = planQueries(requestSchema.parse({ claim: 'FundingPips has never denied a single payout.' }));
  assert(!query.discovery.includes('never'));
  assert.match(query.counterevidence, /exceptions limitations/);
});
