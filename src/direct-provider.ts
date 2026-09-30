import type { Config } from './config.js';
import type { ProviderClient } from './providers.js';

/** Optional BYO vendor keys. Direct vendor costs are not returned by these APIs. */
export class DirectClient implements ProviderClient {
  constructor(private config: Config) {}
  async run(provider: string, endpoint: string, input: Record<string, unknown>) {
    const key = this.config.directKeys[provider as keyof Config['directKeys']];
    if (!key) throw new Error('Direct provider is not configured');
    const urls: Record<string, string> = {
      serper: 'https://google.serper.dev', exa: 'https://api.exa.ai',
      tikhub: 'https://api.tikhub.io', scrapecreators: 'https://api.scrapecreators.com',
    };
    const get = provider === 'tikhub' || provider === 'scrapecreators';
    const url = new URL(`${urls[provider]}${endpoint}`);
    if (get) for (const [k, v] of Object.entries(input)) url.searchParams.set(k, String(v));
    const response = await fetch(url, {
      method: get ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', ...(provider === 'tikhub' ? { Authorization: `Bearer ${key}` } : { [provider === 'serper' ? 'X-API-KEY' : 'x-api-key']: key }) },
      ...(get ? {} : { body: JSON.stringify(input) }), signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) throw new Error('Direct provider failed');
    return { output: await response.json(), run: { provider, endpoint, status: 'COMPLETED', charge_usd: '0', usable: true, cost_unknown: true } };
  }
}
