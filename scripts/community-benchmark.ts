import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { cases } from './benchmark-cases.js';
import { normalize } from '../src/providers.js';

const dir = '.claimcheck/community-benchmark';
await mkdir(dir, { recursive: true });
const mode = process.argv[2] ?? 'prepare';
const digest = createHash('sha256').update(JSON.stringify(cases)).digest('hex');
if (mode === 'prepare') {
  let previous: any;
  try { previous = JSON.parse(await readFile(`${dir}/manifest.json`, 'utf8')); } catch {}
  const prepared = [];
  for (const item of cases) {
    const id = item.question_url.split('/').at(-1);
    const capture = JSON.parse(await readFile(`.claimcheck/showcase/thread-${id}.json`, 'utf8'));
    const posts = normalize('x', capture.output, new Date().toISOString());
    const question = posts.find((p) => p.url === item.question_url);
    if (!question || !question.published_at || Date.parse(question.published_at) < Date.parse('2026-09-28T00:00:00Z')) throw new Error(`Missing current question: ${item.id}`);
    prepared.push({ ...item, question: { text: question.text, published_at: new Date(question.published_at).toISOString() }, bot_replies: posts.filter((p) => p.url.startsWith('https://x.com/grok/')).map(({ url, text, published_at }) => ({ url, text, published_at })), request: { claim: item.claim, ...(item.context ? { context: item.context } : {}), source_url: item.question_url, sources: ['web', 'x'] } });
  }
  if (previous) for (const original of previous.cases) {
    const current = prepared.find((p) => p.id === original.id);
    if (!current || JSON.stringify(current) !== JSON.stringify(original)) throw new Error(`Existing frozen input changed: ${original.id}`);
  }
  await writeFile(`${dir}/manifest.json`, JSON.stringify({ frozen_at: previous?.frozen_at ?? new Date().toISOString(), supplemental_frozen_at: previous ? new Date().toISOString() : undefined, original_sha256: previous?.original_sha256 ?? previous?.sha256, original_case_count: previous?.original_case_count ?? previous?.cases.length, sha256: digest, planned_calls: prepared.length, planned_payment_usdc: (prepared.length * .05).toFixed(2), cases: prepared }, null, 2));
  console.log(JSON.stringify({ frozen_cases: prepared.length, conversations: new Set(prepared.map((c) => c.question_url)).size, payment_usdc: (prepared.length * .05).toFixed(2), sha256: digest }));
} else if (mode === 'run') {
  const manifest = JSON.parse(await readFile(`${dir}/manifest.json`, 'utf8'));
  if (manifest.sha256 !== digest) throw new Error('Inputs changed after manifest was frozen');
  for (const item of manifest.cases) {
    try { await readFile(`${dir}/${item.id}.json`, 'utf8'); console.log(`${item.id}: saved attempt retained`); continue; } catch {}
    const started = Date.now();
    let result: any;
    try {
      const { stdout } = await promisify(execFile)('pay', ['curl', '-sS', '-X', 'POST', 'https://facet.hidden-pond-5e6a.workers.dev/v1/verify', '-H', 'Content-Type: application/json', '-d', JSON.stringify(item.request)], { timeout: 180000, maxBuffer: 2 * 1024 * 1024 });
      result = JSON.parse(stdout);
    } catch (error) {
      const failure = error as { stderr?: string; stdout?: string; code?: number };
      result = { error: { code: 'client_failure', message: 'Payment client did not return a usable JSON response.', diagnostic: failure.stderr?.slice(0, 1500), exit_code: failure.code } };
      console.error(failure.stderr ?? 'No payment client diagnostic available');
    }
    await writeFile(`${dir}/${item.id}.json`, JSON.stringify({ ...item, attempted_at: new Date(started).toISOString(), wall_ms: Date.now() - started, result }, null, 2));
    console.log(JSON.stringify({ id: item.id, verdict: result.verdict, summary: result.summary, expected_match: item.expected.includes(result.verdict), seconds: result.request_duration_ms / 1000, documents: result.evidence?.filter((e: any) => e.scope === 'source_document').length, payment: result.billing?.payment, warnings: result.research?.warnings, error: result.error }));
    if (result.error && !process.argv.includes('--continue-rejected')) throw new Error('Saved failure; stop paid batch for inspection before any further charges');
  }
} else if (mode === 'publish') {
  const manifest = JSON.parse(await readFile(`${dir}/manifest.json`, 'utf8'));
  const rows = [];
  for (const item of manifest.cases) {
    const capture = JSON.parse(await readFile(`${dir}/${item.id}.json`, 'utf8'));
    const r = capture.result;
    const costs = r.billing?.costs;
    const citations = r.citations ?? [];
    const matched = citations.filter((c: any) => r.evidence?.some((e: any) => e.id === c.evidence_id && e.text.includes(c.quote))).length;
    rows.push({ ...item, attempted_at: capture.attempted_at, wall_ms: capture.wall_ms, expected_match: item.expected.includes(r.verdict), quote_audit: { citations: citations.length, exact_matches: matched, all_match: citations.length > 0 && citations.length === matched }, response: { id: r.id, checked_at: r.checked_at, verdict: r.verdict, summary: r.summary, atomic_claims: r.atomic_claims, limitations: r.limitations, next_steps: r.next_steps, citations: r.citations?.map((c: any) => ({ ...c, url: r.evidence?.find((e: any) => e.id === c.evidence_id)?.url })), evidence: r.evidence?.map((e: any) => ({ id: e.id, source: e.source, url: e.url, title: e.title, scope: e.scope, content_truncated: e.content_truncated, retrieved_at: e.retrieved_at, text: e.text })), warnings: r.research?.warnings, duration_ms: r.request_duration_ms, cache: r.cache, provider_runs: r.research?.provider_runs, settlement: r.billing?.payment, costs: costs ? { retrieval_reported_usd: costs.glasser_reported_usd, model_estimated_usd: costs.azure_estimated_usd, accounting_complete: costs.accounting_complete } : null, error: r.error } });
  }
  const ordered = rows.map((c) => c.response.duration_ms).filter((v) => typeof v === 'number').sort((a,b) => a-b);
  const chain = JSON.parse(await readFile(`${dir}/chain-settlements.json`, 'utf8'));
  const summary = { attempted: rows.length, completed: rows.filter((c) => c.response.verdict).length, conversations: new Set(rows.map((c) => c.question_url)).size, paid_calls_with_receipt: rows.filter((c) => c.response.settlement).length, settled_usdc: (rows.filter((c) => c.response.settlement).length * .05).toFixed(2), wallet_before_usdc: '4.75', wallet_after_usdc: '3.40', observed_wallet_spend_usdc: '1.35', unreceipted_wallet_delta_usdc: '0.30', payment_note: 'Wallet balance fell by $1.35 during this run, while captured response receipts account for $1.05. The $0.30 discrepancy is unresolved; do not equate missing responses with unpaid attempts.', expected_label_matches: rows.filter((c) => c.expected_match).length, expected_label_total: rows.length, completed_label_total: rows.filter((c) => c.response.verdict).length, quote_citations: rows.reduce((s,c) => s+c.quote_audit.citations,0), quote_exact_matches: rows.reduce((s,c) => s+c.quote_audit.exact_matches,0), with_grounding_notice: rows.filter((c) => /could not be fully grounded/i.test(c.response.summary ?? '')).length, median_ms: ordered[Math.floor(ordered.length / 2)], p90_ms: ordered[Math.ceil(ordered.length * .9) - 1], with_full_documents: rows.filter((c) => c.response.evidence?.some((e: any) => e.scope === 'source_document')).length, with_warnings: rows.filter((c) => c.response.warnings?.length).length, retrieval_reported_usd: rows.reduce((s,c) => s + Number(c.response.costs?.retrieval_reported_usd ?? 0), 0).toFixed(6), model_estimated_usd: rows.reduce((s,c) => s + Number(c.response.costs?.model_estimated_usd ?? 0), 0).toFixed(6), verdicts: Object.fromEntries([...new Set(rows.map((c) => c.response.verdict ?? 'client_failure'))].map((v) => [v, rows.filter((c) => (c.response.verdict ?? 'client_failure') === v).length])) };
  summary.payment_note = 'Chain audit confirms 27 customer USDC debits of $0.05 ($1.35 total). Response receipts account for 21 ($1.05). Six settled attempts did not yield a usable captured response; three did not settle. Individual missing-response transfers are published but not assigned to cases without receipts.';
  await writeFile('public/benchmark.json', JSON.stringify({ service: 'Facet', version: 'community-v1', published_at: new Date().toISOString(), manifest_sha256: manifest.sha256, frozen_at: manifest.frozen_at, supplemental_frozen_at: manifest.supplemental_frozen_at, original_sha256: manifest.original_sha256, original_case_count: manifest.original_case_count, question_window: 'September 28–30, 2026 UTC', methodology: '30 assertion-level checks drawn from current public X conversations discovered and inspected before endpoint testing. Original block: 24; supplemental block: 6 different assertions frozen after the original run, with its failures retained. Some inputs are extracted assertions or explicitly identified inference probes, rather than literal user questions. Expected labels and reference rationale were frozen before the corresponding paid calls. All first attempts are published, including mismatches, warnings and inconclusive results. Expected-label agreement is a diagnostic against author-assigned provisional references, not independently adjudicated accuracy or a controlled Grok comparison. Reference pages are a mixture of audited full documents and discovery-only leads; per-case reference_basis states which. Exact quote provenance is auditable from captured source text, but does not establish entailment or source truth.', summary: { ...summary, chain_confirmed_calls: chain.transfers.length, chain_confirmed_usdc: chain.total_usdc, paid_without_captured_response: chain.transfers.length - summary.paid_calls_with_receipt }, chain_settlements: chain.transfers, cases: rows }, null, 2));
  console.log(JSON.stringify(summary, null, 2));
}
