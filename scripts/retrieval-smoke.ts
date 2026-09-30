import { mkdir, writeFile } from 'node:fs/promises';
import { GlasserClient, normalize } from '../src/providers.js';
import { loadConfig } from '../src/config.js';

await mkdir('.claimcheck/provider-smoke', { recursive: true });
const client = new GlasserClient(loadConfig({ ...process.env, ORIGIN_API_KEY: 'retrieval-smoke-local-only-key' }));
for (const provider of ['exa', 'serpapi']) {
  const endpoint = provider === 'exa' ? '/search' : '/search?engine=bing';
  const input = provider === 'exa' ? { query: 'NASA Apollo 11 first Moon landing July 20 1969', numResults: 3 } : { q: 'NASA Apollo 11 July 20 1969' };
  const result = await client.run(provider, endpoint, input);
  const evidence = normalize('web', result.output, new Date().toISOString());
  await writeFile(`.claimcheck/provider-smoke/${provider}.json`, JSON.stringify(result, null, 2));
  if (!result.run.usable || !evidence.length) throw new Error(`${provider} returned no usable discovery evidence`);
  console.log(JSON.stringify({ provider, run: result.run, evidence: evidence.map(({ url, scope }) => ({ url, scope })) }));
}
