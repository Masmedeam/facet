# Facet community capability evaluation

September 30, 2026. Social questions dated September 28–30. 30 assertion-level attempts from 22 X conversations, discovered through paid search and thread inspection before testing. Original 24-case block frozen before calls; six supplemental different assertions frozen later to exceed $1 in receipt-backed tests without retrying failed cases. Hashes and freeze timestamps are published in `public/benchmark.json`.

## Results

- 21 usable assessments / 30 first attempts.
- 27 on-chain $0.05 payments: **$1.35**. 21 captured response receipts account for $1.05; six transfers yielded no usable captured response, three attempts did not settle. Chain audit scripts preserve all signatures; missing-response transfers are not assigned to individual cases without a receipt.
- 19 / 21 completed results match the author-assigned provisional expected-label sets (19 / 30 including failed attempts). This is reference-label agreement, not independently adjudicated factual accuracy.
- 101 / 101 published quotations exactly match captured evidence text. Provenance only, not truth, credibility or entailment.
- All 21 responses include full-source extracts; seven have retrieval warnings.
- Median server processing: 17.818 seconds; nearest-rank p90: 35.794 seconds. Payment/client wall time is separately recorded.
- Reported retrieval charges $0.237600; configured model estimate $0.086386, for captured responses only. Failed attempts may have additional merchant costs.

## Findings worth preserving

Current data distinctions include annualized versus realized revenue, operating loss versus cash burn, billed versus paid TRICARE amounts, temporary invalidity suspension versus immediate legal change, and exported video codec versus original capture setting. Several original Grok replies already include the correct distinction. Do not market every inference probe as a literal Grok mistake.

Two top-level labels disagreed with frozen references: iPhone N1 was described as unresolved yet labelled `mixed`; a Gemini leak labelled unverified in the explanation received `refuted` instead of the expected `insufficient_evidence`. One New York statute result includes the model-grounding notice. Full outputs and references are available in the dataset, including weak and failed outcomes.

## Reproduction

`scripts/benchmark-cases.ts` is the test set. `scripts/community-benchmark.ts prepare` freezes the manifest and requires existing cases to stay identical. `run` submits new attempts using `pay curl`, retaining saved attempts. `publish` generates public results from private captures and chain accounting. `scripts/benchmark-settlements.ts` audits token debits to the merchant during the test interval. Re-running paid commands incurs charges.

Raw response artifacts stay under ignored `.claimcheck/community-benchmark/`. Public output removes transport branding and private configuration, preserves source text, citations, model, request body, response ID, transaction, timing and limitations. Do not rerun `prepare` to silently rewrite original expected labels after outcomes.

## Retrieval upgrade

Sparse keyword results now trigger Exa semantic discovery; fewer than two remaining web records trigger the live-tested SerpApi Bing fallback in hosted transport. Maximum provider operations remains 12. Research cache version is `multi-discovery-v3`. Exa and Bing transport smoke tests were successful, though Bing returned broad NASA results for the smoke query; broad discovery is not corroboration. Additional provider cards are labelled expansion candidates, not claimed integrations.
