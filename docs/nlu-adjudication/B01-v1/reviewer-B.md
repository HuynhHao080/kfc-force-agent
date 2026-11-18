# B01-v1 — Independent reviewer B form

**Blank human-review form. No case decision, proposed label, signature or review timestamp has been populated.**

Reviewer identity: ____________________
Review date/time (enter only when actually reviewing): ____________________
Signature / attestation (if required by the owner): ____________________
Policy version consulted: ____________________

Use only the policy selections in [B00-policy-v1](../B00-policy-v1.md) and the permitted inputs below. Work independently; do not consult the other reviewer, historical recommendation cards or inference outputs. First write your own interpretation; only then compare with the original golden snapshots in evidence.md. Do not use future turns or other dialogues even if their sections are visible in this bundle.

## Original trusted context

```json
{
  "classification": "seed_demo",
  "menuVersion": "n2-synthetic-v1",
  "storeId": "demo-a",
  "channel": "pickup",
  "products": [
    {
      "id": "demo-pepsi",
      "name": "Pepsi",
      "options": [
        {
          "id": "size",
          "values": [
            "small",
            "large"
          ]
        }
      ]
    },
    {
      "id": "demo-burger",
      "name": "Burger demo",
      "options": [
        {
          "id": "spice",
          "values": [
            "mild",
            "hot"
          ]
        }
      ]
    },
    {
      "id": "demo-fries",
      "name": "Khoai demo",
      "options": []
    }
  ],
  "cart": {
    "revision": "r1",
    "lines": [
      {
        "id": "line1",
        "productId": "demo-pepsi",
        "quantity": 3,
        "optionValueIds": []
      }
    ]
  },
  "references": [
    {
      "id": "last-item",
      "productId": "demo-pepsi"
    }
  ]
}
```

The context is synthetic; no cart changes or menu capability claims may be inferred from a requested state.

## N2-D-BUDGET-1-1

Original hash: `be7e5d4b750a397c796469cc618cb0948d76ee5d99b51a710c6f2914297e100f`. Split `train`; group `dialogue-family-budget`; dialogue `dialogue-budget-1`; turn 1.

Original utterance: Tư vấn đồ ăn cho nhóm mình

Allowed history:
None.

Trusted context: exact shared context above. No assistant question/response is supplied.

### Independent interpretation — leave blank until human review

- Current-turn semantics / intents: ____________________
- Entities, references, quantity/measurement semantics where applicable: ____________________
- Requested attributes versus supported menu facts: ____________________
- Accumulated requested state, distinguished from cart: ____________________
- Evidence source for each explicit or inherited slot: ____________________
- Entity resolution and sufficient-evidence reasoning: ____________________
- Required step: ____________________
- all_missing_slots: ____________________
- next_question_slot: ____________________
- What blocks the required step, if anything: ____________________
- Relevant policy IDs and unresolved implementation details: ____________________
- Independent annotation / free-text alternative (do not force an unavailable schema): ____________________

### Comparison after independent interpretation

- Original golden consulted: ____________________
- Outcome (enter keep / propose_revision / acceptable_alternative / insufficient_evidence / policy_blocked / propose_exclusion): ____________________
- Rationale and evidence: ____________________
- Proposed change, if any: ____________________
- Confidence / uncertainty: ____________________
- Human reviewer attestation: ____________________
- Actual review time: ____________________

## N2-D-BUDGET-1-2

Original hash: `377c7491629453453214028c719b336bee3678026f77f7696c14aaddb87e5490`. Split `train`; group `dialogue-family-budget`; dialogue `dialogue-budget-1`; turn 2.

Original utterance: Tụi mình có bốn người ăn

Allowed history:
- N2-D-BUDGET-1-1: Tư vấn đồ ăn cho nhóm mình

Trusted context: exact shared context above. No assistant question/response is supplied.

### Independent interpretation — leave blank until human review

- Current-turn semantics / intents: ____________________
- Entities, references, quantity/measurement semantics where applicable: ____________________
- Requested attributes versus supported menu facts: ____________________
- Accumulated requested state, distinguished from cart: ____________________
- Evidence source for each explicit or inherited slot: ____________________
- Entity resolution and sufficient-evidence reasoning: ____________________
- Required step: ____________________
- all_missing_slots: ____________________
- next_question_slot: ____________________
- What blocks the required step, if anything: ____________________
- Relevant policy IDs and unresolved implementation details: ____________________
- Independent annotation / free-text alternative (do not force an unavailable schema): ____________________

### Comparison after independent interpretation

- Original golden consulted: ____________________
- Outcome (enter keep / propose_revision / acceptable_alternative / insufficient_evidence / policy_blocked / propose_exclusion): ____________________
- Rationale and evidence: ____________________
- Proposed change, if any: ____________________
- Confidence / uncertainty: ____________________
- Human reviewer attestation: ____________________
- Actual review time: ____________________

## N2-D-BUDGET-1-3

Original hash: `465c8efb40323b01819c0dfadde06cf49498fcc96d7a3c54c6ea997e0691ed14`. Split `train`; group `dialogue-family-budget`; dialogue `dialogue-budget-1`; turn 3.

Original utterance: Chi tối đa ba trăm nghìn cả nhóm

Allowed history:
- N2-D-BUDGET-1-1: Tư vấn đồ ăn cho nhóm mình
- N2-D-BUDGET-1-2: Tụi mình có bốn người ăn

Trusted context: exact shared context above. No assistant question/response is supplied.

### Independent interpretation — leave blank until human review

- Current-turn semantics / intents: ____________________
- Entities, references, quantity/measurement semantics where applicable: ____________________
- Requested attributes versus supported menu facts: ____________________
- Accumulated requested state, distinguished from cart: ____________________
- Evidence source for each explicit or inherited slot: ____________________
- Entity resolution and sufficient-evidence reasoning: ____________________
- Required step: ____________________
- all_missing_slots: ____________________
- next_question_slot: ____________________
- What blocks the required step, if anything: ____________________
- Relevant policy IDs and unresolved implementation details: ____________________
- Independent annotation / free-text alternative (do not force an unavailable schema): ____________________

### Comparison after independent interpretation

- Original golden consulted: ____________________
- Outcome (enter keep / propose_revision / acceptable_alternative / insufficient_evidence / policy_blocked / propose_exclusion): ____________________
- Rationale and evidence: ____________________
- Proposed change, if any: ____________________
- Confidence / uncertainty: ____________________
- Human reviewer attestation: ____________________
- Actual review time: ____________________

## N2-D-BUDGET-2-1

Original hash: `2d2659b37f6c418dc79ae532fd0626e54880e7a850895a9bb50abc71d9aaa0f2`. Split `train`; group `dialogue-family-budget`; dialogue `dialogue-budget-2`; turn 1.

Original utterance: Nhóm mình cần gợi ý món ăn

Allowed history:
None.

Trusted context: exact shared context above. No assistant question/response is supplied.

### Independent interpretation — leave blank until human review

- Current-turn semantics / intents: ____________________
- Entities, references, quantity/measurement semantics where applicable: ____________________
- Requested attributes versus supported menu facts: ____________________
- Accumulated requested state, distinguished from cart: ____________________
- Evidence source for each explicit or inherited slot: ____________________
- Entity resolution and sufficient-evidence reasoning: ____________________
- Required step: ____________________
- all_missing_slots: ____________________
- next_question_slot: ____________________
- What blocks the required step, if anything: ____________________
- Relevant policy IDs and unresolved implementation details: ____________________
- Independent annotation / free-text alternative (do not force an unavailable schema): ____________________

### Comparison after independent interpretation

- Original golden consulted: ____________________
- Outcome (enter keep / propose_revision / acceptable_alternative / insufficient_evidence / policy_blocked / propose_exclusion): ____________________
- Rationale and evidence: ____________________
- Proposed change, if any: ____________________
- Confidence / uncertainty: ____________________
- Human reviewer attestation: ____________________
- Actual review time: ____________________

## N2-D-BUDGET-2-2

Original hash: `5053e210b8f4f7bbc14c52e05c3e5e65ef94071908aa3ae19fb4b7d9d680b609`. Split `train`; group `dialogue-family-budget`; dialogue `dialogue-budget-2`; turn 2.

Original utterance: Nhóm này gồm 4 người nhé

Allowed history:
- N2-D-BUDGET-2-1: Nhóm mình cần gợi ý món ăn

Trusted context: exact shared context above. No assistant question/response is supplied.

### Independent interpretation — leave blank until human review

- Current-turn semantics / intents: ____________________
- Entities, references, quantity/measurement semantics where applicable: ____________________
- Requested attributes versus supported menu facts: ____________________
- Accumulated requested state, distinguished from cart: ____________________
- Evidence source for each explicit or inherited slot: ____________________
- Entity resolution and sufficient-evidence reasoning: ____________________
- Required step: ____________________
- all_missing_slots: ____________________
- next_question_slot: ____________________
- What blocks the required step, if anything: ____________________
- Relevant policy IDs and unresolved implementation details: ____________________
- Independent annotation / free-text alternative (do not force an unavailable schema): ____________________

### Comparison after independent interpretation

- Original golden consulted: ____________________
- Outcome (enter keep / propose_revision / acceptable_alternative / insufficient_evidence / policy_blocked / propose_exclusion): ____________________
- Rationale and evidence: ____________________
- Proposed change, if any: ____________________
- Confidence / uncertainty: ____________________
- Human reviewer attestation: ____________________
- Actual review time: ____________________

## N2-D-BUDGET-2-3

Original hash: `a4fadfd48c57921de80f687578670e70c6a177fd8a7954dda966f32142527582`. Split `train`; group `dialogue-family-budget`; dialogue `dialogue-budget-2`; turn 3.

Original utterance: Tổng ngân sách nhóm là 300k thôi

Allowed history:
- N2-D-BUDGET-2-1: Nhóm mình cần gợi ý món ăn
- N2-D-BUDGET-2-2: Nhóm này gồm 4 người nhé

Trusted context: exact shared context above. No assistant question/response is supplied.

### Independent interpretation — leave blank until human review

- Current-turn semantics / intents: ____________________
- Entities, references, quantity/measurement semantics where applicable: ____________________
- Requested attributes versus supported menu facts: ____________________
- Accumulated requested state, distinguished from cart: ____________________
- Evidence source for each explicit or inherited slot: ____________________
- Entity resolution and sufficient-evidence reasoning: ____________________
- Required step: ____________________
- all_missing_slots: ____________________
- next_question_slot: ____________________
- What blocks the required step, if anything: ____________________
- Relevant policy IDs and unresolved implementation details: ____________________
- Independent annotation / free-text alternative (do not force an unavailable schema): ____________________

### Comparison after independent interpretation

- Original golden consulted: ____________________
- Outcome (enter keep / propose_revision / acceptable_alternative / insufficient_evidence / policy_blocked / propose_exclusion): ____________________
- Rationale and evidence: ____________________
- Proposed change, if any: ____________________
- Confidence / uncertainty: ____________________
- Human reviewer attestation: ____________________
- Actual review time: ____________________

## Handoff

Send this completed form privately to the designated adjudicator. Do not copy values into the operational review manifest or dataset. Owner policy logging and a completed reviewer form do not by themselves release an approved dataset.
