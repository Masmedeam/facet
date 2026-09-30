import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/config.js';
import { modelCost, parseUsage, costBreakdown } from '../src/costs.js';

const config = loadConfig({ ORIGIN_API_KEY: 'cost-test-key-at-least-24-characters',
  MODEL_INPUT_USD_PER_MILLION: '0.2', MODEL_CACHED_INPUT_USD_PER_MILLION: '0.02', MODEL_OUTPUT_USD_PER_MILLION: '1.2' });
test('cached input and reasoning tokens are not charged twice', () => {
  const usage = parseUsage({ prompt_tokens: 10000, completion_tokens: 1000,
    prompt_tokens_details: { cached_tokens: 5000 }, completion_tokens_details: { reasoning_tokens: 700 } });
  assert.equal(modelCost(usage, config), '0.002300000');
  const costs = costBreakdown(0.0044, usage, config, true, false);
  assert.equal(costs.suggested_cost_plus_price_usd, '0.011700');
});
test('unknown usage/rates/charges produce unknown totals rather than free inference', () => {
  assert.equal(modelCost(null, config), null);
  assert.equal(parseUsage({ prompt_tokens: 1, completion_tokens: 1, prompt_tokens_details: { cached_tokens: 2 } }), null);
  assert.equal(costBreakdown(0.001, null, config, false, false).suggested_cost_plus_price_usd, null);
});
