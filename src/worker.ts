import { DurableObject } from 'cloudflare:workers';
import { createPayKit, Signer, usd } from '@solana/pay-kit';
import { loadConfig } from './config.js';
import { requestSchema, ServiceError } from './contracts.js';
import { createVerifier, ready } from './service.js';
import type { CacheEntry } from './cache-key.js';
import openapi from '../openapi.json';

export interface Env {
  CLAIMCHECK: DurableObjectNamespace<ClaimCheckCoordinator>;
  ASSETS: Fetcher;
  [key: string]: unknown;
  PAYMENT_NETWORK: string;
  PAY_RPC_URL: string;
  PAY_PAYMENT_RECIPIENT: string;
  PAY_OPERATOR_KEYPAIR: string;
  PAY_MPP_CHALLENGE_SECRET: string;
}
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path === '/openapi.json') return json({ ...openapi, servers: [{ url: new URL(request.url).origin }] });
    if (path === '/v1/health' || path === '/v1/verify') {
      // One coordinator provides strong cache consistency and atomic payment replay protection.
      return env.CLAIMCHECK.get(env.CLAIMCHECK.idFromName('coordinator-v1')).fetch(request);
    }
    if (path.startsWith('/v1/')) return json({ error: { code: 'not_found', message: 'Unknown API route.' } }, 404);
    return env.ASSETS.fetch(request);
  },
};

export class ClaimCheckCoordinator extends DurableObject<Env> {
  private verifier?: ReturnType<typeof createVerifier>;
  private payments?: ReturnType<typeof createPayKit>;
  private active = 0;
  private config() {
    const strings = Object.fromEntries(Object.entries(this.env).filter(([, v]) => typeof v === 'string')) as Record<string, string>;
    return loadConfig({ ...strings, ORIGIN_API_KEY: 'worker-internal-no-public-origin-route' });
  }
  private getVerifier() {
    return this.verifier ??= createVerifier(this.config(), undefined, {
      get: async (key) => {
        const entry = await this.ctx.storage.get<CacheEntry<unknown>>(`research:${key}`);
        if (!entry || entry.expires_at <= Date.now()) {
          if (entry) await this.ctx.storage.delete(`research:${key}`);
          return null;
        }
        return entry;
      },
      set: async (entry) => {
        // DO values have a 128KiB limit; don't fail research when a response is larger.
        if (new TextEncoder().encode(JSON.stringify(entry)).length <= 120000) await this.ctx.storage.put(`research:${entry.key}`, entry);
      },
    });
  }
  private getPayments() {
    if (!this.payments) this.payments = (async () => {
      if (!this.env.PAY_OPERATOR_KEYPAIR || !this.env.PAY_MPP_CHALLENGE_SECRET || !this.env.PAY_PAYMENT_RECIPIENT) {
        throw new ServiceError(503, 'payments_not_configured', 'Merchant payment configuration is incomplete.');
      }
      const storage = this.ctx.storage;
      return createPayKit({
        network: this.env.PAYMENT_NETWORK === 'mainnet' ? 'solana_mainnet' : 'solana_localnet',
        rpcUrl: this.env.PAY_RPC_URL,
        operator: { signer: await Signer.json(this.env.PAY_OPERATOR_KEYPAIR), recipient: this.env.PAY_PAYMENT_RECIPIENT },
        accept: ['mpp'], stablecoins: ['USDC'],
        mpp: { challengeBindingSecret: this.env.PAY_MPP_CHALLENGE_SECRET, expiresIn: 300 },
        replayStore: Object.assign({
          get: async (key: string) => (await storage.get(`payment:${key}`)) ?? null,
          put: async (key: string, value: unknown) => { await storage.put(`payment:${key}`, value); },
          delete: async (key: string) => { await storage.delete(`payment:${key}`); },
        }, {
          update: async <T>(key: string, fn: (current: unknown) => { op: string; value?: unknown; result: T }): Promise<T> => {
            return storage.transaction(async (tx) => {
              const change = fn((await tx.get(`payment:${key}`)) ?? null);
              if (change.op === 'set') await tx.put(`payment:${key}`, change.value);
              if (change.op === 'delete') await tx.delete(`payment:${key}`);
              return change.result;
            });
          },
        }),
        pricing: { verify: { amount: usd('0.05', 'USDC'), description: 'Facet verification. Same price for freshness-limited cache hits.' } },
      });
    })().catch((error) => { this.payments = undefined; throw error; });
    return this.payments;
  }
  async fetch(request: Request): Promise<Response> {
    const path = new URL(request.url).pathname;
    try {
      const config = this.config();
      if (path === '/v1/health' && request.method === 'GET') return json({
        service: 'Facet', ready: ready(config), mode: config.demo ? 'demo' : 'live',
        data_provider: config.dataProvider, model_provider: config.modelProvider,
        payments: { network: this.env.PAYMENT_NETWORK, price_usd: '0.05', currency: 'USDC', recipient: this.env.PAY_PAYMENT_RECIPIENT || null,
          configured: Boolean(this.env.PAY_OPERATOR_KEYPAIR && this.env.PAY_MPP_CHALLENGE_SECRET) },
      }, ready(config) ? 200 : 503);
      if (path !== '/v1/verify' || request.method !== 'POST') return json({ error: { code: 'method_not_allowed' } }, 405);
      if (!ready(config)) return json({ error: { code: 'not_configured', message: 'Verification providers are not configured.' } }, 503);
      const content = await request.clone().text();
      if (new TextEncoder().encode(content).length > 16384) return json({ error: { code: 'invalid_body', message: 'Maximum body size is 16KB.' } }, 413);
      let body: unknown;
      try { body = JSON.parse(content); } catch { return json({ error: { code: 'invalid_body', message: 'Provide valid JSON.' } }, 400); }
      const parsed = requestSchema.safeParse(body);
      if (!parsed.success) return json({ error: { code: 'invalid_request', details: parsed.error.issues } }, 400);
      if (parsed.data.as_of && Date.parse(parsed.data.as_of) < Date.now() - 60000) return json({ error: { code: 'historical_verification_unavailable' } }, 422);
      if (this.active >= 4) return json({ error: { code: 'busy', message: 'Retry later.' } }, 503);
      this.active++;
      try {
        const pay = await this.getPayments();
        const result = await pay.requirePayment(request, 'verify');
        if ('respond' in result) return result.respond;
        if (result.status === 402) {
          if (request.headers.get('Authorization')?.startsWith('Payment ')) console.error('Payment credential rejected', { status: result.status });
          return result.response;
        }
        const answer = await this.getVerifier()(parsed.data);
        return result.withSettlement(json({ ...answer, billing: { ...answer.billing,
          network: this.env.PAYMENT_NETWORK, recipient: this.env.PAY_PAYMENT_RECIPIENT,
          payment: result.payment.transaction } }));
      } finally { this.active--; }
    } catch (error) {
      const known = error instanceof ServiceError;
      console.error('Request failed', known ? error.code : 'internal_error');
      return json({ error: { code: known ? error.code : 'request_failed', message: known ? error.message : 'Request failed; retry or contact the operator.' } }, known ? error.status : 500);
    }
  }
}
