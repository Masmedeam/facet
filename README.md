<p align="center"><img src="public/logo.svg" width="72" height="72" alt="Facet logo"></p>
<h1 align="center">Facet</h1>
<p align="center">More evidence. Better answers.</p>
<p align="center"><a href="https://facet.hidden-pond-5e6a.workers.dev">Try Facet</a> · <a href="https://facet.hidden-pond-5e6a.workers.dev/#benchmark">Explore the evaluation</a> · <a href="https://facet.hidden-pond-5e6a.workers.dev/agents.md">Agent guide</a></p>

Facet is a paid claim-verification API for agents. It retrieves source documents and public discussions, assesses individual assertions, and returns exact quotations, source links, and explicit uncertainty.

## Try the API

Each production request costs **$0.05 USDC on Solana mainnet**, including cache hits and inconclusive findings. Documentation and health checks are free. Use an installed [pay.sh](https://pay.sh) CLI with a funded mainnet wallet:

```sh
brew install pay
pay curl -i -X POST https://facet.hidden-pond-5e6a.workers.dev/v1/verify \
  -H 'Content-Type: application/json' \
  -d '{"claim":"An H.264 codec in a shared iPhone video conclusively proves Most Compatible was used at capture time.","sources":["web"],"source_url":"https://support.apple.com/en-us/116944"}'
```

No Facet account or API key is required. The deployed service accepts **Solana MPP**; `pay curl` handles the HTTP 402 exchange. Payment settles before research. Preserve the response receipt and `billing.payment` signature. There are no automatic refunds or paid-response recovery; a timeout or retry may occur after settlement.

| Endpoint | Purpose |
| --- | --- |
| [`GET /llms.txt`](https://facet.hidden-pond-5e6a.workers.dev/llms.txt) | Agent discovery |
| [`GET /agents.md`](https://facet.hidden-pond-5e6a.workers.dev/agents.md) | Requests, payments, interpretation and retries |
| [`GET /docs.html`](https://facet.hidden-pond-5e6a.workers.dev/docs.html) | Human-readable API guide |
| [`GET /openapi.json`](https://facet.hidden-pond-5e6a.workers.dev/openapi.json) | OpenAPI 3.1 contract |
| [`GET /v1/health`](https://facet.hidden-pond-5e6a.workers.dev/v1/health) | Readiness and payment configuration |
| `POST /v1/verify` | Paid evidence retrieval and assessment |
| [`GET /benchmark.json`](https://facet.hidden-pond-5e6a.workers.dev/benchmark.json) | All community evaluation attempts |
| [`GET /showcase.json`](https://facet.hidden-pond-5e6a.workers.dev/showcase.json) | Featured examples and captured citations |

## Request and response

Send JSON up to 16 KB. `claim` is required (5–2,000 characters). Optional fields: `context` (4,000 characters), `source_url` (2,048 characters), and `sources`. **`sources` selects evidence channels**, not providers: `web` for search/documents, `x` for posts/replies, `reddit` for threads/comments. Omit it to allow all three. Historical `as_of` verification is unavailable.

Responses include:

- `verdict`: `supported`, `refuted`, `mixed`, `insufficient_evidence`, or `not_fact_checkable`.
- `atomic_claims`, `citations`, `evidence`: individual findings, exact passages, source URLs, text, dates and document metadata.
- `limitations`, `next_steps`, `research`: unresolved issues, queries, provider outcomes and retrieval warnings.
- `cache`, `billing`: evidence freshness, fixed access price, informational cost estimates and settlement signature.

The verifier uses at most 12 provider operations, four selected pages and 40 evidence records. Text may be truncated. Missing evidence does not mean false. Quotation matching confirms provenance, not source truth or entailment. This is text verification, not image/video forensics.

## Published evaluation

September 30, 2026: **30 first attempts from 22 public X conversations** dated September 28–30. Inputs and provisional references were frozen in two documented blocks before their corresponding paid calls. All outcomes are published.

| Measurement | Result |
| --- | --- |
| Usable assessments | 21 / 30 |
| On-chain payments | 27 × $0.05 = **$1.35** |
| Settled without a usable captured response | 6 |
| Provisional reference-label agreement | 19 / 21 completed; 19 / 30 attempted |
| Exact quotation matches | 101 / 101 |
| Median / p90 server processing | 17.8s / 35.8s |
| Completed responses with retrieval warnings | 7 |

These measure the observed workflow; label agreement is not independently adjudicated accuracy or a controlled Grok comparison. Some inputs are explicitly identified inference probes and several original bot replies already contain the correct distinction. Two label mismatches and one grounding notice remain visible. See [methodology](docs/research/community-benchmark.md) and the [live explorer](https://facet.hidden-pond-5e6a.workers.dev/#benchmark).

## Architecture

```text
Agent → Solana MPP payment → Cloudflare Worker
      → Durable Object: replay protection, bounded concurrency, cache
      → evidence retrieval → Azure / OpenAI-compatible assessment
      → claim-level findings, citations and uncertainty
```

Live evidence routes: Serper keyword search/scrape, Exa full text and sparse-result semantic discovery, TikHub X, ScrapeCreators Reddit, and SerpApi Bing fallback. Other logos in the header are labelled expansion options, not active integrations. Agent logos illustrate potential callers, not native integrations or endorsements.

Exact-request caching includes model, endpoint, evidence transport and research version. Default TTL is 15 minutes; unresolved answers are capped at 2 minutes. Cache hits retain original evidence time and still cost $0.05. The coordinator permits four active requests. It is a small-service deployment.

Model costs use returned token usage and configured estimates; provider-reported charges are tracked separately. Cost-plus figures are informational and do not change settlement. Hosting, RPC and network fees are excluded.

## Local development

Node.js 24 is used in CI (minimum 22). Install dependencies and copy the environment template:

```sh
npm ci
cp .env.example .env
DEMO_MODE=true npm run sandbox
```

Open `http://127.0.0.1:3000` for the landing page; the local payment gateway is `http://127.0.0.1:1402`. Demo mode uses fictional evidence without paid retrieval. Live sandbox mode still incurs provider/model charges. Set a random `ORIGIN_API_KEY` for standalone `npm run dev`.

```sh
npm run typecheck
npm run typecheck:worker
npm test
npm run build
npm run deploy:check
npm run release:audit
```

## Deploy your instance

Authenticate Wrangler, choose your Worker name and model settings in `wrangler.jsonc`, then configure evidence/model credentials and merchant secrets. Use your actual model deployment and rates. No credentials belong in the client assets or committed configuration.

```sh
npx wrangler login
npm run deploy
# Configure required secrets as documented below before accepting paid traffic.
```

See [deployment and merchant setup](docs/deployment.md) and [provider switching](docs/providers.md). The merchant receives USDC directly and needs SOL to sponsor fees. A reproducible postinstall patch aligns pay-kit **0.12.0** broadcast commitment with simulation; the dependency is pinned and the patch must be reviewed on upgrade.

## Repository layout

```text
src/       Shared verifier, evidence normalization, model, costs, cache and API
public/    Landing page, animated SVG, agent docs and reviewed evaluation data
test/      Retrieval, grounding, accounting and cache regressions
scripts/   Deployment, wallets, sandbox and explicit paid evaluation utilities
docs/      Deployment, integration references and research methodology
```

`.env`, `.dev.vars`, wallets, generated `.claimcheck/` artifacts, Wrangler state and raw historical research are ignored. Reviewed `public/benchmark.json` and `public/showcase.json` are intentionally public. Paid research scripts are opt-in; do not run them as part of CI. Brand assets and provenance are described in [the showcase notes](docs/research/showcase-week.md).

## Contributing

Follow [CONTRIBUTING.md](CONTRIBUTING.md). Preserve source provenance, document failed live tests, and run release checks. MIT licensed.
