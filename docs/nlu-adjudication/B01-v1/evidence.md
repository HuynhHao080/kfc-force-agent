# B01-v1 — Original review evidence

**Documentation-only packet. Six original B01 cases; none reviewed, adjudicated or approved.** Source hashes are verified against dataset, N3.1A queue and current review manifest. Policy selections do not overwrite the historical labels below.

Policy reference: [B00-policy-v1](../B00-policy-v1.md). Reviewer forms contain permitted inputs and blank response fields; old Codex recommendations and predictions are not part of this packet.

## Trusted context

All six cases have the exact same original seed_demo context below. This does not establish real KFC facts. It contains no assistant transcript or evidence that prior proposals changed the cart.

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

## Original cases

### N2-D-BUDGET-1-1

Original case hash: `be7e5d4b750a397c796469cc618cb0948d76ee5d99b51a710c6f2914297e100f`. Split `train`; group `dialogue-family-budget`; dialogue `dialogue-budget-1`; turn 1.

Original utterance: Tư vấn đồ ăn cho nhóm mình

Allowed earlier user turns only:
None. Do not invent an assistant question or earlier dialogue.

Trusted context: exact shared context above; unchanged at this turn. Later cases in the bundle are not evidence for this case.

Original golden snapshot (historical reference, **not approved**):

```json
{
  "status": "needs_clarification",
  "missingSlots": [
    "meaning"
  ],
  "reason": "Need recommendation requirements",
  "intents": [
    {
      "id": "i",
      "kind": "request_recommendation",
      "polarity": "affirmed",
      "targetIds": []
    }
  ],
  "entities": []
}
```

### N2-D-BUDGET-1-2

Original case hash: `377c7491629453453214028c719b336bee3678026f77f7696c14aaddb87e5490`. Split `train`; group `dialogue-family-budget`; dialogue `dialogue-budget-1`; turn 2.

Original utterance: Tụi mình có bốn người ăn

Allowed earlier user turns only:
- N2-D-BUDGET-1-1: Tư vấn đồ ăn cho nhóm mình

Trusted context: exact shared context above; unchanged at this turn. Later cases in the bundle are not evidence for this case.

Original golden snapshot (historical reference, **not approved**):

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "request_recommendation",
      "polarity": "affirmed",
      "targetIds": []
    }
  ],
  "entities": [
    {
      "id": "n",
      "kind": "party_size",
      "text": "Tụi mình có bốn người ăn",
      "value": 4
    }
  ]
}
```

### N2-D-BUDGET-1-3

Original case hash: `465c8efb40323b01819c0dfadde06cf49498fcc96d7a3c54c6ea997e0691ed14`. Split `train`; group `dialogue-family-budget`; dialogue `dialogue-budget-1`; turn 3.

Original utterance: Chi tối đa ba trăm nghìn cả nhóm

Allowed earlier user turns only:
- N2-D-BUDGET-1-1: Tư vấn đồ ăn cho nhóm mình
- N2-D-BUDGET-1-2: Tụi mình có bốn người ăn

Trusted context: exact shared context above; unchanged at this turn. Later cases in the bundle are not evidence for this case.

Original golden snapshot (historical reference, **not approved**):

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "request_recommendation",
      "polarity": "affirmed",
      "targetIds": []
    }
  ],
  "entities": [
    {
      "id": "n",
      "kind": "party_size",
      "text": "Chi tối đa ba trăm nghìn cả nhóm",
      "value": 4
    },
    {
      "id": "b",
      "kind": "budget",
      "text": "Chi tối đa ba trăm nghìn cả nhóm",
      "amount": 300000,
      "currency": "VND",
      "scope": "total"
    }
  ]
}
```

### N2-D-BUDGET-2-1

Original case hash: `2d2659b37f6c418dc79ae532fd0626e54880e7a850895a9bb50abc71d9aaa0f2`. Split `train`; group `dialogue-family-budget`; dialogue `dialogue-budget-2`; turn 1.

Original utterance: Nhóm mình cần gợi ý món ăn

Allowed earlier user turns only:
None. Do not invent an assistant question or earlier dialogue.

Trusted context: exact shared context above; unchanged at this turn. Later cases in the bundle are not evidence for this case.

Original golden snapshot (historical reference, **not approved**):

```json
{
  "status": "needs_clarification",
  "missingSlots": [
    "meaning"
  ],
  "reason": "Need recommendation requirements",
  "intents": [
    {
      "id": "i",
      "kind": "request_recommendation",
      "polarity": "affirmed",
      "targetIds": []
    }
  ],
  "entities": []
}
```

### N2-D-BUDGET-2-2

Original case hash: `5053e210b8f4f7bbc14c52e05c3e5e65ef94071908aa3ae19fb4b7d9d680b609`. Split `train`; group `dialogue-family-budget`; dialogue `dialogue-budget-2`; turn 2.

Original utterance: Nhóm này gồm 4 người nhé

Allowed earlier user turns only:
- N2-D-BUDGET-2-1: Nhóm mình cần gợi ý món ăn

Trusted context: exact shared context above; unchanged at this turn. Later cases in the bundle are not evidence for this case.

Original golden snapshot (historical reference, **not approved**):

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "request_recommendation",
      "polarity": "affirmed",
      "targetIds": []
    }
  ],
  "entities": [
    {
      "id": "n",
      "kind": "party_size",
      "text": "Nhóm này gồm 4 người nhé",
      "value": 4
    }
  ]
}
```

### N2-D-BUDGET-2-3

Original case hash: `a4fadfd48c57921de80f687578670e70c6a177fd8a7954dda966f32142527582`. Split `train`; group `dialogue-family-budget`; dialogue `dialogue-budget-2`; turn 3.

Original utterance: Tổng ngân sách nhóm là 300k thôi

Allowed earlier user turns only:
- N2-D-BUDGET-2-1: Nhóm mình cần gợi ý món ăn
- N2-D-BUDGET-2-2: Nhóm này gồm 4 người nhé

Trusted context: exact shared context above; unchanged at this turn. Later cases in the bundle are not evidence for this case.

Original golden snapshot (historical reference, **not approved**):

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "request_recommendation",
      "polarity": "affirmed",
      "targetIds": []
    }
  ],
  "entities": [
    {
      "id": "n",
      "kind": "party_size",
      "text": "Tổng ngân sách nhóm là 300k thôi",
      "value": 4
    },
    {
      "id": "b",
      "kind": "budget",
      "text": "Tổng ngân sách nhóm là 300k thôi",
      "amount": 300000,
      "currency": "VND",
      "scope": "total"
    }
  ]
}
```
