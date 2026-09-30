# Deployment and revenue

Public service: **https://facet.hidden-pond-5e6a.workers.dev**

The Facet Worker is deployed with its own secret configuration and Durable Object state. Historical evaluation receipts were captured on the earlier `claimcheck` deployment using the same merchant recipient; the dataset retains that provenance.

- `POST /v1/verify`: $0.05 USDC on Solana mainnet, including cache hits.
- `GET /v1/health`: provider/payment readiness and public recipient address.
- `GET /openapi.json`: specification with the current public server URL.

## Cloudflare deployment

```sh
npm ci
npm run typecheck:worker
npm run deploy:check
npm run deploy
```

Wrangler must be authenticated to your account. The default configuration uses a SQLite-backed Durable Object for shared research caching, concurrent request coalescing, and an atomic payment replay store. One coordinator bounds concurrency to four requests. It is a small-service deployment, not a horizontally scaled research cluster.

Set secrets with `npx wrangler secret put NAME`. Renaming a Worker creates a separate service with separate secrets and Durable Object state; configure the new instance before routing paid traffic.

| Secret | Purpose |
|---|---|
| `GLASSER_API_KEY` | Paid evidence acquisition |
| `AZURE_OPENAI_API_KEY` | Azure inference authentication |
| `AZURE_OPENAI_ENDPOINT` | Resource inference URL, ending `/openai/v1` |
| `PAY_OPERATOR_KEYPAIR` | Private merchant signer, Solana JSON keypair |
| `PAY_PAYMENT_RECIPIENT` | Public wallet receiving USDC |
| `PAY_MPP_CHALLENGE_SECRET` | Stable random challenge-binding secret |

Nonsecret choices (model, provider, rates, cache TTL, network, RPC) are in `wrangler.jsonc`. Provider keys and private endpoints belong in secrets, never that file. Keep the challenge secret stable; rotation invalidates outstanding challenges. `scripts/deploy-secrets.ts` is a local convenience that sends `.env` and wallet material directly through stdin; don't rerun it without setting a stable challenge secret.

## Merchant wallet

This deployment receives USDC at:

```text
EGHfMz8SLAPAby86uY1Zf1QM1iSNKweNTXUiLH73EaQX
```

The wallet was created locally with `node --import tsx scripts/create-wallet.ts`. Its private backup is `.claimcheck/wallet/merchant.json`, ignored by Git. Keep a secure backup; it controls the funds. The signer is also stored as a Cloudflare encrypted secret. The wallet can be imported into a compatible Solana wallet using the local keypair; never send or publish the file.

Payments transfer directly to that wallet's USDC associated token account. pay.sh handles the payment protocol; it is not a dashboard balance held for this app. The merchant signer sponsors network fees and therefore needs SOL. Customer test credits live in a **separate** pay.sh wallet. Glasser and Azure bill their configured accounts separately; USDC revenue does not automatically refill them.

## Test status, September 30, 2026

- Wrangler deployment and secret configuration succeeded.
- Public health and OpenAPI return 200.
- Public unpaid verification returns a $0.05 USDC mainnet MPP challenge.
- Customer test activation succeeded and showed $5.00 USDC.
- Initial paid attempts failed before settlement while the merchant lacked fee funding. This historical troubleshooting state was resolved by the steps below.
- Cloudflare logs identified RPC blocking during simulation at Solana's default public RPC. The configured RPC was changed to PublicNode; a dedicated production RPC is recommended.
- After the RPC change, simulation failed with `AccountNotFound` until merchant fee funding and USDC account initialization were complete.
- Merchant funding of 0.01 SOL was confirmed. Initialized its USDC associated token account with `scripts/initialize-merchant.ts` (approximately 0.00149 SOL rent plus fee).
- Fixed pay-kit 0.12.0's broadcast preflight commitment mismatch: simulation used confirmed, broadcasting defaulted to finalized. `scripts/patch-pay-kit.ts` applies a narrow, reproducible postinstall patch keeping preflight enabled. Review/remove when upgrading the SDK.
- First settled $0.05 call exposed an unsupported CLI subprocess in the deployed Glasser adapter and returned no evidence; fixed the adapter to use Glasser HTTP.
- **Mainnet payment + live verification confirmed:** HTTP 200, `supported` Apollo 11 claim, four full-source extracts, and 12.399 seconds research time. Glasser $0.006600; Azure estimate $0.002111400.
- Successful end-to-end payment signature: `5JYHR2ZQRktxBpYhGCkiG7DZaMkqU7oBGf9Qq8K6yChYsjF2YquRiBWA8Q6tFKNKVsC2RJZVyqW5QokLU2JxKWUs`.
- After two settled calls (one failed research, one successful), customer USDC was **$4.90**, merchant USDC **$0.10**. Failed simulations did not transfer USDC. No automatic refund was performed.
- Subsequent community evaluation: 30 attempts, 21 captured assessments, 27 on-chain transfers totalling $1.35. Six settled without a usable captured response. See [evaluation and accounting](research/community-benchmark.md). Mainnet payment is functional, but paid-response reliability remains unresolved.

User activation codes and private wallet material must not be placed in test reports, examples, or Git.

## Public request

```sh
brew install pay
# Create/fund your own customer wallet with pay setup / pay topup.
pay curl -i -X POST https://facet.hidden-pond-5e6a.workers.dev/v1/verify \
  -H 'Content-Type: application/json' \
  -d '{"claim":"Apollo 11 landed humans on the Moon in July 1969.","sources":["web"]}'
```

Use `payment-receipt` response headers and the returned payment signature for reconciliation. Cached answers still cost $0.05 as requested. Invalid JSON is rejected before the payment handshake. Fixed-charge settlement occurs before research; refunds and client-response recovery for failed investigations are not implemented.

## Retention and operations

Cache keys hash the request, but cached values contain the actual claim, context, and source text. Hashing is not encryption. Restrict Cloudflare access accordingly. Expired cache entries are removed on access; scheduled eviction and payment-replay retention management remain operational follow-ups. Large entries above 120KB are not persisted. Budget for Cloudflare, RPC, provider, and failed-request costs beyond token estimates.
