# Full-source retrieval and agent caching

Implemented September 30, 2026. These changes close a demonstrated retrieval gap; they do not establish superiority over Grok across tasks.

## Shipped

- Neutral keyword discovery plus a separate exceptions/limitations/corrections search.
- Up to four selected source-page extracts via Exa, with bounded Serper fallback.
- Source text replaces discovery snippets for the same URL, preserving evidence IDs.
- Available title/date, retrieval provider, SHA-256 content fingerprint, and truncation flag.
- Explicit requested/retrieved/failed page lists; failed fetches do not silently become full-source evidence.
- Source-document priority over social discussions, with a twelve-operation cap.
- Persistent SHA-256 request caching, default fifteen-minute TTL (two minutes for unresolved results), and in-process concurrent request coalescing.
- Agent-facing cache age, evidence check time, expiry, current-request duration, and incremental versus original research cost.

## Live before/after results

### Cockpit doors

Previously, ClaimCheck marked the ballistic requirement unresolved because its Google snippets omitted relevant text.

The full-source version retrieved the FAA release preserved by Yale and the Federal Register account. It now quotes small-arms/fragmentation protection and ballistic penetration standards. It also quotes the cargo compliance-date extension instead of just invoking generic cargo exceptions.

The first full-source run returned `refuted` overall; a second run returned `mixed`. Both supported the ballistic standard and qualified the universal fleetwide/date assertion. That top-level variation is an unresolved model/aggregation issue, not an accuracy win. These are not independently adjudicated fleet-compliance findings.

Latest uncached run: **31.753 seconds**, Glasser **$0.019800**, Azure estimate **$0.003998600**, cost plus half-cent fee **$0.028799**. Four pages were retrieved, including a Serper fallback. The higher cost/latency is the tradeoff for fuller evidence.

Immediate identical repeat: **cache hit**, server-side duration **0 ms at millisecond resolution**, zero incremental provider/inference calls. HTTP/network and pay.sh payment latency are not included in that duration.

### iPhone 17e hardware

The version retrieved Apple specifications and complete discussion extracts containing conflicting N1 claims. C1X remains supported; N1 remains unresolved. The upgrade supplied more specific context rather than a decisive correction.

Latest uncached run: **16.285 seconds**, Glasser **$0.009900**, Azure estimate **$0.004245800**, cost plus fee **$0.019146**.

Immediate identical repeat: **cache hit**, server-side duration **1 ms**, zero incremental provider/inference calls.

Captured results: `.claimcheck/full-source-comparisons.json`. The earlier snippet-only comparisons remain in `.claimcheck/pitch-comparisons.json`. Original findings and limits are documented in [pitch examples](research/pitch-examples.md).

Reproduce (incurs live provider/inference charges only on cache misses):

```sh
node --env-file=.env --import tsx scripts/pitch-comparisons.ts --full-source-retest --cache-check
```

## Next improvements, in priority order

1. **Claim-aware retrieval planning:** current keyword normalization is deterministic and cheap, but cannot reliably infer all entities, dates, or evidentiary requirements. Generate neutral research questions and explicit proof requirements with measured planning cost.
2. **Evidence quality and entailment:** label allegations, primary records, vendor statements, independent reporting, and copied sources. Validate whether passages support the exact claim; substring quotation checks only establish provenance.
3. **Deterministic verdict policy:** stabilize conjunctive versus multi-assertion aggregation. The cockpit-door rerun shows why one overall label is insufficient without atomic findings.
4. **Targeted follow-up:** when a specific subclaim remains unresolved, acquire evidence for that subclaim rather than blindly expanding broad searches.
5. **Document handling:** selected extracts can be truncated; improve PDF/table handling and section-aware passage extraction. Do not assume a crawled page is complete.
6. **Agent economics:** lower-price cached access needs a separate payment integration, since the gateway still collects fixed $0.05 on hits. Add refresh controls, refund/replay handling, bounded spend quotes, and verified variable settlement.
7. **Distributed operation:** shared cache and cross-instance locking, disk eviction, cache poisoning/integrity controls, and workflow-appropriate freshness.
8. **Evaluation:** a blinded, independently adjudicated matched set, measuring correct resolution, wrong decisive answers, evidence support, latency, and cost versus a search-enabled agent at the same budget.

Caching exact requests improves latency and economics, not knowledge coverage. Full-source retrieval improves available evidence, not source truth. A stronger service needs both and must preserve those distinctions.
