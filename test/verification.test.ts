import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { loadConfig } from '../src/config.js';
import { createApp } from '../src/app.js';
import { groundAssessment, assess } from '../src/model.js';
import { normalize, retrieve, type ProviderClient } from '../src/providers.js';
import { requestSchema, type Evidence } from '../src/contracts.js';
import { createVerifier } from '../src/service.js';

const config = loadConfig({ ORIGIN_API_KEY: 'test-origin-secret-at-least-24', DEMO_MODE: 'true' });
const evidence: Evidence[] = [{ id: 'e1', source: 'web', url: 'https://example.com/policy',
  retrieved_at: '2026-09-30T00:00:00Z', text: 'Attachments are excluded from export.', scope: 'post' }];
const assessment = {
  verdict: 'refuted', summary: 'Attachments are excluded.',
  atomic_claims: [{ claim: 'All data can be exported.', verdict: 'refuted', explanation: 'Policy excludes attachments.', evidence_ids: ['e1'] }],
  citations: [{ evidence_id: 'e1', quote: 'Attachments are excluded from export.', relation: 'contradicts' }],
  limitations: [], next_steps: [],
};

test('reject fabricated quotations and withhold unsupported decisive verdicts', () => {
  const valid = groundAssessment(assessment, evidence);
  assert.equal(valid.verdict, 'refuted');
  const fabricated = groundAssessment({ ...assessment, citations: [{ ...assessment.citations[0], quote: 'All data can be exported.' }] }, evidence);
  assert.equal(fabricated.verdict, 'insufficient_evidence');
  assert.equal(fabricated.citations.length, 0);
  assert.match(fabricated.summary, /could not be fully grounded/);
});

test('unknown evidence IDs cannot ground an atomic claim', () => {
  const result = groundAssessment({ ...assessment, atomic_claims: [{ ...assessment.atomic_claims[0], evidence_ids: ['invented'] }] }, evidence);
  assert.equal(result.verdict, 'insufficient_evidence');
});

test('refuting an essential component can refute a compound assertion', () => {
  const result = groundAssessment({ ...assessment, atomic_claims: [
    ...assessment.atomic_claims,
    { claim: 'Core records can be exported.', verdict: 'insufficient_evidence', explanation: 'Not supplied.', evidence_ids: [] },
  ] }, evidence);
  assert.equal(result.verdict, 'refuted');
});

test('extract original and quoted X posts, preserve text, and normalize Reddit comments', () => {
  const x = normalize('x', { data: { timeline: [{ tweet_id: '123', text: 'Check this', quoted: { tweet_id: '456', text: 'Original claim', author: { screen_name: 'author' } } }] } }, 'now');
  assert.equal(x.length, 2);
  assert.equal(x[1]?.url, 'https://x.com/author/status/456');
  const reddit = normalize('reddit', { comments: [{ body: 'Firsthand report', permalink: '/r/test/comments/abc/title/comment/def/', author: 'user' }] }, 'now');
  assert.equal(reddit[0]?.scope, 'thread_comment');
  assert.equal(reddit[0]?.author, 'user');
});

test('retrieval caps paid operations and never directly fetches arbitrary source URLs', async () => {
  let calls = 0;
  const provider: ProviderClient = { async run(name, endpoint) {
    calls++;
    return { output: { organic: [{ link: 'https://example.com', title: 'Evidence', snippet: 'Some text' }] },
      run: { provider: name, endpoint, status: 'COMPLETED', charge_usd: '0.0011', usable: true } };
  } };
  const result = await retrieve(requestSchema.parse({ claim: 'A product exports everything', source_url: 'http://127.0.0.1/secrets', sources: ['web'] }), provider);
  assert(calls <= 5);
  assert.match(result.warnings[0] ?? '', /not directly retrieved/);
});

test('empty retrieval produces uncertainty instead of a false verdict', async () => {
  const result = await assess(requestSchema.parse({ claim: 'An unverified claim' }), [], config);
  assert.equal(result.verdict, 'insufficient_evidence');
});

test('Azure v1 uses api-key and deployment name, and grounds model output', async () => {
  let received: { url?: string; key?: string; model?: string } = {};
  const server = createServer(async (req, res) => {
    let data = ''; for await (const chunk of req) data += chunk;
    received = { url: req.url, key: String(req.headers['api-key']), model: JSON.parse(data).model };
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(assessment) } }] }));
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const address = server.address(); assert(address && typeof address !== 'string');
  try {
    const azure = loadConfig({ ORIGIN_API_KEY: config.originKey, AZURE_OPENAI_API_KEY: 'test-model-key',
      AZURE_OPENAI_ENDPOINT: `http://127.0.0.1:${address.port}`, AZURE_OPENAI_DEPLOYMENT: 'my-deployment' });
    const result = await assess(requestSchema.parse({ claim: 'All data can be exported.' }), evidence, azure);
    assert.equal(result.verdict, 'refuted');
    assert.deepEqual(received, { url: '/openai/v1/chat/completions', key: 'test-model-key', model: 'my-deployment' });
  } finally { await new Promise<void>((r) => server.close(() => r())); }
});

test('origin rejects payment-header spoofing, accepts gateway key, validates JSON, and labels demo', async () => {
  const server = createApp(config).listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', r));
  const address = server.address(); assert(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}/v1/verify`;
  const body = JSON.stringify({ claim: 'All data can be exported.' });
  try {
    const spoofed = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-PAYMENT': 'fake' }, body });
    assert.equal(spoofed.status, 401);
    const invalid = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Origin-Key': config.originKey }, body: '{}' });
    assert.equal(invalid.status, 400);
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Origin-Key': config.originKey }, body });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.mode, 'demo');
    assert.equal(result.verdict, 'insufficient_evidence');
    assert.equal(result.research.provider_runs.length, 0);
  } finally { await new Promise<void>((r) => server.close(() => r())); }
});

test('historical requests are rejected rather than silently using current evidence', async () => {
  await assert.rejects(createVerifier(config)(requestSchema.parse({ claim: 'A historical fact', as_of: '2025-01-01T00:00:00Z' })), /Historical/);
});
