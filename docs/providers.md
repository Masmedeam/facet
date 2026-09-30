# Switching providers

## Models

Azure is deployed by default. Set `MODEL_PROVIDER=azure`, `MODEL_NAME` to the deployment name, and the `AZURE_OPENAI_API_KEY` / `AZURE_OPENAI_ENDPOINT` secrets. Azure OpenAI v1 endpoints end `/openai/v1`. Legacy deployments may set `AZURE_OPENAI_API_VERSION` with a resource-root endpoint.

For OpenAI or xAI-compatible chat completions:

```dotenv
MODEL_PROVIDER=openai
MODEL_BASE_URL=https://api.openai.com/v1
MODEL_NAME=your-model
MODEL_API_KEY=your-key
```

Set keys/endpoints using Wrangler secrets and update the nonsecret provider/model choices in `wrangler.jsonc`. Rate settings must change with the model; do not apply the Luna rates to another deployment. Azure is live-tested; other providers are integration options requiring smoke tests of JSON output and token parameter compatibility.

## Evidence acquisition

`DATA_PROVIDER=glasser` uses the Glasser HTTP API—no CLI/subprocess in the Worker. Current provider routes are Serper search/scrape, Exa contents and sparse-result semantic search, TikHub X, and ScrapeCreators Reddit. SerpApi Bing is a second-engine fallback when both keyword and semantic discovery leave fewer than two web records. Exa search and SerpApi Bing were live smoke-tested September 30, 2026. SerpApi results can be broad rather than claim-specific; the route is a coverage fallback, not independent proof.

`DATA_PROVIDER=direct` uses your own vendor keys:

```dotenv
SERPER_API_KEY=
EXA_API_KEY=
TIKHUB_API_KEY=
SCRAPECREATORS_API_KEY=
```

Only enable request source types whose vendor keys are configured. Direct transport is implemented but not live-tested. Vendor responses do not include billed charges; their cost is marked unknown and the aggregate cost-plus estimate withheld. Do not interpret the zero placeholder in a direct-provider run as free usage.

Transport adapters implement `ProviderClient.run(provider, endpoint, input)` in `src/providers.ts` and `src/direct-provider.ts`. Evidence normalization and research orchestration are shared. A new vendor with a different output shape needs an explicit normalization adapter and contract tests, not just a URL change.

Cache identity includes the model, inference endpoint, data transport, research version, and contextual request. Increase `RESEARCH_VERSION` after material prompt/retrieval changes to avoid serving old behavior.
