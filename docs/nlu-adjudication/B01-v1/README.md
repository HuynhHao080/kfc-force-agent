# B01-v1 — Human review readiness packet

## Documentation-only status

- B00_POLICY_LOGGED: PASS — 11 owner-provided policy selections recorded in a new versioned log.
- B00_POLICY_CONSISTENCY: PASS at policy-principle level; implementation details remain open.
- B01_REVIEW_PACKET_READY: PASS for independent human review only, not label release.
- HUMAN_REVIEW_STATUS: NOT_PERFORMED — six B01 cases and all 140 dataset records remain pending.

No identities, signatures or decision timestamps have been supplied or invented. Policy provenance is the current user-provided selection message; it is not a signed per-record approval.

## Baseline and preservation

Branch main; HEAD a1cfeb4c093b532a48eada804031778f1b5ff55b. Existing S1/N2/N3.1/N3.1A worktree changes remain in place. Only new documentation artifacts are added; no code, dataset, fixture, manifest, schema, evaluator or runtime edits are made.

## Contents

- [Policy log](../B00-policy-v1.md): the supplied selections, consistency checklist and open implementation details.
- [Evidence, human-readable](evidence.md) and [evidence JSON](evidence.json): exactly six cases with original hashes, trusted context, permitted prior user history and historical golden snapshots.
- [Reviewer A](reviewer-A.md) and [Reviewer B](reviewer-B.md): separate blank forms, no case-specific suggested answers or inference results.
- [Adjudicator](adjudicator.md): a separate blank reconciliation form.

## Exact B01 inventory

| Case ID | Original case hash |
|---|---|
| N2-D-BUDGET-1-1 | `be7e5d4b750a397c796469cc618cb0948d76ee5d99b51a710c6f2914297e100f` |
| N2-D-BUDGET-1-2 | `377c7491629453453214028c719b336bee3678026f77f7696c14aaddb87e5490` |
| N2-D-BUDGET-1-3 | `465c8efb40323b01819c0dfadde06cf49498fcc96d7a3c54c6ea997e0691ed14` |
| N2-D-BUDGET-2-1 | `2d2659b37f6c418dc79ae532fd0626e54880e7a850895a9bb50abc71d9aaa0f2` |
| N2-D-BUDGET-2-2 | `5053e210b8f4f7bbc14c52e05c3e5e65ef94071908aa3ae19fb4b7d9d680b609` |
| N2-D-BUDGET-2-3 | `a4fadfd48c57921de80f687578670e70c6a177fd8a7954dda966f32142527582` |

This batch contains two complete three-turn train dialogues in the original dialogue-family-budget group. No substitutions, extra records, split changes or future-history augmentation are included.

## Independent review procedure

1. The responsible owner assigns real reviewer A, reviewer B and an adjudicator; identities are not assumed here.
2. Give each reviewer only their own blank form and the common owner-selected policy log. Inputs are identical; outcomes remain separate. Do not use historical recommendation cards or model-output fixtures.
3. Review each dialogue in turn order, using only the history allocated to that case. Later cases are present as separate packet sections, not as allowed evidence for earlier turns; distribute sections sequentially if strict turn-level blinding is required.
4. Reviewers first write their independent interpretation, then consult the historical golden evidence for comparison. Record evidence and uncertainty; do not force a successor schema or resolve open policy details by guesswork.
5. Only after both independent forms exist should the adjudicator reconcile them, recording disagreements and unresolved gates. No reconciliation is performed in this task.
6. Keep any future candidate-label release, manifest update, schema migration, live inference and spending approval as separate authorized steps.

Masking here means content omission from these new forms/packet, not an access-control mechanism for pre-existing repository files. Avoid giving reviewers the historical recommendation documents during the independent phase.

## Remaining gates

- Real humans must complete both forms; conflicts/missing evidence require owner/adjudicator action.
- Exact successor representations, required-step definitions, evidence thresholds, scoring and audit/release fields remain unresolved in the policy log.
- Historical golden labels can differ from the selected policy principles; they are preserved for review, not automatically changed.
- Reviewer assignment, actual review times, signatures and release authority remain unpopulated.
- The operational manifest stays pending; this packet cannot enable approved-only evaluation or live inference.

## Checks

Source case hashes match the dataset, original queue and operational review manifest; original golden snapshots, contexts and allowed histories match source evidence. Cards were checked as an additional historical source, but their recommendations were not copied. Final integrity checks cover exact six-case membership, unchanged source files, blank forms, omitted recommendations/predictions and unchanged pending statuses. No runtime tests or model calls are represented as part of this documentation-only handoff.

Actual checks completed: 11 policy selections match the supplied list; D04-CONTENTS and D04-ATTR are separate; all six case hashes/golden snapshots/contexts/history lists match originals; reviewer A/B contain identical evidence with separate blank response areas; adjudicator fields remain blank; no recommendation payloads or model-output fixtures are embedded. All 140 operational review-manifest records remain pending with reviewer/time null.

SHA-256 comparison: **230 pre-existing files unchanged**, exactly seven new documentation files added. `git diff --check` passed. No pre-existing report was rewritten, no missing case evidence was encountered, and no record decision was inferred from policy consistency checks.
