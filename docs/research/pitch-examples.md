# Today's Grok requests vs ClaimCheck: evidence for the pitch

Research date: **September 30, 2026**. “Today” means UTC, `since:2026-09-30 until:2026-10-01`. Requested date filters still returned an occasional September 29 post; inspected candidates below were confirmed September 30 by returned timestamps.

**Version note:** comparisons below describe the original snippet-only version. Full-source retrieval and agent caching have since been implemented and retested; see [service improvements](../service-improvements.md). The original record is retained to show the failure that motivated the change.

## Executive result

Four matched live comparisons produced **two useful qualification examples**, **one agreement/control**, and **one ClaimCheck retrieval failure**. They do **not** establish that ClaimCheck beats Grok on accuracy, or that paid providers gave us exclusive evidence.

The most defensible current pitch:

> **Before an agent publishes a confident assertion, ClaimCheck identifies which parts are supported, retrieves linked evidence, and makes unresolved parts explicit.**

The next important product improvement is full-source retrieval. This experiment shows why: a relevant search snippet can omit precisely the paragraph needed to resolve a claim.

## Method and reproducibility

1. Eight Twitter-only discovery searches: verification requests, “wrong” challenges, and Grok uncertainty, with today's UTC date filters.
2. Six candidate thread lookups plus four single-post lookups to recover requests, original claims, Grok replies and corrections. Selection was purposive, not random. A user saying “you are wrong” was not counted as proof.
3. Selected four cases: a specific product assertion, a media-authenticity inference, a challenged factual answer, and a platform-policy claim suspected of being outdated.
4. Called the actual `POST /v1/verify` origin through its authenticated route, sequentially, using Azure `gpt-5.6-luna`, Glasser, and `sources: ["web", "x"]`. Pay.sh payment handshake was already tested separately; these were origin calls, not four wallet transactions.
5. Manually opened selected external source URLs to audit the output. Those full pages were **not available to the endpoint**, which received Google snippets plus X text. Manual audit findings must not be presented as endpoint-generated findings.

The endpoint claim was extracted from Grok's answer when needed, rather than pretending a user's short “is this AI?” prompt contained the full claim. Both the original prompt and extracted claim are recorded below.

Current evidence can contain later replies than the public bot had available. This is an illustrative comparison, not a controlled same-budget or same-information evaluation. Model versions behind public Grok replies are unknown. The extraction model, prompt, and retrieval budget differ.

Artifacts:

- `pitch-search-plan.json`, `pitch-context-plan.json`: exact paid discovery queries.
- `broad-research-data/pitch-today-*.json`, `pitch-context-*.json`: raw source/provider responses, UTC timestamps, run links, charges.
- `scripts/pitch-comparisons.ts`: exact endpoint inputs and repeatable comparison runner. Rerunning incurs provider and Azure charges.
- `.claimcheck/pitch-comparisons.json`: original captured endpoint outputs, quotes, evidence, token usage, costs and timing; ignored by git.

Commands:

```sh
# Inspect already saved discovery/context without paid calls:
python3 factcheck-digest.py 'pitch-today-*.json'
python3 factcheck-digest.py 'pitch-context-*.json'
# Repeat the four endpoint comparisons (paid Glasser + Azure):
node --env-file=.env --import tsx scripts/pitch-comparisons.ts
```

## Example 1 — A specific product assertion needs specific evidence

**Request, 16:55:26 UTC:** “I thought it was the iPhone 18. @grok”

- [Request and reply](https://x.com/phriend75/status/2105340758496817438)
- [Grok, 16:55:59 UTC](https://x.com/grok/status/2105340893494382722)

Grok says:

> “the C1X modem and N1 wireless chip in the iPhone 17e (and 17 series)…”

The answer also discusses Israeli R&D and rejects spying/backdoor theories. This comparison evaluates **only the specific hardware assertion**, not that whole response or the broader theory.

**ClaimCheck input:**

> “The iPhone 17e contains both the Apple C1X modem and the N1 wireless chip.”

**Captured result:** `insufficient_evidence` overall, with:

- C1X modem: `supported`.
- N1 chip: `insufficient_evidence`.

ClaimCheck found [Apple technical specifications](https://www.apple.com/iphone-17e/specs/) and [Apple Support specifications](https://support.apple.com/en-us/126470), alongside a Facebook search snippet asserting both chips. It did not treat the social claim or specifications for the broader iPhone 17 series as proof about the 17e.

**Manual source audit:** Apple's full specifications identify “Apple C1X cellular modem” and list Wi-Fi 6/Bluetooth 5.3; they do not establish N1 presence. Absence from that page alone does **not** prove the device lacks N1. A teardown, definitive Apple statement, or equally specific hardware evidence is required for a decisive correction.

**Improvement demonstrated:** precise separation of a supported component from a component not established by the retrieved manufacturer material. **Not demonstrated:** that Grok's N1 assertion is false.

**Pitch wording:**

> “In a real September 30 Grok reply, two hardware details were asserted together. ClaimCheck linked the manufacturer specifications and separated the detail they support from the detail still requiring evidence.”

**Avoid:** “We proved Grok hallucinated the N1 chip.”

Time: **14.766s**. Glasser **$0.005500**, Azure estimate **$0.002135800**, suggested cost plus $0.005 fee **$0.012636**.

## Example 2 — Missing reporting cannot establish AI generation

**Request, 17:23:25 UTC:** “Is this SI or Ai @grok”

- [Request](https://x.com/iamcidixz/status/2105347800120873282)
- [Grok, 17:24:27 UTC](https://x.com/grok/status/2105348060213637256)

Grok says visuals alone cannot confirm authenticity and no credible reports verify a meeting between Lamine Yamal and Mia Khalifa, then concludes:

> “This is almost certainly AI (or SI) fan content.”

**ClaimCheck input:**

> “The media shared in this X conversation is almost certainly AI-generated because no credible reports confirm a meeting between Lamine Yamal and Mia Khalifa.”

**Captured result:** `insufficient_evidence`.

ClaimCheck explicitly separates:

1. Whether the **specific media** is AI-generated.
2. Whether credible reporting establishes a meeting.
3. Whether absent reporting justifies the authenticity conclusion.

It retrieved posts/snippets alleging fabrication, a detector listing, and a social-media snippet claiming a meeting. It did not establish that those items match the exact media, or that the meeting report is credible. Grok's own replies were treated as context, not independent verification.

**Improvement demonstrated:** withholding an unsupported level of certainty and identifying missing evidence. **Not demonstrated:** whether the media is genuine, whether it is AI-generated, or whether the people met.

The captured citation `relation` labels include “supports”/“contradicts” for low-quality claims. Those labels reflect how a passage relates to the hypothesis, **not source credibility**; the narrative makes the uncertainty clearer than the citation labels. This is another product detail to improve before automating decisions from citation relations.

**Pitch wording:**

> “An authenticity answer ended with ‘almost certainly AI.’ ClaimCheck exposed that the exact asset wasn't verified and that missing news coverage doesn't establish AI generation—preventing the agent from presenting an unverified inference as a finding.”

**Avoid:** “We identified a real video Grok falsely called AI.”

Time: **21.183s**. Glasser **$0.005500**, Azure estimate **$0.004957400**, suggested cost plus fee **$0.015458**.

## Control 1 — A suspected outdated answer was supported

**Request, 18:34:20 UTC:** user complains X is blocking quote sharing.

- [Request](https://x.com/POZTIV33/status/2105365646175596649)
- [Grok, 18:34:58 UTC](https://x.com/grok/status/2105365806192140296)

Grok gives limits of 50 original posts and 200 replies/day for unverified accounts and cites the X Help Center.

**ClaimCheck input:**

> “According to the X Help Center About X limits, unverified accounts have a daily limit of 50 original posts and 200 replies.”

**Captured result:** `supported`, quoting the [X Help Center search snippet](https://help.x.com/en/rules-and-policies/x-limits) with those exact limits.

**Manual audit:** direct page fetch returned 403. The result therefore supports what the retrieved snippet says, not independently verified full-page policy or the cause of this individual's account block.

**Conclusion:** evidence linkage, but **no demonstrated correction**. Do not use as an example of Grok failing.

Time: **16.056s**. Glasser **$0.005500**, Azure estimate **$0.003036600**, suggested cost plus fee **$0.013537**.

## Control 2 / ClaimCheck failure — More cautious did not mean more accurate

**Challenge, 19:47:05 UTC:**

> “dig deeper. You are wrong. The airlines never installed the intrusion and ballistic standard doors in mass.”

- [Challenge](https://x.com/facemullet/status/2105383953289146624)
- [Earlier Grok reply, 19:36:00 UTC](https://x.com/grok/status/2105381163791528381)
- [Grok answer to challenge, 19:47:31 UTC](https://x.com/grok/status/2105384064039399892)

Grok maintains that FAA-mandated reinforced doors were installed by the April 9, 2003 deadline.

**ClaimCheck input:**

> “Permanent reinforced cockpit doors meeting FAA intrusion and ballistic standards were installed across the US commercial fleet by April 9, 2003.”

**Captured result:** `mixed`. It found the installation deadline and intrusion standard but marked the ballistic requirement `insufficient_evidence`; it also found cargo-fleet qualifications in later material.

**Manual full-source audit contradicts the endpoint's apparent evidence gap:**

- [FAA January 11, 2002 press release, preserved by Yale](https://avalon.law.yale.edu/sept11/faa_001.asp) explicitly describes protection from “small arms fire or fragmentation devices” and the April 9, 2003 deadline.
- [Boeing April 9, 2003 release](https://boeing.mediaroom.com/2003-04-09-Boeing-Helps-Customers-Meet-Enhanced-Security-Flight-Deck-Door-Deadline) reports more than **4,300 door kits to 76 airlines** and describes “blunt-force, ballistics and small-explosives resistance.”

Both URLs were already in endpoint evidence, but the Google snippets omitted decisive passages. This supports the core of Grok's response about standards and mass installation. The exact scope of all commercial/cargo aircraft, delivery versus installation, and the “over 10,000” number in Grok's follow-up require further adjudication.

**Conclusion:** cannot count a user challenge or ClaimCheck's caution as an accuracy win. **Our endpoint missed relevant evidence on pages it had discovered.** Also, later cargo-rule exceptions should not silently be projected back to April 2003.

**Product lesson:** fetch full primary sources, distinguish dates, and distinguish manufacturing/delivery from installed/compliant fleet counts. Returning unknown can be less useful than a correct confident answer.

Time: **19.252s**. Glasser **$0.005500**, Azure estimate **$0.002289800**, suggested cost plus fee **$0.012790**.

## Cost summary

| Work | Cost |
|---|---:|
| Discovery/context: 18 Glasser Twitter calls | $0.019800 |
| Four endpoint comparisons: Glasser | $0.022000 |
| Four endpoint comparisons: estimated Azure | $0.012419600 |
| Total reported Glasser + estimated Azure for this experiment | **$0.054219600** |

Azure estimate uses configured $0.20/M input, $0.02/M cached input, $1.20/M output; not reconciled to an invoice. There were no real wallet payments in these comparisons. The suggested cost-plus price is not the gateway's currently fixed $0.05 collection.

## What this does and doesn't prove about paid evidence

Glasser acquired X thread context and discovered source documents. That is a useful workflow, but the clearest additional facts were on publicly accessible manufacturer/government pages. We have **not** demonstrated that an agent lacking paid data access could not find them.

For the stronger paid-data pitch, find cases where original posts, reply history, deleted/archived material where lawfully available, or inaccessible full documents materially change the conclusion. Compare against a caller using ordinary search at equal budget, and show which retrieved item changed the answer.

## Next evaluation gates

1. Full-source retrieval before claiming an evidence gap on a discovered authoritative URL.
2. Evidence credibility and entailment separate from simple `supports`/`contradicts` relation labels.
3. Neutral inputs and counterexample searches, rather than always copying Grok's proposed conclusion into the search query.
4. A blinded, independently adjudicated set with both decisive successes and justified abstentions.
5. More real September 30 examples with documented error corrections, not merely user disagreement.

**Use these two qualification examples in a pitch with their exact limits. Do not advertise “we outperform Grok” from this experiment.**
