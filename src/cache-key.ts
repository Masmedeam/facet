import { createHash } from 'node:crypto';
import type { Config } from './config.js';
import type { VerifyRequest } from './contracts.js';

export const RESEARCH_VERSION = 'multi-discovery-v3';
export function cacheKey(request: VerifyRequest, config: Config) {
  // Conservative normalization: do not lowercase or remove punctuation in factual claims.
  const canonical = {
    version: RESEARCH_VERSION, model: config.modelName, provider: config.modelProvider, data_provider: config.dataProvider,
    model_endpoint: config.modelBase, mode: config.demo ? 'demo' : 'live',
    claim: request.claim.normalize('NFC').trim(), context: request.context?.normalize('NFC').trim() ?? '',
    source_url: request.source_url ?? '', as_of: request.as_of ?? '', sources: [...request.sources].sort(),
  };
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}
export interface CacheEntry<T> { key: string; created_at: number; expires_at: number; value: T }
export interface ResearchCache<T> {
  get(key: string): Promise<CacheEntry<T> | null>;
  set(entry: CacheEntry<T>): Promise<void>;
}
