# B00 policy log — v1

## Status and provenance

**Scope: policy logging only. No dataset case is reviewed, adjudicated or approved by this log.**

- Log version: `B00-policy-v1`.
- Decision source: the user's message titled **“KFC Force Agent — B00 Policy Logging & B01 Readiness (Documentation Only)”**, section “Approved policy selections”.
- Selection provenance: **user-provided owner policy selections**, transcribed below. This records what was explicitly supplied; it does not create a signature or authenticate an identity.
- Owner/reviewer identity: not supplied; not populated.
- Decision timestamp / signature: not supplied; not populated. No timestamp is inferred from file metadata, chat dates or earlier report dates.
- Supersedes: no prior owner-selected policy log is established by the inspected evidence. Earlier N3.1A proposals remain historical, unmodified documents.
- Applicable use: guidance for independent B01 review; not a change to schema, evaluator, labels, manifests or transaction permissions.

Selection letters below belong to **this owner-provided B00 selection list**. They are not the A/B/C option IDs attached to individual questions in old review cards. In particular, D04-CONTENTS and D04-ATTR remain separate, and no per-record option is selected by copying a policy letter.

## Owner-selected policies — verbatim meanings

| Decision ID | Selection | User-provided policy meaning |
|---|---|---|
| D01 | B | separate current-turn semantics and accumulated requested state. |
| D02 | B | clarification only when missing or ambiguous information blocks the required step. |
| D03 | B | understood product mention with entity-resolution `no_match` when catalog lookup fails; never invent product IDs. |
| D04-CONTENTS | A | distinguish ingredients, included_items, unspecified; require trusted menu evidence for factual claims. |
| D04-ATTR | B | preserve requested attributes; do not assert menu capability without evidence. |
| D05 | A | resolve references only with sufficient trusted evidence; otherwise unresolved. |
| D06 | A | preserve delta/absolute/keep and measurement semantics; deterministic cart computation. |
| D07 | A | semantic negation scope and target-specific polarity. |
| D08 | B | budget operator, approximation, scope and evidence in successor contract. |
| D09 | A | separate all_missing_slots and next_question_slot. |
| D10 | A | distinguish assent, cancel recommendation, cart operations and order confirmation; transaction gates remain separate. |

## Policy consistency checklist

These are **documentation/policy consistency checks**, not human-review outcomes for any case.

| Check | Result | Reason / boundary |
|---|---|---|
| All explicitly supplied selections preserved | PASS | 11 distinct decision IDs, with the exact supplied letters and meanings |
| Contents and requested attributes remain separate | PASS | D04-CONTENTS concerns the relation being asked about; D04-ATTR concerns what is requested, not what the menu can supply |
| Current-turn semantics does not execute accumulated requests | PASS | D01 separates layers; D06/D10 keep calculation and transaction permissions outside language annotation |
| Understanding is distinct from catalog resolution | PASS | D03 allows no_match without invented IDs; D05 requires evidence for references |
| Clarification has a blocking criterion | PASS | D02 is compatible with D09: all missing information and the next question are distinct |
| Request constraints are not factual menu claims | PASS | D04-CONTENTS/D04-ATTR require evidence for capabilities and factual contents |
| Quantity and polarity remain target-specific | PASS | D06/D07 do not authorize default quantities, blanket negation or deriving counts from volume |
| Budget refinements do not silently extend N2 | PASS | D08 explicitly refers to a successor contract; old data/schema remain unchanged |
| Policy agreement does not approve records or paid inference | PASS | No record outcomes, identities, signatures or API permissions are created here |
| Contradiction among the supplied policy principles | NONE IDENTIFIED | This is a consistency assessment of the supplied principles, not a proof that implementation details are settled |

## Unresolved implementation details — not decided by this log

1. Exact successor envelope and field names for current-turn semantics versus accumulated requested state, including evidence turn IDs and replacement/cancellation semantics.
2. Canonical intent names for refining a request, answering a real clarification, keeping a quantity and cancelling a recommendation. Policy selection does not select an enum or candidate label for B01.
3. What the “required step” is for each capability, which slots block it and which questions are optional. Do not derive mandatory slots from a particular golden case.
4. Binding representation for resolved / ambiguous / no_match / unresolved and candidate lists; do not collapse no_match into a language-understanding error merely because N2 has only ID/null.
5. Evidence sufficiency, allowed antecedent scope and time boundaries; how to represent historical references when no assistant transcript or display history exists.
6. Contents relation versus subject kind, the meaning of unspecified, and the boundary between a desired attribute and a fact about ingredients/options/availability.
7. Quantity `keep`, target domain (cart versus pending request), units, range/approximation and deterministic computation rules. No cart calculation is performed in this documentation task.
8. Budget operator vocabulary, approximation qualifier, unknown scope and evidence offsets; a human policy decision is needed where the wording supports alternatives.
9. Encoding and ordering of all_missing_slots and next_question_slot, including multiple intents and selectively blocked subrequests.
10. Independent review/adjudication audit fields, signatures or identity verification, release authority and how a future approved release would project to an operational manifest.
11. Successor schema/evaluator migration, acceptable-alternative scoring, versioning, split checks and a separately held-out evaluation set. No earlier mock result validates the selected policies.

These are implementation gates, not contradictions automatically resolved by Codex. Reviewers may mark an item policy_blocked and explain the gap; they must not invent missing evidence or assume a new schema is already active.

## B01 handoff

Use [B01-v1 packet](B01-v1/README.md). It contains exactly the six B01 cases already identified in the N3.1A queue, with original hashes, trusted context, permitted history and original golden snapshots. The golden snapshots are references awaiting review, not labels ratified by B00.

Reviewer A and B receive separate blank forms with the same permitted inputs. Neither form embeds old Codex recommendations, case-specific suggested decisions or model predictions. The adjudicator form is separate and remains blank until the two independent reviews exist.

No record approval, source modification, runtime change, API call or commit/push is authorized by this policy log.
