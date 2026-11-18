# N3.1 — Readiness for real Vietnamese NLU evaluation

Status: **CONDITIONAL**, 2026-11-09. Offline engineering checks can pass while
real-inference readiness remains blocked on reviewed labels and explicit spending
authorization. No real model was invoked in N3.1.

## Baseline and additive implementation

Branch `main`, HEAD `a1cfeb4c093b532a48eada804031778f1b5ff55b`. Existing dirty
worktree is preserved. N2 labels, mock outputs, runtime Agent, menu, provider service
and package scripts are unchanged. New files:

- `src/lib/agent/nlu/evaluation-request.ts`: prompt/request projection and service-response parser.
- `scripts/nlu-evaluation-harness.cjs`: review gates, bounded dry-run, scoring and durable resume.
- `scripts/evaluate-nlu-readiness.cjs`: offline CLI; no live implementation.
- `scripts/audit-nlu-readiness.cjs`: repeatable structural/quality inventory.
- `scripts/test-nlu-readiness.cjs`: mock acceptance and negative tests.
- `tests/data/nlu/review-manifest.json`: 140 pending review records, case/dataset hash bindings.
- This design and `docs/nlu-human-review.md`: review checklist and decision protocol.

## Dataset evidence and interpretation

140 records: 80 standalone utterances and 20 three-turn dialogues, 84/28/28
train/dev/test, 50 declared groups. All original annotations and all review-sidecar
decisions are pending. Audit found no structural errors, declared cross-split
dialogue/group leakage or normalized exact text leakage against prompt examples.
Four existing examples are train-only; this harness sends **no few-shot examples**.

There is one normalized exact overlap with legacy development data:
`N2-NEG-01` / `LS-020` (train). No cross-split character-trigram candidates reached
the documented 0.5 Jaccard shortlist threshold. This does not establish semantic
independence: all data is public in the working repository, has been inspected,
and cannot serve as a sealed independent holdout. Intent-level similarities across
splits are expected and require human family/near-duplicate review.

The audit emits 86 review findings over 74 distinct records. These are review
questions, **not 86 proven annotation errors**:

| Finding | Evidence / action |
| --- | --- |
| Component taxonomy | `N2-HOLDCOMP-01/02` use `ask_combo_contents` for a burger product; resolve product-component versus combo intent |
| No match versus ambiguity | `N2-HOLDUNKNOWN-01/02` require clarification because a mentioned dish is absent from demo context; absence alone does not prove unclear language |
| Clarification policy | First turns of `dialogue-family-budget` mark a generic recommendation as missing meaning; reconcile with other understood recommendation records |
| Dialogue target | All 60 dialogue turns need a consistent policy for current intent versus accumulated request constraints; no assistant clarification messages exist in the corpus |
| Budget boundary | 20 records contain budget entities; N2 has amount/scope but cannot represent strict `<` versus `<=` |
| Contextual reference | Historical unknown references coexist with a generic `last-item` binding; specify which antecedents are permitted |

There are 34 repeated rationale strings; this indicates templating and limited
case-specific justification, not automatically incorrect labels. Entity evidence
uses entire utterances rather than token spans. Human review should improve both
in a versioned successor, not overwrite N2 labels to fit a prediction.

## Separating label errors from model errors

Before approval, an evaluator mismatch means only a difference from a provisional
reference. The report retains `labelReviewRequired:true`; do not call it a model
failure rate. Two independent Vietnamese reviewers should check the utterance,
permitted history, trusted context and annotation before looking at a prediction.
Disagreements go to an adjudicator. Record one of: reference error, prediction
error, acceptable alternative, task/contract ambiguity or insufficient evidence.

Do not silently relabel an evaluated dataset. Label revisions get a new version,
new hashes and a new run; retain the original outputs and prior report. At the
current stage all cases remain pending; no human reviewer or approval is invented.

## Provider compatibility and structured requests

Installed `@aws-sdk/client-bedrock-runtime` is 3.1137.0. It and `src/lib/aws/bedrock.ts` already use
`InvokeModel` with Anthropic Messages, maxAttempts=1, explicit model ID, usage and
a 15-second abort. Reuse this service boundary later. Do not pass NLU through
`BedrockLLMProvider`: that wrapper validates the older AgentResponse and rewrites
action-free responses, incompatible with N2 states.

`NluServiceReply` is type-compatible with the existing service result. The N3.1
module imports its types only; no client, service, credentials or live callback
is constructed. Prompt construction uses the exported N2 JSON Schema with reused
definitions, plus instructions about deltas, absolute counts, exclusions, unknown
bindings and no execution. Zod semantic refinements remain mandatory locally.

Projection sends only:

1. Generic NLU instructions/schema, identical across cases.
2. Current original utterance.
3. Strictly validated current trusted context.
4. Earlier user utterances in the same dialogue/split, in turn order.

No expected labels, rationale, review decision, assistant gold or future utterance
is serialized. Generic schema enum values are not case-specific labels. Prompt
examples and annotation metadata never enter the request. Prior requests are not
treated as executed cart changes. Missing real assistant clarification history is
an explicit corpus limitation, not synthesized from labels.

N3.1 uses **prompt-requested JSON plus local validation**, not native constrained
decoding. AWS documents native `output_config.format` for Anthropic InvokeModel;
the existing service does not emit this field. AWS also documents schema complexity
limits and potentially ~90-second first compilation with a recommended >=120-second
client timeout. The existing 15-second service timeout and the N2 union schema
therefore need a separately reviewed transport/schema compatibility change before
claiming native structured-output support. No such runtime change is made here.

Sources checked for this design:

- [AWS structured outputs](https://docs.aws.amazon.com/bedrock/latest/userguide/structured-output.html)
- [AWS Claude Haiku 4.5 model card](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-anthropic-claude-haiku-4-5.html)

## Review-gated execution and safety controls

`unreviewed_dry_run` exists solely to test the machinery using authored fixtures.
`approved_only` requires sidecar decisions with matching dataset and case hashes,
reviewer, timestamp and note. Every prior dialogue turn used as input must also be
approved. Decisions are operator attestations, not authenticated signatures; the
script cannot establish that the named reviewer is actually human. With the
checked-in all-pending sidecar, approved-only rejects before any mock invocation.

Defaults: 20 cases, 20 total attempts, one concurrent operation, zero retries,
32,768 input bytes per request, 1,500 maximum output tokens, 1,000,000 aggregate
reserved token proxies. Schema/prompt/history/context all count toward input size.
Byte count + 1,024 overhead is a conservative **planning proxy**, not a verified
tokenizer or enforceable AWS billing guarantee. Output limits are part of the
prepared request descriptor; no live transport exists to send them in this stage.
Reported usage beyond a reservation stops the run and remains stopped on resume.

No API key lookup, environment-secret reads, paid calls, real customers, tools,
menu changes or production persistence are part of this harness. Network guards
are loaded by all offline entry points. `--mode live` is explicitly rejected.

## Durable resume and saved evidence

The run fingerprint binds selected requests, case labels for scoring, dataset,
review decisions, limits, schema and relevant source files. Mock fixture hash is
also pinned in the checkpoint manifest. Exclusive lock protects a run directory.
Each started attempt is appended and fsynced **before** response processing;
completion is appended and fsynced after validation/scoring. Completed cases do
not rerun. A started case without completion is uncertain; the run stops for
operator investigation and never automatically retries it. Stale locks likewise
require manual investigation. An orphan/truncated/invalid journal fails closed.

Writes stay in the chosen `output/` run directory; the CLI rejects traversal,
links/junctions and hard-linked existing checkpoint files. The lock is for local
cooperating processes, not a distributed or adversarial-filesystem guarantee.

Saved records contain normalized prediction, bounded raw model-content fixture,
parse/schema/context issues, outcome, request hash, latency and optional usage.
Provider failure messages are replaced with a generic safe error; raw provider
envelopes, headers and exception stacks are not persisted. Raw oversized content
is omitted. Latency/usage in dry-run are explicitly mock telemetry, not inference
latency, true tokenization or actual billed usage.

## Offline commands

```text
node scripts/audit-nlu-readiness.cjs
node scripts/test-nlu-readiness.cjs
node scripts/test-nlu.cjs
node scripts/evaluate-nlu-readiness.cjs --plan-only
node scripts/evaluate-nlu-readiness.cjs --run-dir output/nlu-readiness-dev
node scripts/evaluate-nlu-readiness.cjs --run-dir output/nlu-readiness-dev
node scripts/evaluate-nlu-readiness.cjs --approved-only
node scripts/evaluate-nlu-readiness.cjs --mode live
```

Second identical run should report newCalls=0. Last two commands are expected
rejections (exit 1) for the current repository. Fingerprint changes require a new
run directory; never silently adopt an old checkpoint under new data/config/code.
The audit report is `output/nlu-readiness-review.json`; a run saves manifest,
events.jsonl and report.json under its selected directory. Every report stays
`mock_contract_evaluation`, `realLlmEvaluated:false` even with perfect fixture scores.

## N3.2 proposal — not implemented or authorized

Candidate: existing AWS Bedrock transport, Claude Haiku 4.5, explicit global profile
`global.anthropic.claude-haiku-4-5-20251001-v1:0`, proposed source region
`ap-southeast-1`. AWS's model card lists this region with global inference support.
Account entitlement, IAM, actual profile availability and cross-region consent
have not been checked. This is a compatibility/cost candidate, not a claim of best
Vietnamese quality or the cheapest current model.

For cost reference, the official Anthropic AWS Bedrock list effective 2026-05-27
lists standard global Haiku 4.5 at USD 1/input MTok and USD 5/output MTok; geographic
pricing differs. The document was consulted on 2026-11-09. AWS's pricing page was
reachable but its retrieved text did not expose a Haiku 4.5 rate table; do not
claim an account-specific or newly effective AWS quote.

- [Official platform price list, AWS Bedrock Haiku section](https://www-cdn.anthropic.com/files/4zrzovbb/website/3684c2faafb97418665782cea0001f439f74b1d2.pdf)
- [AWS Bedrock pricing](https://aws.amazon.com/bedrock/pricing/)

Proposed first pilot: at most 20 **human-approved dev** utterance turns, including
complete dialogue groups and teencode/negation/budget cases; no new provider, no
runtime integration. Concurrency=1, retry=0, output <=1,500 tokens per turn.
Illustrative 6,000 input tokens/turn gives 120k input +30k output = **USD 0.27**.
At the configured 32,768-byte proxy +1,024 overhead ceiling per turn, the planning
scenario is USD 0.82584; this is not a tokenizer-based hard bound. Propose **USD 2
maximum authorized spend**, excluding taxes/ancillary services, only after an
operator re-verifies the exact model/profile/region price and approves the budget.

Before N3.2: adjudicate/revise labels; freeze prompt/task semantics; obtain explicit
live/budget/model/region authorization; implement a separate tightly gated service
bridge and provider-appropriate token/monetary reservation with actual usage checks;
confirm timeout and truncation diagnostics; freeze manifests and create a new
independently held-out corpus for generalization claims. N3.1 has no dollar-charge
enforcement because it has no live transport. No credentials are inspected now.

Do not run all 140 records or retry failures under the proposed pilot permission.
Report provisional versus reviewed-reference results and real versus mock telemetry
separately. Any future real run still must not execute Agent tools or orders.

## Actual verification in N3.1

Tests were written before implementation; the initial run failed on the absent
module. Additional budget and journal negative tests also failed before their
controls were implemented. Final commands/results:

| Command | Actual result |
| --- | --- |
| `node scripts/test-nlu-readiness.cjs` | 26/26 pass |
| `node scripts/test-nlu.cjs` | 28/28 pass |
| `node scripts/audit-nlu-readiness.cjs` | 140 records; zero structural errors; all pending |
| `node scripts/evaluate-nlu-readiness.cjs --plan-only` | 20 dev cases; no response processing |
| Dry-run then identical resume | 20 fixture responses completed; subsequent newCalls=0 |
| `--approved-only` | Expected rejection, exit 1, because no approvals |
| `--mode live` | Expected rejection, exit 1, live implementation absent |
| `npm run test:menu` | 87/87 pass |
| `npm run test:acquisition` | 46/46 pass |
| `npm test` | 89/89 pass, mock-only |
| `npm run lint` | Pass |
| `npm run typecheck` | Pass |

Related regressions used network guards, mock persistence and a disposable local
data directory. No build or paid-inference check is claimed by this N3.1 table.
All perfect mock scores are authored-fixture consistency results only. The 20-case
plan reserved 301,910 token proxies (including output and overhead reservations),
not 301,910 measured provider tokens. No annotation was approved or changed.
