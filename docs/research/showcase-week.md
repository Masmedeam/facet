# ClaimTrace community showcase

Research: September 30, 2026. Discovery window: September 28–30 (the elapsed part of this week), UTC. Six X-only searches, six thread lookups, three paid public endpoint checks. Exact discovery operations are in `scripts/showcase-research.ts`; raw artifacts remain ignored under `.claimcheck/showcase/`. Rerunning `discover`, `threads`, or `verify` incurs charges.

The public, curated record is [`public/showcase.json`](../../public/showcase.json). It includes request wording, original X questions, actual Grok reply excerpts, endpoint result IDs, settlement signatures, selected captured citations, limitations and costs. These are response excerpts, not complete raw responses. The landing page presents the same examples, with optional X iframes, expandable tested JSON inputs and source links that remain usable if embeds fail.

## Selection and claims

- **Car privacy:** September 29 request by @SacredGeoInt, referring to @KaceeRAllen's viral car-data post. Grok opens with “Yes” and also explains the Washington Privacy Act injury requirement. Endpoint returned `mixed`, separating litigation outcome and allegations from universal legal authorization. The endpoint did not retrieve the opinions; one full-source page failed. This is scope augmentation, not an independently adjudicated legal correction.
- **iPhone chip specificity:** September 30 request by @phriend75. The hardware assertion is extracted from the actual Grok reply; unrelated surveillance assertions are excluded. Endpoint returned `insufficient_evidence`, confirming C1X from Apple and leaving N1 unresolved. Truncated manufacturer extracts contain the relevant section. No teardown, and no proof of N1 absence.
- **Bee-venom research:** September 30 request by @NotFarLeftAtAll. Grok already rejects a human-cure inference. The endpoint input adds a clearly disclosed human-treatment probe and returns `refuted` for the compound claim, supporting the melittin cell-culture finding and rejecting established human efficacy. The primary PMC extract contained a cookie notice, so cited secondary source documents carry the result. This is corroboration with source linkage, not a Grok correction.

Provider charges for discovery/context: $0.013200. Three public calls settled $0.15 USDC total. Merchant research costs: Glasser $0.040700 plus configured Azure estimate $0.014237400. No controlled same-time, same-budget accuracy comparison, no demonstrated exclusive access, and no general claim to outperform Grok. Search date operators returned some older quoted material, so selected request timestamps were checked explicitly.

## Workflow visual

Agent names/logos illustrate potential callers of a payment-aware HTTP endpoint, not native product integrations or endorsements. Actual retrieval providers: Serper (search and scrape fallback), Exa (full pages), TikHub (X), ScrapeCreators (Reddit), through Glasser. The three selectable evidence channels remain web, X and Reddit.

OpenAI, Claude and Google Gemini SVG paths are sourced from [Simple Icons](https://github.com/simple-icons/simple-icons), CC0. Grok and provider marks are copied from Glasser's published catalog assets by `scripts/provider-assets.ts`. Additional catalog options (DataForSEO, Bright Data, Apify, SerpApi) are labelled expansion options and are not connected as active retrieval providers. Catalog capabilities were checked September 30, 2026 at [Glasser](https://glasser.ai/datasources). Marks identify the providers; no endorsement is implied.

Workflow animation uses native SVG `animateMotion`, looping continuously on the exact base connector paths via `mpath`. Animated dots are hidden for reduced-motion users. The workflow uses an SVG object so the document can load its local logo assets; a static image is the fallback. `sources` in the API means allowed evidence channels, not provider selection: web, X and Reddit. Docs and OpenAPI explain that distinction explicitly.
