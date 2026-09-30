import { writeFile } from 'node:fs/promises';
const rpc = async (method: string, params: unknown[]) => {
  const r = await fetch('https://solana-rpc.publicnode.com', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  const body = await r.json() as { result: any; error?: unknown };
  if (body.error) throw new Error(JSON.stringify(body.error));
  return body.result;
};
const customer = '3opQjQoL2rK3NxAULkkEsHGu8PQgT8cYEX7efpYxmqZ5';
const recipient = 'EGHfMz8SLAPAby86uY1Zf1QM1iSNKweNTXUiLH73EaQX';
const entries = await rpc('getSignaturesForAddress', [recipient, { limit: 40 }]);
const transfers = [];
for (const entry of entries.filter((e: any) => !e.err && e.blockTime >= Date.parse('2026-09-30T21:30:00Z') / 1000)) {
  const tx = await rpc('getTransaction', [entry.signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, commitment: 'confirmed' }]);
  if (!tx?.meta || tx.meta.err) continue;
  const before = tx.meta.preTokenBalances.find((b: any) => b.owner === customer);
  const after = tx.meta.postTokenBalances.find((b: any) => b.owner === customer);
  if (before && after) {
    const delta = (Number(before.uiTokenAmount.amount) - Number(after.uiTokenAmount.amount)) / 1e6;
    if (delta > 0) transfers.push({ signature: entry.signature, timestamp: new Date(entry.blockTime * 1000).toISOString(), customer_usdc_debit: delta });
  }
}
await writeFile('.claimcheck/community-benchmark/chain-settlements.json', JSON.stringify({ customer, recipient, transfers, total_usdc: transfers.reduce((s, t) => s + t.customer_usdc_debit, 0).toFixed(2) }, null, 2));
console.log(JSON.stringify({ count: transfers.length, total_usdc: transfers.reduce((s,t) => s+t.customer_usdc_debit,0).toFixed(2) }));
