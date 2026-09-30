# Facet agent guide

Base URL: `https://facet.hidden-pond-5e6a.workers.dev`

Facet retrieves claim-specific evidence from web, X, and Reddit, then returns a structured assessment. Every production verification costs **$0.05 USDC on Solana mainnet**, including cached requests and inconclusive results. Free documentation and health checks require no wallet.

## Discovery

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/llms.txt` | Documentation index |
| GET | `/agents.md` | This usage guide |
| GET | `/openapi.json` | OpenAPI 3.1 contract |
| GET | `/v1/health` | Readiness, mode, and production payment configuration |
| GET | `/showcase.json` | Curated community examples, inputs, citations, and limitations |
| GET | `/benchmark.json` | All 30 community evaluation attempts, inputs, outcomes, reference labels, and accounting |
| POST | `/v1/verify` | Paid evidence retrieval and assessment |

## Quick start

1. Fetch `/v1/health`. Expect HTTP 200, `ready: true`, and `mode: "live"`. Production `payments` reports network, price, currency, recipient, and configuration status. Readiness checks configuration, not upstream availability. Local origins can return demo mode and have a different health shape.
2. Prepare one precise, checkable claim. Select relevant sources; `web` is usually sufficient for public-document claims. Include context or the original URL when useful.
3. Use an installed pay.sh CLI with a funded mainnet USDC wallet, or implement the Solana MPP challenge flow. See [pay.sh](https://pay.sh) for wallet setup.
4. Submit the JSON and inspect both the findings and research limitations.

```sh
pay curl -i -X POST \
  https://facet.hidden-pond-5e6a.workers.dev/v1/verify \
  -H 'Content-Type: application/json' \
  -d '{"claim":"Apollo 11 landed humans on the Moon in July 1969.","sources":["web"]}'
```

Ordinary HTTP clients receive **402 Payment Required** for a valid unpaid request. The deployed service accepts **Solana MPP**, not arbitrary 402 payment protocols. A compatible client reads the challenge, signs the required payment with its wallet, and resubmits the same request with the protocol's payment credential. `pay curl` handles this exchange. No Facet API key is needed; sending an unrelated bearer key does not pay for verification. Do not put wallet private keys in the JSON request.

Payment settles **before research**. Successful responses include `Payment-Receipt`, `X-Payment-Settlement-Signature`, and `billing.payment`. There are no automatic refunds or paid-response recovery. Preserve receipts and response IDs, especially if a paid research attempt fails.

## Request

`POST /v1/verify` with `Content-Type: application/json`. Maximum JSON body: 16 KB. Unknown properties are rejected.

| Field | Type | Requirement |
| --- | --- | --- |
| `claim` | string | Required, 5–2,000 characters after trimming |
| `context` | string | Optional, up to 4,000 characters |
| `source_url` | URL string | Optional, up to 2,048 characters; use public HTTP(S) document or X/Reddit thread URLs |
| `sources` | string array | Optional evidence channels: where the endpoint may search. `web` = search and documents; `x` = posts and replies; `reddit` = threads and comments. Select 1–3; omit to allow all three. Not provider selection or citation URLs. |
| `as_of` | ISO date-time | Optional; historical verification is unavailable, so omit for ordinary requests |

Enable `web` when providing a document URL. Evidence channels guide retrieval, not a guarantee of coverage. The endpoint chooses provider operations: Serper and Exa for web evidence, TikHub for X, and ScrapeCreators for Reddit. `source_url` is a starting document or discussion; response `evidence[].url` and `citations` identify the material actually retrieved and cited. Up to 12 provider calls and 40 evidence records are used. Retrieved page text can be truncated; inspect its metadata. Typical latency is tens of seconds; allow at least 120 seconds end-to-end for payment, retrieval, and assessment.

## Response

HTTP 200 returns an assessment, which can be inconclusive. Consult OpenAPI for the full schema.

| Field | How to use it |
| --- | --- |
| `id`, `checked_at`, `mode` | Record the result ID and evidence time; reject fictional `demo` results for real claims |
| `verdict`, `summary` | Overall finding and short explanation |
| `atomic_claims` | Findings for individual parts, with referenced evidence IDs |
| `citations` | Exact passages linked by `evidence_id`; relation is `supports`, `contradicts`, or `context` |
| `evidence` | Source URLs, retrieved text, scope, dates, and optional truncation/fingerprint metadata |
| `limitations`, `next_steps` | What remains uncertain and suggested follow-up |
| `research` | Queries, provider outcomes, warnings, page retrieval, and duration |
| `billing` | Fixed collected price, production payment signature, and informational cost estimates |
| `cache` | Hit/miss/coalesced/disabled status, evidence time, age, and expiry |

Verdicts:
- `supported`: retrieved evidence supports the claim.
- `refuted`: retrieved evidence contradicts the claim.
- `mixed`: different parts or evidence point in different directions.
- `insufficient_evidence`: the available evidence does not settle the claim; **do not interpret as false**.
- `not_fact_checkable`: the claim is not amenable to factual verification.

Resolve citation IDs against `evidence`, preserve source links, and read individual findings before repeating a compound claim. Exact quote matching checks provenance, not truth or logical entailment. Repeated source counts do not establish independent corroboration. No image/video authenticity, deepfake detection, or historical as-of verification is provided.

Exact-request cache TTL is normally 900 seconds, with unresolved results capped at 120 seconds. A hit retains the original evidence time and still costs $0.05. `billing.costs` estimates provider costs; it does not change settlement or issue a refund.

## Errors and retries

| Status | Meaning | Action |
| --- | --- | --- |
| 400 | Invalid JSON or request fields | Correct the request |
| 402 | Payment required or credential rejected | Use the compatible payment client; inspect the challenge/error |
| 413 | Body exceeds 16 KB | Reduce the body |
| 422 | Historical verification unavailable | Omit historical `as_of` |
| 500 / 502 | Request or assessment failure | Preserve any payment receipt; inspect failure before retrying |
| 503 | Not configured, payment unavailable, or busy | Check health, back off; honor `Retry-After` if present |

There is no application-level idempotency key. A new paid request, including a retry or cache hit, may incur another $0.05 charge. Do not blindly retry after a timeout or lost response: payment may already have settled. A 200 response with empty evidence or research warnings is a paid inconclusive attempt, not proof the claim is false.
