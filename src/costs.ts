import type { Config } from './config.js';

export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  cached_input_tokens: number;
  reasoning_tokens: number;
}
export function parseUsage(raw: unknown): TokenUsage | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const input = row.prompt_tokens;
  const output = row.completion_tokens;
  if (!Number.isSafeInteger(input) || !Number.isSafeInteger(output) || Number(input) < 0 || Number(output) < 0) return null;
  const cached = (row.prompt_tokens_details as Record<string, unknown> | undefined)?.cached_tokens ?? 0;
  const reasoning = (row.completion_tokens_details as Record<string, unknown> | undefined)?.reasoning_tokens ?? 0;
  if (!Number.isSafeInteger(cached) || Number(cached) < 0 || Number(cached) > Number(input)) return null;
  return { prompt_tokens: Number(input), completion_tokens: Number(output), cached_input_tokens: Number(cached),
    reasoning_tokens: Number.isSafeInteger(reasoning) ? Number(reasoning) : 0 };
}
export function modelCost(usage: TokenUsage | null, config: Config): string | null {
  if (!usage || config.inputRate === undefined || config.outputRate === undefined) return null;
  // Cached tokens are a subset of prompt tokens; reasoning is already in completion tokens.
  if (usage.cached_input_tokens && config.cachedInputRate === undefined) return null;
  return (((usage.prompt_tokens - usage.cached_input_tokens) * config.inputRate
    + usage.cached_input_tokens * (config.cachedInputRate ?? config.inputRate)
    + usage.completion_tokens * config.outputRate) / 1_000_000).toFixed(9);
}
export function costBreakdown(glasser: number, usage: TokenUsage | null, config: Config, complete: boolean, demo: boolean) {
  const azure = demo ? '0.000000000' : modelCost(usage, config);
  const total = azure !== null && complete ? glasser + Number(azure) : null;
  return {
    glasser_reported_usd: glasser.toFixed(6),
    azure_estimated_usd: azure,
    azure_usage: usage,
    azure_rates_usd_per_million: { input: config.inputRate ?? null, cached_input: config.cachedInputRate ?? null, output: config.outputRate ?? null },
    accounting_complete: complete && azure !== null,
    estimated_provider_total_usd: total?.toFixed(9) ?? null,
    service_fee_usd: config.serviceFee.toFixed(6),
    suggested_cost_plus_price_usd: total === null ? null : (Math.ceil((total + config.serviceFee) * 1_000_000 - 1e-9) / 1_000_000).toFixed(6),
    basis: 'Glasser reported charges plus Azure reported token usage at configured rates. Excludes hosting, network/payment fees, taxes, and failed calls with unknown charges.',
  };
}
