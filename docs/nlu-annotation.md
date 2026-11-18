# N2: Vietnamese NLU annotation and offline evaluation

## Scope and evidence

This is an additive offline semantic contract, authored annotation pilot and evaluator.
Nothing imports it into the current Agent, provider selection, routes, menu or cart.
It does not classify utterances by matching them to dataset records. The adapter takes
an already produced JSON document and a caller-owned trusted context. No inference,
network, training, tool invocation or automatic confirmation is implemented.

All pilot menu IDs are isolated `demo-*` synthetic context identifiers, not official
KFC IDs and not a migration of the S1.2 fixture. The only context classifications
accepted by this N2 pilot are `seed_demo` and `unverified`. Future use of verified
datasets needs its own evidence review and an explicit contract change.

## Contract and interpretation

`src/lib/validation/nlu.ts` owns the strict Zod schemas. Types are inferred in
`src/lib/types/nlu.ts`, avoiding a second incompatible definition. Every object
rejects unknown properties. There are no price, finalQuantity, tool parameters,
execution, permissions or confirmation fields. Self-reported confidence is not an
accuracy probability and is deliberately absent from this baseline contract.

States:

| Status | Meaning |
| --- | --- |
| `understood` | A nonempty semantic request with resolved required slots; no claim that a tool supports or executed it |
| `needs_clarification` | Preserve partial intents/entities and explicit missing slots |
| `unsupported` | The request is understood to be outside capabilities; reason retained |
| `error` | Provider/parse/validation/context failure; no intents or action surface |

Intent discriminators include search, recommendation, detail/price/component/option/
availability questions; add, set, adjust, remove and clear; cart view; greeting,
assent, cancellation, correction, clarification and unsupported requests. Intent
polarity applies to the specific operation. Multiple intents are an array, never
silently reduced to the first action. There is no utterance-to-answer dictionary.

Entity discriminators cover product, contextual reference, option/value, quantity,
volume, budget, party size and preference. Entity and intent IDs are unique within
one document; links must refer to the correct entity kind.

- `add_item` uses a positive delta: requested additional quantity.
- `adjust_quantity` uses a signed nonzero delta.
- `set_quantity` uses a positive absolute quantity.
- No final quantity is calculated from cart contents. Zero/removal semantics need
  an explicit remove request or clarification, not an implicit delete.
- Missing quantities stay null with clarification rather than silently defaulting
  to one. Quantity is integer and bounded by the current 1..100 business limit.
- Volume is a separate entity in ml; 1.5L does not mean 1.5 servings.
- Preferences are desired constraints, not assertions about product properties.
  `neq` excludes an attribute; a negated intent forbids the operation itself.
- Constraints are conjunctive by default. Optional `constraintGroups` express
  `all`/`any` groups over constraint entity IDs. Arbitrary nested conditions are
  outside N2 and require clarification or an unsupported result.
- Budget has VND and explicit total/per-person/per-item scope. Unknown scope is
  null and cannot be represented as fully understood.

The adapter parses exactly one JSON document, with a 64KiB byte limit. Markdown
fences or surrounding prose are parse errors. Schema and context errors remain
distinct. Failure returns only an error record; it never builds a runtime action.

Context includes menu version, classification, store/channel, allowed products,
owned option/value IDs, cart revision and explicit prior referents. Resolved IDs
must exist in that exact supplied scope. An output cannot select another scope.
This validates referential integrity, not whether the caller's context is authentic
or whether the model selected the right existing product from an utterance.
Those require a trusted context builder and semantic evaluation in a future stage.

Null references are preserved; the adapter does not guess a match. A supplied
context reference may resolve a prior mention, but no rule interprets “ok” as
permission. The current UI confirmation mechanism remains unchanged.

## Pilot inventory and annotation protocol

`tests/data/nlu/pilot.vi.json` contains 80 standalone utterances and 20 three-turn
dialogues: 140 records, split 84 train / 28 dev / 28 test (60/20/20). Each pair of
authored paraphrases shares a group. Two variants of each dialogue family share
one group. All turns of a dialogue stay in one split.

Each record includes stable case ID, original utterance, trusted synthetic context,
expected semantic annotation, language tags, split/group/dialogue/turn IDs, earlier
turn IDs, rationale and annotation provenance. Labels were authored by the coding
agent and are **pending human review**, not independently adjudicated ground truth.
No real customer messages, real orders or collected KFC records are included.

The pilot covers natural Vietnamese, teencode (`ko`, `k`, `hok`, `cx`, `zay`, `z`,
`mk`, `bn`), abbreviations, typos, unaccented text, operation negation, exclusions,
budget, party size, delta/absolute quantities, multiple intents, volume, ambiguous
references, clarification, unsupported requests and corrections across turns.
These strings illustrate language variety; they are not normalization rules.

`entities[].text` currently cites the entire supporting utterance; exact token
spans are intentionally not fabricated. Entity metrics therefore measure normalized
values, not NER span quality. A later reviewed corpus should add precise spans and
cross-turn evidence locations using a documented Unicode offset convention.

For dialogue records, annotations describe the accumulated request after that
turn. Cart context stays synthetic and unchanged: a proposal never counts as an
executed cart update. Earlier turn IDs make the history explicit; N2 does not infer
or persist dialogue state from text. The model-output fixture is supplied directly.

Before using labels to evaluate a real model, two Vietnamese annotators should
review intent scope, quantities, implicit references, budgets and ambiguity
independently. Record disagreements and adjudicate; create a versioned successor
dataset rather than silently editing a heldout label to match a prediction.

## Splits and leakage

The pilot split is for exercising the evaluation machinery, not an independent
generalization claim: all records and authored outputs are visible in this repo.
The existing 50 intent and 61 language-safety cases remain separate known regression
data. They are not newly designated independent test data.

`prompt-examples.json` declares four train-only examples; no runtime prompt is
modified. Leakage auditing checks record/schema validity, ID uniqueness, contiguous
dialogue history, cross-split dialogue/group membership and normalized exact text
(NFKC, lowercase, punctuation/space normalization). Prompt case IDs, group IDs and
text must match train records and cannot overlap dev/test. Human review is still
needed for semantic near-duplicates and undeclared paraphrase families.

For future real evaluation, freeze the prompt and dataset versions, keep a new
holdout under independent operator control, group by dialogue/paraphrase family,
and separate authors/situations where possible. Never inspect heldout errors to
revise the same evaluated prompt. No fine-tuning is required by N2.

## Evaluator and metrics

`tests/fixtures/nlu/model-outputs.json` contains deliberately authored correct JSON
outputs. They are separate from the dataset so tests can replace, corrupt or omit
predictions. They are not a classifier and are not generated by model inference.

Every report is labelled `mock_contract_evaluation` with `realLlmEvaluated:false`.
Perfect scores on these fixtures demonstrate fixture/contract/evaluator consistency
only, not real LLM accuracy. CLI exits nonzero on leakage, missing/extra outputs,
parse errors, validation/context errors or semantic mismatches.

| Metric | Definition |
| --- | --- |
| Intent accuracy | Exact multiset of intent kind + polarity per record; multiple intents are all required |
| Semantic exact accuracy | Status, grounded intent arguments, entities, constraints/logic and clarification slots all match |
| Entity P/R/F1 | Micro multiset matching of normalized entity values excluding local IDs and evidence text |
| Quantity operation accuracy | Exact operations including target, delta/absolute mode and value |
| Negation accuracy | Exact scoped operation polarities and exclusions |
| Constraint accuracy | Exact budgets, party sizes, preferences and logical groups |
| Clarification accuracy | Status and exact missing-slot set |
| Dialogue annotation exact | All turn annotations match; not executed-cart state accuracy |

Entity precision=TP/(TP+FP), recall=TP/(TP+FN), F1=2PR/(P+R). Undefined empty
entity denominators report zero; totals are shown. Relevant subsets for quantity,
negation, constraints and clarification avoid hiding rare failures among empty
slots. Reports also include split and overlapping language-tag groups; their
counts must not be summed as independent observations. Free-form reason wording,
entity ordering and arbitrary local ID names do not affect semantic comparison.
Quantity/intent links do affect semantic exactness. This is not macro intent F1,
span F1, calibrated confidence, user satisfaction or inference latency evaluation.

Golden metric tests intentionally alter quantities, remove a second intent and
inject bad outputs to verify that syntactically valid predictions can still fail.
Artifact hashes bind reports to data, adapter, schema and evaluator versions.

## Verification and N3 boundary

Run locally with installed dependencies; no installation or network required:

```text
node scripts/test-nlu.cjs
node scripts/evaluate-nlu.cjs --report output/nlu-report.json
npm run test:menu
npm run test:acquisition
npm test
npm run test:data
npm run lint
npm run typecheck
```

For guarded regression processes preload `scripts/offline-network-guard.cjs` via
NODE_OPTIONS. Use a disposable LOCAL_DATA_DIR and mock persistence. Build needs
the existing `tests/fixtures/build/offline-google-fonts.cjs` hook via
NEXT_FONT_GOOGLE_MOCKED_RESPONSES; enable NEXT_TELEMETRY_DISABLED and the network
guard. This verifies compilation with local font responses, not live font retrieval.

The acceptance runner contains 28 tests covering the N1 15 cases, N2 16–20 and
additional negative/metric checks. Full menu/acquisition
regressions remain separate actual commands; the focused runner does not claim
to execute those suites. No existing package script or runtime module is changed.

N3 proposal: independent human annotation review, finer evidence spans, stronger
near-duplicate auditing and a sealed new holdout; then an explicitly authorized
shadow inference experiment through the existing provider interface. Report cost,
latency, unsupported cases and grounded semantic errors separately. No runtime
mutation integration or paid inference is authorized by completion of N2.

Offline webpack build command for PowerShell (an absolute preload path is needed
because child workers can change directory; forward slashes preserve Windows paths):

```powershell
$guard = (Resolve-Path scripts/offline-network-guard.cjs).Path.Replace([char]92, [char]47)
$env:NODE_OPTIONS = '--require "' + $guard + '"'
$env:NEXT_FONT_GOOGLE_MOCKED_RESPONSES = (Resolve-Path tests/fixtures/build/offline-google-fonts.cjs).Path
$env:NEXT_TELEMETRY_DISABLED = '1'
$env:AI_PROVIDER = 'mock'
$env:PERSISTENCE_DRIVER = 'mock'
$env:LOCAL_DATA_DIR = Join-Path $env:TEMP ('kfc-n2-build-' + [guid]::NewGuid())
npm run build -- --webpack
```
