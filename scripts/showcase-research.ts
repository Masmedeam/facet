import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { loadConfig } from '../src/config.js';
import { GlasserClient, normalize } from '../src/providers.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import assert from 'node:assert/strict';

const config = loadConfig({ ...process.env, ORIGIN_API_KEY: 'showcase-research-local-only-key' });
const client = new GlasserClient(config);
const dir = '.claimcheck/showcase';
await mkdir(dir, { recursive: true });
const mode = process.argv[2] ?? 'discover';
if (mode === 'pages') {
  const urls = process.argv.slice(3);
  for (let i = 0; i < urls.length; i += 4) {
    const result = await client.run('exa', '/contents', { urls: urls.slice(i, i + 4), maxCharacters: 10000, maxAgeHours: 0 });
    const name = `reference-pages-${Date.now()}-${i}`;
    await writeFile(`${dir}/${name}.json`, JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ name, run: result.run, pages: normalize('web', result.output, new Date().toISOString()).map(({ url, text }) => ({ url, text: text.slice(0, 9500) })) }, null, 2));
  }
} else if (mode === 'web-audit') {
  for (const [i, q] of process.argv.slice(3).entries()) {
    const result = await client.run('serper', '/search', { q, num: 5 });
    const name = `reference-${Date.now()}-${i}`;
    await writeFile(`${dir}/${name}.json`, JSON.stringify({ q, ...result }, null, 2));
    console.log(JSON.stringify({ name, q, run: result.run, evidence: normalize('web', result.output, new Date().toISOString()).map(({ url, text }) => ({ url, text })) }, null, 2));
  }
} else if (mode === 'search') {
  for (const [i, keyword] of process.argv.slice(3).entries()) {
    const result = await client.run('tikhub', '/api/v1/twitter/web/fetch_search_timeline', { keyword, search_type: 'Latest' });
    const name = `focused-${Date.now()}-${i}`;
    await writeFile(`${dir}/${name}.json`, JSON.stringify({ keyword, ...result }, null, 2));
    const posts = normalize('x', result.output, new Date().toISOString()).filter((p) => p.published_at && Date.parse(p.published_at) >= Date.parse('2026-09-28T00:00:00Z') && Date.parse(p.published_at) < Date.parse('2026-10-01T00:00:00Z'));
    console.log(JSON.stringify({ name, keyword, run: result.run, posts: posts.map(({ url, text, published_at }) => ({ url, text: text.slice(0, 1100), published_at })) }, null, 2));
  }
} else if (mode === 'candidates') {
  const queries = [
    '@grok ("wrong" OR "incorrect" OR "outdated" OR "hallucinating") since:2026-09-28 until:2026-10-01 -from:grok',
    'from:grok ("correction" OR "apologize" OR "mistake" OR "outdated") since:2026-09-28 until:2026-10-01',
    '@grok ("verify" OR "true" OR "sources") (privacy OR court OR regulation OR ban) since:2026-09-28 until:2026-10-01 -from:grok',
    '@grok ("true" OR "check" OR "verify") (study OR cancer OR vaccine OR treatment) since:2026-09-28 until:2026-10-01 -from:grok',
    '@grok ("true" OR "verify" OR "correct") (iPhone OR chip OR battery OR launch) since:2026-09-28 until:2026-10-01 -from:grok',
    '@grok ("true" OR "verify" OR "source") (inflation OR jobs OR tariffs OR unemployment) since:2026-09-28 until:2026-10-01 -from:grok',
    '@grok ("true" OR "verify" OR "sources") (energy OR climate OR nuclear OR electricity) since:2026-09-28 until:2026-10-01 -from:grok',
    '@grok ("wrong" OR "check" OR "confirm") (OpenAI OR AI OR model OR data) since:2026-09-28 until:2026-10-01 -from:grok',
    'from:grok ("unable to verify" OR "cannot confirm" OR "unverified" OR "no reliable") since:2026-09-28 until:2026-10-01',
    '@grok ("dig deeper" OR "source please" OR "not true" OR "made up") since:2026-09-28 until:2026-10-01 -from:grok',
    '@grok ("verify" OR "true") (subscription OR export OR security OR breach) since:2026-09-28 until:2026-10-01 -from:grok',
    '@grok ("true" OR "verify") (Starship OR Artemis OR NASA OR satellite) since:2026-09-28 until:2026-10-01 -from:grok',
  ];
  for (const [i, keyword] of queries.entries()) {
    const result = await client.run('tikhub', '/api/v1/twitter/web/fetch_search_timeline', { keyword, search_type: 'Latest' });
    await writeFile(`${dir}/candidate-search-${i}.json`, JSON.stringify({ keyword, ...result }, null, 2));
    const posts = normalize('x', result.output, new Date().toISOString()).filter((p) => p.published_at && Date.parse(p.published_at) >= Date.parse('2026-09-28T00:00:00Z') && Date.parse(p.published_at) < Date.parse('2026-10-01T00:00:00Z'));
    console.log(JSON.stringify({ query: keyword, run: result.run, posts: posts.map(({ url, text, published_at }) => ({ url, text, published_at })) }, null, 2));
  }
} else if (mode === 'discover') {
  const queries = [
    '@grok ("is this true" OR "fact check") since:2026-09-28 until:2026-10-01 -from:grok',
    '@grok ("verify" OR "source") (health OR study OR science) since:2026-09-28 until:2026-10-01 -from:grok',
    '@grok ("true" OR "correct") (Apple OR iPhone OR privacy OR policy) since:2026-09-28 until:2026-10-01 -from:grok',
    'from:grok ("cannot verify" OR "insufficient" OR "no evidence") since:2026-09-28 until:2026-10-01',
    '@grok ("true" OR "fact check") (NASA OR energy OR climate OR economy) since:2026-09-28 until:2026-10-01 -from:grok',
    'from:grok ("correction" OR "you’re right" OR "my mistake") since:2026-09-28 until:2026-10-01',
  ];
  for (const [i, keyword] of queries.entries()) {
    const result = await client.run('tikhub', '/api/v1/twitter/web/fetch_search_timeline', { keyword, search_type: 'Latest' });
    await writeFile(`${dir}/search-${i}.json`, JSON.stringify({ keyword, ...result }, null, 2));
    console.log(JSON.stringify({ query: keyword, run: result.run, posts: normalize('x', result.output, new Date().toISOString()).map(({ url, text, published_at }) => ({ url, text, published_at })) }, null, 2));
  }
} else if (mode === 'threads') {
  for (const id of process.argv.slice(3)) {
    const result = await client.run('tikhub', '/api/v1/twitter/web/fetch_post_comments', { tweet_id: id });
    await writeFile(`${dir}/thread-${id}.json`, JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ id, run: result.run, posts: normalize('x', result.output, new Date().toISOString()).map(({ url, text, published_at }) => ({ url, text, published_at })) }, null, 2));
  }
} else if (mode === 'verify') {
  const cases = [
    { slug: 'car-privacy', source_url: 'https://x.com/SacredGeoInt/status/2105052397634486484', claim: 'A 2023 Ninth Circuit dismissal of privacy lawsuits against Honda, Toyota, Volkswagen, and GM established that automakers can legally intercept all private texts and call logs as soon as a phone connects to a car.', context: 'Distinguish plaintiff allegations, the specific Washington Privacy Act civil injury requirement, and what the court actually decided from a blanket authorization. This is a factual assessment of a ruling, not legal advice.' },
    { slug: 'iphone-chips', source_url: 'https://x.com/phriend75/status/2105340758496817438', claim: 'The iPhone 17e contains both the Apple C1X modem and the N1 wireless chip.', context: 'Check the specific 17e model against manufacturer specifications; distinguish lack of evidence from proof a chip is absent. Do not assess unrelated surveillance claims.' },
    { slug: 'bee-venom', source_url: 'https://x.com/NotFarLeftAtAll/status/2105319972666826971', claim: 'A 2020 study found that honeybee venom or melittin killed aggressive breast cancer cells within 60 minutes, establishing a proven treatment for breast cancer in humans.', context: 'Separate cell-culture and animal findings from human clinical efficacy. The human-treatment clause is a verification probe, not a quotation of the user or Grok, whose reply explicitly says this is preclinical.' },
  ];
  for (const item of cases) {
    const body = { claim: item.claim, context: item.context, source_url: item.source_url, sources: ['web', 'x'] };
    const { stdout } = await promisify(execFile)('pay', ['curl', '-sS', '-X', 'POST', 'https://facet.hidden-pond-5e6a.workers.dev/v1/verify', '-H', 'Content-Type: application/json', '-d', JSON.stringify(body)], { timeout: 180000, maxBuffer: 2 * 1024 * 1024 });
    const result = JSON.parse(stdout);
    await writeFile(`${dir}/verify-${item.slug}.json`, JSON.stringify({ ...item, request: body, result }, null, 2));
    console.log(JSON.stringify({ slug: item.slug, id: result.id, verdict: result.verdict, summary: result.summary, atomic_claims: result.atomic_claims, limitations: result.limitations, warnings: result.research?.warnings, payment: result.billing?.payment, seconds: result.request_duration_ms / 1000, citations: result.citations?.map((c: { evidence_id: string }) => ({ ...c, source: result.evidence.find((e: { id: string }) => e.id === c.evidence_id)?.url })), costs: result.billing?.costs }, null, 2));
  }
} else if (mode === 'audit') {
  const showcase = JSON.parse(await readFile('public/showcase.json', 'utf8'));
  for (const item of showcase.cases) {
    const captured = JSON.parse(await readFile(`${dir}/verify-${item.slug}.json`, 'utf8'));
    assert.deepEqual(item.request, captured.request);
    assert.equal(item.result.id, captured.result.id);
    assert.equal(item.result.verdict, captured.result.verdict);
    assert.equal(item.result.payment, captured.result.billing.payment);
    assert.equal(item.result.duration_ms, captured.result.request_duration_ms);
    for (const citation of item.result.citations) {
      assert.ok(captured.result.citations.some((c: { quote: string; evidence_id: string }) => c.quote === citation.quote && captured.result.evidence.some((e: { id: string; url: string; text: string }) => e.id === c.evidence_id && e.url === citation.url && e.text.includes(c.quote))), `${item.slug}: citation must match captured quote and source text`);
    }
    const id = item.question_url.split('/').at(-1);
    const thread = JSON.parse(await readFile(`${dir}/thread-${id}.json`, 'utf8'));
    const posts = normalize('x', thread.output, new Date().toISOString());
    const question = posts.find((p) => p.url === item.question_url);
    assert.ok(question?.text.includes(item.question_quote));
    assert.equal(new Date(question!.published_at!).toISOString(), new Date(item.question_date).toISOString());
    assert.ok(posts.some((p) => p.url === item.grok_reply_url && p.text.includes(item.grok_reply_quote)));
    console.log(`${item.slug}: request, timing, settlement, source quotes, X prompt, date and Grok excerpt match saved captures`);
  }
} else if (mode === 'digest') {
  for (let i = 0; i < 12; i++) {
    const result = JSON.parse(await readFile(`${dir}/candidate-search-${i}.json`, 'utf8'));
    const posts = normalize('x', result.output, new Date().toISOString()).filter((p) => p.published_at && Date.parse(p.published_at) >= Date.parse('2026-09-28T00:00:00Z') && Date.parse(p.published_at) < Date.parse('2026-10-01T00:00:00Z'));
    console.log(JSON.stringify({ search: i, posts: posts.map(({ url, text, published_at }) => ({ url, text: text.slice(0, 1000), published_at })) }, null, 2));
  }
} else if (mode === 'inspect') {
  for (const name of process.argv.slice(3)) {
    const result = JSON.parse(await readFile(`${dir}/${name}.json`, 'utf8'));
    console.log(JSON.stringify(normalize('x', result.output, new Date().toISOString()).map(({ url, text, published_at }) => ({ url, text, published_at })), null, 2));
  }
}
