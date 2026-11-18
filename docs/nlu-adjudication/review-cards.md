# N3.1A — Review cards

**140 cards; tất cả pending. Đề xuất Codex chưa được duyệt.** Bản này sao chép golden nguồn để người review đối chiếu; không là dataset mới và không được nạp vào prompt/evaluator. Chỉ liệt kê history đã tồn tại trước turn; không tạo assistant question.

## Context chung C0

Cả 140 records dùng cùng C0 dưới đây. Context là seed demo, không chứng minh dữ kiện KFC thật. Mỗi card nhắc lại cart/ref và scope; các product/option IDs hợp lệ nằm ở C0.

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

## Batch index

| Batch | Records | Ưu tiên | Focus |
|---|---:|---|---|
| B01 | 6 | original flagged | Review cả hai hội thoại budget; chốt current/state và evidence trước khi chấm |
| B02 | 6 | original flagged | Review cả hai hội thoại spice; chốt current/state và evidence trước khi chấm |
| B03 | 6 | original flagged | Review cả hai hội thoại increase; chốt current/state và evidence trước khi chấm |
| B04 | 6 | original flagged | Review cả hai hội thoại switch; chốt current/state và evidence trước khi chấm |
| B05 | 6 | original flagged | Review cả hai hội thoại recovery; chốt current/state và evidence trước khi chấm |
| B06 | 6 | original flagged | Review cả hai hội thoại ref; chốt current/state và evidence trước khi chấm |
| B07 | 6 | original flagged | Review cả hai hội thoại option; chốt current/state và evidence trước khi chấm |
| B08 | 6 | original flagged | Review cả hai hội thoại volume; chốt current/state và evidence trước khi chấm |
| B09 | 6 | original flagged | Review cả hai hội thoại remove; chốt current/state và evidence trước khi chấm |
| B10 | 6 | original flagged | Review cả hai hội thoại assent; chốt current/state và evidence trước khi chấm |
| B11 | 6 | original flagged | Taxonomy, no_match và reference thiếu provenance |
| B12 | 8 | original flagged | Budget operator/scope và phủ định theo phạm vi |
| B13 | 8 | unflagged pending | Review unflagged độc lập; không auto-pass, giữ cặp paraphrase |
| B14 | 8 | unflagged pending | Review unflagged độc lập; không auto-pass, giữ cặp paraphrase |
| B15 | 8 | unflagged pending | Review unflagged độc lập; không auto-pass, giữ cặp paraphrase |
| B16 | 8 | unflagged pending | Review unflagged độc lập; không auto-pass, giữ cặp paraphrase |
| B17 | 8 | unflagged pending | Review unflagged độc lập; không auto-pass, giữ cặp paraphrase |
| B18 | 8 | unflagged pending | Review unflagged độc lập; không auto-pass, giữ cặp paraphrase |
| B19 | 8 | unflagged pending | Review unflagged độc lập; không auto-pass, giữ cặp paraphrase |
| B20 | 8 | unflagged pending | Review unflagged độc lập; không auto-pass, giữ cặp paraphrase |
| B21 | 2 | unflagged pending | Review unflagged độc lập; không auto-pass, giữ cặp paraphrase |

## N2-D-BUDGET-1-1

Batch B01 · queue 1 · P1_original_flagged · split train · group `dialogue-family-budget` · **pending**

**Câu gốc:** Tư vấn đồ ăn cho nhóm mình

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

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

**Rationale nguồn:** Dialogue budget, turn 1: annotation describes the accumulated request state, not an executed cart. Prior context is synthetic and proposals never mutate it.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `be7e5d4b750a397c796469cc618cb0948d76ee5d99b51a710c6f2914297e100f`.

### Q027 — Clarification policy

Nguồn `clarification_policy`: Generic recommendation is marked needs_clarification/meaning; compare understood recommendation records.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ needs_clarification với missing meaning | Có thể muốn thu thêm requirements trước tư vấn. | Đánh đồng thông tin bổ sung tùy chọn với không hiểu intent rõ. | Không nhất thiết; chờ policy |
| B — understood/request_recommendation, hỏi thêm tùy chọn | Ý muốn được tư vấn nhóm ăn đã rõ, chưa có yêu cầu mua cụ thể. | Không cần bịa party size/budget; chính sách hội thoại có thể hỏi để tư vấn tốt hơn. | Không nhất thiết; chờ policy |
| C — Clarify theo mandatory recommendation slots công bố trước | Phù hợp nếu MVP thực sự bắt buộc số người hoặc ngân sách. | Phải áp dụng đồng đều cho mọi recommendation; không dùng missing meaning để thay slot thực tế thiếu. | Không nhất thiết; chờ policy |

**Codex đề xuất B — CHƯA DUYỆT:** Đề xuất D02: hiểu recommendation trước, tách câu hỏi thêm tùy chọn; không thay nhãn nguồn khi chưa được duyệt.

### Q028 — Current-turn intent vs accumulated state

Nguồn `dialogue_target`: Confirm per-turn intent versus accumulated request state and missing assistant clarification history.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ N2 như snapshot active request/gold hiện tại | Ít thay đổi, vẫn tái lập được evaluator N2. | Phải công bố đang chấm snapshot; nếu dùng các intent lặp lại làm lệnh sẽ hiểu sai thêm món nhiều lần. | Không nhất thiết; chờ policy |
| B — Tách current-turn semantics và requested state | Yêu cầu recommendation có nghĩa rõ. Đề xuất understood/request_recommendation, hỏi requirements thêm ở lớp hội thoại tùy chọn; gold missingSlots=meaning cần phân xử với policy bắt buộc slots. | Chấm hai lớp riêng, giữ evidence turn; cần successor contract/evaluator, không áp vào golden N2. | Có, chưa triển khai |
| C — Chỉ chấm lượt hiện tại và bỏ inherited state | Giảm yêu cầu state khi corpus chưa có assistant turns. | Mất bài kiểm tra giữ preferences/options/reference nhiều lượt; không đáp ứng mục tiêu state nếu không bổ sung tập khác. | Không nhất thiết; chờ policy |

**Codex đề xuất B — CHƯA DUYỆT:** Yêu cầu recommendation có nghĩa rõ. Đề xuất understood/request_recommendation, hỏi requirements thêm ở lớp hội thoại tùy chọn; gold missingSlots=meaning cần phân xử với policy bắt buộc slots. Đề xuất D01, chưa duyệt; giữ bản N2 làm baseline cho tới khi người phụ trách chốt task.

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Current-turn intent vs accumulated state: Yêu cầu recommendation có nghĩa rõ. Đề xuất understood/request_recommendation, hỏi requirements thêm ở lớp hội thoại tùy chọn; gold missingSlots=meaning cần phân xử với policy bắt buộc slots.
- Clarification policy: missingSlots hiện tại [meaning]: phân biệt toàn bộ slot thiếu với slot sẽ hỏi tiếp, không tự điền từ cart.

**Đề xuất theo record, CHƯA DUYỆT:** Yêu cầu recommendation có nghĩa rõ. Đề xuất understood/request_recommendation, hỏi requirements thêm ở lớp hội thoại tùy chọn; gold missingSlots=meaning cần phân xử với policy bắt buộc slots.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-D-BUDGET-1-2

Batch B01 · queue 2 · P1_original_flagged · split train · group `dialogue-family-budget` · **pending**

**Câu gốc:** Tụi mình có bốn người ăn

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
- N2-D-BUDGET-1-1: Tư vấn đồ ăn cho nhóm mình

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

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

**Rationale nguồn:** Dialogue budget, turn 2: annotation describes the accumulated request state, not an executed cart. Prior context is synthetic and proposals never mutate it.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `377c7491629453453214028c719b336bee3678026f77f7696c14aaddb87e5490`.

### Q029 — Current-turn intent vs accumulated state

Nguồn `dialogue_target`: Confirm per-turn intent versus accumulated request state and missing assistant clarification history.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ N2 như snapshot active request/gold hiện tại | Ít thay đổi, vẫn tái lập được evaluator N2. | Phải công bố đang chấm snapshot; nếu dùng các intent lặp lại làm lệnh sẽ hiểu sai thêm món nhiều lần. | Không nhất thiết; chờ policy |
| B — Tách current-turn semantics và requested state | Lượt hiện tại cung cấp party_size=4 cho request recommendation trước. Đề xuất refine_request/provide_constraints, không coi đây là một đề nghị recommendation mới độc lập; requested state giữ 4 người. | Chấm hai lớp riêng, giữ evidence turn; cần successor contract/evaluator, không áp vào golden N2. | Có, chưa triển khai |
| C — Chỉ chấm lượt hiện tại và bỏ inherited state | Giảm yêu cầu state khi corpus chưa có assistant turns. | Mất bài kiểm tra giữ preferences/options/reference nhiều lượt; không đáp ứng mục tiêu state nếu không bổ sung tập khác. | Không nhất thiết; chờ policy |

**Codex đề xuất B — CHƯA DUYỆT:** Lượt hiện tại cung cấp party_size=4 cho request recommendation trước. Đề xuất refine_request/provide_constraints, không coi đây là một đề nghị recommendation mới độc lập; requested state giữ 4 người. Đề xuất D01, chưa duyệt; giữ bản N2 làm baseline cho tới khi người phụ trách chốt task.

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Current-turn intent vs accumulated state: Lượt hiện tại cung cấp party_size=4 cho request recommendation trước. Đề xuất refine_request/provide_constraints, không coi đây là một đề nghị recommendation mới độc lập; requested state giữ 4 người.

**Đề xuất theo record, CHƯA DUYỆT:** Lượt hiện tại cung cấp party_size=4 cho request recommendation trước. Đề xuất refine_request/provide_constraints, không coi đây là một đề nghị recommendation mới độc lập; requested state giữ 4 người.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-D-BUDGET-1-3

Batch B01 · queue 3 · P1_original_flagged · split train · group `dialogue-family-budget` · **pending**

**Câu gốc:** Chi tối đa ba trăm nghìn cả nhóm

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
- N2-D-BUDGET-1-1: Tư vấn đồ ăn cho nhóm mình
- N2-D-BUDGET-1-2: Tụi mình có bốn người ăn

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

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

**Rationale nguồn:** Dialogue budget, turn 3: annotation describes the accumulated request state, not an executed cart. Prior context is synthetic and proposals never mutate it.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `465c8efb40323b01819c0dfadde06cf49498fcc96d7a3c54c6ea997e0691ed14`.

### Q030 — Current-turn intent vs accumulated state

Nguồn `dialogue_target`: Confirm per-turn intent versus accumulated request state and missing assistant clarification history.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ N2 như snapshot active request/gold hiện tại | Ít thay đổi, vẫn tái lập được evaluator N2. | Phải công bố đang chấm snapshot; nếu dùng các intent lặp lại làm lệnh sẽ hiểu sai thêm món nhiều lần. | Không nhất thiết; chờ policy |
| B — Tách current-turn semantics và requested state | Lượt hiện tại bổ sung budget 300000 VND, scope total, upper cap lte. Requested state tiếp tục giữ party_size=4 từ turn trước, không thêm budget như thể được nói lại cùng lượt. | Chấm hai lớp riêng, giữ evidence turn; cần successor contract/evaluator, không áp vào golden N2. | Có, chưa triển khai |
| C — Chỉ chấm lượt hiện tại và bỏ inherited state | Giảm yêu cầu state khi corpus chưa có assistant turns. | Mất bài kiểm tra giữ preferences/options/reference nhiều lượt; không đáp ứng mục tiêu state nếu không bổ sung tập khác. | Không nhất thiết; chờ policy |

**Codex đề xuất B — CHƯA DUYỆT:** Lượt hiện tại bổ sung budget 300000 VND, scope total, upper cap lte. Requested state tiếp tục giữ party_size=4 từ turn trước, không thêm budget như thể được nói lại cùng lượt. Đề xuất D01, chưa duyệt; giữ bản N2 làm baseline cho tới khi người phụ trách chốt task.

### Q031 — Entity ambiguity

Nguồn `budget_operator`: N2 encodes amount/scope but not strict < versus <=; avoid penalizing this unrepresentable distinction.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ amount/scope N2, bỏ phân biệt operator khi chấm | N2 chưa có field operator. | Tương thích hiện tại nhưng không được tuyên bố đã kiểm tra strict lt/lte. | Không nhất thiết; chờ policy |
| B — Bổ sung operator/approximation/scope evidence ở successor | 300k là tổng upper budget lte; giữ party_size=4 bằng evidence turn trước. | Làm rõ constraint accuracy và có thể khiến các paraphrase cùng group mang giá trị khác nhau; cần schema/version mới. | Có, chưa triển khai |
| C — needs_clarification khi operator hoặc scope thực sự chưa rõ | Giữ nguyên điều chưa biết thay vì suy đoán. | Không hỏi lại câu đã rõ chỉ vì schema chưa có field; schema gap khác linguistic ambiguity. | Không nhất thiết; chờ policy |

**Codex đề xuất B — CHƯA DUYỆT:** 300k là tổng upper budget lte; giữ party_size=4 bằng evidence turn trước. Codex đề xuất D08; không điền operator vào gold gốc.

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Current-turn intent vs accumulated state: Lượt hiện tại bổ sung budget 300000 VND, scope total, upper cap lte. Requested state tiếp tục giữ party_size=4 từ turn trước, không thêm budget như thể được nói lại cùng lượt.

**Đề xuất theo record, CHƯA DUYỆT:** Lượt hiện tại bổ sung budget 300000 VND, scope total, upper cap lte. Requested state tiếp tục giữ party_size=4 từ turn trước, không thêm budget như thể được nói lại cùng lượt.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-D-BUDGET-2-1

Batch B01 · queue 4 · P1_original_flagged · split train · group `dialogue-family-budget` · **pending**

**Câu gốc:** Nhóm mình cần gợi ý món ăn

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

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

**Rationale nguồn:** Dialogue budget, turn 1: annotation describes the accumulated request state, not an executed cart. Prior context is synthetic and proposals never mutate it.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `2d2659b37f6c418dc79ae532fd0626e54880e7a850895a9bb50abc71d9aaa0f2`.

### Q032 — Clarification policy

Nguồn `clarification_policy`: Generic recommendation is marked needs_clarification/meaning; compare understood recommendation records.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ needs_clarification với missing meaning | Có thể muốn thu thêm requirements trước tư vấn. | Đánh đồng thông tin bổ sung tùy chọn với không hiểu intent rõ. | Không nhất thiết; chờ policy |
| B — understood/request_recommendation, hỏi thêm tùy chọn | Ý muốn được tư vấn nhóm ăn đã rõ, chưa có yêu cầu mua cụ thể. | Không cần bịa party size/budget; chính sách hội thoại có thể hỏi để tư vấn tốt hơn. | Không nhất thiết; chờ policy |
| C — Clarify theo mandatory recommendation slots công bố trước | Phù hợp nếu MVP thực sự bắt buộc số người hoặc ngân sách. | Phải áp dụng đồng đều cho mọi recommendation; không dùng missing meaning để thay slot thực tế thiếu. | Không nhất thiết; chờ policy |

**Codex đề xuất B — CHƯA DUYỆT:** Đề xuất D02: hiểu recommendation trước, tách câu hỏi thêm tùy chọn; không thay nhãn nguồn khi chưa được duyệt.

### Q033 — Current-turn intent vs accumulated state

Nguồn `dialogue_target`: Confirm per-turn intent versus accumulated request state and missing assistant clarification history.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ N2 như snapshot active request/gold hiện tại | Ít thay đổi, vẫn tái lập được evaluator N2. | Phải công bố đang chấm snapshot; nếu dùng các intent lặp lại làm lệnh sẽ hiểu sai thêm món nhiều lần. | Không nhất thiết; chờ policy |
| B — Tách current-turn semantics và requested state | Yêu cầu recommendation có nghĩa rõ. Đề xuất understood/request_recommendation, hỏi requirements thêm ở lớp hội thoại tùy chọn; gold missingSlots=meaning cần phân xử với policy bắt buộc slots. | Chấm hai lớp riêng, giữ evidence turn; cần successor contract/evaluator, không áp vào golden N2. | Có, chưa triển khai |
| C — Chỉ chấm lượt hiện tại và bỏ inherited state | Giảm yêu cầu state khi corpus chưa có assistant turns. | Mất bài kiểm tra giữ preferences/options/reference nhiều lượt; không đáp ứng mục tiêu state nếu không bổ sung tập khác. | Không nhất thiết; chờ policy |

**Codex đề xuất B — CHƯA DUYỆT:** Yêu cầu recommendation có nghĩa rõ. Đề xuất understood/request_recommendation, hỏi requirements thêm ở lớp hội thoại tùy chọn; gold missingSlots=meaning cần phân xử với policy bắt buộc slots. Đề xuất D01, chưa duyệt; giữ bản N2 làm baseline cho tới khi người phụ trách chốt task.

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Current-turn intent vs accumulated state: Yêu cầu recommendation có nghĩa rõ. Đề xuất understood/request_recommendation, hỏi requirements thêm ở lớp hội thoại tùy chọn; gold missingSlots=meaning cần phân xử với policy bắt buộc slots.
- Clarification policy: missingSlots hiện tại [meaning]: phân biệt toàn bộ slot thiếu với slot sẽ hỏi tiếp, không tự điền từ cart.

**Đề xuất theo record, CHƯA DUYỆT:** Yêu cầu recommendation có nghĩa rõ. Đề xuất understood/request_recommendation, hỏi requirements thêm ở lớp hội thoại tùy chọn; gold missingSlots=meaning cần phân xử với policy bắt buộc slots.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-D-BUDGET-2-2

Batch B01 · queue 5 · P1_original_flagged · split train · group `dialogue-family-budget` · **pending**

**Câu gốc:** Nhóm này gồm 4 người nhé

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
- N2-D-BUDGET-2-1: Nhóm mình cần gợi ý món ăn

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

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

**Rationale nguồn:** Dialogue budget, turn 2: annotation describes the accumulated request state, not an executed cart. Prior context is synthetic and proposals never mutate it.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `5053e210b8f4f7bbc14c52e05c3e5e65ef94071908aa3ae19fb4b7d9d680b609`.

### Q034 — Current-turn intent vs accumulated state

Nguồn `dialogue_target`: Confirm per-turn intent versus accumulated request state and missing assistant clarification history.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ N2 như snapshot active request/gold hiện tại | Ít thay đổi, vẫn tái lập được evaluator N2. | Phải công bố đang chấm snapshot; nếu dùng các intent lặp lại làm lệnh sẽ hiểu sai thêm món nhiều lần. | Không nhất thiết; chờ policy |
| B — Tách current-turn semantics và requested state | Lượt hiện tại cung cấp party_size=4 cho request recommendation trước. Đề xuất refine_request/provide_constraints, không coi đây là một đề nghị recommendation mới độc lập; requested state giữ 4 người. | Chấm hai lớp riêng, giữ evidence turn; cần successor contract/evaluator, không áp vào golden N2. | Có, chưa triển khai |
| C — Chỉ chấm lượt hiện tại và bỏ inherited state | Giảm yêu cầu state khi corpus chưa có assistant turns. | Mất bài kiểm tra giữ preferences/options/reference nhiều lượt; không đáp ứng mục tiêu state nếu không bổ sung tập khác. | Không nhất thiết; chờ policy |

**Codex đề xuất B — CHƯA DUYỆT:** Lượt hiện tại cung cấp party_size=4 cho request recommendation trước. Đề xuất refine_request/provide_constraints, không coi đây là một đề nghị recommendation mới độc lập; requested state giữ 4 người. Đề xuất D01, chưa duyệt; giữ bản N2 làm baseline cho tới khi người phụ trách chốt task.

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Current-turn intent vs accumulated state: Lượt hiện tại cung cấp party_size=4 cho request recommendation trước. Đề xuất refine_request/provide_constraints, không coi đây là một đề nghị recommendation mới độc lập; requested state giữ 4 người.

**Đề xuất theo record, CHƯA DUYỆT:** Lượt hiện tại cung cấp party_size=4 cho request recommendation trước. Đề xuất refine_request/provide_constraints, không coi đây là một đề nghị recommendation mới độc lập; requested state giữ 4 người.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-D-BUDGET-2-3

Batch B01 · queue 6 · P1_original_flagged · split train · group `dialogue-family-budget` · **pending**

**Câu gốc:** Tổng ngân sách nhóm là 300k thôi

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
- N2-D-BUDGET-2-1: Nhóm mình cần gợi ý món ăn
- N2-D-BUDGET-2-2: Nhóm này gồm 4 người nhé

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

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

**Rationale nguồn:** Dialogue budget, turn 3: annotation describes the accumulated request state, not an executed cart. Prior context is synthetic and proposals never mutate it.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `a4fadfd48c57921de80f687578670e70c6a177fd8a7954dda966f32142527582`.

### Q035 — Current-turn intent vs accumulated state

Nguồn `dialogue_target`: Confirm per-turn intent versus accumulated request state and missing assistant clarification history.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ N2 như snapshot active request/gold hiện tại | Ít thay đổi, vẫn tái lập được evaluator N2. | Phải công bố đang chấm snapshot; nếu dùng các intent lặp lại làm lệnh sẽ hiểu sai thêm món nhiều lần. | Không nhất thiết; chờ policy |
| B — Tách current-turn semantics và requested state | Lượt hiện tại bổ sung budget 300000 VND, scope total, upper cap lte. Requested state tiếp tục giữ party_size=4 từ turn trước, không thêm budget như thể được nói lại cùng lượt. | Chấm hai lớp riêng, giữ evidence turn; cần successor contract/evaluator, không áp vào golden N2. | Có, chưa triển khai |
| C — Chỉ chấm lượt hiện tại và bỏ inherited state | Giảm yêu cầu state khi corpus chưa có assistant turns. | Mất bài kiểm tra giữ preferences/options/reference nhiều lượt; không đáp ứng mục tiêu state nếu không bổ sung tập khác. | Không nhất thiết; chờ policy |

**Codex đề xuất B — CHƯA DUYỆT:** Lượt hiện tại bổ sung budget 300000 VND, scope total, upper cap lte. Requested state tiếp tục giữ party_size=4 từ turn trước, không thêm budget như thể được nói lại cùng lượt. Đề xuất D01, chưa duyệt; giữ bản N2 làm baseline cho tới khi người phụ trách chốt task.

### Q036 — Entity ambiguity

Nguồn `budget_operator`: N2 encodes amount/scope but not strict < versus <=; avoid penalizing this unrepresentable distinction.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ amount/scope N2, bỏ phân biệt operator khi chấm | N2 chưa có field operator. | Tương thích hiện tại nhưng không được tuyên bố đã kiểm tra strict lt/lte. | Không nhất thiết; chờ policy |
| B — Bổ sung operator/approximation/scope evidence ở successor | 300k là tổng upper budget lte; giữ party_size=4 bằng evidence turn trước. | Làm rõ constraint accuracy và có thể khiến các paraphrase cùng group mang giá trị khác nhau; cần schema/version mới. | Có, chưa triển khai |
| C — needs_clarification khi operator hoặc scope thực sự chưa rõ | Giữ nguyên điều chưa biết thay vì suy đoán. | Không hỏi lại câu đã rõ chỉ vì schema chưa có field; schema gap khác linguistic ambiguity. | Không nhất thiết; chờ policy |

**Codex đề xuất B — CHƯA DUYỆT:** 300k là tổng upper budget lte; giữ party_size=4 bằng evidence turn trước. Codex đề xuất D08; không điền operator vào gold gốc.

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Current-turn intent vs accumulated state: Lượt hiện tại bổ sung budget 300000 VND, scope total, upper cap lte. Requested state tiếp tục giữ party_size=4 từ turn trước, không thêm budget như thể được nói lại cùng lượt.

**Đề xuất theo record, CHƯA DUYỆT:** Lượt hiện tại bổ sung budget 300000 VND, scope total, upper cap lte. Requested state tiếp tục giữ party_size=4 từ turn trước, không thêm budget như thể được nói lại cùng lượt.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-D-SPICE-1-1

Batch B02 · queue 7 · P1_original_flagged · split train · group `dialogue-family-spice` · **pending**

**Câu gốc:** Cho hai burger giúp mình trước

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "add_item",
      "polarity": "affirmed",
      "targetId": "p",
      "quantityId": "q"
    }
  ],
  "entities": [
    {
      "id": "p",
      "kind": "product",
      "text": "Cho hai burger giúp mình trước",
      "productId": "demo-burger"
    },
    {
      "id": "q",
      "kind": "quantity",
      "text": "Cho hai burger giúp mình trước",
      "mode": "delta",
      "value": 2
    }
  ]
}
```

**Rationale nguồn:** Dialogue spice, turn 1: annotation describes the accumulated request state, not an executed cart. Prior context is synthetic and proposals never mutate it.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `22c5c11a3d581a932be9159c9441644fbf254b2a538c8c6657f3ebbd5827ac7f`.

### Q037 — Current-turn intent vs accumulated state

Nguồn `dialogue_target`: Confirm per-turn intent versus accumulated request state and missing assistant clarification history.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ N2 như snapshot active request/gold hiện tại | Ít thay đổi, vẫn tái lập được evaluator N2. | Phải công bố đang chấm snapshot; nếu dùng các intent lặp lại làm lệnh sẽ hiểu sai thêm món nhiều lần. | Không nhất thiết; chờ policy |
| B — Tách current-turn semantics và requested state | Đề nghị burger demo ×2: add_item delta +2 trong pending request, không phải burger đã có trong cart. C0 chỉ có cart Pepsi ×3. | Chấm hai lớp riêng, giữ evidence turn; cần successor contract/evaluator, không áp vào golden N2. | Có, chưa triển khai |
| C — Chỉ chấm lượt hiện tại và bỏ inherited state | Giảm yêu cầu state khi corpus chưa có assistant turns. | Mất bài kiểm tra giữ preferences/options/reference nhiều lượt; không đáp ứng mục tiêu state nếu không bổ sung tập khác. | Không nhất thiết; chờ policy |

**Codex đề xuất B — CHƯA DUYỆT:** Đề nghị burger demo ×2: add_item delta +2 trong pending request, không phải burger đã có trong cart. C0 chỉ có cart Pepsi ×3. Đề xuất D01, chưa duyệt; giữ bản N2 làm baseline cho tới khi người phụ trách chốt task.

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Quantity delta/absolute: Kiểm tra delta=2 đúng mục tiêu cart/pending_request; không tự tính final quantity hoặc lấy dung tích làm count.
- Current-turn intent vs accumulated state: Đề nghị burger demo ×2: add_item delta +2 trong pending request, không phải burger đã có trong cart. C0 chỉ có cart Pepsi ×3.

**Đề xuất theo record, CHƯA DUYỆT:** Đề nghị burger demo ×2: add_item delta +2 trong pending request, không phải burger đã có trong cart. C0 chỉ có cart Pepsi ×3.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-D-SPICE-1-2

Batch B02 · queue 8 · P1_original_flagged · split train · group `dialogue-family-spice` · **pending**

**Câu gốc:** Hai phần đó tránh cay nhé

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
- N2-D-SPICE-1-1: Cho hai burger giúp mình trước

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "add_item",
      "polarity": "affirmed",
      "targetId": "p",
      "quantityId": "q"
    }
  ],
  "entities": [
    {
      "id": "p",
      "kind": "product",
      "text": "Hai phần đó tránh cay nhé",
      "productId": "demo-burger"
    },
    {
      "id": "q",
      "kind": "quantity",
      "text": "Hai phần đó tránh cay nhé",
      "mode": "delta",
      "value": 2
    },
    {
      "id": "pref",
      "kind": "preference",
      "text": "Hai phần đó tránh cay nhé",
      "targetId": "p",
      "attribute": "spice",
      "operator": "neq",
      "value": "hot"
    }
  ]
}
```

**Rationale nguồn:** Dialogue spice, turn 2: annotation describes the accumulated request state, not an executed cart. Prior context is synthetic and proposals never mutate it.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `7a6718aed1aa4461da6d12e248f648dfbdc4939202168f917a77b3ad26a06c39`.

### Q038 — Current-turn intent vs accumulated state

Nguồn `dialogue_target`: Confirm per-turn intent versus accumulated request state and missing assistant clarification history.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ N2 như snapshot active request/gold hiện tại | Ít thay đổi, vẫn tái lập được evaluator N2. | Phải công bố đang chấm snapshot; nếu dùng các intent lặp lại làm lệnh sẽ hiểu sai thêm món nhiều lần. | Không nhất thiết; chờ policy |
| B — Tách current-turn semantics và requested state | Bổ sung exclusion spice != hot cho burger của request trước, không add burger ×2 lần nữa. Burger antecedent lấy từ history, không dùng last-item=Pepsi của C0. | Chấm hai lớp riêng, giữ evidence turn; cần successor contract/evaluator, không áp vào golden N2. | Có, chưa triển khai |
| C — Chỉ chấm lượt hiện tại và bỏ inherited state | Giảm yêu cầu state khi corpus chưa có assistant turns. | Mất bài kiểm tra giữ preferences/options/reference nhiều lượt; không đáp ứng mục tiêu state nếu không bổ sung tập khác. | Không nhất thiết; chờ policy |

**Codex đề xuất B — CHƯA DUYỆT:** Bổ sung exclusion spice != hot cho burger của request trước, không add burger ×2 lần nữa. Burger antecedent lấy từ history, không dùng last-item=Pepsi của C0. Đề xuất D01, chưa duyệt; giữ bản N2 làm baseline cho tới khi người phụ trách chốt task.

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Quantity delta/absolute: Kiểm tra delta=2 đúng mục tiêu cart/pending_request; không tự tính final quantity hoặc lấy dung tích làm count.
- Negation/exclusion: Kiểm tra polarity của từng operation và exclusion theo target; không bỏ toàn bộ yêu cầu vì một phủ định.
- Current-turn intent vs accumulated state: Bổ sung exclusion spice != hot cho burger của request trước, không add burger ×2 lần nữa. Burger antecedent lấy từ history, không dùng last-item=Pepsi của C0.

**Đề xuất theo record, CHƯA DUYỆT:** Bổ sung exclusion spice != hot cho burger của request trước, không add burger ×2 lần nữa. Burger antecedent lấy từ history, không dùng last-item=Pepsi của C0.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-D-SPICE-1-3

Batch B02 · queue 9 · P1_original_flagged · split train · group `dialogue-family-spice` · **pending**

**Câu gốc:** Mình vẫn muốn hai phần như cũ

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
- N2-D-SPICE-1-1: Cho hai burger giúp mình trước
- N2-D-SPICE-1-2: Hai phần đó tránh cay nhé

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "set_quantity",
      "polarity": "affirmed",
      "targetId": "p",
      "quantityId": "q"
    }
  ],
  "entities": [
    {
      "id": "p",
      "kind": "product",
      "text": "Mình vẫn muốn hai phần như cũ",
      "productId": "demo-burger"
    },
    {
      "id": "q",
      "kind": "quantity",
      "text": "Mình vẫn muốn hai phần như cũ",
      "mode": "absolute",
      "value": 2
    },
    {
      "id": "pref",
      "kind": "preference",
      "text": "Mình vẫn muốn hai phần như cũ",
      "targetId": "p",
      "attribute": "spice",
      "operator": "neq",
      "value": "hot"
    }
  ]
}
```

**Rationale nguồn:** Dialogue spice, turn 3: annotation describes the accumulated request state, not an executed cart. Prior context is synthetic and proposals never mutate it.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `46e6de8615f24c82419de37fe89c3950aaee8cbdf1ced767d0a5c43c30eed586`.

### Q039 — Current-turn intent vs accumulated state

Nguồn `dialogue_target`: Confirm per-turn intent versus accumulated request state and missing assistant clarification history.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ N2 như snapshot active request/gold hiện tại | Ít thay đổi, vẫn tái lập được evaluator N2. | Phải công bố đang chấm snapshot; nếu dùng các intent lặp lại làm lệnh sẽ hiểu sai thêm món nhiều lần. | Không nhất thiết; chờ policy |
| B — Tách current-turn semantics và requested state | Giữ số lượng yêu cầu burger là 2, bảo toàn exclusion đã nói. Biến thể như cũ có thể chỉ reaffirm pending quantity; không bắt buộc là sửa cart. Phân xử correct/refine versus set_quantity với domain pending_request. | Chấm hai lớp riêng, giữ evidence turn; cần successor contract/evaluator, không áp vào golden N2. | Có, chưa triển khai |
| C — Chỉ chấm lượt hiện tại và bỏ inherited state | Giảm yêu cầu state khi corpus chưa có assistant turns. | Mất bài kiểm tra giữ preferences/options/reference nhiều lượt; không đáp ứng mục tiêu state nếu không bổ sung tập khác. | Không nhất thiết; chờ policy |

**Codex đề xuất B — CHƯA DUYỆT:** Giữ số lượng yêu cầu burger là 2, bảo toàn exclusion đã nói. Biến thể như cũ có thể chỉ reaffirm pending quantity; không bắt buộc là sửa cart. Phân xử correct/refine versus set_quantity với domain pending_request. Đề xuất D01, chưa duyệt; giữ bản N2 làm baseline cho tới khi người phụ trách chốt task.

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Quantity delta/absolute: Kiểm tra absolute=2 đúng mục tiêu cart/pending_request; không tự tính final quantity hoặc lấy dung tích làm count.
- Negation/exclusion: Kiểm tra polarity của từng operation và exclusion theo target; không bỏ toàn bộ yêu cầu vì một phủ định.
- Current-turn intent vs accumulated state: Giữ số lượng yêu cầu burger là 2, bảo toàn exclusion đã nói. Biến thể như cũ có thể chỉ reaffirm pending quantity; không bắt buộc là sửa cart. Phân xử correct/refine versus set_quantity với domain pending_request.

**Đề xuất theo record, CHƯA DUYỆT:** Giữ số lượng yêu cầu burger là 2, bảo toàn exclusion đã nói. Biến thể như cũ có thể chỉ reaffirm pending quantity; không bắt buộc là sửa cart. Phân xử correct/refine versus set_quantity với domain pending_request.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-D-SPICE-2-1

Batch B02 · queue 10 · P1_original_flagged · split train · group `dialogue-family-spice` · **pending**

**Câu gốc:** Mình muốn hai phần burger demo

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "add_item",
      "polarity": "affirmed",
      "targetId": "p",
      "quantityId": "q"
    }
  ],
  "entities": [
    {
      "id": "p",
      "kind": "product",
      "text": "Mình muốn hai phần burger demo",
      "productId": "demo-burger"
    },
    {
      "id": "q",
      "kind": "quantity",
      "text": "Mình muốn hai phần burger demo",
      "mode": "delta",
      "value": 2
    }
  ]
}
```

**Rationale nguồn:** Dialogue spice, turn 1: annotation describes the accumulated request state, not an executed cart. Prior context is synthetic and proposals never mutate it.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `26389f8b2877954fd749032752b5ce4afc6bb2a19516a559ef55109b5b02dc18`.

### Q040 — Current-turn intent vs accumulated state

Nguồn `dialogue_target`: Confirm per-turn intent versus accumulated request state and missing assistant clarification history.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ N2 như snapshot active request/gold hiện tại | Ít thay đổi, vẫn tái lập được evaluator N2. | Phải công bố đang chấm snapshot; nếu dùng các intent lặp lại làm lệnh sẽ hiểu sai thêm món nhiều lần. | Không nhất thiết; chờ policy |
| B — Tách current-turn semantics và requested state | Đề nghị burger demo ×2: add_item delta +2 trong pending request, không phải burger đã có trong cart. C0 chỉ có cart Pepsi ×3. | Chấm hai lớp riêng, giữ evidence turn; cần successor contract/evaluator, không áp vào golden N2. | Có, chưa triển khai |
| C — Chỉ chấm lượt hiện tại và bỏ inherited state | Giảm yêu cầu state khi corpus chưa có assistant turns. | Mất bài kiểm tra giữ preferences/options/reference nhiều lượt; không đáp ứng mục tiêu state nếu không bổ sung tập khác. | Không nhất thiết; chờ policy |

**Codex đề xuất B — CHƯA DUYỆT:** Đề nghị burger demo ×2: add_item delta +2 trong pending request, không phải burger đã có trong cart. C0 chỉ có cart Pepsi ×3. Đề xuất D01, chưa duyệt; giữ bản N2 làm baseline cho tới khi người phụ trách chốt task.

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Quantity delta/absolute: Kiểm tra delta=2 đúng mục tiêu cart/pending_request; không tự tính final quantity hoặc lấy dung tích làm count.
- Current-turn intent vs accumulated state: Đề nghị burger demo ×2: add_item delta +2 trong pending request, không phải burger đã có trong cart. C0 chỉ có cart Pepsi ×3.

**Đề xuất theo record, CHƯA DUYỆT:** Đề nghị burger demo ×2: add_item delta +2 trong pending request, không phải burger đã có trong cart. C0 chỉ có cart Pepsi ×3.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-D-SPICE-2-2

Batch B02 · queue 11 · P1_original_flagged · split train · group `dialogue-family-spice` · **pending**

**Câu gốc:** Món burger vừa nói đừng chọn vị cay

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
- N2-D-SPICE-2-1: Mình muốn hai phần burger demo

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "add_item",
      "polarity": "affirmed",
      "targetId": "p",
      "quantityId": "q"
    }
  ],
  "entities": [
    {
      "id": "p",
      "kind": "product",
      "text": "Món burger vừa nói đừng chọn vị cay",
      "productId": "demo-burger"
    },
    {
      "id": "q",
      "kind": "quantity",
      "text": "Món burger vừa nói đừng chọn vị cay",
      "mode": "delta",
      "value": 2
    },
    {
      "id": "pref",
      "kind": "preference",
      "text": "Món burger vừa nói đừng chọn vị cay",
      "targetId": "p",
      "attribute": "spice",
      "operator": "neq",
      "value": "hot"
    }
  ]
}
```

**Rationale nguồn:** Dialogue spice, turn 2: annotation describes the accumulated request state, not an executed cart. Prior context is synthetic and proposals never mutate it.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `bc0f00582471c60e867c9c4c448b2b021d603a6c8d9fee91cda9f7aabbc6313d`.

### Q041 — Current-turn intent vs accumulated state

Nguồn `dialogue_target`: Confirm per-turn intent versus accumulated request state and missing assistant clarification history.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ N2 như snapshot active request/gold hiện tại | Ít thay đổi, vẫn tái lập được evaluator N2. | Phải công bố đang chấm snapshot; nếu dùng các intent lặp lại làm lệnh sẽ hiểu sai thêm món nhiều lần. | Không nhất thiết; chờ policy |
| B — Tách current-turn semantics và requested state | Bổ sung exclusion spice != hot cho burger của request trước, không add burger ×2 lần nữa. Burger antecedent lấy từ history, không dùng last-item=Pepsi của C0. | Chấm hai lớp riêng, giữ evidence turn; cần successor contract/evaluator, không áp vào golden N2. | Có, chưa triển khai |
| C — Chỉ chấm lượt hiện tại và bỏ inherited state | Giảm yêu cầu state khi corpus chưa có assistant turns. | Mất bài kiểm tra giữ preferences/options/reference nhiều lượt; không đáp ứng mục tiêu state nếu không bổ sung tập khác. | Không nhất thiết; chờ policy |

**Codex đề xuất B — CHƯA DUYỆT:** Bổ sung exclusion spice != hot cho burger của request trước, không add burger ×2 lần nữa. Burger antecedent lấy từ history, không dùng last-item=Pepsi của C0. Đề xuất D01, chưa duyệt; giữ bản N2 làm baseline cho tới khi người phụ trách chốt task.

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Quantity delta/absolute: Kiểm tra delta=2 đúng mục tiêu cart/pending_request; không tự tính final quantity hoặc lấy dung tích làm count.
- Negation/exclusion: Kiểm tra polarity của từng operation và exclusion theo target; không bỏ toàn bộ yêu cầu vì một phủ định.
- Current-turn intent vs accumulated state: Bổ sung exclusion spice != hot cho burger của request trước, không add burger ×2 lần nữa. Burger antecedent lấy từ history, không dùng last-item=Pepsi của C0.

**Đề xuất theo record, CHƯA DUYỆT:** Bổ sung exclusion spice != hot cho burger của request trước, không add burger ×2 lần nữa. Burger antecedent lấy từ history, không dùng last-item=Pepsi của C0.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-D-SPICE-2-3

Batch B02 · queue 12 · P1_original_flagged · split train · group `dialogue-family-spice` · **pending**

**Câu gốc:** Giữ số lượng burger là 2 thôi

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
- N2-D-SPICE-2-1: Mình muốn hai phần burger demo
- N2-D-SPICE-2-2: Món burger vừa nói đừng chọn vị cay

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "set_quantity",
      "polarity": "affirmed",
      "targetId": "p",
      "quantityId": "q"
    }
  ],
  "entities": [
    {
      "id": "p",
      "kind": "product",
      "text": "Giữ số lượng burger là 2 thôi",
      "productId": "demo-burger"
    },
    {
      "id": "q",
      "kind": "quantity",
      "text": "Giữ số lượng burger là 2 thôi",
      "mode": "absolute",
      "value": 2
    },
    {
      "id": "pref",
      "kind": "preference",
      "text": "Giữ số lượng burger là 2 thôi",
      "targetId": "p",
      "attribute": "spice",
      "operator": "neq",
      "value": "hot"
    }
  ]
}
```

**Rationale nguồn:** Dialogue spice, turn 3: annotation describes the accumulated request state, not an executed cart. Prior context is synthetic and proposals never mutate it.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `f5caff96229f0eda92df647029c341ac4c9236959e9ad53766246737efa47dac`.

### Q042 — Current-turn intent vs accumulated state

Nguồn `dialogue_target`: Confirm per-turn intent versus accumulated request state and missing assistant clarification history.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ N2 như snapshot active request/gold hiện tại | Ít thay đổi, vẫn tái lập được evaluator N2. | Phải công bố đang chấm snapshot; nếu dùng các intent lặp lại làm lệnh sẽ hiểu sai thêm món nhiều lần. | Không nhất thiết; chờ policy |
| B — Tách current-turn semantics và requested state | Giữ số lượng yêu cầu burger là 2, bảo toàn exclusion đã nói. Biến thể như cũ có thể chỉ reaffirm pending quantity; không bắt buộc là sửa cart. Phân xử correct/refine versus set_quantity với domain pending_request. | Chấm hai lớp riêng, giữ evidence turn; cần successor contract/evaluator, không áp vào golden N2. | Có, chưa triển khai |
| C — Chỉ chấm lượt hiện tại và bỏ inherited state | Giảm yêu cầu state khi corpus chưa có assistant turns. | Mất bài kiểm tra giữ preferences/options/reference nhiều lượt; không đáp ứng mục tiêu state nếu không bổ sung tập khác. | Không nhất thiết; chờ policy |

**Codex đề xuất B — CHƯA DUYỆT:** Giữ số lượng yêu cầu burger là 2, bảo toàn exclusion đã nói. Biến thể như cũ có thể chỉ reaffirm pending quantity; không bắt buộc là sửa cart. Phân xử correct/refine versus set_quantity với domain pending_request. Đề xuất D01, chưa duyệt; giữ bản N2 làm baseline cho tới khi người phụ trách chốt task.

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Quantity delta/absolute: Kiểm tra absolute=2 đúng mục tiêu cart/pending_request; không tự tính final quantity hoặc lấy dung tích làm count.
- Negation/exclusion: Kiểm tra polarity của từng operation và exclusion theo target; không bỏ toàn bộ yêu cầu vì một phủ định.
- Current-turn intent vs accumulated state: Giữ số lượng yêu cầu burger là 2, bảo toàn exclusion đã nói. Biến thể như cũ có thể chỉ reaffirm pending quantity; không bắt buộc là sửa cart. Phân xử correct/refine versus set_quantity với domain pending_request.

**Đề xuất theo record, CHƯA DUYỆT:** Giữ số lượng yêu cầu burger là 2, bảo toàn exclusion đã nói. Biến thể như cũ có thể chỉ reaffirm pending quantity; không bắt buộc là sửa cart. Phân xử correct/refine versus set_quantity với domain pending_request.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-D-INCREASE-1-1

Batch B03 · queue 13 · P1_original_flagged · split train · group `dialogue-family-increase` · **pending**

**Câu gốc:** Giỏ đang có Pepsi phải không

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "view_cart",
      "polarity": "affirmed"
    }
  ],
  "entities": []
}
```

**Rationale nguồn:** Dialogue increase, turn 1: annotation describes the accumulated request state, not an executed cart. Prior context is synthetic and proposals never mutate it.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `542030697ccaf19b0fb8d89233b1365a7169b3b2f4dd21366f351d414b55c604`.

### Q015 — Current-turn intent vs accumulated state

Nguồn `dialogue_target`: Confirm per-turn intent versus accumulated request state and missing assistant clarification history.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ N2 như snapshot active request/gold hiện tại | Ít thay đổi, vẫn tái lập được evaluator N2. | Phải công bố đang chấm snapshot; nếu dùng các intent lặp lại làm lệnh sẽ hiểu sai thêm món nhiều lần. | Không nhất thiết; chờ policy |
| B — Tách current-turn semantics và requested state | Lượt này hỏi giỏ, có mention Pepsi. Gold view_cart là hướng phù hợp; kiểm tra việc mất product mention do entities=[] nếu v1 muốn chấm lookup dòng. Requested state không tự đổi. | Chấm hai lớp riêng, giữ evidence turn; cần successor contract/evaluator, không áp vào golden N2. | Có, chưa triển khai |
| C — Chỉ chấm lượt hiện tại và bỏ inherited state | Giảm yêu cầu state khi corpus chưa có assistant turns. | Mất bài kiểm tra giữ preferences/options/reference nhiều lượt; không đáp ứng mục tiêu state nếu không bổ sung tập khác. | Không nhất thiết; chờ policy |

**Codex đề xuất B — CHƯA DUYỆT:** Lượt này hỏi giỏ, có mention Pepsi. Gold view_cart là hướng phù hợp; kiểm tra việc mất product mention do entities=[] nếu v1 muốn chấm lookup dòng. Requested state không tự đổi. Đề xuất D01, chưa duyệt; giữ bản N2 làm baseline cho tới khi người phụ trách chốt task.

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Current-turn intent vs accumulated state: Lượt này hỏi giỏ, có mention Pepsi. Gold view_cart là hướng phù hợp; kiểm tra việc mất product mention do entities=[] nếu v1 muốn chấm lookup dòng. Requested state không tự đổi.

**Đề xuất theo record, CHƯA DUYỆT:** Lượt này hỏi giỏ, có mention Pepsi. Gold view_cart là hướng phù hợp; kiểm tra việc mất product mention do entities=[] nếu v1 muốn chấm lookup dòng. Requested state không tự đổi.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-D-INCREASE-1-2

Batch B03 · queue 14 · P1_original_flagged · split train · group `dialogue-family-increase` · **pending**

**Câu gốc:** Thêm cho món đó hai phần nữa

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
- N2-D-INCREASE-1-1: Giỏ đang có Pepsi phải không

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "adjust_quantity",
      "polarity": "affirmed",
      "targetId": "r",
      "quantityId": "q"
    }
  ],
  "entities": [
    {
      "id": "r",
      "kind": "reference",
      "text": "Thêm cho món đó hai phần nữa",
      "referentId": "last-item"
    },
    {
      "id": "q",
      "kind": "quantity",
      "text": "Thêm cho món đó hai phần nữa",
      "mode": "delta",
      "value": 2
    }
  ]
}
```

**Rationale nguồn:** Dialogue increase, turn 2: annotation describes the accumulated request state, not an executed cart. Prior context is synthetic and proposals never mutate it.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `1be19215129ce6bdf35a50b6a1160ed739b36519b8f8261f7e0b9f0c70caa75e`.

### Q016 — Current-turn intent vs accumulated state

Nguồn `dialogue_target`: Confirm per-turn intent versus accumulated request state and missing assistant clarification history.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ N2 như snapshot active request/gold hiện tại | Ít thay đổi, vẫn tái lập được evaluator N2. | Phải công bố đang chấm snapshot; nếu dùng các intent lặp lại làm lệnh sẽ hiểu sai thêm món nhiều lần. | Không nhất thiết; chờ policy |
| B — Tách current-turn semantics và requested state | Yêu cầu thêm/tăng 2 ở món đang được nhắc: giữ delta +2, target đúng referent. add_item và adjust_quantity cần quy ước canonical cho dòng đã có; không tính final=5 từ cart Pepsi ×3. | Chấm hai lớp riêng, giữ evidence turn; cần successor contract/evaluator, không áp vào golden N2. | Có, chưa triển khai |
| C — Chỉ chấm lượt hiện tại và bỏ inherited state | Giảm yêu cầu state khi corpus chưa có assistant turns. | Mất bài kiểm tra giữ preferences/options/reference nhiều lượt; không đáp ứng mục tiêu state nếu không bổ sung tập khác. | Không nhất thiết; chờ policy |

**Codex đề xuất B — CHƯA DUYỆT:** Yêu cầu thêm/tăng 2 ở món đang được nhắc: giữ delta +2, target đúng referent. add_item và adjust_quantity cần quy ước canonical cho dòng đã có; không tính final=5 từ cart Pepsi ×3. Đề xuất D01, chưa duyệt; giữ bản N2 làm baseline cho tới khi người phụ trách chốt task.

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Quantity delta/absolute: Kiểm tra delta=2 đúng mục tiêu cart/pending_request; không tự tính final quantity hoặc lấy dung tích làm count.
- Current-turn intent vs accumulated state: Yêu cầu thêm/tăng 2 ở món đang được nhắc: giữ delta +2, target đúng referent. add_item và adjust_quantity cần quy ước canonical cho dòng đã có; không tính final=5 từ cart Pepsi ×3.

**Đề xuất theo record, CHƯA DUYỆT:** Yêu cầu thêm/tăng 2 ở món đang được nhắc: giữ delta +2, target đúng referent. add_item và adjust_quantity cần quy ước canonical cho dòng đã có; không tính final=5 từ cart Pepsi ×3.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-D-INCREASE-1-3

Batch B03 · queue 15 · P1_original_flagged · split train · group `dialogue-family-increase` · **pending**

**Câu gốc:** Không, đổi thành bốn tất cả

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
- N2-D-INCREASE-1-1: Giỏ đang có Pepsi phải không
- N2-D-INCREASE-1-2: Thêm cho món đó hai phần nữa

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "set_quantity",
      "polarity": "affirmed",
      "targetId": "p",
      "quantityId": "q"
    }
  ],
  "entities": [
    {
      "id": "p",
      "kind": "product",
      "text": "Không, đổi thành bốn tất cả",
      "productId": "demo-pepsi"
    },
    {
      "id": "q",
      "kind": "quantity",
      "text": "Không, đổi thành bốn tất cả",
      "mode": "absolute",
      "value": 4
    }
  ]
}
```

**Rationale nguồn:** Dialogue increase, turn 3: annotation describes the accumulated request state, not an executed cart. Prior context is synthetic and proposals never mutate it.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `656c9512bd0e278bbe1c246d38b2df833c74c5ba8e65fd68e1ea0168bc877048`.

### Q017 — Current-turn intent vs accumulated state

Nguồn `dialogue_target`: Confirm per-turn intent versus accumulated request state and missing assistant clarification history.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ N2 như snapshot active request/gold hiện tại | Ít thay đổi, vẫn tái lập được evaluator N2. | Phải công bố đang chấm snapshot; nếu dùng các intent lặp lại làm lệnh sẽ hiểu sai thêm món nhiều lần. | Không nhất thiết; chờ policy |
| B — Tách current-turn semantics và requested state | Sửa đề nghị trước thành số lượng tuyệt đối 4 trong pending request; không cộng delta trước rồi thực thi. Với câu mở đầu Không, không phủ định toàn bộ set_quantity. Phải chốt target_domain pending_request so với cart. | Chấm hai lớp riêng, giữ evidence turn; cần successor contract/evaluator, không áp vào golden N2. | Có, chưa triển khai |
| C — Chỉ chấm lượt hiện tại và bỏ inherited state | Giảm yêu cầu state khi corpus chưa có assistant turns. | Mất bài kiểm tra giữ preferences/options/reference nhiều lượt; không đáp ứng mục tiêu state nếu không bổ sung tập khác. | Không nhất thiết; chờ policy |

**Codex đề xuất B — CHƯA DUYỆT:** Sửa đề nghị trước thành số lượng tuyệt đối 4 trong pending request; không cộng delta trước rồi thực thi. Với câu mở đầu Không, không phủ định toàn bộ set_quantity. Phải chốt target_domain pending_request so với cart. Đề xuất D01, chưa duyệt; giữ bản N2 làm baseline cho tới khi người phụ trách chốt task.

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Quantity delta/absolute: Kiểm tra absolute=4 đúng mục tiêu cart/pending_request; không tự tính final quantity hoặc lấy dung tích làm count.
- Current-turn intent vs accumulated state: Sửa đề nghị trước thành số lượng tuyệt đối 4 trong pending request; không cộng delta trước rồi thực thi. Với câu mở đầu Không, không phủ định toàn bộ set_quantity. Phải chốt target_domain pending_request so với cart.

**Đề xuất theo record, CHƯA DUYỆT:** Sửa đề nghị trước thành số lượng tuyệt đối 4 trong pending request; không cộng delta trước rồi thực thi. Với câu mở đầu Không, không phủ định toàn bộ set_quantity. Phải chốt target_domain pending_request so với cart.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-D-INCREASE-2-1

Batch B03 · queue 16 · P1_original_flagged · split train · group `dialogue-family-increase` · **pending**

**Câu gốc:** Cho kiểm tra Pepsi trong giỏ trước

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "view_cart",
      "polarity": "affirmed"
    }
  ],
  "entities": []
}
```

**Rationale nguồn:** Dialogue increase, turn 1: annotation describes the accumulated request state, not an executed cart. Prior context is synthetic and proposals never mutate it.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `3a9e12cc8f83ab850bad667da7ed4951b8af913ed5251b03ba9aae76928b346a`.

### Q018 — Current-turn intent vs accumulated state

Nguồn `dialogue_target`: Confirm per-turn intent versus accumulated request state and missing assistant clarification history.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ N2 như snapshot active request/gold hiện tại | Ít thay đổi, vẫn tái lập được evaluator N2. | Phải công bố đang chấm snapshot; nếu dùng các intent lặp lại làm lệnh sẽ hiểu sai thêm món nhiều lần. | Không nhất thiết; chờ policy |
| B — Tách current-turn semantics và requested state | Lượt này hỏi giỏ, có mention Pepsi. Gold view_cart là hướng phù hợp; kiểm tra việc mất product mention do entities=[] nếu v1 muốn chấm lookup dòng. Requested state không tự đổi. | Chấm hai lớp riêng, giữ evidence turn; cần successor contract/evaluator, không áp vào golden N2. | Có, chưa triển khai |
| C — Chỉ chấm lượt hiện tại và bỏ inherited state | Giảm yêu cầu state khi corpus chưa có assistant turns. | Mất bài kiểm tra giữ preferences/options/reference nhiều lượt; không đáp ứng mục tiêu state nếu không bổ sung tập khác. | Không nhất thiết; chờ policy |

**Codex đề xuất B — CHƯA DUYỆT:** Lượt này hỏi giỏ, có mention Pepsi. Gold view_cart là hướng phù hợp; kiểm tra việc mất product mention do entities=[] nếu v1 muốn chấm lookup dòng. Requested state không tự đổi. Đề xuất D01, chưa duyệt; giữ bản N2 làm baseline cho tới khi người phụ trách chốt task.

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Current-turn intent vs accumulated state: Lượt này hỏi giỏ, có mention Pepsi. Gold view_cart là hướng phù hợp; kiểm tra việc mất product mention do entities=[] nếu v1 muốn chấm lookup dòng. Requested state không tự đổi.

**Đề xuất theo record, CHƯA DUYỆT:** Lượt này hỏi giỏ, có mention Pepsi. Gold view_cart là hướng phù hợp; kiểm tra việc mất product mention do entities=[] nếu v1 muốn chấm lookup dòng. Requested state không tự đổi.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-D-INCREASE-2-2

Batch B03 · queue 17 · P1_original_flagged · split train · group `dialogue-family-increase` · **pending**

**Câu gốc:** Tăng món vừa nhắc thêm hai

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
- N2-D-INCREASE-2-1: Cho kiểm tra Pepsi trong giỏ trước

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "adjust_quantity",
      "polarity": "affirmed",
      "targetId": "r",
      "quantityId": "q"
    }
  ],
  "entities": [
    {
      "id": "r",
      "kind": "reference",
      "text": "Tăng món vừa nhắc thêm hai",
      "referentId": "last-item"
    },
    {
      "id": "q",
      "kind": "quantity",
      "text": "Tăng món vừa nhắc thêm hai",
      "mode": "delta",
      "value": 2
    }
  ]
}
```

**Rationale nguồn:** Dialogue increase, turn 2: annotation describes the accumulated request state, not an executed cart. Prior context is synthetic and proposals never mutate it.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `c7fe4bd1347085e2c482ab30dc51153ffbc0c628f1af0de876cc439939ae1713`.

### Q019 — Current-turn intent vs accumulated state

Nguồn `dialogue_target`: Confirm per-turn intent versus accumulated request state and missing assistant clarification history.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ N2 như snapshot active request/gold hiện tại | Ít thay đổi, vẫn tái lập được evaluator N2. | Phải công bố đang chấm snapshot; nếu dùng các intent lặp lại làm lệnh sẽ hiểu sai thêm món nhiều lần. | Không nhất thiết; chờ policy |
| B — Tách current-turn semantics và requested state | Yêu cầu thêm/tăng 2 ở món đang được nhắc: giữ delta +2, target đúng referent. add_item và adjust_quantity cần quy ước canonical cho dòng đã có; không tính final=5 từ cart Pepsi ×3. | Chấm hai lớp riêng, giữ evidence turn; cần successor contract/evaluator, không áp vào golden N2. | Có, chưa triển khai |
| C — Chỉ chấm lượt hiện tại và bỏ inherited state | Giảm yêu cầu state khi corpus chưa có assistant turns. | Mất bài kiểm tra giữ preferences/options/reference nhiều lượt; không đáp ứng mục tiêu state nếu không bổ sung tập khác. | Không nhất thiết; chờ policy |

**Codex đề xuất B — CHƯA DUYỆT:** Yêu cầu thêm/tăng 2 ở món đang được nhắc: giữ delta +2, target đúng referent. add_item và adjust_quantity cần quy ước canonical cho dòng đã có; không tính final=5 từ cart Pepsi ×3. Đề xuất D01, chưa duyệt; giữ bản N2 làm baseline cho tới khi người phụ trách chốt task.

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Quantity delta/absolute: Kiểm tra delta=2 đúng mục tiêu cart/pending_request; không tự tính final quantity hoặc lấy dung tích làm count.
- Current-turn intent vs accumulated state: Yêu cầu thêm/tăng 2 ở món đang được nhắc: giữ delta +2, target đúng referent. add_item và adjust_quantity cần quy ước canonical cho dòng đã có; không tính final=5 từ cart Pepsi ×3.

**Đề xuất theo record, CHƯA DUYỆT:** Yêu cầu thêm/tăng 2 ở món đang được nhắc: giữ delta +2, target đúng referent. add_item và adjust_quantity cần quy ước canonical cho dòng đã có; không tính final=5 từ cart Pepsi ×3.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-D-INCREASE-2-3

Batch B03 · queue 18 · P1_original_flagged · split train · group `dialogue-family-increase` · **pending**

**Câu gốc:** Sửa lại Pepsi tổng cộng là bốn

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
- N2-D-INCREASE-2-1: Cho kiểm tra Pepsi trong giỏ trước
- N2-D-INCREASE-2-2: Tăng món vừa nhắc thêm hai

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "set_quantity",
      "polarity": "affirmed",
      "targetId": "p",
      "quantityId": "q"
    }
  ],
  "entities": [
    {
      "id": "p",
      "kind": "product",
      "text": "Sửa lại Pepsi tổng cộng là bốn",
      "productId": "demo-pepsi"
    },
    {
      "id": "q",
      "kind": "quantity",
      "text": "Sửa lại Pepsi tổng cộng là bốn",
      "mode": "absolute",
      "value": 4
    }
  ]
}
```

**Rationale nguồn:** Dialogue increase, turn 3: annotation describes the accumulated request state, not an executed cart. Prior context is synthetic and proposals never mutate it.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `312600174b45fd85d5b5fa4edd21cc8bffffd320645d2f379e2a3f32c68fbfb8`.

### Q020 — Current-turn intent vs accumulated state

Nguồn `dialogue_target`: Confirm per-turn intent versus accumulated request state and missing assistant clarification history.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ N2 như snapshot active request/gold hiện tại | Ít thay đổi, vẫn tái lập được evaluator N2. | Phải công bố đang chấm snapshot; nếu dùng các intent lặp lại làm lệnh sẽ hiểu sai thêm món nhiều lần. | Không nhất thiết; chờ policy |
| B — Tách current-turn semantics và requested state | Sửa đề nghị trước thành số lượng tuyệt đối 4 trong pending request; không cộng delta trước rồi thực thi. Với câu mở đầu Không, không phủ định toàn bộ set_quantity. Phải chốt target_domain pending_request so với cart. | Chấm hai lớp riêng, giữ evidence turn; cần successor contract/evaluator, không áp vào golden N2. | Có, chưa triển khai |
| C — Chỉ chấm lượt hiện tại và bỏ inherited state | Giảm yêu cầu state khi corpus chưa có assistant turns. | Mất bài kiểm tra giữ preferences/options/reference nhiều lượt; không đáp ứng mục tiêu state nếu không bổ sung tập khác. | Không nhất thiết; chờ policy |

**Codex đề xuất B — CHƯA DUYỆT:** Sửa đề nghị trước thành số lượng tuyệt đối 4 trong pending request; không cộng delta trước rồi thực thi. Với câu mở đầu Không, không phủ định toàn bộ set_quantity. Phải chốt target_domain pending_request so với cart. Đề xuất D01, chưa duyệt; giữ bản N2 làm baseline cho tới khi người phụ trách chốt task.

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Quantity delta/absolute: Kiểm tra absolute=4 đúng mục tiêu cart/pending_request; không tự tính final quantity hoặc lấy dung tích làm count.
- Current-turn intent vs accumulated state: Sửa đề nghị trước thành số lượng tuyệt đối 4 trong pending request; không cộng delta trước rồi thực thi. Với câu mở đầu Không, không phủ định toàn bộ set_quantity. Phải chốt target_domain pending_request so với cart.

**Đề xuất theo record, CHƯA DUYỆT:** Sửa đề nghị trước thành số lượng tuyệt đối 4 trong pending request; không cộng delta trước rồi thực thi. Với câu mở đầu Không, không phủ định toàn bộ set_quantity. Phải chốt target_domain pending_request so với cart.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-D-SWITCH-1-1

Batch B04 · queue 19 · P1_original_flagged · split test · group `dialogue-family-switch` · **pending**

**Câu gốc:** Tụi mình hai người muốn được tư vấn bữa

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

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
      "text": "Tụi mình hai người muốn được tư vấn bữa",
      "value": 2
    }
  ]
}
```

**Rationale nguồn:** Dialogue switch, turn 1: annotation describes the accumulated request state, not an executed cart. Prior context is synthetic and proposals never mutate it.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `52ac9d6e342ff0ac11383be42ad819b7fd72782f2b7b4a1705aafe10a36429d0`.

### Q079 — Current-turn intent vs accumulated state

Nguồn `dialogue_target`: Confirm per-turn intent versus accumulated request state and missing assistant clarification history.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ N2 như snapshot active request/gold hiện tại | Ít thay đổi, vẫn tái lập được evaluator N2. | Phải công bố đang chấm snapshot; nếu dùng các intent lặp lại làm lệnh sẽ hiểu sai thêm món nhiều lần. | Không nhất thiết; chờ policy |
| B — Tách current-turn semantics và requested state | Recommendation cho 2 người là understood, không cần order mutation hoặc mandatory budget nếu policy không công bố điều đó. | Chấm hai lớp riêng, giữ evidence turn; cần successor contract/evaluator, không áp vào golden N2. | Có, chưa triển khai |
| C — Chỉ chấm lượt hiện tại và bỏ inherited state | Giảm yêu cầu state khi corpus chưa có assistant turns. | Mất bài kiểm tra giữ preferences/options/reference nhiều lượt; không đáp ứng mục tiêu state nếu không bổ sung tập khác. | Không nhất thiết; chờ policy |

**Codex đề xuất B — CHƯA DUYỆT:** Recommendation cho 2 người là understood, không cần order mutation hoặc mandatory budget nếu policy không công bố điều đó. Đề xuất D01, chưa duyệt; giữ bản N2 làm baseline cho tới khi người phụ trách chốt task.

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Current-turn intent vs accumulated state: Recommendation cho 2 người là understood, không cần order mutation hoặc mandatory budget nếu policy không công bố điều đó.

**Đề xuất theo record, CHƯA DUYỆT:** Recommendation cho 2 người là understood, không cần order mutation hoặc mandatory budget nếu policy không công bố điều đó.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-D-SWITCH-1-2

Batch B04 · queue 20 · P1_original_flagged · split test · group `dialogue-family-switch` · **pending**

**Câu gốc:** Không lấy khoai trong gợi ý đó

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
- N2-D-SWITCH-1-1: Tụi mình hai người muốn được tư vấn bữa

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

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
      "text": "Không lấy khoai trong gợi ý đó",
      "value": 2
    },
    {
      "id": "no-fries",
      "kind": "preference",
      "text": "Không lấy khoai trong gợi ý đó",
      "targetId": null,
      "attribute": "ingredient",
      "operator": "neq",
      "value": "potato"
    }
  ]
}
```

**Rationale nguồn:** Dialogue switch, turn 2: annotation describes the accumulated request state, not an executed cart. Prior context is synthetic and proposals never mutate it.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `1e90031df46aedfe49536bfb4340053b3060dc8cd4017ce41a3e607627696ee9`.

### Q080 — Current-turn intent vs accumulated state

Nguồn `dialogue_target`: Confirm per-turn intent versus accumulated request state and missing assistant clarification history.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ N2 như snapshot active request/gold hiện tại | Ít thay đổi, vẫn tái lập được evaluator N2. | Phải công bố đang chấm snapshot; nếu dùng các intent lặp lại làm lệnh sẽ hiểu sai thêm món nhiều lần. | Không nhất thiết; chờ policy |
| B — Tách current-turn semantics và requested state | Loại khoai khỏi recommendation, không remove_line khỏi cart và không phủ định toàn bộ request. Requested state giữ party_size=2; current turn là refinement/exclusion. | Chấm hai lớp riêng, giữ evidence turn; cần successor contract/evaluator, không áp vào golden N2. | Có, chưa triển khai |
| C — Chỉ chấm lượt hiện tại và bỏ inherited state | Giảm yêu cầu state khi corpus chưa có assistant turns. | Mất bài kiểm tra giữ preferences/options/reference nhiều lượt; không đáp ứng mục tiêu state nếu không bổ sung tập khác. | Không nhất thiết; chờ policy |

**Codex đề xuất B — CHƯA DUYỆT:** Loại khoai khỏi recommendation, không remove_line khỏi cart và không phủ định toàn bộ request. Requested state giữ party_size=2; current turn là refinement/exclusion. Đề xuất D01, chưa duyệt; giữ bản N2 làm baseline cho tới khi người phụ trách chốt task.

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Negation/exclusion: Kiểm tra polarity của từng operation và exclusion theo target; không bỏ toàn bộ yêu cầu vì một phủ định.
- Current-turn intent vs accumulated state: Loại khoai khỏi recommendation, không remove_line khỏi cart và không phủ định toàn bộ request. Requested state giữ party_size=2; current turn là refinement/exclusion.

**Đề xuất theo record, CHƯA DUYỆT:** Loại khoai khỏi recommendation, không remove_line khỏi cart và không phủ định toàn bộ request. Requested state giữ party_size=2; current turn là refinement/exclusion.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-D-SWITCH-1-3

Batch B04 · queue 21 · P1_original_flagged · split test · group `dialogue-family-switch` · **pending**

**Câu gốc:** Hạn mức cả hai là 220 nghìn nhé

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
- N2-D-SWITCH-1-1: Tụi mình hai người muốn được tư vấn bữa
- N2-D-SWITCH-1-2: Không lấy khoai trong gợi ý đó

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

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
      "text": "Hạn mức cả hai là 220 nghìn nhé",
      "value": 2
    },
    {
      "id": "no-fries",
      "kind": "preference",
      "text": "Hạn mức cả hai là 220 nghìn nhé",
      "targetId": null,
      "attribute": "ingredient",
      "operator": "neq",
      "value": "potato"
    },
    {
      "id": "b",
      "kind": "budget",
      "text": "Hạn mức cả hai là 220 nghìn nhé",
      "amount": 220000,
      "currency": "VND",
      "scope": "total"
    }
  ]
}
```

**Rationale nguồn:** Dialogue switch, turn 3: annotation describes the accumulated request state, not an executed cart. Prior context is synthetic and proposals never mutate it.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `e74299e42a94b18e745ff62fdb547132901345d461995e6f505d6d80b3cacd36`.

### Q081 — Current-turn intent vs accumulated state

Nguồn `dialogue_target`: Confirm per-turn intent versus accumulated request state and missing assistant clarification history.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ N2 như snapshot active request/gold hiện tại | Ít thay đổi, vẫn tái lập được evaluator N2. | Phải công bố đang chấm snapshot; nếu dùng các intent lặp lại làm lệnh sẽ hiểu sai thêm món nhiều lần. | Không nhất thiết; chờ policy |
| B — Tách current-turn semantics và requested state | Thêm upper budget 220000 VND total cho request trước. Requested state giữ party_size=2 và exclusion potato, current turn không nói lại các constraints đó. | Chấm hai lớp riêng, giữ evidence turn; cần successor contract/evaluator, không áp vào golden N2. | Có, chưa triển khai |
| C — Chỉ chấm lượt hiện tại và bỏ inherited state | Giảm yêu cầu state khi corpus chưa có assistant turns. | Mất bài kiểm tra giữ preferences/options/reference nhiều lượt; không đáp ứng mục tiêu state nếu không bổ sung tập khác. | Không nhất thiết; chờ policy |

**Codex đề xuất B — CHƯA DUYỆT:** Thêm upper budget 220000 VND total cho request trước. Requested state giữ party_size=2 và exclusion potato, current turn không nói lại các constraints đó. Đề xuất D01, chưa duyệt; giữ bản N2 làm baseline cho tới khi người phụ trách chốt task.

### Q082 — Entity ambiguity

Nguồn `budget_operator`: N2 encodes amount/scope but not strict < versus <=; avoid penalizing this unrepresentable distinction.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ amount/scope N2, bỏ phân biệt operator khi chấm | N2 chưa có field operator. | Tương thích hiện tại nhưng không được tuyên bố đã kiểm tra strict lt/lte. | Không nhất thiết; chờ policy |
| B — Bổ sung operator/approximation/scope evidence ở successor | 220 nghìn là tổng upper budget lte; giữ 2 người và exclusion bằng evidence turn trước. | Làm rõ constraint accuracy và có thể khiến các paraphrase cùng group mang giá trị khác nhau; cần schema/version mới. | Có, chưa triển khai |
| C — needs_clarification khi operator hoặc scope thực sự chưa rõ | Giữ nguyên điều chưa biết thay vì suy đoán. | Không hỏi lại câu đã rõ chỉ vì schema chưa có field; schema gap khác linguistic ambiguity. | Không nhất thiết; chờ policy |

**Codex đề xuất B — CHƯA DUYỆT:** 220 nghìn là tổng upper budget lte; giữ 2 người và exclusion bằng evidence turn trước. Codex đề xuất D08; không điền operator vào gold gốc.

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Negation/exclusion: Kiểm tra polarity của từng operation và exclusion theo target; không bỏ toàn bộ yêu cầu vì một phủ định.
- Current-turn intent vs accumulated state: Thêm upper budget 220000 VND total cho request trước. Requested state giữ party_size=2 và exclusion potato, current turn không nói lại các constraints đó.

**Đề xuất theo record, CHƯA DUYỆT:** Thêm upper budget 220000 VND total cho request trước. Requested state giữ party_size=2 và exclusion potato, current turn không nói lại các constraints đó.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-D-SWITCH-2-1

Batch B04 · queue 22 · P1_original_flagged · split test · group `dialogue-family-switch` · **pending**

**Câu gốc:** Gợi ý món để hai đứa cùng ăn

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

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
      "text": "Gợi ý món để hai đứa cùng ăn",
      "value": 2
    }
  ]
}
```

**Rationale nguồn:** Dialogue switch, turn 1: annotation describes the accumulated request state, not an executed cart. Prior context is synthetic and proposals never mutate it.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `54fe07e9df9877d6886f05649c2facb3327633db0139510a05fc4b4691ebaacd`.

### Q083 — Current-turn intent vs accumulated state

Nguồn `dialogue_target`: Confirm per-turn intent versus accumulated request state and missing assistant clarification history.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ N2 như snapshot active request/gold hiện tại | Ít thay đổi, vẫn tái lập được evaluator N2. | Phải công bố đang chấm snapshot; nếu dùng các intent lặp lại làm lệnh sẽ hiểu sai thêm món nhiều lần. | Không nhất thiết; chờ policy |
| B — Tách current-turn semantics và requested state | Recommendation cho 2 người là understood, không cần order mutation hoặc mandatory budget nếu policy không công bố điều đó. | Chấm hai lớp riêng, giữ evidence turn; cần successor contract/evaluator, không áp vào golden N2. | Có, chưa triển khai |
| C — Chỉ chấm lượt hiện tại và bỏ inherited state | Giảm yêu cầu state khi corpus chưa có assistant turns. | Mất bài kiểm tra giữ preferences/options/reference nhiều lượt; không đáp ứng mục tiêu state nếu không bổ sung tập khác. | Không nhất thiết; chờ policy |

**Codex đề xuất B — CHƯA DUYỆT:** Recommendation cho 2 người là understood, không cần order mutation hoặc mandatory budget nếu policy không công bố điều đó. Đề xuất D01, chưa duyệt; giữ bản N2 làm baseline cho tới khi người phụ trách chốt task.

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Current-turn intent vs accumulated state: Recommendation cho 2 người là understood, không cần order mutation hoặc mandatory budget nếu policy không công bố điều đó.

**Đề xuất theo record, CHƯA DUYỆT:** Recommendation cho 2 người là understood, không cần order mutation hoặc mandatory budget nếu policy không công bố điều đó.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-D-SWITCH-2-2

Batch B04 · queue 23 · P1_original_flagged · split test · group `dialogue-family-switch` · **pending**

**Câu gốc:** Loại khoai tây khỏi phương án giúp

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
- N2-D-SWITCH-2-1: Gợi ý món để hai đứa cùng ăn

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

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
      "text": "Loại khoai tây khỏi phương án giúp",
      "value": 2
    },
    {
      "id": "no-fries",
      "kind": "preference",
      "text": "Loại khoai tây khỏi phương án giúp",
      "targetId": null,
      "attribute": "ingredient",
      "operator": "neq",
      "value": "potato"
    }
  ]
}
```

**Rationale nguồn:** Dialogue switch, turn 2: annotation describes the accumulated request state, not an executed cart. Prior context is synthetic and proposals never mutate it.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `ffd8ffc42b68ded218d1e68bdd59e41d7762a6a033ca6399e4921a60710722c9`.

### Q084 — Current-turn intent vs accumulated state

Nguồn `dialogue_target`: Confirm per-turn intent versus accumulated request state and missing assistant clarification history.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ N2 như snapshot active request/gold hiện tại | Ít thay đổi, vẫn tái lập được evaluator N2. | Phải công bố đang chấm snapshot; nếu dùng các intent lặp lại làm lệnh sẽ hiểu sai thêm món nhiều lần. | Không nhất thiết; chờ policy |
| B — Tách current-turn semantics và requested state | Loại khoai khỏi recommendation, không remove_line khỏi cart và không phủ định toàn bộ request. Requested state giữ party_size=2; current turn là refinement/exclusion. | Chấm hai lớp riêng, giữ evidence turn; cần successor contract/evaluator, không áp vào golden N2. | Có, chưa triển khai |
| C — Chỉ chấm lượt hiện tại và bỏ inherited state | Giảm yêu cầu state khi corpus chưa có assistant turns. | Mất bài kiểm tra giữ preferences/options/reference nhiều lượt; không đáp ứng mục tiêu state nếu không bổ sung tập khác. | Không nhất thiết; chờ policy |

**Codex đề xuất B — CHƯA DUYỆT:** Loại khoai khỏi recommendation, không remove_line khỏi cart và không phủ định toàn bộ request. Requested state giữ party_size=2; current turn là refinement/exclusion. Đề xuất D01, chưa duyệt; giữ bản N2 làm baseline cho tới khi người phụ trách chốt task.

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Negation/exclusion: Kiểm tra polarity của từng operation và exclusion theo target; không bỏ toàn bộ yêu cầu vì một phủ định.
- Current-turn intent vs accumulated state: Loại khoai khỏi recommendation, không remove_line khỏi cart và không phủ định toàn bộ request. Requested state giữ party_size=2; current turn là refinement/exclusion.

**Đề xuất theo record, CHƯA DUYỆT:** Loại khoai khỏi recommendation, không remove_line khỏi cart và không phủ định toàn bộ request. Requested state giữ party_size=2; current turn là refinement/exclusion.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-D-SWITCH-2-3

Batch B04 · queue 24 · P1_original_flagged · split test · group `dialogue-family-switch` · **pending**

**Câu gốc:** Tổng hai người không quá 220k

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
- N2-D-SWITCH-2-1: Gợi ý món để hai đứa cùng ăn
- N2-D-SWITCH-2-2: Loại khoai tây khỏi phương án giúp

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

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
      "text": "Tổng hai người không quá 220k",
      "value": 2
    },
    {
      "id": "no-fries",
      "kind": "preference",
      "text": "Tổng hai người không quá 220k",
      "targetId": null,
      "attribute": "ingredient",
      "operator": "neq",
      "value": "potato"
    },
    {
      "id": "b",
      "kind": "budget",
      "text": "Tổng hai người không quá 220k",
      "amount": 220000,
      "currency": "VND",
      "scope": "total"
    }
  ]
}
```

**Rationale nguồn:** Dialogue switch, turn 3: annotation describes the accumulated request state, not an executed cart. Prior context is synthetic and proposals never mutate it.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `0237bad891228375f2d39213fabba3eff29f8eb26567f92a7b1cb3a000bcdff3`.

### Q085 — Current-turn intent vs accumulated state

Nguồn `dialogue_target`: Confirm per-turn intent versus accumulated request state and missing assistant clarification history.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ N2 như snapshot active request/gold hiện tại | Ít thay đổi, vẫn tái lập được evaluator N2. | Phải công bố đang chấm snapshot; nếu dùng các intent lặp lại làm lệnh sẽ hiểu sai thêm món nhiều lần. | Không nhất thiết; chờ policy |
| B — Tách current-turn semantics và requested state | Thêm upper budget 220000 VND total cho request trước. Requested state giữ party_size=2 và exclusion potato, current turn không nói lại các constraints đó. | Chấm hai lớp riêng, giữ evidence turn; cần successor contract/evaluator, không áp vào golden N2. | Có, chưa triển khai |
| C — Chỉ chấm lượt hiện tại và bỏ inherited state | Giảm yêu cầu state khi corpus chưa có assistant turns. | Mất bài kiểm tra giữ preferences/options/reference nhiều lượt; không đáp ứng mục tiêu state nếu không bổ sung tập khác. | Không nhất thiết; chờ policy |

**Codex đề xuất B — CHƯA DUYỆT:** Thêm upper budget 220000 VND total cho request trước. Requested state giữ party_size=2 và exclusion potato, current turn không nói lại các constraints đó. Đề xuất D01, chưa duyệt; giữ bản N2 làm baseline cho tới khi người phụ trách chốt task.

### Q086 — Entity ambiguity

Nguồn `budget_operator`: N2 encodes amount/scope but not strict < versus <=; avoid penalizing this unrepresentable distinction.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ amount/scope N2, bỏ phân biệt operator khi chấm | N2 chưa có field operator. | Tương thích hiện tại nhưng không được tuyên bố đã kiểm tra strict lt/lte. | Không nhất thiết; chờ policy |
| B — Bổ sung operator/approximation/scope evidence ở successor | 220 nghìn là tổng upper budget lte; giữ 2 người và exclusion bằng evidence turn trước. | Làm rõ constraint accuracy và có thể khiến các paraphrase cùng group mang giá trị khác nhau; cần schema/version mới. | Có, chưa triển khai |
| C — needs_clarification khi operator hoặc scope thực sự chưa rõ | Giữ nguyên điều chưa biết thay vì suy đoán. | Không hỏi lại câu đã rõ chỉ vì schema chưa có field; schema gap khác linguistic ambiguity. | Không nhất thiết; chờ policy |

**Codex đề xuất B — CHƯA DUYỆT:** 220 nghìn là tổng upper budget lte; giữ 2 người và exclusion bằng evidence turn trước. Codex đề xuất D08; không điền operator vào gold gốc.

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Negation/exclusion: Kiểm tra polarity của từng operation và exclusion theo target; không bỏ toàn bộ yêu cầu vì một phủ định.
- Current-turn intent vs accumulated state: Thêm upper budget 220000 VND total cho request trước. Requested state giữ party_size=2 và exclusion potato, current turn không nói lại các constraints đó.

**Đề xuất theo record, CHƯA DUYỆT:** Thêm upper budget 220000 VND total cho request trước. Requested state giữ party_size=2 và exclusion potato, current turn không nói lại các constraints đó.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-D-RECOVERY-1-1

Batch B05 · queue 25 · P1_original_flagged · split test · group `dialogue-family-recovery` · **pending**

**Câu gốc:** Đặt món giống hôm kia cho mình

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "needs_clarification",
  "missingSlots": [
    "reference"
  ],
  "reason": "Prior meal absent from supplied context",
  "intents": [
    {
      "id": "i",
      "kind": "add_item",
      "polarity": "affirmed",
      "targetId": "r",
      "quantityId": null
    }
  ],
  "entities": [
    {
      "id": "r",
      "kind": "reference",
      "text": "Đặt món giống hôm kia cho mình",
      "referentId": null
    }
  ]
}
```

**Rationale nguồn:** Dialogue recovery, turn 1: annotation describes the accumulated request state, not an executed cart. Prior context is synthetic and proposals never mutate it.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `6d24f68fef34970789c95512195f5bae8f1d45aa7a0d02f15f65db7d3fe99b2f`.

### Q067 — Current-turn intent vs accumulated state

Nguồn `dialogue_target`: Confirm per-turn intent versus accumulated request state and missing assistant clarification history.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ N2 như snapshot active request/gold hiện tại | Ít thay đổi, vẫn tái lập được evaluator N2. | Phải công bố đang chấm snapshot; nếu dùng các intent lặp lại làm lệnh sẽ hiểu sai thêm món nhiều lần. | Không nhất thiết; chờ policy |
| B — Tách current-turn semantics và requested state | Nhắc món hôm kia/hồi trước ngoài history được cung cấp. Giữ reference unresolved; không bind last-item=Pepsi chỉ vì context có ID đó. Gold chỉ liệt kê reference dù quantity cũng null: chốt all_missing_slots versus next_question_slot. | Chấm hai lớp riêng, giữ evidence turn; cần successor contract/evaluator, không áp vào golden N2. | Có, chưa triển khai |
| C — Chỉ chấm lượt hiện tại và bỏ inherited state | Giảm yêu cầu state khi corpus chưa có assistant turns. | Mất bài kiểm tra giữ preferences/options/reference nhiều lượt; không đáp ứng mục tiêu state nếu không bổ sung tập khác. | Không nhất thiết; chờ policy |

**Codex đề xuất B — CHƯA DUYỆT:** Nhắc món hôm kia/hồi trước ngoài history được cung cấp. Giữ reference unresolved; không bind last-item=Pepsi chỉ vì context có ID đó. Gold chỉ liệt kê reference dù quantity cũng null: chốt all_missing_slots versus next_question_slot. Đề xuất D01, chưa duyệt; giữ bản N2 làm baseline cho tới khi người phụ trách chốt task.

### Q068 — Multi-turn reference

Nguồn `referent_policy`: Context contains last-item even for unavailable historical references; reviewer must specify permitted antecedents.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ binding/clarification hiện tại theo evidence đã có | Nhắc món hôm kia/hồi trước ngoài history được cung cấp. Giữ reference unresolved; không bind last-item=Pepsi chỉ vì context có ID đó. Gold chỉ liệt kê reference dù quantity cũng null: chốt all_missing_slots versus next_question_slot. | Giữ unresolved với lịch sử ngoài phạm vi; recovery đã làm rõ thì không tiếp tục báo thiếu product. | Không nhất thiết; chờ policy |
| B — Bind mọi reference vào last-item=Pepsi | Context có referent ID hợp lệ về cấu trúc. | Có thể ghép sai món hôm kia/cái thứ hai hoặc ghi đè antecedent burger; ID tồn tại không chứng minh nghĩa đúng. | Không nhất thiết; chờ policy |
| C — Bổ sung nguồn referent/history và review lại | Đối chiếu turn, scope, thời điểm hoặc danh sách đã hiển thị có bằng chứng. | Không dựng assistant message hoặc order history từ golden; nếu thiếu nguồn thì giữ pending/reference unresolved. | Có, chưa triển khai |

**Codex đề xuất A — CHƯA DUYỆT:** Nhắc món hôm kia/hồi trước ngoài history được cung cấp. Giữ reference unresolved; không bind last-item=Pepsi chỉ vì context có ID đó. Gold chỉ liệt kê reference dù quantity cũng null: chốt all_missing_slots versus next_question_slot. Đề xuất D05/D09, chưa duyệt. Không tự lấy quantity=3 từ cart.

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Current-turn intent vs accumulated state: Nhắc món hôm kia/hồi trước ngoài history được cung cấp. Giữ reference unresolved; không bind last-item=Pepsi chỉ vì context có ID đó. Gold chỉ liệt kê reference dù quantity cũng null: chốt all_missing_slots versus next_question_slot.
- Clarification policy: missingSlots hiện tại [reference]: phân biệt toàn bộ slot thiếu với slot sẽ hỏi tiếp, không tự điền từ cart.

**Đề xuất theo record, CHƯA DUYỆT:** Nhắc món hôm kia/hồi trước ngoài history được cung cấp. Giữ reference unresolved; không bind last-item=Pepsi chỉ vì context có ID đó. Gold chỉ liệt kê reference dù quantity cũng null: chốt all_missing_slots versus next_question_slot.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-D-RECOVERY-1-2

Batch B05 · queue 26 · P1_original_flagged · split test · group `dialogue-family-recovery` · **pending**

**Câu gốc:** Ý mình nói đến Pepsi đó bạn

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
- N2-D-RECOVERY-1-1: Đặt món giống hôm kia cho mình

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "needs_clarification",
  "missingSlots": [
    "quantity"
  ],
  "reason": "Product clarified, count absent",
  "intents": [
    {
      "id": "i",
      "kind": "add_item",
      "polarity": "affirmed",
      "targetId": "p",
      "quantityId": null
    }
  ],
  "entities": [
    {
      "id": "p",
      "kind": "product",
      "text": "Ý mình nói đến Pepsi đó bạn",
      "productId": "demo-pepsi"
    }
  ]
}
```

**Rationale nguồn:** Dialogue recovery, turn 2: annotation describes the accumulated request state, not an executed cart. Prior context is synthetic and proposals never mutate it.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `8b332e49089d29010b24c1dd391f96990d3a99c6267b8b61eaf94094b4c6c34c`.

### Q069 — Current-turn intent vs accumulated state

Nguồn `dialogue_target`: Confirm per-turn intent versus accumulated request state and missing assistant clarification history.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ N2 như snapshot active request/gold hiện tại | Ít thay đổi, vẫn tái lập được evaluator N2. | Phải công bố đang chấm snapshot; nếu dùng các intent lặp lại làm lệnh sẽ hiểu sai thêm món nhiều lần. | Không nhất thiết; chờ policy |
| B — Tách current-turn semantics và requested state | Người dùng làm rõ product là Pepsi, chưa nêu count. Giữ quantity thiếu, không default=1 hoặc copy cart quantity=3. Không tiếp tục unresolved product sau khi đã có bằng chứng mới. | Chấm hai lớp riêng, giữ evidence turn; cần successor contract/evaluator, không áp vào golden N2. | Có, chưa triển khai |
| C — Chỉ chấm lượt hiện tại và bỏ inherited state | Giảm yêu cầu state khi corpus chưa có assistant turns. | Mất bài kiểm tra giữ preferences/options/reference nhiều lượt; không đáp ứng mục tiêu state nếu không bổ sung tập khác. | Không nhất thiết; chờ policy |

**Codex đề xuất B — CHƯA DUYỆT:** Người dùng làm rõ product là Pepsi, chưa nêu count. Giữ quantity thiếu, không default=1 hoặc copy cart quantity=3. Không tiếp tục unresolved product sau khi đã có bằng chứng mới. Đề xuất D01, chưa duyệt; giữ bản N2 làm baseline cho tới khi người phụ trách chốt task.

### Q070 — Multi-turn reference

Nguồn `referent_policy`: Context contains last-item even for unavailable historical references; reviewer must specify permitted antecedents.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ binding/clarification hiện tại theo evidence đã có | Người dùng làm rõ product là Pepsi, chưa nêu count. Giữ quantity thiếu, không default=1 hoặc copy cart quantity=3. Không tiếp tục unresolved product sau khi đã có bằng chứng mới. | Giữ unresolved với lịch sử ngoài phạm vi; recovery đã làm rõ thì không tiếp tục báo thiếu product. | Không nhất thiết; chờ policy |
| B — Bind mọi reference vào last-item=Pepsi | Context có referent ID hợp lệ về cấu trúc. | Có thể ghép sai món hôm kia/cái thứ hai hoặc ghi đè antecedent burger; ID tồn tại không chứng minh nghĩa đúng. | Không nhất thiết; chờ policy |
| C — Bổ sung nguồn referent/history và review lại | Đối chiếu turn, scope, thời điểm hoặc danh sách đã hiển thị có bằng chứng. | Không dựng assistant message hoặc order history từ golden; nếu thiếu nguồn thì giữ pending/reference unresolved. | Có, chưa triển khai |

**Codex đề xuất A — CHƯA DUYỆT:** Người dùng làm rõ product là Pepsi, chưa nêu count. Giữ quantity thiếu, không default=1 hoặc copy cart quantity=3. Không tiếp tục unresolved product sau khi đã có bằng chứng mới. Đề xuất D05/D09, chưa duyệt. Không tự lấy quantity=3 từ cart.

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Current-turn intent vs accumulated state: Người dùng làm rõ product là Pepsi, chưa nêu count. Giữ quantity thiếu, không default=1 hoặc copy cart quantity=3. Không tiếp tục unresolved product sau khi đã có bằng chứng mới.
- Clarification policy: missingSlots hiện tại [quantity]: phân biệt toàn bộ slot thiếu với slot sẽ hỏi tiếp, không tự điền từ cart.

**Đề xuất theo record, CHƯA DUYỆT:** Người dùng làm rõ product là Pepsi, chưa nêu count. Giữ quantity thiếu, không default=1 hoặc copy cart quantity=3. Không tiếp tục unresolved product sau khi đã có bằng chứng mới.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-D-RECOVERY-1-3

Batch B05 · queue 27 · P1_original_flagged · split test · group `dialogue-family-recovery` · **pending**

**Câu gốc:** Giờ lấy đúng ba phần nước đó

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
- N2-D-RECOVERY-1-1: Đặt món giống hôm kia cho mình
- N2-D-RECOVERY-1-2: Ý mình nói đến Pepsi đó bạn

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "add_item",
      "polarity": "affirmed",
      "targetId": "p",
      "quantityId": "q"
    }
  ],
  "entities": [
    {
      "id": "p",
      "kind": "product",
      "text": "Giờ lấy đúng ba phần nước đó",
      "productId": "demo-pepsi"
    },
    {
      "id": "q",
      "kind": "quantity",
      "text": "Giờ lấy đúng ba phần nước đó",
      "mode": "delta",
      "value": 3
    }
  ]
}
```

**Rationale nguồn:** Dialogue recovery, turn 3: annotation describes the accumulated request state, not an executed cart. Prior context is synthetic and proposals never mutate it.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `b453eaf1fde9759ffd1cdd5d713f16aa097af597f319db65c7472adba85910f5`.

### Q071 — Current-turn intent vs accumulated state

Nguồn `dialogue_target`: Confirm per-turn intent versus accumulated request state and missing assistant clarification history.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ N2 như snapshot active request/gold hiện tại | Ít thay đổi, vẫn tái lập được evaluator N2. | Phải công bố đang chấm snapshot; nếu dùng các intent lặp lại làm lệnh sẽ hiểu sai thêm món nhiều lần. | Không nhất thiết; chờ policy |
| B — Tách current-turn semantics và requested state | Nêu 3 Pepsi cho request mới đã làm rõ: quantity delta +3 khi chốt ordering intent, không phải do cart hiện có 3 nên final=3. Không tính cart final=6; giữ target/evidence từ history. | Chấm hai lớp riêng, giữ evidence turn; cần successor contract/evaluator, không áp vào golden N2. | Có, chưa triển khai |
| C — Chỉ chấm lượt hiện tại và bỏ inherited state | Giảm yêu cầu state khi corpus chưa có assistant turns. | Mất bài kiểm tra giữ preferences/options/reference nhiều lượt; không đáp ứng mục tiêu state nếu không bổ sung tập khác. | Không nhất thiết; chờ policy |

**Codex đề xuất B — CHƯA DUYỆT:** Nêu 3 Pepsi cho request mới đã làm rõ: quantity delta +3 khi chốt ordering intent, không phải do cart hiện có 3 nên final=3. Không tính cart final=6; giữ target/evidence từ history. Đề xuất D01, chưa duyệt; giữ bản N2 làm baseline cho tới khi người phụ trách chốt task.

### Q072 — Multi-turn reference

Nguồn `referent_policy`: Context contains last-item even for unavailable historical references; reviewer must specify permitted antecedents.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ binding/clarification hiện tại theo evidence đã có | Nêu 3 Pepsi cho request mới đã làm rõ: quantity delta +3 khi chốt ordering intent, không phải do cart hiện có 3 nên final=3. Không tính cart final=6; giữ target/evidence từ history. | Giữ unresolved với lịch sử ngoài phạm vi; recovery đã làm rõ thì không tiếp tục báo thiếu product. | Không nhất thiết; chờ policy |
| B — Bind mọi reference vào last-item=Pepsi | Context có referent ID hợp lệ về cấu trúc. | Có thể ghép sai món hôm kia/cái thứ hai hoặc ghi đè antecedent burger; ID tồn tại không chứng minh nghĩa đúng. | Không nhất thiết; chờ policy |
| C — Bổ sung nguồn referent/history và review lại | Đối chiếu turn, scope, thời điểm hoặc danh sách đã hiển thị có bằng chứng. | Không dựng assistant message hoặc order history từ golden; nếu thiếu nguồn thì giữ pending/reference unresolved. | Có, chưa triển khai |

**Codex đề xuất A — CHƯA DUYỆT:** Nêu 3 Pepsi cho request mới đã làm rõ: quantity delta +3 khi chốt ordering intent, không phải do cart hiện có 3 nên final=3. Không tính cart final=6; giữ target/evidence từ history. Đề xuất D05/D09, chưa duyệt. Không tự lấy quantity=3 từ cart.

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Quantity delta/absolute: Kiểm tra delta=3 đúng mục tiêu cart/pending_request; không tự tính final quantity hoặc lấy dung tích làm count.
- Current-turn intent vs accumulated state: Nêu 3 Pepsi cho request mới đã làm rõ: quantity delta +3 khi chốt ordering intent, không phải do cart hiện có 3 nên final=3. Không tính cart final=6; giữ target/evidence từ history.

**Đề xuất theo record, CHƯA DUYỆT:** Nêu 3 Pepsi cho request mới đã làm rõ: quantity delta +3 khi chốt ordering intent, không phải do cart hiện có 3 nên final=3. Không tính cart final=6; giữ target/evidence từ history.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-D-RECOVERY-2-1

Batch B05 · queue 28 · P1_original_flagged · split test · group `dialogue-family-recovery` · **pending**

**Câu gốc:** Lấy lại cái hồi trước mình hay ăn

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "needs_clarification",
  "missingSlots": [
    "reference"
  ],
  "reason": "Prior meal absent from supplied context",
  "intents": [
    {
      "id": "i",
      "kind": "add_item",
      "polarity": "affirmed",
      "targetId": "r",
      "quantityId": null
    }
  ],
  "entities": [
    {
      "id": "r",
      "kind": "reference",
      "text": "Lấy lại cái hồi trước mình hay ăn",
      "referentId": null
    }
  ]
}
```

**Rationale nguồn:** Dialogue recovery, turn 1: annotation describes the accumulated request state, not an executed cart. Prior context is synthetic and proposals never mutate it.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `756d5c98ca735b21b232695af2c81e43e42cef178a3f0f2895353d3a93654338`.

### Q073 — Current-turn intent vs accumulated state

Nguồn `dialogue_target`: Confirm per-turn intent versus accumulated request state and missing assistant clarification history.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ N2 như snapshot active request/gold hiện tại | Ít thay đổi, vẫn tái lập được evaluator N2. | Phải công bố đang chấm snapshot; nếu dùng các intent lặp lại làm lệnh sẽ hiểu sai thêm món nhiều lần. | Không nhất thiết; chờ policy |
| B — Tách current-turn semantics và requested state | Nhắc món hôm kia/hồi trước ngoài history được cung cấp. Giữ reference unresolved; không bind last-item=Pepsi chỉ vì context có ID đó. Gold chỉ liệt kê reference dù quantity cũng null: chốt all_missing_slots versus next_question_slot. | Chấm hai lớp riêng, giữ evidence turn; cần successor contract/evaluator, không áp vào golden N2. | Có, chưa triển khai |
| C — Chỉ chấm lượt hiện tại và bỏ inherited state | Giảm yêu cầu state khi corpus chưa có assistant turns. | Mất bài kiểm tra giữ preferences/options/reference nhiều lượt; không đáp ứng mục tiêu state nếu không bổ sung tập khác. | Không nhất thiết; chờ policy |

**Codex đề xuất B — CHƯA DUYỆT:** Nhắc món hôm kia/hồi trước ngoài history được cung cấp. Giữ reference unresolved; không bind last-item=Pepsi chỉ vì context có ID đó. Gold chỉ liệt kê reference dù quantity cũng null: chốt all_missing_slots versus next_question_slot. Đề xuất D01, chưa duyệt; giữ bản N2 làm baseline cho tới khi người phụ trách chốt task.

### Q074 — Multi-turn reference

Nguồn `referent_policy`: Context contains last-item even for unavailable historical references; reviewer must specify permitted antecedents.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ binding/clarification hiện tại theo evidence đã có | Nhắc món hôm kia/hồi trước ngoài history được cung cấp. Giữ reference unresolved; không bind last-item=Pepsi chỉ vì context có ID đó. Gold chỉ liệt kê reference dù quantity cũng null: chốt all_missing_slots versus next_question_slot. | Giữ unresolved với lịch sử ngoài phạm vi; recovery đã làm rõ thì không tiếp tục báo thiếu product. | Không nhất thiết; chờ policy |
| B — Bind mọi reference vào last-item=Pepsi | Context có referent ID hợp lệ về cấu trúc. | Có thể ghép sai món hôm kia/cái thứ hai hoặc ghi đè antecedent burger; ID tồn tại không chứng minh nghĩa đúng. | Không nhất thiết; chờ policy |
| C — Bổ sung nguồn referent/history và review lại | Đối chiếu turn, scope, thời điểm hoặc danh sách đã hiển thị có bằng chứng. | Không dựng assistant message hoặc order history từ golden; nếu thiếu nguồn thì giữ pending/reference unresolved. | Có, chưa triển khai |

**Codex đề xuất A — CHƯA DUYỆT:** Nhắc món hôm kia/hồi trước ngoài history được cung cấp. Giữ reference unresolved; không bind last-item=Pepsi chỉ vì context có ID đó. Gold chỉ liệt kê reference dù quantity cũng null: chốt all_missing_slots versus next_question_slot. Đề xuất D05/D09, chưa duyệt. Không tự lấy quantity=3 từ cart.

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Current-turn intent vs accumulated state: Nhắc món hôm kia/hồi trước ngoài history được cung cấp. Giữ reference unresolved; không bind last-item=Pepsi chỉ vì context có ID đó. Gold chỉ liệt kê reference dù quantity cũng null: chốt all_missing_slots versus next_question_slot.
- Clarification policy: missingSlots hiện tại [reference]: phân biệt toàn bộ slot thiếu với slot sẽ hỏi tiếp, không tự điền từ cart.

**Đề xuất theo record, CHƯA DUYỆT:** Nhắc món hôm kia/hồi trước ngoài history được cung cấp. Giữ reference unresolved; không bind last-item=Pepsi chỉ vì context có ID đó. Gold chỉ liệt kê reference dù quantity cũng null: chốt all_missing_slots versus next_question_slot.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-D-RECOVERY-2-2

Batch B05 · queue 29 · P1_original_flagged · split test · group `dialogue-family-recovery` · **pending**

**Câu gốc:** Món nước mình nhắc là Pepsi

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
- N2-D-RECOVERY-2-1: Lấy lại cái hồi trước mình hay ăn

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "needs_clarification",
  "missingSlots": [
    "quantity"
  ],
  "reason": "Product clarified, count absent",
  "intents": [
    {
      "id": "i",
      "kind": "add_item",
      "polarity": "affirmed",
      "targetId": "p",
      "quantityId": null
    }
  ],
  "entities": [
    {
      "id": "p",
      "kind": "product",
      "text": "Món nước mình nhắc là Pepsi",
      "productId": "demo-pepsi"
    }
  ]
}
```

**Rationale nguồn:** Dialogue recovery, turn 2: annotation describes the accumulated request state, not an executed cart. Prior context is synthetic and proposals never mutate it.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `e6d049c9571070305f23d7215ea73d3c5d574c5e3b37dcd5cdebe784c87319ca`.

### Q075 — Current-turn intent vs accumulated state

Nguồn `dialogue_target`: Confirm per-turn intent versus accumulated request state and missing assistant clarification history.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ N2 như snapshot active request/gold hiện tại | Ít thay đổi, vẫn tái lập được evaluator N2. | Phải công bố đang chấm snapshot; nếu dùng các intent lặp lại làm lệnh sẽ hiểu sai thêm món nhiều lần. | Không nhất thiết; chờ policy |
| B — Tách current-turn semantics và requested state | Người dùng làm rõ product là Pepsi, chưa nêu count. Giữ quantity thiếu, không default=1 hoặc copy cart quantity=3. Không tiếp tục unresolved product sau khi đã có bằng chứng mới. | Chấm hai lớp riêng, giữ evidence turn; cần successor contract/evaluator, không áp vào golden N2. | Có, chưa triển khai |
| C — Chỉ chấm lượt hiện tại và bỏ inherited state | Giảm yêu cầu state khi corpus chưa có assistant turns. | Mất bài kiểm tra giữ preferences/options/reference nhiều lượt; không đáp ứng mục tiêu state nếu không bổ sung tập khác. | Không nhất thiết; chờ policy |

**Codex đề xuất B — CHƯA DUYỆT:** Người dùng làm rõ product là Pepsi, chưa nêu count. Giữ quantity thiếu, không default=1 hoặc copy cart quantity=3. Không tiếp tục unresolved product sau khi đã có bằng chứng mới. Đề xuất D01, chưa duyệt; giữ bản N2 làm baseline cho tới khi người phụ trách chốt task.

### Q076 — Multi-turn reference

Nguồn `referent_policy`: Context contains last-item even for unavailable historical references; reviewer must specify permitted antecedents.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ binding/clarification hiện tại theo evidence đã có | Người dùng làm rõ product là Pepsi, chưa nêu count. Giữ quantity thiếu, không default=1 hoặc copy cart quantity=3. Không tiếp tục unresolved product sau khi đã có bằng chứng mới. | Giữ unresolved với lịch sử ngoài phạm vi; recovery đã làm rõ thì không tiếp tục báo thiếu product. | Không nhất thiết; chờ policy |
| B — Bind mọi reference vào last-item=Pepsi | Context có referent ID hợp lệ về cấu trúc. | Có thể ghép sai món hôm kia/cái thứ hai hoặc ghi đè antecedent burger; ID tồn tại không chứng minh nghĩa đúng. | Không nhất thiết; chờ policy |
| C — Bổ sung nguồn referent/history và review lại | Đối chiếu turn, scope, thời điểm hoặc danh sách đã hiển thị có bằng chứng. | Không dựng assistant message hoặc order history từ golden; nếu thiếu nguồn thì giữ pending/reference unresolved. | Có, chưa triển khai |

**Codex đề xuất A — CHƯA DUYỆT:** Người dùng làm rõ product là Pepsi, chưa nêu count. Giữ quantity thiếu, không default=1 hoặc copy cart quantity=3. Không tiếp tục unresolved product sau khi đã có bằng chứng mới. Đề xuất D05/D09, chưa duyệt. Không tự lấy quantity=3 từ cart.

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Current-turn intent vs accumulated state: Người dùng làm rõ product là Pepsi, chưa nêu count. Giữ quantity thiếu, không default=1 hoặc copy cart quantity=3. Không tiếp tục unresolved product sau khi đã có bằng chứng mới.
- Clarification policy: missingSlots hiện tại [quantity]: phân biệt toàn bộ slot thiếu với slot sẽ hỏi tiếp, không tự điền từ cart.

**Đề xuất theo record, CHƯA DUYỆT:** Người dùng làm rõ product là Pepsi, chưa nêu count. Giữ quantity thiếu, không default=1 hoặc copy cart quantity=3. Không tiếp tục unresolved product sau khi đã có bằng chứng mới.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-D-RECOVERY-2-3

Batch B05 · queue 30 · P1_original_flagged · split test · group `dialogue-family-recovery` · **pending**

**Câu gốc:** Mình muốn 3 Pepsi cho yêu cầu này

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
- N2-D-RECOVERY-2-1: Lấy lại cái hồi trước mình hay ăn
- N2-D-RECOVERY-2-2: Món nước mình nhắc là Pepsi

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "add_item",
      "polarity": "affirmed",
      "targetId": "p",
      "quantityId": "q"
    }
  ],
  "entities": [
    {
      "id": "p",
      "kind": "product",
      "text": "Mình muốn 3 Pepsi cho yêu cầu này",
      "productId": "demo-pepsi"
    },
    {
      "id": "q",
      "kind": "quantity",
      "text": "Mình muốn 3 Pepsi cho yêu cầu này",
      "mode": "delta",
      "value": 3
    }
  ]
}
```

**Rationale nguồn:** Dialogue recovery, turn 3: annotation describes the accumulated request state, not an executed cart. Prior context is synthetic and proposals never mutate it.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `83e6707cba6905b4ad715622d6d544bc9737b24b86f8612c54fb7ffcfb3407de`.

### Q077 — Current-turn intent vs accumulated state

Nguồn `dialogue_target`: Confirm per-turn intent versus accumulated request state and missing assistant clarification history.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ N2 như snapshot active request/gold hiện tại | Ít thay đổi, vẫn tái lập được evaluator N2. | Phải công bố đang chấm snapshot; nếu dùng các intent lặp lại làm lệnh sẽ hiểu sai thêm món nhiều lần. | Không nhất thiết; chờ policy |
| B — Tách current-turn semantics và requested state | Nêu 3 Pepsi cho request mới đã làm rõ: quantity delta +3 khi chốt ordering intent, không phải do cart hiện có 3 nên final=3. Không tính cart final=6; giữ target/evidence từ history. | Chấm hai lớp riêng, giữ evidence turn; cần successor contract/evaluator, không áp vào golden N2. | Có, chưa triển khai |
| C — Chỉ chấm lượt hiện tại và bỏ inherited state | Giảm yêu cầu state khi corpus chưa có assistant turns. | Mất bài kiểm tra giữ preferences/options/reference nhiều lượt; không đáp ứng mục tiêu state nếu không bổ sung tập khác. | Không nhất thiết; chờ policy |

**Codex đề xuất B — CHƯA DUYỆT:** Nêu 3 Pepsi cho request mới đã làm rõ: quantity delta +3 khi chốt ordering intent, không phải do cart hiện có 3 nên final=3. Không tính cart final=6; giữ target/evidence từ history. Đề xuất D01, chưa duyệt; giữ bản N2 làm baseline cho tới khi người phụ trách chốt task.

### Q078 — Multi-turn reference

Nguồn `referent_policy`: Context contains last-item even for unavailable historical references; reviewer must specify permitted antecedents.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ binding/clarification hiện tại theo evidence đã có | Nêu 3 Pepsi cho request mới đã làm rõ: quantity delta +3 khi chốt ordering intent, không phải do cart hiện có 3 nên final=3. Không tính cart final=6; giữ target/evidence từ history. | Giữ unresolved với lịch sử ngoài phạm vi; recovery đã làm rõ thì không tiếp tục báo thiếu product. | Không nhất thiết; chờ policy |
| B — Bind mọi reference vào last-item=Pepsi | Context có referent ID hợp lệ về cấu trúc. | Có thể ghép sai món hôm kia/cái thứ hai hoặc ghi đè antecedent burger; ID tồn tại không chứng minh nghĩa đúng. | Không nhất thiết; chờ policy |
| C — Bổ sung nguồn referent/history và review lại | Đối chiếu turn, scope, thời điểm hoặc danh sách đã hiển thị có bằng chứng. | Không dựng assistant message hoặc order history từ golden; nếu thiếu nguồn thì giữ pending/reference unresolved. | Có, chưa triển khai |

**Codex đề xuất A — CHƯA DUYỆT:** Nêu 3 Pepsi cho request mới đã làm rõ: quantity delta +3 khi chốt ordering intent, không phải do cart hiện có 3 nên final=3. Không tính cart final=6; giữ target/evidence từ history. Đề xuất D05/D09, chưa duyệt. Không tự lấy quantity=3 từ cart.

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Quantity delta/absolute: Kiểm tra delta=3 đúng mục tiêu cart/pending_request; không tự tính final quantity hoặc lấy dung tích làm count.
- Current-turn intent vs accumulated state: Nêu 3 Pepsi cho request mới đã làm rõ: quantity delta +3 khi chốt ordering intent, không phải do cart hiện có 3 nên final=3. Không tính cart final=6; giữ target/evidence từ history.

**Đề xuất theo record, CHƯA DUYỆT:** Nêu 3 Pepsi cho request mới đã làm rõ: quantity delta +3 khi chốt ordering intent, không phải do cart hiện có 3 nên final=3. Không tính cart final=6; giữ target/evidence từ history.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-D-REF-1-1

Batch B06 · queue 31 · P1_original_flagged · split dev · group `dialogue-family-ref` · **pending**

**Câu gốc:** Mình đang hỏi về Pepsi nha

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "get_product_details",
      "polarity": "affirmed",
      "targetIds": [
        "p"
      ]
    }
  ],
  "entities": [
    {
      "id": "p",
      "kind": "product",
      "text": "Mình đang hỏi về Pepsi nha",
      "productId": "demo-pepsi"
    }
  ]
}
```

**Rationale nguồn:** Dialogue ref, turn 1: annotation describes the accumulated request state, not an executed cart. Prior context is synthetic and proposals never mutate it.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `107f2afb0ddf536f7ca702942e1314c065494344e5478b2dbb71962b6dbd5c4d`.

### Q061 — Current-turn intent vs accumulated state

Nguồn `dialogue_target`: Confirm per-turn intent versus accumulated request state and missing assistant clarification history.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ N2 như snapshot active request/gold hiện tại | Ít thay đổi, vẫn tái lập được evaluator N2. | Phải công bố đang chấm snapshot; nếu dùng các intent lặp lại làm lệnh sẽ hiểu sai thêm món nhiều lần. | Không nhất thiết; chờ policy |
| B — Tách current-turn semantics và requested state | get_product_details cho Pepsi được nói trực tiếp; đây là utterance neo antecedent, không phải kết quả tool đã trả về. | Chấm hai lớp riêng, giữ evidence turn; cần successor contract/evaluator, không áp vào golden N2. | Có, chưa triển khai |
| C — Chỉ chấm lượt hiện tại và bỏ inherited state | Giảm yêu cầu state khi corpus chưa có assistant turns. | Mất bài kiểm tra giữ preferences/options/reference nhiều lượt; không đáp ứng mục tiêu state nếu không bổ sung tập khác. | Không nhất thiết; chờ policy |

**Codex đề xuất B — CHƯA DUYỆT:** get_product_details cho Pepsi được nói trực tiếp; đây là utterance neo antecedent, không phải kết quả tool đã trả về. Đề xuất D01, chưa duyệt; giữ bản N2 làm baseline cho tới khi người phụ trách chốt task.

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Current-turn intent vs accumulated state: get_product_details cho Pepsi được nói trực tiếp; đây là utterance neo antecedent, không phải kết quả tool đã trả về.

**Đề xuất theo record, CHƯA DUYỆT:** get_product_details cho Pepsi được nói trực tiếp; đây là utterance neo antecedent, không phải kết quả tool đã trả về.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-D-REF-1-2

Batch B06 · queue 32 · P1_original_flagged · split dev · group `dialogue-family-ref` · **pending**

**Câu gốc:** Giá món vừa nhắc là bao nhiêu

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
- N2-D-REF-1-1: Mình đang hỏi về Pepsi nha

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "ask_price",
      "polarity": "affirmed",
      "targetIds": [
        "r"
      ]
    }
  ],
  "entities": [
    {
      "id": "r",
      "kind": "reference",
      "text": "Giá món vừa nhắc là bao nhiêu",
      "referentId": "last-item"
    }
  ]
}
```

**Rationale nguồn:** Dialogue ref, turn 2: annotation describes the accumulated request state, not an executed cart. Prior context is synthetic and proposals never mutate it.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `e08b5000ff8a5584cd8d40014fae7ab4f5c7c21545d8fa1a912ff054411d7ad2`.

### Q062 — Current-turn intent vs accumulated state

Nguồn `dialogue_target`: Confirm per-turn intent versus accumulated request state and missing assistant clarification history.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ N2 như snapshot active request/gold hiện tại | Ít thay đổi, vẫn tái lập được evaluator N2. | Phải công bố đang chấm snapshot; nếu dùng các intent lặp lại làm lệnh sẽ hiểu sai thêm món nhiều lần. | Không nhất thiết; chờ policy |
| B — Tách current-turn semantics và requested state | ask_price của Pepsi được resolve từ prior user mention có nguồn. Không carry intent get_product_details thành intent thứ hai và không bịa giá vì context không có giá. | Chấm hai lớp riêng, giữ evidence turn; cần successor contract/evaluator, không áp vào golden N2. | Có, chưa triển khai |
| C — Chỉ chấm lượt hiện tại và bỏ inherited state | Giảm yêu cầu state khi corpus chưa có assistant turns. | Mất bài kiểm tra giữ preferences/options/reference nhiều lượt; không đáp ứng mục tiêu state nếu không bổ sung tập khác. | Không nhất thiết; chờ policy |

**Codex đề xuất B — CHƯA DUYỆT:** ask_price của Pepsi được resolve từ prior user mention có nguồn. Không carry intent get_product_details thành intent thứ hai và không bịa giá vì context không có giá. Đề xuất D01, chưa duyệt; giữ bản N2 làm baseline cho tới khi người phụ trách chốt task.

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Current-turn intent vs accumulated state: ask_price của Pepsi được resolve từ prior user mention có nguồn. Không carry intent get_product_details thành intent thứ hai và không bịa giá vì context không có giá.

**Đề xuất theo record, CHƯA DUYỆT:** ask_price của Pepsi được resolve từ prior user mention có nguồn. Không carry intent get_product_details thành intent thứ hai và không bịa giá vì context không có giá.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-D-REF-1-3

Batch B06 · queue 33 · P1_original_flagged · split dev · group `dialogue-family-ref` · **pending**

**Câu gốc:** Món đó có sẵn tại đây không

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
- N2-D-REF-1-1: Mình đang hỏi về Pepsi nha
- N2-D-REF-1-2: Giá món vừa nhắc là bao nhiêu

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "ask_availability",
      "polarity": "affirmed",
      "targetIds": [
        "r"
      ]
    }
  ],
  "entities": [
    {
      "id": "r",
      "kind": "reference",
      "text": "Món đó có sẵn tại đây không",
      "referentId": "last-item"
    }
  ]
}
```

**Rationale nguồn:** Dialogue ref, turn 3: annotation describes the accumulated request state, not an executed cart. Prior context is synthetic and proposals never mutate it.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `465aee30c10100fd2803ffaed0708520404c81699343f57f58a5f02aad8ce62e`.

### Q063 — Current-turn intent vs accumulated state

Nguồn `dialogue_target`: Confirm per-turn intent versus accumulated request state and missing assistant clarification history.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ N2 như snapshot active request/gold hiện tại | Ít thay đổi, vẫn tái lập được evaluator N2. | Phải công bố đang chấm snapshot; nếu dùng các intent lặp lại làm lệnh sẽ hiểu sai thêm món nhiều lần. | Không nhất thiết; chờ policy |
| B — Tách current-turn semantics và requested state | ask_availability cho cùng Pepsi; giữ câu hỏi rõ, không carry ask_price và không suy availability từ sự tồn tại product trong C0. | Chấm hai lớp riêng, giữ evidence turn; cần successor contract/evaluator, không áp vào golden N2. | Có, chưa triển khai |
| C — Chỉ chấm lượt hiện tại và bỏ inherited state | Giảm yêu cầu state khi corpus chưa có assistant turns. | Mất bài kiểm tra giữ preferences/options/reference nhiều lượt; không đáp ứng mục tiêu state nếu không bổ sung tập khác. | Không nhất thiết; chờ policy |

**Codex đề xuất B — CHƯA DUYỆT:** ask_availability cho cùng Pepsi; giữ câu hỏi rõ, không carry ask_price và không suy availability từ sự tồn tại product trong C0. Đề xuất D01, chưa duyệt; giữ bản N2 làm baseline cho tới khi người phụ trách chốt task.

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Current-turn intent vs accumulated state: ask_availability cho cùng Pepsi; giữ câu hỏi rõ, không carry ask_price và không suy availability từ sự tồn tại product trong C0.

**Đề xuất theo record, CHƯA DUYỆT:** ask_availability cho cùng Pepsi; giữ câu hỏi rõ, không carry ask_price và không suy availability từ sự tồn tại product trong C0.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-D-REF-2-1

Batch B06 · queue 34 · P1_original_flagged · split dev · group `dialogue-family-ref` · **pending**

**Câu gốc:** Pepsi là món mình muốn hỏi tiếp

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "get_product_details",
      "polarity": "affirmed",
      "targetIds": [
        "p"
      ]
    }
  ],
  "entities": [
    {
      "id": "p",
      "kind": "product",
      "text": "Pepsi là món mình muốn hỏi tiếp",
      "productId": "demo-pepsi"
    }
  ]
}
```

**Rationale nguồn:** Dialogue ref, turn 1: annotation describes the accumulated request state, not an executed cart. Prior context is synthetic and proposals never mutate it.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `b05b14132b6d6b5a76b1734dc22f5375c02e7b0eada2a8dd591117590b51d67d`.

### Q064 — Current-turn intent vs accumulated state

Nguồn `dialogue_target`: Confirm per-turn intent versus accumulated request state and missing assistant clarification history.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ N2 như snapshot active request/gold hiện tại | Ít thay đổi, vẫn tái lập được evaluator N2. | Phải công bố đang chấm snapshot; nếu dùng các intent lặp lại làm lệnh sẽ hiểu sai thêm món nhiều lần. | Không nhất thiết; chờ policy |
| B — Tách current-turn semantics và requested state | get_product_details cho Pepsi được nói trực tiếp; đây là utterance neo antecedent, không phải kết quả tool đã trả về. | Chấm hai lớp riêng, giữ evidence turn; cần successor contract/evaluator, không áp vào golden N2. | Có, chưa triển khai |
| C — Chỉ chấm lượt hiện tại và bỏ inherited state | Giảm yêu cầu state khi corpus chưa có assistant turns. | Mất bài kiểm tra giữ preferences/options/reference nhiều lượt; không đáp ứng mục tiêu state nếu không bổ sung tập khác. | Không nhất thiết; chờ policy |

**Codex đề xuất B — CHƯA DUYỆT:** get_product_details cho Pepsi được nói trực tiếp; đây là utterance neo antecedent, không phải kết quả tool đã trả về. Đề xuất D01, chưa duyệt; giữ bản N2 làm baseline cho tới khi người phụ trách chốt task.

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Current-turn intent vs accumulated state: get_product_details cho Pepsi được nói trực tiếp; đây là utterance neo antecedent, không phải kết quả tool đã trả về.

**Đề xuất theo record, CHƯA DUYỆT:** get_product_details cho Pepsi được nói trực tiếp; đây là utterance neo antecedent, không phải kết quả tool đã trả về.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-D-REF-2-2

Batch B06 · queue 35 · P1_original_flagged · split dev · group `dialogue-family-ref` · **pending**

**Câu gốc:** Món đó có giá như thế nào

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
- N2-D-REF-2-1: Pepsi là món mình muốn hỏi tiếp

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "ask_price",
      "polarity": "affirmed",
      "targetIds": [
        "r"
      ]
    }
  ],
  "entities": [
    {
      "id": "r",
      "kind": "reference",
      "text": "Món đó có giá như thế nào",
      "referentId": "last-item"
    }
  ]
}
```

**Rationale nguồn:** Dialogue ref, turn 2: annotation describes the accumulated request state, not an executed cart. Prior context is synthetic and proposals never mutate it.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `cd8f8acd93aaedbaa61acc374cd3a2d1027d911f7b09796e2b17765dd0b44be6`.

### Q065 — Current-turn intent vs accumulated state

Nguồn `dialogue_target`: Confirm per-turn intent versus accumulated request state and missing assistant clarification history.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ N2 như snapshot active request/gold hiện tại | Ít thay đổi, vẫn tái lập được evaluator N2. | Phải công bố đang chấm snapshot; nếu dùng các intent lặp lại làm lệnh sẽ hiểu sai thêm món nhiều lần. | Không nhất thiết; chờ policy |
| B — Tách current-turn semantics và requested state | ask_price của Pepsi được resolve từ prior user mention có nguồn. Không carry intent get_product_details thành intent thứ hai và không bịa giá vì context không có giá. | Chấm hai lớp riêng, giữ evidence turn; cần successor contract/evaluator, không áp vào golden N2. | Có, chưa triển khai |
| C — Chỉ chấm lượt hiện tại và bỏ inherited state | Giảm yêu cầu state khi corpus chưa có assistant turns. | Mất bài kiểm tra giữ preferences/options/reference nhiều lượt; không đáp ứng mục tiêu state nếu không bổ sung tập khác. | Không nhất thiết; chờ policy |

**Codex đề xuất B — CHƯA DUYỆT:** ask_price của Pepsi được resolve từ prior user mention có nguồn. Không carry intent get_product_details thành intent thứ hai và không bịa giá vì context không có giá. Đề xuất D01, chưa duyệt; giữ bản N2 làm baseline cho tới khi người phụ trách chốt task.

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Current-turn intent vs accumulated state: ask_price của Pepsi được resolve từ prior user mention có nguồn. Không carry intent get_product_details thành intent thứ hai và không bịa giá vì context không có giá.

**Đề xuất theo record, CHƯA DUYỆT:** ask_price của Pepsi được resolve từ prior user mention có nguồn. Không carry intent get_product_details thành intent thứ hai và không bịa giá vì context không có giá.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-D-REF-2-3

Batch B06 · queue 36 · P1_original_flagged · split dev · group `dialogue-family-ref` · **pending**

**Câu gốc:** Kiểm tra availability món vừa hỏi

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
- N2-D-REF-2-1: Pepsi là món mình muốn hỏi tiếp
- N2-D-REF-2-2: Món đó có giá như thế nào

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "ask_availability",
      "polarity": "affirmed",
      "targetIds": [
        "r"
      ]
    }
  ],
  "entities": [
    {
      "id": "r",
      "kind": "reference",
      "text": "Kiểm tra availability món vừa hỏi",
      "referentId": "last-item"
    }
  ]
}
```

**Rationale nguồn:** Dialogue ref, turn 3: annotation describes the accumulated request state, not an executed cart. Prior context is synthetic and proposals never mutate it.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `35955d425bbb57a5c3e3d5e7db232829d184a9c74664b6b71b6a6e8d62c00300`.

### Q066 — Current-turn intent vs accumulated state

Nguồn `dialogue_target`: Confirm per-turn intent versus accumulated request state and missing assistant clarification history.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ N2 như snapshot active request/gold hiện tại | Ít thay đổi, vẫn tái lập được evaluator N2. | Phải công bố đang chấm snapshot; nếu dùng các intent lặp lại làm lệnh sẽ hiểu sai thêm món nhiều lần. | Không nhất thiết; chờ policy |
| B — Tách current-turn semantics và requested state | ask_availability cho cùng Pepsi; giữ câu hỏi rõ, không carry ask_price và không suy availability từ sự tồn tại product trong C0. | Chấm hai lớp riêng, giữ evidence turn; cần successor contract/evaluator, không áp vào golden N2. | Có, chưa triển khai |
| C — Chỉ chấm lượt hiện tại và bỏ inherited state | Giảm yêu cầu state khi corpus chưa có assistant turns. | Mất bài kiểm tra giữ preferences/options/reference nhiều lượt; không đáp ứng mục tiêu state nếu không bổ sung tập khác. | Không nhất thiết; chờ policy |

**Codex đề xuất B — CHƯA DUYỆT:** ask_availability cho cùng Pepsi; giữ câu hỏi rõ, không carry ask_price và không suy availability từ sự tồn tại product trong C0. Đề xuất D01, chưa duyệt; giữ bản N2 làm baseline cho tới khi người phụ trách chốt task.

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Current-turn intent vs accumulated state: ask_availability cho cùng Pepsi; giữ câu hỏi rõ, không carry ask_price và không suy availability từ sự tồn tại product trong C0.

**Đề xuất theo record, CHƯA DUYỆT:** ask_availability cho cùng Pepsi; giữ câu hỏi rõ, không carry ask_price và không suy availability từ sự tồn tại product trong C0.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-D-OPTION-1-1

Batch B07 · queue 37 · P1_original_flagged · split dev · group `dialogue-family-option` · **pending**

**Câu gốc:** Nước Pepsi có những cỡ gì vậy

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "ask_options",
      "polarity": "affirmed",
      "targetIds": [
        "p"
      ]
    }
  ],
  "entities": [
    {
      "id": "p",
      "kind": "product",
      "text": "Nước Pepsi có những cỡ gì vậy",
      "productId": "demo-pepsi"
    }
  ]
}
```

**Rationale nguồn:** Dialogue option, turn 1: annotation describes the accumulated request state, not an executed cart. Prior context is synthetic and proposals never mutate it.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `3ac50d27e29a240a4d535260e09ba1f5483cb95b9e5c0dac07ab6c6b56bffc7f`.

### Q055 — Current-turn intent vs accumulated state

Nguồn `dialogue_target`: Confirm per-turn intent versus accumulated request state and missing assistant clarification history.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ N2 như snapshot active request/gold hiện tại | Ít thay đổi, vẫn tái lập được evaluator N2. | Phải công bố đang chấm snapshot; nếu dùng các intent lặp lại làm lệnh sẽ hiểu sai thêm món nhiều lần. | Không nhất thiết; chờ policy |
| B — Tách current-turn semantics và requested state | ask_options cho Pepsi, chưa phải yêu cầu add. Không điền count hoặc tự chọn large. | Chấm hai lớp riêng, giữ evidence turn; cần successor contract/evaluator, không áp vào golden N2. | Có, chưa triển khai |
| C — Chỉ chấm lượt hiện tại và bỏ inherited state | Giảm yêu cầu state khi corpus chưa có assistant turns. | Mất bài kiểm tra giữ preferences/options/reference nhiều lượt; không đáp ứng mục tiêu state nếu không bổ sung tập khác. | Không nhất thiết; chờ policy |

**Codex đề xuất B — CHƯA DUYỆT:** ask_options cho Pepsi, chưa phải yêu cầu add. Không điền count hoặc tự chọn large. Đề xuất D01, chưa duyệt; giữ bản N2 làm baseline cho tới khi người phụ trách chốt task.

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Current-turn intent vs accumulated state: ask_options cho Pepsi, chưa phải yêu cầu add. Không điền count hoặc tự chọn large.

**Đề xuất theo record, CHƯA DUYỆT:** ask_options cho Pepsi, chưa phải yêu cầu add. Không điền count hoặc tự chọn large.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-D-OPTION-1-2

Batch B07 · queue 38 · P1_original_flagged · split dev · group `dialogue-family-option` · **pending**

**Câu gốc:** Chọn lớn nhưng chưa biết lấy mấy

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
- N2-D-OPTION-1-1: Nước Pepsi có những cỡ gì vậy

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "needs_clarification",
  "missingSlots": [
    "quantity"
  ],
  "reason": "Option known, quantity missing",
  "intents": [
    {
      "id": "i",
      "kind": "add_item",
      "polarity": "affirmed",
      "targetId": "p",
      "quantityId": null
    }
  ],
  "entities": [
    {
      "id": "p",
      "kind": "product",
      "text": "Chọn lớn nhưng chưa biết lấy mấy",
      "productId": "demo-pepsi"
    },
    {
      "id": "o",
      "kind": "option",
      "text": "Chọn lớn nhưng chưa biết lấy mấy",
      "targetId": "p",
      "optionId": "size",
      "valueId": "large"
    }
  ]
}
```

**Rationale nguồn:** Dialogue option, turn 2: annotation describes the accumulated request state, not an executed cart. Prior context is synthetic and proposals never mutate it.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `60517535e5135d3515e71afea06e093eb6004b2be1c48c7904d9943573d05381`.

### Q056 — Current-turn intent vs accumulated state

Nguồn `dialogue_target`: Confirm per-turn intent versus accumulated request state and missing assistant clarification history.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ N2 như snapshot active request/gold hiện tại | Ít thay đổi, vẫn tái lập được evaluator N2. | Phải công bố đang chấm snapshot; nếu dùng các intent lặp lại làm lệnh sẽ hiểu sai thêm món nhiều lần. | Không nhất thiết; chờ policy |
| B — Tách current-turn semantics và requested state | Chọn size=large và chưa có count. Gold đang suy add_item từ hội thoại hỏi cỡ; reviewer cần chọn option-selection/refine versus partial add. Giữ quantity thiếu nếu ngữ cảnh ordering được xác nhận, không đoán. | Chấm hai lớp riêng, giữ evidence turn; cần successor contract/evaluator, không áp vào golden N2. | Có, chưa triển khai |
| C — Chỉ chấm lượt hiện tại và bỏ inherited state | Giảm yêu cầu state khi corpus chưa có assistant turns. | Mất bài kiểm tra giữ preferences/options/reference nhiều lượt; không đáp ứng mục tiêu state nếu không bổ sung tập khác. | Không nhất thiết; chờ policy |

**Codex đề xuất B — CHƯA DUYỆT:** Chọn size=large và chưa có count. Gold đang suy add_item từ hội thoại hỏi cỡ; reviewer cần chọn option-selection/refine versus partial add. Giữ quantity thiếu nếu ngữ cảnh ordering được xác nhận, không đoán. Đề xuất D01, chưa duyệt; giữ bản N2 làm baseline cho tới khi người phụ trách chốt task.

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Current-turn intent vs accumulated state: Chọn size=large và chưa có count. Gold đang suy add_item từ hội thoại hỏi cỡ; reviewer cần chọn option-selection/refine versus partial add. Giữ quantity thiếu nếu ngữ cảnh ordering được xác nhận, không đoán.
- Clarification policy: missingSlots hiện tại [quantity]: phân biệt toàn bộ slot thiếu với slot sẽ hỏi tiếp, không tự điền từ cart.

**Đề xuất theo record, CHƯA DUYỆT:** Chọn size=large và chưa có count. Gold đang suy add_item từ hội thoại hỏi cỡ; reviewer cần chọn option-selection/refine versus partial add. Giữ quantity thiếu nếu ngữ cảnh ordering được xác nhận, không đoán.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-D-OPTION-1-3

Batch B07 · queue 39 · P1_original_flagged · split dev · group `dialogue-family-option` · **pending**

**Câu gốc:** Chốt số lượng yêu cầu là hai cỡ lớn

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
- N2-D-OPTION-1-1: Nước Pepsi có những cỡ gì vậy
- N2-D-OPTION-1-2: Chọn lớn nhưng chưa biết lấy mấy

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "add_item",
      "polarity": "affirmed",
      "targetId": "p",
      "quantityId": "q"
    }
  ],
  "entities": [
    {
      "id": "p",
      "kind": "product",
      "text": "Chốt số lượng yêu cầu là hai cỡ lớn",
      "productId": "demo-pepsi"
    },
    {
      "id": "q",
      "kind": "quantity",
      "text": "Chốt số lượng yêu cầu là hai cỡ lớn",
      "mode": "delta",
      "value": 2
    },
    {
      "id": "o",
      "kind": "option",
      "text": "Chốt số lượng yêu cầu là hai cỡ lớn",
      "targetId": "p",
      "optionId": "size",
      "valueId": "large"
    }
  ]
}
```

**Rationale nguồn:** Dialogue option, turn 3: annotation describes the accumulated request state, not an executed cart. Prior context is synthetic and proposals never mutate it.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `c15c87f0fc0a825f95cfa92cb0f9a19186d0f55363cbfc2127263f608709cb0c`.

### Q057 — Current-turn intent vs accumulated state

Nguồn `dialogue_target`: Confirm per-turn intent versus accumulated request state and missing assistant clarification history.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ N2 như snapshot active request/gold hiện tại | Ít thay đổi, vẫn tái lập được evaluator N2. | Phải công bố đang chấm snapshot; nếu dùng các intent lặp lại làm lệnh sẽ hiểu sai thêm món nhiều lần. | Không nhất thiết; chờ policy |
| B — Tách current-turn semantics và requested state | Cung cấp count=2 và size large cho Pepsi. Hoàn thiện pending request; không coi từ chốt là quyền xác nhận đơn. Không thực hiện add lặp từ turn trước. | Chấm hai lớp riêng, giữ evidence turn; cần successor contract/evaluator, không áp vào golden N2. | Có, chưa triển khai |
| C — Chỉ chấm lượt hiện tại và bỏ inherited state | Giảm yêu cầu state khi corpus chưa có assistant turns. | Mất bài kiểm tra giữ preferences/options/reference nhiều lượt; không đáp ứng mục tiêu state nếu không bổ sung tập khác. | Không nhất thiết; chờ policy |

**Codex đề xuất B — CHƯA DUYỆT:** Cung cấp count=2 và size large cho Pepsi. Hoàn thiện pending request; không coi từ chốt là quyền xác nhận đơn. Không thực hiện add lặp từ turn trước. Đề xuất D01, chưa duyệt; giữ bản N2 làm baseline cho tới khi người phụ trách chốt task.

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Quantity delta/absolute: Kiểm tra delta=2 đúng mục tiêu cart/pending_request; không tự tính final quantity hoặc lấy dung tích làm count.
- Current-turn intent vs accumulated state: Cung cấp count=2 và size large cho Pepsi. Hoàn thiện pending request; không coi từ chốt là quyền xác nhận đơn. Không thực hiện add lặp từ turn trước.

**Đề xuất theo record, CHƯA DUYỆT:** Cung cấp count=2 và size large cho Pepsi. Hoàn thiện pending request; không coi từ chốt là quyền xác nhận đơn. Không thực hiện add lặp từ turn trước.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-D-OPTION-2-1

Batch B07 · queue 40 · P1_original_flagged · split dev · group `dialogue-family-option` · **pending**

**Câu gốc:** Mình muốn hỏi các cỡ Pepsi

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "ask_options",
      "polarity": "affirmed",
      "targetIds": [
        "p"
      ]
    }
  ],
  "entities": [
    {
      "id": "p",
      "kind": "product",
      "text": "Mình muốn hỏi các cỡ Pepsi",
      "productId": "demo-pepsi"
    }
  ]
}
```

**Rationale nguồn:** Dialogue option, turn 1: annotation describes the accumulated request state, not an executed cart. Prior context is synthetic and proposals never mutate it.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `ec656f1dfe5e73ac12f06ec867f3efe57e5cd792bce25b99c186fe28f3db5941`.

### Q058 — Current-turn intent vs accumulated state

Nguồn `dialogue_target`: Confirm per-turn intent versus accumulated request state and missing assistant clarification history.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ N2 như snapshot active request/gold hiện tại | Ít thay đổi, vẫn tái lập được evaluator N2. | Phải công bố đang chấm snapshot; nếu dùng các intent lặp lại làm lệnh sẽ hiểu sai thêm món nhiều lần. | Không nhất thiết; chờ policy |
| B — Tách current-turn semantics và requested state | ask_options cho Pepsi, chưa phải yêu cầu add. Không điền count hoặc tự chọn large. | Chấm hai lớp riêng, giữ evidence turn; cần successor contract/evaluator, không áp vào golden N2. | Có, chưa triển khai |
| C — Chỉ chấm lượt hiện tại và bỏ inherited state | Giảm yêu cầu state khi corpus chưa có assistant turns. | Mất bài kiểm tra giữ preferences/options/reference nhiều lượt; không đáp ứng mục tiêu state nếu không bổ sung tập khác. | Không nhất thiết; chờ policy |

**Codex đề xuất B — CHƯA DUYỆT:** ask_options cho Pepsi, chưa phải yêu cầu add. Không điền count hoặc tự chọn large. Đề xuất D01, chưa duyệt; giữ bản N2 làm baseline cho tới khi người phụ trách chốt task.

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Current-turn intent vs accumulated state: ask_options cho Pepsi, chưa phải yêu cầu add. Không điền count hoặc tự chọn large.

**Đề xuất theo record, CHƯA DUYỆT:** ask_options cho Pepsi, chưa phải yêu cầu add. Không điền count hoặc tự chọn large.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-D-OPTION-2-2

Batch B07 · queue 41 · P1_original_flagged · split dev · group `dialogue-family-option` · **pending**

**Câu gốc:** Cỡ large nhé, để mình nghĩ số chai

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
- N2-D-OPTION-2-1: Mình muốn hỏi các cỡ Pepsi

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "needs_clarification",
  "missingSlots": [
    "quantity"
  ],
  "reason": "Option known, quantity missing",
  "intents": [
    {
      "id": "i",
      "kind": "add_item",
      "polarity": "affirmed",
      "targetId": "p",
      "quantityId": null
    }
  ],
  "entities": [
    {
      "id": "p",
      "kind": "product",
      "text": "Cỡ large nhé, để mình nghĩ số chai",
      "productId": "demo-pepsi"
    },
    {
      "id": "o",
      "kind": "option",
      "text": "Cỡ large nhé, để mình nghĩ số chai",
      "targetId": "p",
      "optionId": "size",
      "valueId": "large"
    }
  ]
}
```

**Rationale nguồn:** Dialogue option, turn 2: annotation describes the accumulated request state, not an executed cart. Prior context is synthetic and proposals never mutate it.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `e6c8dbaf3dd802c299f8015278d9b88db961bb8090d6b89e34ce939dd8e45fd5`.

### Q059 — Current-turn intent vs accumulated state

Nguồn `dialogue_target`: Confirm per-turn intent versus accumulated request state and missing assistant clarification history.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ N2 như snapshot active request/gold hiện tại | Ít thay đổi, vẫn tái lập được evaluator N2. | Phải công bố đang chấm snapshot; nếu dùng các intent lặp lại làm lệnh sẽ hiểu sai thêm món nhiều lần. | Không nhất thiết; chờ policy |
| B — Tách current-turn semantics và requested state | Chọn size=large và chưa có count. Gold đang suy add_item từ hội thoại hỏi cỡ; reviewer cần chọn option-selection/refine versus partial add. Giữ quantity thiếu nếu ngữ cảnh ordering được xác nhận, không đoán. | Chấm hai lớp riêng, giữ evidence turn; cần successor contract/evaluator, không áp vào golden N2. | Có, chưa triển khai |
| C — Chỉ chấm lượt hiện tại và bỏ inherited state | Giảm yêu cầu state khi corpus chưa có assistant turns. | Mất bài kiểm tra giữ preferences/options/reference nhiều lượt; không đáp ứng mục tiêu state nếu không bổ sung tập khác. | Không nhất thiết; chờ policy |

**Codex đề xuất B — CHƯA DUYỆT:** Chọn size=large và chưa có count. Gold đang suy add_item từ hội thoại hỏi cỡ; reviewer cần chọn option-selection/refine versus partial add. Giữ quantity thiếu nếu ngữ cảnh ordering được xác nhận, không đoán. Đề xuất D01, chưa duyệt; giữ bản N2 làm baseline cho tới khi người phụ trách chốt task.

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Current-turn intent vs accumulated state: Chọn size=large và chưa có count. Gold đang suy add_item từ hội thoại hỏi cỡ; reviewer cần chọn option-selection/refine versus partial add. Giữ quantity thiếu nếu ngữ cảnh ordering được xác nhận, không đoán.
- Clarification policy: missingSlots hiện tại [quantity]: phân biệt toàn bộ slot thiếu với slot sẽ hỏi tiếp, không tự điền từ cart.

**Đề xuất theo record, CHƯA DUYỆT:** Chọn size=large và chưa có count. Gold đang suy add_item từ hội thoại hỏi cỡ; reviewer cần chọn option-selection/refine versus partial add. Giữ quantity thiếu nếu ngữ cảnh ordering được xác nhận, không đoán.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-D-OPTION-2-3

Batch B07 · queue 42 · P1_original_flagged · split dev · group `dialogue-family-option` · **pending**

**Câu gốc:** Mình chọn 2 phần Pepsi large

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
- N2-D-OPTION-2-1: Mình muốn hỏi các cỡ Pepsi
- N2-D-OPTION-2-2: Cỡ large nhé, để mình nghĩ số chai

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "add_item",
      "polarity": "affirmed",
      "targetId": "p",
      "quantityId": "q"
    }
  ],
  "entities": [
    {
      "id": "p",
      "kind": "product",
      "text": "Mình chọn 2 phần Pepsi large",
      "productId": "demo-pepsi"
    },
    {
      "id": "q",
      "kind": "quantity",
      "text": "Mình chọn 2 phần Pepsi large",
      "mode": "delta",
      "value": 2
    },
    {
      "id": "o",
      "kind": "option",
      "text": "Mình chọn 2 phần Pepsi large",
      "targetId": "p",
      "optionId": "size",
      "valueId": "large"
    }
  ]
}
```

**Rationale nguồn:** Dialogue option, turn 3: annotation describes the accumulated request state, not an executed cart. Prior context is synthetic and proposals never mutate it.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `7d799a8ca64971b02eff7522a227a9a4a2beaba3b11830ad8aded43761bec13f`.

### Q060 — Current-turn intent vs accumulated state

Nguồn `dialogue_target`: Confirm per-turn intent versus accumulated request state and missing assistant clarification history.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ N2 như snapshot active request/gold hiện tại | Ít thay đổi, vẫn tái lập được evaluator N2. | Phải công bố đang chấm snapshot; nếu dùng các intent lặp lại làm lệnh sẽ hiểu sai thêm món nhiều lần. | Không nhất thiết; chờ policy |
| B — Tách current-turn semantics và requested state | Cung cấp count=2 và size large cho Pepsi. Hoàn thiện pending request; không coi từ chốt là quyền xác nhận đơn. Không thực hiện add lặp từ turn trước. | Chấm hai lớp riêng, giữ evidence turn; cần successor contract/evaluator, không áp vào golden N2. | Có, chưa triển khai |
| C — Chỉ chấm lượt hiện tại và bỏ inherited state | Giảm yêu cầu state khi corpus chưa có assistant turns. | Mất bài kiểm tra giữ preferences/options/reference nhiều lượt; không đáp ứng mục tiêu state nếu không bổ sung tập khác. | Không nhất thiết; chờ policy |

**Codex đề xuất B — CHƯA DUYỆT:** Cung cấp count=2 và size large cho Pepsi. Hoàn thiện pending request; không coi từ chốt là quyền xác nhận đơn. Không thực hiện add lặp từ turn trước. Đề xuất D01, chưa duyệt; giữ bản N2 làm baseline cho tới khi người phụ trách chốt task.

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Quantity delta/absolute: Kiểm tra delta=2 đúng mục tiêu cart/pending_request; không tự tính final quantity hoặc lấy dung tích làm count.
- Current-turn intent vs accumulated state: Cung cấp count=2 và size large cho Pepsi. Hoàn thiện pending request; không coi từ chốt là quyền xác nhận đơn. Không thực hiện add lặp từ turn trước.

**Đề xuất theo record, CHƯA DUYỆT:** Cung cấp count=2 và size large cho Pepsi. Hoàn thiện pending request; không coi từ chốt là quyền xác nhận đơn. Không thực hiện add lặp từ turn trước.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-D-VOLUME-1-1

Batch B08 · queue 43 · P1_original_flagged · split train · group `dialogue-family-volume` · **pending**

**Câu gốc:** Lấy cho mình Pepsi chai 1,5 lít

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "needs_clarification",
  "missingSlots": [
    "quantity"
  ],
  "reason": "Volume is not count",
  "intents": [
    {
      "id": "i",
      "kind": "add_item",
      "polarity": "affirmed",
      "targetId": "p",
      "quantityId": null
    }
  ],
  "entities": [
    {
      "id": "p",
      "kind": "product",
      "text": "Lấy cho mình Pepsi chai 1,5 lít",
      "productId": "demo-pepsi"
    },
    {
      "id": "v",
      "kind": "volume",
      "text": "Lấy cho mình Pepsi chai 1,5 lít",
      "value": 1500,
      "unit": "ml",
      "targetId": "p"
    }
  ]
}
```

**Rationale nguồn:** Dialogue volume, turn 1: annotation describes the accumulated request state, not an executed cart. Prior context is synthetic and proposals never mutate it.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `b3869773605ec953fef652a475de2f94e8364abcc83d54ffad6b88e5b4b4e46b`.

### Q043 — Current-turn intent vs accumulated state

Nguồn `dialogue_target`: Confirm per-turn intent versus accumulated request state and missing assistant clarification history.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ N2 như snapshot active request/gold hiện tại | Ít thay đổi, vẫn tái lập được evaluator N2. | Phải công bố đang chấm snapshot; nếu dùng các intent lặp lại làm lệnh sẽ hiểu sai thêm món nhiều lần. | Không nhất thiết; chờ policy |
| B — Tách current-turn semantics và requested state | Pepsi 1500ml là dung tích mong muốn, chưa có count. Giữ quantity null/needs_clarification quantity; không suy rằng menu demo có SKU 1.5L hoặc lấy 1.5 làm số phần. | Chấm hai lớp riêng, giữ evidence turn; cần successor contract/evaluator, không áp vào golden N2. | Có, chưa triển khai |
| C — Chỉ chấm lượt hiện tại và bỏ inherited state | Giảm yêu cầu state khi corpus chưa có assistant turns. | Mất bài kiểm tra giữ preferences/options/reference nhiều lượt; không đáp ứng mục tiêu state nếu không bổ sung tập khác. | Không nhất thiết; chờ policy |

**Codex đề xuất B — CHƯA DUYỆT:** Pepsi 1500ml là dung tích mong muốn, chưa có count. Giữ quantity null/needs_clarification quantity; không suy rằng menu demo có SKU 1.5L hoặc lấy 1.5 làm số phần. Đề xuất D01, chưa duyệt; giữ bản N2 làm baseline cho tới khi người phụ trách chốt task.

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Current-turn intent vs accumulated state: Pepsi 1500ml là dung tích mong muốn, chưa có count. Giữ quantity null/needs_clarification quantity; không suy rằng menu demo có SKU 1.5L hoặc lấy 1.5 làm số phần.
- Clarification policy: missingSlots hiện tại [quantity]: phân biệt toàn bộ slot thiếu với slot sẽ hỏi tiếp, không tự điền từ cart.

**Đề xuất theo record, CHƯA DUYỆT:** Pepsi 1500ml là dung tích mong muốn, chưa có count. Giữ quantity null/needs_clarification quantity; không suy rằng menu demo có SKU 1.5L hoặc lấy 1.5 làm số phần.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-D-VOLUME-1-2

Batch B08 · queue 44 · P1_original_flagged · split train · group `dialogue-family-volume` · **pending**

**Câu gốc:** Hai chai loại vừa nói nhé

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
- N2-D-VOLUME-1-1: Lấy cho mình Pepsi chai 1,5 lít

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "add_item",
      "polarity": "affirmed",
      "targetId": "p",
      "quantityId": "q"
    }
  ],
  "entities": [
    {
      "id": "p",
      "kind": "product",
      "text": "Hai chai loại vừa nói nhé",
      "productId": "demo-pepsi"
    },
    {
      "id": "q",
      "kind": "quantity",
      "text": "Hai chai loại vừa nói nhé",
      "mode": "delta",
      "value": 2
    },
    {
      "id": "v",
      "kind": "volume",
      "text": "Hai chai loại vừa nói nhé",
      "value": 1500,
      "unit": "ml",
      "targetId": "p"
    }
  ]
}
```

**Rationale nguồn:** Dialogue volume, turn 2: annotation describes the accumulated request state, not an executed cart. Prior context is synthetic and proposals never mutate it.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `87b5e4ddf3fa2480c1cd9ece75de8b2f63633c4d653883210de38f65fac1846e`.

### Q044 — Current-turn intent vs accumulated state

Nguồn `dialogue_target`: Confirm per-turn intent versus accumulated request state and missing assistant clarification history.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ N2 như snapshot active request/gold hiện tại | Ít thay đổi, vẫn tái lập được evaluator N2. | Phải công bố đang chấm snapshot; nếu dùng các intent lặp lại làm lệnh sẽ hiểu sai thêm món nhiều lần. | Không nhất thiết; chờ policy |
| B — Tách current-turn semantics và requested state | Bổ sung count=2 cho pending request, giữ volume=1500ml từ history. Không mặc định volume thành variant/option hay tạo thêm order vì lặp add. | Chấm hai lớp riêng, giữ evidence turn; cần successor contract/evaluator, không áp vào golden N2. | Có, chưa triển khai |
| C — Chỉ chấm lượt hiện tại và bỏ inherited state | Giảm yêu cầu state khi corpus chưa có assistant turns. | Mất bài kiểm tra giữ preferences/options/reference nhiều lượt; không đáp ứng mục tiêu state nếu không bổ sung tập khác. | Không nhất thiết; chờ policy |

**Codex đề xuất B — CHƯA DUYỆT:** Bổ sung count=2 cho pending request, giữ volume=1500ml từ history. Không mặc định volume thành variant/option hay tạo thêm order vì lặp add. Đề xuất D01, chưa duyệt; giữ bản N2 làm baseline cho tới khi người phụ trách chốt task.

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Quantity delta/absolute: Kiểm tra delta=2 đúng mục tiêu cart/pending_request; không tự tính final quantity hoặc lấy dung tích làm count.
- Current-turn intent vs accumulated state: Bổ sung count=2 cho pending request, giữ volume=1500ml từ history. Không mặc định volume thành variant/option hay tạo thêm order vì lặp add.

**Đề xuất theo record, CHƯA DUYỆT:** Bổ sung count=2 cho pending request, giữ volume=1500ml từ history. Không mặc định volume thành variant/option hay tạo thêm order vì lặp add.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-D-VOLUME-1-3

Batch B08 · queue 45 · P1_original_flagged · split train · group `dialogue-family-volume` · **pending**

**Câu gốc:** Đổi thành ba chai cùng loại

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
- N2-D-VOLUME-1-1: Lấy cho mình Pepsi chai 1,5 lít
- N2-D-VOLUME-1-2: Hai chai loại vừa nói nhé

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "set_quantity",
      "polarity": "affirmed",
      "targetId": "p",
      "quantityId": "q"
    }
  ],
  "entities": [
    {
      "id": "p",
      "kind": "product",
      "text": "Đổi thành ba chai cùng loại",
      "productId": "demo-pepsi"
    },
    {
      "id": "q",
      "kind": "quantity",
      "text": "Đổi thành ba chai cùng loại",
      "mode": "absolute",
      "value": 3
    },
    {
      "id": "v",
      "kind": "volume",
      "text": "Đổi thành ba chai cùng loại",
      "value": 1500,
      "unit": "ml",
      "targetId": "p"
    }
  ]
}
```

**Rationale nguồn:** Dialogue volume, turn 3: annotation describes the accumulated request state, not an executed cart. Prior context is synthetic and proposals never mutate it.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `52d8773d9bf7c45c2accb2eb1f6f9ee0a75114971251a11c7d84804b6d52a293`.

### Q045 — Current-turn intent vs accumulated state

Nguồn `dialogue_target`: Confirm per-turn intent versus accumulated request state and missing assistant clarification history.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ N2 như snapshot active request/gold hiện tại | Ít thay đổi, vẫn tái lập được evaluator N2. | Phải công bố đang chấm snapshot; nếu dùng các intent lặp lại làm lệnh sẽ hiểu sai thêm món nhiều lần. | Không nhất thiết; chờ policy |
| B — Tách current-turn semantics và requested state | Đổi count đích của pending request thành absolute=3, giữ volume=1500ml. Không thêm 3 vào 2 đã được đề nghị và không khẳng định có SKU hợp lệ. | Chấm hai lớp riêng, giữ evidence turn; cần successor contract/evaluator, không áp vào golden N2. | Có, chưa triển khai |
| C — Chỉ chấm lượt hiện tại và bỏ inherited state | Giảm yêu cầu state khi corpus chưa có assistant turns. | Mất bài kiểm tra giữ preferences/options/reference nhiều lượt; không đáp ứng mục tiêu state nếu không bổ sung tập khác. | Không nhất thiết; chờ policy |

**Codex đề xuất B — CHƯA DUYỆT:** Đổi count đích của pending request thành absolute=3, giữ volume=1500ml. Không thêm 3 vào 2 đã được đề nghị và không khẳng định có SKU hợp lệ. Đề xuất D01, chưa duyệt; giữ bản N2 làm baseline cho tới khi người phụ trách chốt task.

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Quantity delta/absolute: Kiểm tra absolute=3 đúng mục tiêu cart/pending_request; không tự tính final quantity hoặc lấy dung tích làm count.
- Current-turn intent vs accumulated state: Đổi count đích của pending request thành absolute=3, giữ volume=1500ml. Không thêm 3 vào 2 đã được đề nghị và không khẳng định có SKU hợp lệ.

**Đề xuất theo record, CHƯA DUYỆT:** Đổi count đích của pending request thành absolute=3, giữ volume=1500ml. Không thêm 3 vào 2 đã được đề nghị và không khẳng định có SKU hợp lệ.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-D-VOLUME-2-1

Batch B08 · queue 46 · P1_original_flagged · split train · group `dialogue-family-volume` · **pending**

**Câu gốc:** Mình muốn Pepsi chai 1.5L

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "needs_clarification",
  "missingSlots": [
    "quantity"
  ],
  "reason": "Volume is not count",
  "intents": [
    {
      "id": "i",
      "kind": "add_item",
      "polarity": "affirmed",
      "targetId": "p",
      "quantityId": null
    }
  ],
  "entities": [
    {
      "id": "p",
      "kind": "product",
      "text": "Mình muốn Pepsi chai 1.5L",
      "productId": "demo-pepsi"
    },
    {
      "id": "v",
      "kind": "volume",
      "text": "Mình muốn Pepsi chai 1.5L",
      "value": 1500,
      "unit": "ml",
      "targetId": "p"
    }
  ]
}
```

**Rationale nguồn:** Dialogue volume, turn 1: annotation describes the accumulated request state, not an executed cart. Prior context is synthetic and proposals never mutate it.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `2e0936f501a20d5601a697ebb20caa74eab746a30495f060f6b5c8d0228f3aa9`.

### Q046 — Current-turn intent vs accumulated state

Nguồn `dialogue_target`: Confirm per-turn intent versus accumulated request state and missing assistant clarification history.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ N2 như snapshot active request/gold hiện tại | Ít thay đổi, vẫn tái lập được evaluator N2. | Phải công bố đang chấm snapshot; nếu dùng các intent lặp lại làm lệnh sẽ hiểu sai thêm món nhiều lần. | Không nhất thiết; chờ policy |
| B — Tách current-turn semantics và requested state | Pepsi 1500ml là dung tích mong muốn, chưa có count. Giữ quantity null/needs_clarification quantity; không suy rằng menu demo có SKU 1.5L hoặc lấy 1.5 làm số phần. | Chấm hai lớp riêng, giữ evidence turn; cần successor contract/evaluator, không áp vào golden N2. | Có, chưa triển khai |
| C — Chỉ chấm lượt hiện tại và bỏ inherited state | Giảm yêu cầu state khi corpus chưa có assistant turns. | Mất bài kiểm tra giữ preferences/options/reference nhiều lượt; không đáp ứng mục tiêu state nếu không bổ sung tập khác. | Không nhất thiết; chờ policy |

**Codex đề xuất B — CHƯA DUYỆT:** Pepsi 1500ml là dung tích mong muốn, chưa có count. Giữ quantity null/needs_clarification quantity; không suy rằng menu demo có SKU 1.5L hoặc lấy 1.5 làm số phần. Đề xuất D01, chưa duyệt; giữ bản N2 làm baseline cho tới khi người phụ trách chốt task.

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Current-turn intent vs accumulated state: Pepsi 1500ml là dung tích mong muốn, chưa có count. Giữ quantity null/needs_clarification quantity; không suy rằng menu demo có SKU 1.5L hoặc lấy 1.5 làm số phần.
- Clarification policy: missingSlots hiện tại [quantity]: phân biệt toàn bộ slot thiếu với slot sẽ hỏi tiếp, không tự điền từ cart.

**Đề xuất theo record, CHƯA DUYỆT:** Pepsi 1500ml là dung tích mong muốn, chưa có count. Giữ quantity null/needs_clarification quantity; không suy rằng menu demo có SKU 1.5L hoặc lấy 1.5 làm số phần.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-D-VOLUME-2-2

Batch B08 · queue 47 · P1_original_flagged · split train · group `dialogue-family-volume` · **pending**

**Câu gốc:** Cho hai chai Pepsi loại đó

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
- N2-D-VOLUME-2-1: Mình muốn Pepsi chai 1.5L

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "add_item",
      "polarity": "affirmed",
      "targetId": "p",
      "quantityId": "q"
    }
  ],
  "entities": [
    {
      "id": "p",
      "kind": "product",
      "text": "Cho hai chai Pepsi loại đó",
      "productId": "demo-pepsi"
    },
    {
      "id": "q",
      "kind": "quantity",
      "text": "Cho hai chai Pepsi loại đó",
      "mode": "delta",
      "value": 2
    },
    {
      "id": "v",
      "kind": "volume",
      "text": "Cho hai chai Pepsi loại đó",
      "value": 1500,
      "unit": "ml",
      "targetId": "p"
    }
  ]
}
```

**Rationale nguồn:** Dialogue volume, turn 2: annotation describes the accumulated request state, not an executed cart. Prior context is synthetic and proposals never mutate it.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `aa6fa1cf5aa9c27f7d3d2a9d87273e6b26aae4e12f9bd42def1823915044c008`.

### Q047 — Current-turn intent vs accumulated state

Nguồn `dialogue_target`: Confirm per-turn intent versus accumulated request state and missing assistant clarification history.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ N2 như snapshot active request/gold hiện tại | Ít thay đổi, vẫn tái lập được evaluator N2. | Phải công bố đang chấm snapshot; nếu dùng các intent lặp lại làm lệnh sẽ hiểu sai thêm món nhiều lần. | Không nhất thiết; chờ policy |
| B — Tách current-turn semantics và requested state | Bổ sung count=2 cho pending request, giữ volume=1500ml từ history. Không mặc định volume thành variant/option hay tạo thêm order vì lặp add. | Chấm hai lớp riêng, giữ evidence turn; cần successor contract/evaluator, không áp vào golden N2. | Có, chưa triển khai |
| C — Chỉ chấm lượt hiện tại và bỏ inherited state | Giảm yêu cầu state khi corpus chưa có assistant turns. | Mất bài kiểm tra giữ preferences/options/reference nhiều lượt; không đáp ứng mục tiêu state nếu không bổ sung tập khác. | Không nhất thiết; chờ policy |

**Codex đề xuất B — CHƯA DUYỆT:** Bổ sung count=2 cho pending request, giữ volume=1500ml từ history. Không mặc định volume thành variant/option hay tạo thêm order vì lặp add. Đề xuất D01, chưa duyệt; giữ bản N2 làm baseline cho tới khi người phụ trách chốt task.

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Quantity delta/absolute: Kiểm tra delta=2 đúng mục tiêu cart/pending_request; không tự tính final quantity hoặc lấy dung tích làm count.
- Current-turn intent vs accumulated state: Bổ sung count=2 cho pending request, giữ volume=1500ml từ history. Không mặc định volume thành variant/option hay tạo thêm order vì lặp add.

**Đề xuất theo record, CHƯA DUYỆT:** Bổ sung count=2 cho pending request, giữ volume=1500ml từ history. Không mặc định volume thành variant/option hay tạo thêm order vì lặp add.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-D-VOLUME-2-3

Batch B08 · queue 48 · P1_original_flagged · split train · group `dialogue-family-volume` · **pending**

**Câu gốc:** Số lượng cuối là ba chai đó

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
- N2-D-VOLUME-2-1: Mình muốn Pepsi chai 1.5L
- N2-D-VOLUME-2-2: Cho hai chai Pepsi loại đó

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "set_quantity",
      "polarity": "affirmed",
      "targetId": "p",
      "quantityId": "q"
    }
  ],
  "entities": [
    {
      "id": "p",
      "kind": "product",
      "text": "Số lượng cuối là ba chai đó",
      "productId": "demo-pepsi"
    },
    {
      "id": "q",
      "kind": "quantity",
      "text": "Số lượng cuối là ba chai đó",
      "mode": "absolute",
      "value": 3
    },
    {
      "id": "v",
      "kind": "volume",
      "text": "Số lượng cuối là ba chai đó",
      "value": 1500,
      "unit": "ml",
      "targetId": "p"
    }
  ]
}
```

**Rationale nguồn:** Dialogue volume, turn 3: annotation describes the accumulated request state, not an executed cart. Prior context is synthetic and proposals never mutate it.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `1e9b1bcd4cdc2ef6d5bef501b16696fb4ae699a05b48c9fc978979c20af384f8`.

### Q048 — Current-turn intent vs accumulated state

Nguồn `dialogue_target`: Confirm per-turn intent versus accumulated request state and missing assistant clarification history.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ N2 như snapshot active request/gold hiện tại | Ít thay đổi, vẫn tái lập được evaluator N2. | Phải công bố đang chấm snapshot; nếu dùng các intent lặp lại làm lệnh sẽ hiểu sai thêm món nhiều lần. | Không nhất thiết; chờ policy |
| B — Tách current-turn semantics và requested state | Đổi count đích của pending request thành absolute=3, giữ volume=1500ml. Không thêm 3 vào 2 đã được đề nghị và không khẳng định có SKU hợp lệ. | Chấm hai lớp riêng, giữ evidence turn; cần successor contract/evaluator, không áp vào golden N2. | Có, chưa triển khai |
| C — Chỉ chấm lượt hiện tại và bỏ inherited state | Giảm yêu cầu state khi corpus chưa có assistant turns. | Mất bài kiểm tra giữ preferences/options/reference nhiều lượt; không đáp ứng mục tiêu state nếu không bổ sung tập khác. | Không nhất thiết; chờ policy |

**Codex đề xuất B — CHƯA DUYỆT:** Đổi count đích của pending request thành absolute=3, giữ volume=1500ml. Không thêm 3 vào 2 đã được đề nghị và không khẳng định có SKU hợp lệ. Đề xuất D01, chưa duyệt; giữ bản N2 làm baseline cho tới khi người phụ trách chốt task.

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Quantity delta/absolute: Kiểm tra absolute=3 đúng mục tiêu cart/pending_request; không tự tính final quantity hoặc lấy dung tích làm count.
- Current-turn intent vs accumulated state: Đổi count đích của pending request thành absolute=3, giữ volume=1500ml. Không thêm 3 vào 2 đã được đề nghị và không khẳng định có SKU hợp lệ.

**Đề xuất theo record, CHƯA DUYỆT:** Đổi count đích của pending request thành absolute=3, giữ volume=1500ml. Không thêm 3 vào 2 đã được đề nghị và không khẳng định có SKU hợp lệ.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-D-REMOVE-1-1

Batch B09 · queue 49 · P1_original_flagged · split train · group `dialogue-family-remove` · **pending**

**Câu gốc:** Kiểm tra các món mình đã chọn

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "view_cart",
      "polarity": "affirmed"
    }
  ],
  "entities": []
}
```

**Rationale nguồn:** Dialogue remove, turn 1: annotation describes the accumulated request state, not an executed cart. Prior context is synthetic and proposals never mutate it.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `3f555fe522e4243a7b0f7957f5a5cab49807668193143885292dc23eba22a631`.

### Q021 — Current-turn intent vs accumulated state

Nguồn `dialogue_target`: Confirm per-turn intent versus accumulated request state and missing assistant clarification history.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ N2 như snapshot active request/gold hiện tại | Ít thay đổi, vẫn tái lập được evaluator N2. | Phải công bố đang chấm snapshot; nếu dùng các intent lặp lại làm lệnh sẽ hiểu sai thêm món nhiều lần. | Không nhất thiết; chờ policy |
| B — Tách current-turn semantics và requested state | Chỉ xem giỏ, chưa remove/clear hoặc thay requested state. Không dựng assistant list từ nhãn. | Chấm hai lớp riêng, giữ evidence turn; cần successor contract/evaluator, không áp vào golden N2. | Có, chưa triển khai |
| C — Chỉ chấm lượt hiện tại và bỏ inherited state | Giảm yêu cầu state khi corpus chưa có assistant turns. | Mất bài kiểm tra giữ preferences/options/reference nhiều lượt; không đáp ứng mục tiêu state nếu không bổ sung tập khác. | Không nhất thiết; chờ policy |

**Codex đề xuất B — CHƯA DUYỆT:** Chỉ xem giỏ, chưa remove/clear hoặc thay requested state. Không dựng assistant list từ nhãn. Đề xuất D01, chưa duyệt; giữ bản N2 làm baseline cho tới khi người phụ trách chốt task.

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Current-turn intent vs accumulated state: Chỉ xem giỏ, chưa remove/clear hoặc thay requested state. Không dựng assistant list từ nhãn.

**Đề xuất theo record, CHƯA DUYỆT:** Chỉ xem giỏ, chưa remove/clear hoặc thay requested state. Không dựng assistant list từ nhãn.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-D-REMOVE-1-2

Batch B09 · queue 50 · P1_original_flagged · split train · group `dialogue-family-remove` · **pending**

**Câu gốc:** Dòng Pepsi đó bỏ hết đi

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
- N2-D-REMOVE-1-1: Kiểm tra các món mình đã chọn

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "remove_line",
      "polarity": "affirmed",
      "targetId": "r"
    }
  ],
  "entities": [
    {
      "id": "r",
      "kind": "reference",
      "text": "Dòng Pepsi đó bỏ hết đi",
      "referentId": "last-item"
    }
  ]
}
```

**Rationale nguồn:** Dialogue remove, turn 2: annotation describes the accumulated request state, not an executed cart. Prior context is synthetic and proposals never mutate it.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `d9b9c0b71d8a3cfac38f17f4e0b5e38e670732d3f94c0d93d6ee7ba0dddbfac7`.

### Q022 — Current-turn intent vs accumulated state

Nguồn `dialogue_target`: Confirm per-turn intent versus accumulated request state and missing assistant clarification history.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ N2 như snapshot active request/gold hiện tại | Ít thay đổi, vẫn tái lập được evaluator N2. | Phải công bố đang chấm snapshot; nếu dùng các intent lặp lại làm lệnh sẽ hiểu sai thêm món nhiều lần. | Không nhất thiết; chờ policy |
| B — Tách current-turn semantics và requested state | Bỏ cả dòng được nhắc, không clear giỏ. Biến thể nói rõ Pepsi có bằng chứng trực tiếp; biến thể dòng nước vừa nhắc cần kiểm tra provenance last-item vì lượt trước chỉ hỏi giỏ chung. | Chấm hai lớp riêng, giữ evidence turn; cần successor contract/evaluator, không áp vào golden N2. | Có, chưa triển khai |
| C — Chỉ chấm lượt hiện tại và bỏ inherited state | Giảm yêu cầu state khi corpus chưa có assistant turns. | Mất bài kiểm tra giữ preferences/options/reference nhiều lượt; không đáp ứng mục tiêu state nếu không bổ sung tập khác. | Không nhất thiết; chờ policy |

**Codex đề xuất B — CHƯA DUYỆT:** Bỏ cả dòng được nhắc, không clear giỏ. Biến thể nói rõ Pepsi có bằng chứng trực tiếp; biến thể dòng nước vừa nhắc cần kiểm tra provenance last-item vì lượt trước chỉ hỏi giỏ chung. Đề xuất D01, chưa duyệt; giữ bản N2 làm baseline cho tới khi người phụ trách chốt task.

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Current-turn intent vs accumulated state: Bỏ cả dòng được nhắc, không clear giỏ. Biến thể nói rõ Pepsi có bằng chứng trực tiếp; biến thể dòng nước vừa nhắc cần kiểm tra provenance last-item vì lượt trước chỉ hỏi giỏ chung.

**Đề xuất theo record, CHƯA DUYỆT:** Bỏ cả dòng được nhắc, không clear giỏ. Biến thể nói rõ Pepsi có bằng chứng trực tiếp; biến thể dòng nước vừa nhắc cần kiểm tra provenance last-item vì lượt trước chỉ hỏi giỏ chung.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-D-REMOVE-1-3

Batch B09 · queue 51 · P1_original_flagged · split train · group `dialogue-family-remove` · **pending**

**Câu gốc:** Thôi bỏ đề nghị xóa vừa rồi

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
- N2-D-REMOVE-1-1: Kiểm tra các món mình đã chọn
- N2-D-REMOVE-1-2: Dòng Pepsi đó bỏ hết đi

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "cancel_proposal",
      "polarity": "affirmed"
    }
  ],
  "entities": []
}
```

**Rationale nguồn:** Dialogue remove, turn 3: annotation describes the accumulated request state, not an executed cart. Prior context is synthetic and proposals never mutate it.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `048df03f790bdcb05d12e9f81283024176fd8ab22b3317cd60022a971a196ab1`.

### Q023 — Current-turn intent vs accumulated state

Nguồn `dialogue_target`: Confirm per-turn intent versus accumulated request state and missing assistant clarification history.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ N2 như snapshot active request/gold hiện tại | Ít thay đổi, vẫn tái lập được evaluator N2. | Phải công bố đang chấm snapshot; nếu dùng các intent lặp lại làm lệnh sẽ hiểu sai thêm món nhiều lần. | Không nhất thiết; chờ policy |
| B — Tách current-turn semantics và requested state | Hủy đề nghị remove vừa nêu, không thực hiện remove và không xóa cart. Requested proposal chuyển cancelled; trusted cart vẫn nguyên. | Chấm hai lớp riêng, giữ evidence turn; cần successor contract/evaluator, không áp vào golden N2. | Có, chưa triển khai |
| C — Chỉ chấm lượt hiện tại và bỏ inherited state | Giảm yêu cầu state khi corpus chưa có assistant turns. | Mất bài kiểm tra giữ preferences/options/reference nhiều lượt; không đáp ứng mục tiêu state nếu không bổ sung tập khác. | Không nhất thiết; chờ policy |

**Codex đề xuất B — CHƯA DUYỆT:** Hủy đề nghị remove vừa nêu, không thực hiện remove và không xóa cart. Requested proposal chuyển cancelled; trusted cart vẫn nguyên. Đề xuất D01, chưa duyệt; giữ bản N2 làm baseline cho tới khi người phụ trách chốt task.

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Current-turn intent vs accumulated state: Hủy đề nghị remove vừa nêu, không thực hiện remove và không xóa cart. Requested proposal chuyển cancelled; trusted cart vẫn nguyên.

**Đề xuất theo record, CHƯA DUYỆT:** Hủy đề nghị remove vừa nêu, không thực hiện remove và không xóa cart. Requested proposal chuyển cancelled; trusted cart vẫn nguyên.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-D-REMOVE-2-1

Batch B09 · queue 52 · P1_original_flagged · split train · group `dialogue-family-remove` · **pending**

**Câu gốc:** Mở giỏ để mình kiểm tra món

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "view_cart",
      "polarity": "affirmed"
    }
  ],
  "entities": []
}
```

**Rationale nguồn:** Dialogue remove, turn 1: annotation describes the accumulated request state, not an executed cart. Prior context is synthetic and proposals never mutate it.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `f20a53436f6a7a1b8ee287ed2c574844a42e3a2e7a7d0e044c9cb72ca2988089`.

### Q024 — Current-turn intent vs accumulated state

Nguồn `dialogue_target`: Confirm per-turn intent versus accumulated request state and missing assistant clarification history.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ N2 như snapshot active request/gold hiện tại | Ít thay đổi, vẫn tái lập được evaluator N2. | Phải công bố đang chấm snapshot; nếu dùng các intent lặp lại làm lệnh sẽ hiểu sai thêm món nhiều lần. | Không nhất thiết; chờ policy |
| B — Tách current-turn semantics và requested state | Chỉ xem giỏ, chưa remove/clear hoặc thay requested state. Không dựng assistant list từ nhãn. | Chấm hai lớp riêng, giữ evidence turn; cần successor contract/evaluator, không áp vào golden N2. | Có, chưa triển khai |
| C — Chỉ chấm lượt hiện tại và bỏ inherited state | Giảm yêu cầu state khi corpus chưa có assistant turns. | Mất bài kiểm tra giữ preferences/options/reference nhiều lượt; không đáp ứng mục tiêu state nếu không bổ sung tập khác. | Không nhất thiết; chờ policy |

**Codex đề xuất B — CHƯA DUYỆT:** Chỉ xem giỏ, chưa remove/clear hoặc thay requested state. Không dựng assistant list từ nhãn. Đề xuất D01, chưa duyệt; giữ bản N2 làm baseline cho tới khi người phụ trách chốt task.

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Current-turn intent vs accumulated state: Chỉ xem giỏ, chưa remove/clear hoặc thay requested state. Không dựng assistant list từ nhãn.

**Đề xuất theo record, CHƯA DUYỆT:** Chỉ xem giỏ, chưa remove/clear hoặc thay requested state. Không dựng assistant list từ nhãn.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-D-REMOVE-2-2

Batch B09 · queue 53 · P1_original_flagged · split train · group `dialogue-family-remove` · **pending**

**Câu gốc:** Xóa nguyên dòng nước vừa nhắc

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
- N2-D-REMOVE-2-1: Mở giỏ để mình kiểm tra món

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "remove_line",
      "polarity": "affirmed",
      "targetId": "r"
    }
  ],
  "entities": [
    {
      "id": "r",
      "kind": "reference",
      "text": "Xóa nguyên dòng nước vừa nhắc",
      "referentId": "last-item"
    }
  ]
}
```

**Rationale nguồn:** Dialogue remove, turn 2: annotation describes the accumulated request state, not an executed cart. Prior context is synthetic and proposals never mutate it.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `13dc6797c447ffaca8e25dfe50e94e7269e4017694d43eddf4812997a210a625`.

### Q025 — Current-turn intent vs accumulated state

Nguồn `dialogue_target`: Confirm per-turn intent versus accumulated request state and missing assistant clarification history.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ N2 như snapshot active request/gold hiện tại | Ít thay đổi, vẫn tái lập được evaluator N2. | Phải công bố đang chấm snapshot; nếu dùng các intent lặp lại làm lệnh sẽ hiểu sai thêm món nhiều lần. | Không nhất thiết; chờ policy |
| B — Tách current-turn semantics và requested state | Bỏ cả dòng được nhắc, không clear giỏ. Biến thể nói rõ Pepsi có bằng chứng trực tiếp; biến thể dòng nước vừa nhắc cần kiểm tra provenance last-item vì lượt trước chỉ hỏi giỏ chung. | Chấm hai lớp riêng, giữ evidence turn; cần successor contract/evaluator, không áp vào golden N2. | Có, chưa triển khai |
| C — Chỉ chấm lượt hiện tại và bỏ inherited state | Giảm yêu cầu state khi corpus chưa có assistant turns. | Mất bài kiểm tra giữ preferences/options/reference nhiều lượt; không đáp ứng mục tiêu state nếu không bổ sung tập khác. | Không nhất thiết; chờ policy |

**Codex đề xuất B — CHƯA DUYỆT:** Bỏ cả dòng được nhắc, không clear giỏ. Biến thể nói rõ Pepsi có bằng chứng trực tiếp; biến thể dòng nước vừa nhắc cần kiểm tra provenance last-item vì lượt trước chỉ hỏi giỏ chung. Đề xuất D01, chưa duyệt; giữ bản N2 làm baseline cho tới khi người phụ trách chốt task.

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Current-turn intent vs accumulated state: Bỏ cả dòng được nhắc, không clear giỏ. Biến thể nói rõ Pepsi có bằng chứng trực tiếp; biến thể dòng nước vừa nhắc cần kiểm tra provenance last-item vì lượt trước chỉ hỏi giỏ chung.

**Đề xuất theo record, CHƯA DUYỆT:** Bỏ cả dòng được nhắc, không clear giỏ. Biến thể nói rõ Pepsi có bằng chứng trực tiếp; biến thể dòng nước vừa nhắc cần kiểm tra provenance last-item vì lượt trước chỉ hỏi giỏ chung.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-D-REMOVE-2-3

Batch B09 · queue 54 · P1_original_flagged · split train · group `dialogue-family-remove` · **pending**

**Câu gốc:** Không tiếp tục đề xuất bỏ món đó

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
- N2-D-REMOVE-2-1: Mở giỏ để mình kiểm tra món
- N2-D-REMOVE-2-2: Xóa nguyên dòng nước vừa nhắc

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "cancel_proposal",
      "polarity": "affirmed"
    }
  ],
  "entities": []
}
```

**Rationale nguồn:** Dialogue remove, turn 3: annotation describes the accumulated request state, not an executed cart. Prior context is synthetic and proposals never mutate it.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `2b3b9e26b855f3b2a3f7169fedfb469b6f5c2b1923ebf2861646b58794c43ff8`.

### Q026 — Current-turn intent vs accumulated state

Nguồn `dialogue_target`: Confirm per-turn intent versus accumulated request state and missing assistant clarification history.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ N2 như snapshot active request/gold hiện tại | Ít thay đổi, vẫn tái lập được evaluator N2. | Phải công bố đang chấm snapshot; nếu dùng các intent lặp lại làm lệnh sẽ hiểu sai thêm món nhiều lần. | Không nhất thiết; chờ policy |
| B — Tách current-turn semantics và requested state | Hủy đề nghị remove vừa nêu, không thực hiện remove và không xóa cart. Requested proposal chuyển cancelled; trusted cart vẫn nguyên. | Chấm hai lớp riêng, giữ evidence turn; cần successor contract/evaluator, không áp vào golden N2. | Có, chưa triển khai |
| C — Chỉ chấm lượt hiện tại và bỏ inherited state | Giảm yêu cầu state khi corpus chưa có assistant turns. | Mất bài kiểm tra giữ preferences/options/reference nhiều lượt; không đáp ứng mục tiêu state nếu không bổ sung tập khác. | Không nhất thiết; chờ policy |

**Codex đề xuất B — CHƯA DUYỆT:** Hủy đề nghị remove vừa nêu, không thực hiện remove và không xóa cart. Requested proposal chuyển cancelled; trusted cart vẫn nguyên. Đề xuất D01, chưa duyệt; giữ bản N2 làm baseline cho tới khi người phụ trách chốt task.

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Current-turn intent vs accumulated state: Hủy đề nghị remove vừa nêu, không thực hiện remove và không xóa cart. Requested proposal chuyển cancelled; trusted cart vẫn nguyên.

**Đề xuất theo record, CHƯA DUYỆT:** Hủy đề nghị remove vừa nêu, không thực hiện remove và không xóa cart. Requested proposal chuyển cancelled; trusted cart vẫn nguyên.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-D-ASSENT-1-1

Batch B10 · queue 55 · P1_original_flagged · split train · group `dialogue-family-assent` · **pending**

**Câu gốc:** Cho một phần Pepsi thôi nhé

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "add_item",
      "polarity": "affirmed",
      "targetId": "p",
      "quantityId": "q"
    }
  ],
  "entities": [
    {
      "id": "p",
      "kind": "product",
      "text": "Cho một phần Pepsi thôi nhé",
      "productId": "demo-pepsi"
    },
    {
      "id": "q",
      "kind": "quantity",
      "text": "Cho một phần Pepsi thôi nhé",
      "mode": "delta",
      "value": 1
    }
  ]
}
```

**Rationale nguồn:** Dialogue assent, turn 1: annotation describes the accumulated request state, not an executed cart. Prior context is synthetic and proposals never mutate it.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `400b6797fbe6cb4e4de222b274558173cebced34d437c4e9aa234a428850d6cc`.

### Q049 — Current-turn intent vs accumulated state

Nguồn `dialogue_target`: Confirm per-turn intent versus accumulated request state and missing assistant clarification history.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ N2 như snapshot active request/gold hiện tại | Ít thay đổi, vẫn tái lập được evaluator N2. | Phải công bố đang chấm snapshot; nếu dùng các intent lặp lại làm lệnh sẽ hiểu sai thêm món nhiều lần. | Không nhất thiết; chờ policy |
| B — Tách current-turn semantics và requested state | Đề nghị Pepsi ×1, giữ pending; cart vẫn Pepsi ×3. Chưa có confirmation event. | Chấm hai lớp riêng, giữ evidence turn; cần successor contract/evaluator, không áp vào golden N2. | Có, chưa triển khai |
| C — Chỉ chấm lượt hiện tại và bỏ inherited state | Giảm yêu cầu state khi corpus chưa có assistant turns. | Mất bài kiểm tra giữ preferences/options/reference nhiều lượt; không đáp ứng mục tiêu state nếu không bổ sung tập khác. | Không nhất thiết; chờ policy |

**Codex đề xuất B — CHƯA DUYỆT:** Đề nghị Pepsi ×1, giữ pending; cart vẫn Pepsi ×3. Chưa có confirmation event. Đề xuất D01, chưa duyệt; giữ bản N2 làm baseline cho tới khi người phụ trách chốt task.

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Quantity delta/absolute: Kiểm tra delta=1 đúng mục tiêu cart/pending_request; không tự tính final quantity hoặc lấy dung tích làm count.
- Current-turn intent vs accumulated state: Đề nghị Pepsi ×1, giữ pending; cart vẫn Pepsi ×3. Chưa có confirmation event.

**Đề xuất theo record, CHƯA DUYỆT:** Đề nghị Pepsi ×1, giữ pending; cart vẫn Pepsi ×3. Chưa có confirmation event.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-D-ASSENT-1-2

Batch B10 · queue 56 · P1_original_flagged · split train · group `dialogue-family-assent` · **pending**

**Câu gốc:** okay mình xem đề xuất rồi

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
- N2-D-ASSENT-1-1: Cho một phần Pepsi thôi nhé

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "express_assent",
      "polarity": "affirmed"
    }
  ],
  "entities": []
}
```

**Rationale nguồn:** Dialogue assent, turn 2: annotation describes the accumulated request state, not an executed cart. Prior context is synthetic and proposals never mutate it.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `fe102b752ccbd7b78ce9c171a0085d88ac4d13afb39dea3873261f94bb5070ae`.

### Q050 — Current-turn intent vs accumulated state

Nguồn `dialogue_target`: Confirm per-turn intent versus accumulated request state and missing assistant clarification history.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ N2 như snapshot active request/gold hiện tại | Ít thay đổi, vẫn tái lập được evaluator N2. | Phải công bố đang chấm snapshot; nếu dùng các intent lặp lại làm lệnh sẽ hiểu sai thêm món nhiều lần. | Không nhất thiết; chờ policy |
| B — Tách current-turn semantics và requested state | express_assent là dialogue act, không cấp quyền thực thi hoặc human approval. Requested state không bị mất chỉ vì entities của lượt đồng ý rỗng. | Chấm hai lớp riêng, giữ evidence turn; cần successor contract/evaluator, không áp vào golden N2. | Có, chưa triển khai |
| C — Chỉ chấm lượt hiện tại và bỏ inherited state | Giảm yêu cầu state khi corpus chưa có assistant turns. | Mất bài kiểm tra giữ preferences/options/reference nhiều lượt; không đáp ứng mục tiêu state nếu không bổ sung tập khác. | Không nhất thiết; chờ policy |

**Codex đề xuất B — CHƯA DUYỆT:** express_assent là dialogue act, không cấp quyền thực thi hoặc human approval. Requested state không bị mất chỉ vì entities của lượt đồng ý rỗng. Đề xuất D01, chưa duyệt; giữ bản N2 làm baseline cho tới khi người phụ trách chốt task.

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Current-turn intent vs accumulated state: express_assent là dialogue act, không cấp quyền thực thi hoặc human approval. Requested state không bị mất chỉ vì entities của lượt đồng ý rỗng.

**Đề xuất theo record, CHƯA DUYỆT:** express_assent là dialogue act, không cấp quyền thực thi hoặc human approval. Requested state không bị mất chỉ vì entities của lượt đồng ý rỗng.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-D-ASSENT-1-3

Batch B10 · queue 57 · P1_original_flagged · split train · group `dialogue-family-assent` · **pending**

**Câu gốc:** Cho xem giỏ hiện tại lần nữa

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
- N2-D-ASSENT-1-1: Cho một phần Pepsi thôi nhé
- N2-D-ASSENT-1-2: okay mình xem đề xuất rồi

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "view_cart",
      "polarity": "affirmed"
    }
  ],
  "entities": []
}
```

**Rationale nguồn:** Dialogue assent, turn 3: annotation describes the accumulated request state, not an executed cart. Prior context is synthetic and proposals never mutate it.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `aeb6b324d622421ba02ce3755b75bb8866014b2baf6905e508cee3645f0341a9`.

### Q051 — Current-turn intent vs accumulated state

Nguồn `dialogue_target`: Confirm per-turn intent versus accumulated request state and missing assistant clarification history.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ N2 như snapshot active request/gold hiện tại | Ít thay đổi, vẫn tái lập được evaluator N2. | Phải công bố đang chấm snapshot; nếu dùng các intent lặp lại làm lệnh sẽ hiểu sai thêm món nhiều lần. | Không nhất thiết; chờ policy |
| B — Tách current-turn semantics và requested state | view_cart đọc trusted cart; không suy ra đã add 1 sau lời đồng ý. Nếu chấm state, pending request và cart hiện tại phải tách riêng. | Chấm hai lớp riêng, giữ evidence turn; cần successor contract/evaluator, không áp vào golden N2. | Có, chưa triển khai |
| C — Chỉ chấm lượt hiện tại và bỏ inherited state | Giảm yêu cầu state khi corpus chưa có assistant turns. | Mất bài kiểm tra giữ preferences/options/reference nhiều lượt; không đáp ứng mục tiêu state nếu không bổ sung tập khác. | Không nhất thiết; chờ policy |

**Codex đề xuất B — CHƯA DUYỆT:** view_cart đọc trusted cart; không suy ra đã add 1 sau lời đồng ý. Nếu chấm state, pending request và cart hiện tại phải tách riêng. Đề xuất D01, chưa duyệt; giữ bản N2 làm baseline cho tới khi người phụ trách chốt task.

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Current-turn intent vs accumulated state: view_cart đọc trusted cart; không suy ra đã add 1 sau lời đồng ý. Nếu chấm state, pending request và cart hiện tại phải tách riêng.

**Đề xuất theo record, CHƯA DUYỆT:** view_cart đọc trusted cart; không suy ra đã add 1 sau lời đồng ý. Nếu chấm state, pending request và cart hiện tại phải tách riêng.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-D-ASSENT-2-1

Batch B10 · queue 58 · P1_original_flagged · split train · group `dialogue-family-assent` · **pending**

**Câu gốc:** Lấy đúng một Pepsi giúp tôi

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "add_item",
      "polarity": "affirmed",
      "targetId": "p",
      "quantityId": "q"
    }
  ],
  "entities": [
    {
      "id": "p",
      "kind": "product",
      "text": "Lấy đúng một Pepsi giúp tôi",
      "productId": "demo-pepsi"
    },
    {
      "id": "q",
      "kind": "quantity",
      "text": "Lấy đúng một Pepsi giúp tôi",
      "mode": "delta",
      "value": 1
    }
  ]
}
```

**Rationale nguồn:** Dialogue assent, turn 1: annotation describes the accumulated request state, not an executed cart. Prior context is synthetic and proposals never mutate it.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `1e7f654c3a9c32ec13e32bd44bd37a10b10ade6f2f02df22edfeb516a8653631`.

### Q052 — Current-turn intent vs accumulated state

Nguồn `dialogue_target`: Confirm per-turn intent versus accumulated request state and missing assistant clarification history.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ N2 như snapshot active request/gold hiện tại | Ít thay đổi, vẫn tái lập được evaluator N2. | Phải công bố đang chấm snapshot; nếu dùng các intent lặp lại làm lệnh sẽ hiểu sai thêm món nhiều lần. | Không nhất thiết; chờ policy |
| B — Tách current-turn semantics và requested state | Đề nghị Pepsi ×1, giữ pending; cart vẫn Pepsi ×3. Chưa có confirmation event. | Chấm hai lớp riêng, giữ evidence turn; cần successor contract/evaluator, không áp vào golden N2. | Có, chưa triển khai |
| C — Chỉ chấm lượt hiện tại và bỏ inherited state | Giảm yêu cầu state khi corpus chưa có assistant turns. | Mất bài kiểm tra giữ preferences/options/reference nhiều lượt; không đáp ứng mục tiêu state nếu không bổ sung tập khác. | Không nhất thiết; chờ policy |

**Codex đề xuất B — CHƯA DUYỆT:** Đề nghị Pepsi ×1, giữ pending; cart vẫn Pepsi ×3. Chưa có confirmation event. Đề xuất D01, chưa duyệt; giữ bản N2 làm baseline cho tới khi người phụ trách chốt task.

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Quantity delta/absolute: Kiểm tra delta=1 đúng mục tiêu cart/pending_request; không tự tính final quantity hoặc lấy dung tích làm count.
- Current-turn intent vs accumulated state: Đề nghị Pepsi ×1, giữ pending; cart vẫn Pepsi ×3. Chưa có confirmation event.

**Đề xuất theo record, CHƯA DUYỆT:** Đề nghị Pepsi ×1, giữ pending; cart vẫn Pepsi ×3. Chưa có confirmation event.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-D-ASSENT-2-2

Batch B10 · queue 59 · P1_original_flagged · split train · group `dialogue-family-assent` · **pending**

**Câu gốc:** ừ được, mình thấy đề xuất rồi

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
- N2-D-ASSENT-2-1: Lấy đúng một Pepsi giúp tôi

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "express_assent",
      "polarity": "affirmed"
    }
  ],
  "entities": []
}
```

**Rationale nguồn:** Dialogue assent, turn 2: annotation describes the accumulated request state, not an executed cart. Prior context is synthetic and proposals never mutate it.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `18bc2319d82fedcd9fc16c475cd9b4be0bbb758838cefb0abf495758d70755ef`.

### Q053 — Current-turn intent vs accumulated state

Nguồn `dialogue_target`: Confirm per-turn intent versus accumulated request state and missing assistant clarification history.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ N2 như snapshot active request/gold hiện tại | Ít thay đổi, vẫn tái lập được evaluator N2. | Phải công bố đang chấm snapshot; nếu dùng các intent lặp lại làm lệnh sẽ hiểu sai thêm món nhiều lần. | Không nhất thiết; chờ policy |
| B — Tách current-turn semantics và requested state | express_assent là dialogue act, không cấp quyền thực thi hoặc human approval. Requested state không bị mất chỉ vì entities của lượt đồng ý rỗng. | Chấm hai lớp riêng, giữ evidence turn; cần successor contract/evaluator, không áp vào golden N2. | Có, chưa triển khai |
| C — Chỉ chấm lượt hiện tại và bỏ inherited state | Giảm yêu cầu state khi corpus chưa có assistant turns. | Mất bài kiểm tra giữ preferences/options/reference nhiều lượt; không đáp ứng mục tiêu state nếu không bổ sung tập khác. | Không nhất thiết; chờ policy |

**Codex đề xuất B — CHƯA DUYỆT:** express_assent là dialogue act, không cấp quyền thực thi hoặc human approval. Requested state không bị mất chỉ vì entities của lượt đồng ý rỗng. Đề xuất D01, chưa duyệt; giữ bản N2 làm baseline cho tới khi người phụ trách chốt task.

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Current-turn intent vs accumulated state: express_assent là dialogue act, không cấp quyền thực thi hoặc human approval. Requested state không bị mất chỉ vì entities của lượt đồng ý rỗng.

**Đề xuất theo record, CHƯA DUYỆT:** express_assent là dialogue act, không cấp quyền thực thi hoặc human approval. Requested state không bị mất chỉ vì entities của lượt đồng ý rỗng.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-D-ASSENT-2-3

Batch B10 · queue 60 · P1_original_flagged · split train · group `dialogue-family-assent` · **pending**

**Câu gốc:** Kiểm tra giỏ sau đề nghị đó giúp tôi

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
- N2-D-ASSENT-2-1: Lấy đúng một Pepsi giúp tôi
- N2-D-ASSENT-2-2: ừ được, mình thấy đề xuất rồi

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "view_cart",
      "polarity": "affirmed"
    }
  ],
  "entities": []
}
```

**Rationale nguồn:** Dialogue assent, turn 3: annotation describes the accumulated request state, not an executed cart. Prior context is synthetic and proposals never mutate it.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `a5fab2ce3a9fb8e8c33ec07d3d7fe89f773f959aa8fbf7ed1da002cde3fa052d`.

### Q054 — Current-turn intent vs accumulated state

Nguồn `dialogue_target`: Confirm per-turn intent versus accumulated request state and missing assistant clarification history.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ N2 như snapshot active request/gold hiện tại | Ít thay đổi, vẫn tái lập được evaluator N2. | Phải công bố đang chấm snapshot; nếu dùng các intent lặp lại làm lệnh sẽ hiểu sai thêm món nhiều lần. | Không nhất thiết; chờ policy |
| B — Tách current-turn semantics và requested state | view_cart đọc trusted cart; không suy ra đã add 1 sau lời đồng ý. Nếu chấm state, pending request và cart hiện tại phải tách riêng. | Chấm hai lớp riêng, giữ evidence turn; cần successor contract/evaluator, không áp vào golden N2. | Có, chưa triển khai |
| C — Chỉ chấm lượt hiện tại và bỏ inherited state | Giảm yêu cầu state khi corpus chưa có assistant turns. | Mất bài kiểm tra giữ preferences/options/reference nhiều lượt; không đáp ứng mục tiêu state nếu không bổ sung tập khác. | Không nhất thiết; chờ policy |

**Codex đề xuất B — CHƯA DUYỆT:** view_cart đọc trusted cart; không suy ra đã add 1 sau lời đồng ý. Nếu chấm state, pending request và cart hiện tại phải tách riêng. Đề xuất D01, chưa duyệt; giữ bản N2 làm baseline cho tới khi người phụ trách chốt task.

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Current-turn intent vs accumulated state: view_cart đọc trusted cart; không suy ra đã add 1 sau lời đồng ý. Nếu chấm state, pending request và cart hiện tại phải tách riêng.

**Đề xuất theo record, CHƯA DUYỆT:** view_cart đọc trusted cart; không suy ra đã add 1 sau lời đồng ý. Nếu chấm state, pending request và cart hiện tại phải tách riêng.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-HOLDCOMP-01

Batch B11 · queue 61 · P1_original_flagged · split test · group `single-holdcomp` · **pending**

**Câu gốc:** Burger demo có kèm món nào không

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "ask_combo_contents",
      "polarity": "affirmed",
      "targetIds": [
        "p"
      ]
    }
  ],
  "entities": [
    {
      "id": "p",
      "kind": "product",
      "text": "Burger demo có kèm món nào không",
      "productId": "demo-burger"
    }
  ]
}
```

**Rationale nguồn:** Authored paraphrase 1: preserve ask_combo_contents; natural. Product bindings refer only to the supplied synthetic scope; no execution or menu claims.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `8a5995ed4731ca57508645b694c392b02d7b29f0bb8973bf3bd2fa79ba1e9104`.

### Q013 — Intent ambiguity

Nguồn `taxonomy_ambiguity`: Burger product is labelled ask_combo_contents. Review product-components versus combo intent.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ ask_combo_contents cho mọi câu hỏi thành phần | Ít đổi labels; dùng enum cũ. | Tên intent gây nhầm product với combo và có thể ép model đi theo nhãn không tự nhiên. | Không nhất thiết; chờ policy |
| B — ask_contents với subject/relation rõ | Burger trong C0 là product, không phải combo; kèm món khác với nguyên liệu. | Cần v1 enum/fields; không tạo thành phần hoặc giả định phụ kiện có sẵn. | Có, chưa triển khai |
| C — Dùng get_product_details hoặc hỏi lại relation | Enum cũ chứa get_product_details; hỏi lại nếu gồm gì có hơn một nghĩa. | GET detail rộng làm mất thông tin loại câu hỏi; clarify cần định nghĩa threshold nhất quán. | Không nhất thiết; chờ policy |

**Codex đề xuất B — CHƯA DUYỆT:** Câu có kèm món nào hỏi included_items của burger product; đề xuất ask_contents(product,included_items), không suy có combo. Chưa duyệt.

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**

**Đề xuất theo record, CHƯA DUYỆT:** Giữ ask_combo_contents như candidate nếu reviewer thấy đúng với utterance/context; không suy thực thi hoặc menu fact từ intent.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-HOLDCOMP-02

Batch B11 · queue 62 · P1_original_flagged · split test · group `single-holdcomp` · **pending**

**Câu gốc:** Món burger này gồm những phần gì

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "ask_combo_contents",
      "polarity": "affirmed",
      "targetIds": [
        "p"
      ]
    }
  ],
  "entities": [
    {
      "id": "p",
      "kind": "product",
      "text": "Món burger này gồm những phần gì",
      "productId": "demo-burger"
    }
  ]
}
```

**Rationale nguồn:** Authored paraphrase 2: preserve ask_combo_contents; natural. Product bindings refer only to the supplied synthetic scope; no execution or menu claims.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `f39433c69fdd5c6aae7dd4145689f7d9aeb79b783fda6829f0288258df0d88ae`.

### Q014 — Intent ambiguity

Nguồn `taxonomy_ambiguity`: Burger product is labelled ask_combo_contents. Review product-components versus combo intent.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ ask_combo_contents cho mọi câu hỏi thành phần | Ít đổi labels; dùng enum cũ. | Tên intent gây nhầm product với combo và có thể ép model đi theo nhãn không tự nhiên. | Không nhất thiết; chờ policy |
| B — ask_contents với subject/relation rõ | Burger trong C0 là product, không phải combo; kèm món khác với nguyên liệu. | Cần v1 enum/fields; không tạo thành phần hoặc giả định phụ kiện có sẵn. | Có, chưa triển khai |
| C — Dùng get_product_details hoặc hỏi lại relation | Enum cũ chứa get_product_details; hỏi lại nếu gồm gì có hơn một nghĩa. | GET detail rộng làm mất thông tin loại câu hỏi; clarify cần định nghĩa threshold nhất quán. | Không nhất thiết; chờ policy |

**Codex đề xuất C — CHƯA DUYỆT:** Câu gồm những phần gì có thể hỏi ingredients hoặc included items. Đề xuất hỏi rõ relation khi thiếu ngữ cảnh; không tự ép combo. Chưa duyệt.

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**

**Đề xuất theo record, CHƯA DUYỆT:** Giữ ask_combo_contents như candidate nếu reviewer thấy đúng với utterance/context; không suy thực thi hoặc menu fact từ intent.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-HOLDUNKNOWN-01

Batch B11 · queue 63 · P1_original_flagged · split test · group `single-holdunknown` · **pending**

**Câu gốc:** Có món mỳ ý sốt nấmm không

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "needs_clarification",
  "missingSlots": [
    "product"
  ],
  "reason": "Mention not grounded in demo menu",
  "intents": [
    {
      "id": "i",
      "kind": "search_product",
      "polarity": "affirmed",
      "targetIds": [
        "p"
      ]
    }
  ],
  "entities": [
    {
      "id": "p",
      "kind": "product",
      "text": "Có món mỳ ý sốt nấmm không",
      "productId": null
    }
  ]
}
```

**Rationale nguồn:** Authored paraphrase 1: preserve search_product; clarification, typo. Product bindings refer only to the supplied synthetic scope; no execution or menu claims.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `f13bcc26a3aeb5e257325ff0817a3ef49a6b93f90fe1399196634cd74fd16490`.

### Q011 — Clarification policy

Nguồn `absence_vs_ambiguity`: Missing menu product need not imply ambiguous language; review search/no-match versus clarification.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ needs_clarification/product với null ID như N2 | N2 understood không cho unresolved product. | Tái lập compatibility nhưng biến no_match thành clarification và có thể đánh sai hiểu ngôn ngữ. | Không nhất thiết; chờ policy |
| B — Giữ search_product rõ, binding=no_match, surface gốc | Ý tìm món có thể rõ dù context không chứa món đó. | Cần binding semantics/schema mới; N2 chưa biểu diễn understood+null product. | Có, chưa triển khai |
| C — Chỉ clarify khi danh tính món thực sự có nhiều cách hiểu | Tách spelling/mention ambiguity khỏi catalog absence. | Reviewer phải chỉ ra ambiguity cụ thể, không chỉ viện lý do menu thiếu món. | Không nhất thiết; chờ policy |

**Codex đề xuất B — CHƯA DUYỆT:** Đề xuất D03: giữ nguyên mong muốn tìm mỳ/spaghetti sốt nấm, không gán ID burger/Pepsi để đạt grounding. Không có món trong C0 chưa chứng minh user nói mơ hồ; typo cũng cần chấm riêng. Chưa duyệt.

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Clarification policy: missingSlots hiện tại [product]: phân biệt toàn bộ slot thiếu với slot sẽ hỏi tiếp, không tự điền từ cart.

**Đề xuất theo record, CHƯA DUYỆT:** Đối chiếu loại slot thiếu với evidence và policy D02/D03/D05/D09; giữ pending thay vì tự điền.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-HOLDUNKNOWN-02

Batch B11 · queue 64 · P1_original_flagged · split test · group `single-holdunknown` · **pending**

**Câu gốc:** Tìm giúp spaghetti vị nấm nhé

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "needs_clarification",
  "missingSlots": [
    "product"
  ],
  "reason": "Mention not grounded in demo menu",
  "intents": [
    {
      "id": "i",
      "kind": "search_product",
      "polarity": "affirmed",
      "targetIds": [
        "p"
      ]
    }
  ],
  "entities": [
    {
      "id": "p",
      "kind": "product",
      "text": "Tìm giúp spaghetti vị nấm nhé",
      "productId": null
    }
  ]
}
```

**Rationale nguồn:** Authored paraphrase 2: preserve search_product; clarification, typo. Product bindings refer only to the supplied synthetic scope; no execution or menu claims.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `61e8c653347a908c41db587b696d61cf83222a664dbd2f5800b015822e308001`.

### Q012 — Clarification policy

Nguồn `absence_vs_ambiguity`: Missing menu product need not imply ambiguous language; review search/no-match versus clarification.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ needs_clarification/product với null ID như N2 | N2 understood không cho unresolved product. | Tái lập compatibility nhưng biến no_match thành clarification và có thể đánh sai hiểu ngôn ngữ. | Không nhất thiết; chờ policy |
| B — Giữ search_product rõ, binding=no_match, surface gốc | Ý tìm món có thể rõ dù context không chứa món đó. | Cần binding semantics/schema mới; N2 chưa biểu diễn understood+null product. | Có, chưa triển khai |
| C — Chỉ clarify khi danh tính món thực sự có nhiều cách hiểu | Tách spelling/mention ambiguity khỏi catalog absence. | Reviewer phải chỉ ra ambiguity cụ thể, không chỉ viện lý do menu thiếu món. | Không nhất thiết; chờ policy |

**Codex đề xuất B — CHƯA DUYỆT:** Đề xuất D03: giữ nguyên mong muốn tìm mỳ/spaghetti sốt nấm, không gán ID burger/Pepsi để đạt grounding. Không có món trong C0 chưa chứng minh user nói mơ hồ; typo cũng cần chấm riêng. Chưa duyệt.

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Clarification policy: missingSlots hiện tại [product]: phân biệt toàn bộ slot thiếu với slot sẽ hỏi tiếp, không tự điền từ cart.

**Đề xuất theo record, CHƯA DUYỆT:** Đối chiếu loại slot thiếu với evidence và policy D02/D03/D05/D09; giữ pending thay vì tự điền.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-REFMISS-01

Batch B11 · queue 65 · P1_original_flagged · split train · group `single-refmiss` · **pending**

**Câu gốc:** Bỏ cái thứ hai lúc trước

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "needs_clarification",
  "missingSlots": [
    "reference"
  ],
  "reason": "No resolvable antecedent",
  "intents": [
    {
      "id": "i",
      "kind": "remove_line",
      "polarity": "affirmed",
      "targetId": "r"
    }
  ],
  "entities": [
    {
      "id": "r",
      "kind": "reference",
      "text": "Bỏ cái thứ hai lúc trước",
      "referentId": null
    }
  ]
}
```

**Rationale nguồn:** Authored paraphrase 1: preserve remove_line; multi_turn, clarification. Product bindings refer only to the supplied synthetic scope; no execution or menu claims.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `49f2cfd5ee1fe7411e7b9c0c8e871ef513965f8a1a8a1c7aa3f4f0f372b9daf5`.

### Q003 — Multi-turn reference

Nguồn `referent_policy`: Context contains last-item even for unavailable historical references; reviewer must specify permitted antecedents.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ binding/clarification hiện tại theo evidence đã có | Cái thứ hai lúc trước không có thứ tự hiển thị, C0 chỉ có một dòng; không suy ID từ thứ tự thiếu. | Giữ unresolved với lịch sử ngoài phạm vi; recovery đã làm rõ thì không tiếp tục báo thiếu product. | Không nhất thiết; chờ policy |
| B — Bind mọi reference vào last-item=Pepsi | Context có referent ID hợp lệ về cấu trúc. | Có thể ghép sai món hôm kia/cái thứ hai hoặc ghi đè antecedent burger; ID tồn tại không chứng minh nghĩa đúng. | Không nhất thiết; chờ policy |
| C — Bổ sung nguồn referent/history và review lại | Đối chiếu turn, scope, thời điểm hoặc danh sách đã hiển thị có bằng chứng. | Không dựng assistant message hoặc order history từ golden; nếu thiếu nguồn thì giữ pending/reference unresolved. | Có, chưa triển khai |

**Codex đề xuất A — CHƯA DUYỆT:** Cái thứ hai lúc trước không có thứ tự hiển thị, C0 chỉ có một dòng; không suy ID từ thứ tự thiếu. Đề xuất D05/D09, chưa duyệt. Không tự lấy quantity=3 từ cart.

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Clarification policy: missingSlots hiện tại [reference]: phân biệt toàn bộ slot thiếu với slot sẽ hỏi tiếp, không tự điền từ cart.

**Đề xuất theo record, CHƯA DUYỆT:** Đối chiếu loại slot thiếu với evidence và policy D02/D03/D05/D09; giữ pending thay vì tự điền.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-REFMISS-02

Batch B11 · queue 66 · P1_original_flagged · split train · group `single-refmiss` · **pending**

**Câu gốc:** Xóa món đó mà mình nói lúc nãy

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "needs_clarification",
  "missingSlots": [
    "reference"
  ],
  "reason": "No resolvable antecedent",
  "intents": [
    {
      "id": "i",
      "kind": "remove_line",
      "polarity": "affirmed",
      "targetId": "r"
    }
  ],
  "entities": [
    {
      "id": "r",
      "kind": "reference",
      "text": "Xóa món đó mà mình nói lúc nãy",
      "referentId": null
    }
  ]
}
```

**Rationale nguồn:** Authored paraphrase 2: preserve remove_line; multi_turn, clarification. Product bindings refer only to the supplied synthetic scope; no execution or menu claims.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `11e70062423feba0374f6773c8bd3e92b9cd18980d3303088ee320d44abfa5ec`.

### Q004 — Multi-turn reference

Nguồn `referent_policy`: Context contains last-item even for unavailable historical references; reviewer must specify permitted antecedents.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ binding/clarification hiện tại theo evidence đã có | Món lúc nãy không có textual antecedent trong record đơn; last-item=Pepsi chỉ dùng được nếu policy xác nhận nguồn/thời gian/scope của binding đó. | Giữ unresolved với lịch sử ngoài phạm vi; recovery đã làm rõ thì không tiếp tục báo thiếu product. | Không nhất thiết; chờ policy |
| B — Bind mọi reference vào last-item=Pepsi | Context có referent ID hợp lệ về cấu trúc. | Có thể ghép sai món hôm kia/cái thứ hai hoặc ghi đè antecedent burger; ID tồn tại không chứng minh nghĩa đúng. | Không nhất thiết; chờ policy |
| C — Bổ sung nguồn referent/history và review lại | Đối chiếu turn, scope, thời điểm hoặc danh sách đã hiển thị có bằng chứng. | Không dựng assistant message hoặc order history từ golden; nếu thiếu nguồn thì giữ pending/reference unresolved. | Có, chưa triển khai |

**Codex đề xuất C — CHƯA DUYỆT:** Món lúc nãy không có textual antecedent trong record đơn; last-item=Pepsi chỉ dùng được nếu policy xác nhận nguồn/thời gian/scope của binding đó. Đề xuất D05/D09, chưa duyệt. Không tự lấy quantity=3 từ cart.

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Clarification policy: missingSlots hiện tại [reference]: phân biệt toàn bộ slot thiếu với slot sẽ hỏi tiếp, không tự điền từ cart.

**Đề xuất theo record, CHƯA DUYỆT:** Đối chiếu loại slot thiếu với evidence và policy D02/D03/D05/D09; giữ pending thay vì tự điền.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-CON-01

Batch B12 · queue 67 · P1_original_flagged · split train · group `single-con` · **pending**

**Câu gốc:** Tư vấn cho hai người dưới 200k, không cay và khỏi nước

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

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
      "id": "b",
      "kind": "budget",
      "text": "Tư vấn cho hai người dưới 200k, không cay và khỏi nước",
      "amount": 200000,
      "currency": "VND",
      "scope": "total"
    },
    {
      "id": "n",
      "kind": "party_size",
      "text": "Tư vấn cho hai người dưới 200k, không cay và khỏi nước",
      "value": 2
    },
    {
      "id": "pref",
      "kind": "preference",
      "text": "Tư vấn cho hai người dưới 200k, không cay và khỏi nước",
      "targetId": null,
      "attribute": "spice",
      "operator": "neq",
      "value": "hot"
    },
    {
      "id": "no-water",
      "kind": "preference",
      "text": "Tư vấn cho hai người dưới 200k, không cay và khỏi nước",
      "targetId": null,
      "attribute": "beverage",
      "operator": "neq",
      "value": "drink"
    }
  ]
}
```

**Rationale nguồn:** Authored paraphrase 1: preserve request_recommendation; budget, party_size, exclusion, multi_intent. Product bindings refer only to the supplied synthetic scope; no execution or menu claims.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `bcc3b5ca19f455e0f768a827b089feb2413ba5ad04b841f1fb48d119137c0f27`.

### Q001 — Entity ambiguity

Nguồn `budget_operator`: N2 encodes amount/scope but not strict < versus <=; avoid penalizing this unrepresentable distinction.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ amount/scope N2, bỏ phân biệt operator khi chấm | N2 chưa có field operator. | Tương thích hiện tại nhưng không được tuyên bố đã kiểm tra strict lt/lte. | Không nhất thiết; chờ policy |
| B — Bổ sung operator/approximation/scope evidence ở successor | Dưới 200k: cân nhắc lt, scope total đang do ngữ cảnh nhóm ăn gợi ra; cần reviewer xác nhận scope thay vì coi là phát biểu mỗi người. | Làm rõ constraint accuracy và có thể khiến các paraphrase cùng group mang giá trị khác nhau; cần schema/version mới. | Có, chưa triển khai |
| C — needs_clarification khi operator hoặc scope thực sự chưa rõ | Giữ nguyên điều chưa biết thay vì suy đoán. | Không hỏi lại câu đã rõ chỉ vì schema chưa có field; schema gap khác linguistic ambiguity. | Không nhất thiết; chờ policy |

**Codex đề xuất B — CHƯA DUYỆT:** Dưới 200k: cân nhắc lt, scope total đang do ngữ cảnh nhóm ăn gợi ra; cần reviewer xác nhận scope thay vì coi là phát biểu mỗi người. Codex đề xuất D08; không điền operator vào gold gốc.

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Negation/exclusion: Kiểm tra polarity của từng operation và exclusion theo target; không bỏ toàn bộ yêu cầu vì một phủ định.

**Đề xuất theo record, CHƯA DUYỆT:** Giữ request_recommendation như candidate nếu reviewer thấy đúng với utterance/context; không suy thực thi hoặc menu fact từ intent.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-CON-02

Batch B12 · queue 68 · P1_original_flagged · split train · group `single-con` · **pending**

**Câu gốc:** Gợi ý bữa hai người tối đa 200 nghìn, tránh cay, bỏ nước uống

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

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
      "id": "b",
      "kind": "budget",
      "text": "Gợi ý bữa hai người tối đa 200 nghìn, tránh cay, bỏ nước uống",
      "amount": 200000,
      "currency": "VND",
      "scope": "total"
    },
    {
      "id": "n",
      "kind": "party_size",
      "text": "Gợi ý bữa hai người tối đa 200 nghìn, tránh cay, bỏ nước uống",
      "value": 2
    },
    {
      "id": "pref",
      "kind": "preference",
      "text": "Gợi ý bữa hai người tối đa 200 nghìn, tránh cay, bỏ nước uống",
      "targetId": null,
      "attribute": "spice",
      "operator": "neq",
      "value": "hot"
    },
    {
      "id": "no-water",
      "kind": "preference",
      "text": "Gợi ý bữa hai người tối đa 200 nghìn, tránh cay, bỏ nước uống",
      "targetId": null,
      "attribute": "beverage",
      "operator": "neq",
      "value": "drink"
    }
  ]
}
```

**Rationale nguồn:** Authored paraphrase 2: preserve request_recommendation; budget, party_size, exclusion, multi_intent. Product bindings refer only to the supplied synthetic scope; no execution or menu claims.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `1573e014551c8a83d71ff498b03aafd9e6a9557d96f84e509f9e6ee6a2b44893`.

### Q002 — Entity ambiguity

Nguồn `budget_operator`: N2 encodes amount/scope but not strict < versus <=; avoid penalizing this unrepresentable distinction.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ amount/scope N2, bỏ phân biệt operator khi chấm | N2 chưa có field operator. | Tương thích hiện tại nhưng không được tuyên bố đã kiểm tra strict lt/lte. | Không nhất thiết; chờ policy |
| B — Bổ sung operator/approximation/scope evidence ở successor | Tối đa 200 nghìn: lte, scope total theo ngữ cảnh bữa hai người; giữ exclusions riêng, không phủ định request. | Làm rõ constraint accuracy và có thể khiến các paraphrase cùng group mang giá trị khác nhau; cần schema/version mới. | Có, chưa triển khai |
| C — needs_clarification khi operator hoặc scope thực sự chưa rõ | Giữ nguyên điều chưa biết thay vì suy đoán. | Không hỏi lại câu đã rõ chỉ vì schema chưa có field; schema gap khác linguistic ambiguity. | Không nhất thiết; chờ policy |

**Codex đề xuất B — CHƯA DUYỆT:** Tối đa 200 nghìn: lte, scope total theo ngữ cảnh bữa hai người; giữ exclusions riêng, không phủ định request. Codex đề xuất D08; không điền operator vào gold gốc.

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Negation/exclusion: Kiểm tra polarity của từng operation và exclusion theo target; không bỏ toàn bộ yêu cầu vì một phủ định.

**Đề xuất theo record, CHƯA DUYỆT:** Giữ request_recommendation như candidate nếu reviewer thấy đúng với utterance/context; không suy thực thi hoặc menu fact từ intent.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-BUDGET-01

Batch B12 · queue 69 · P1_original_flagged · split dev · group `single-budget` · **pending**

**Câu gốc:** Ba người ăn tầm dưới 150k thì chọn gì

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

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
      "id": "b",
      "kind": "budget",
      "text": "Ba người ăn tầm dưới 150k thì chọn gì",
      "amount": 150000,
      "currency": "VND",
      "scope": "total"
    },
    {
      "id": "n",
      "kind": "party_size",
      "text": "Ba người ăn tầm dưới 150k thì chọn gì",
      "value": 3
    }
  ]
}
```

**Rationale nguồn:** Authored paraphrase 1: preserve request_recommendation; budget, party_size. Product bindings refer only to the supplied synthetic scope; no execution or menu claims.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `5d97c58442885b6ed7987ae321776ba56e7fe3099e3f5cbe0b93d3138d6d7e82`.

### Q005 — Entity ambiguity

Nguồn `budget_operator`: N2 encodes amount/scope but not strict < versus <=; avoid penalizing this unrepresentable distinction.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ amount/scope N2, bỏ phân biệt operator khi chấm | N2 chưa có field operator. | Tương thích hiện tại nhưng không được tuyên bố đã kiểm tra strict lt/lte. | Không nhất thiết; chờ policy |
| B — Bổ sung operator/approximation/scope evidence ở successor | Tầm dưới 150k: vừa ước lượng vừa có upper bound; cân nhắc lt kèm approximation qualifier, không đồng nhất mặc định với tối đa. | Làm rõ constraint accuracy và có thể khiến các paraphrase cùng group mang giá trị khác nhau; cần schema/version mới. | Có, chưa triển khai |
| C — needs_clarification khi operator hoặc scope thực sự chưa rõ | Giữ nguyên điều chưa biết thay vì suy đoán. | Không hỏi lại câu đã rõ chỉ vì schema chưa có field; schema gap khác linguistic ambiguity. | Không nhất thiết; chờ policy |

**Codex đề xuất B — CHƯA DUYỆT:** Tầm dưới 150k: vừa ước lượng vừa có upper bound; cân nhắc lt kèm approximation qualifier, không đồng nhất mặc định với tối đa. Codex đề xuất D08; không điền operator vào gold gốc.

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**

**Đề xuất theo record, CHƯA DUYỆT:** Giữ request_recommendation như candidate nếu reviewer thấy đúng với utterance/context; không suy thực thi hoặc menu fact từ intent.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-BUDGET-02

Batch B12 · queue 70 · P1_original_flagged · split dev · group `single-budget` · **pending**

**Câu gốc:** Gợi ý cho 3 người, ngân sách tối đa 150 nghìn

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

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
      "id": "b",
      "kind": "budget",
      "text": "Gợi ý cho 3 người, ngân sách tối đa 150 nghìn",
      "amount": 150000,
      "currency": "VND",
      "scope": "total"
    },
    {
      "id": "n",
      "kind": "party_size",
      "text": "Gợi ý cho 3 người, ngân sách tối đa 150 nghìn",
      "value": 3
    }
  ]
}
```

**Rationale nguồn:** Authored paraphrase 2: preserve request_recommendation; budget, party_size. Product bindings refer only to the supplied synthetic scope; no execution or menu claims.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `0e450f988db305e4af3819fd6156f7a6f76594895a2c607e55e35d1a26d32ba4`.

### Q006 — Entity ambiguity

Nguồn `budget_operator`: N2 encodes amount/scope but not strict < versus <=; avoid penalizing this unrepresentable distinction.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ amount/scope N2, bỏ phân biệt operator khi chấm | N2 chưa có field operator. | Tương thích hiện tại nhưng không được tuyên bố đã kiểm tra strict lt/lte. | Không nhất thiết; chờ policy |
| B — Bổ sung operator/approximation/scope evidence ở successor | Tối đa 150 nghìn: lte; xác nhận total cho nhóm 3 người theo policy scope. | Làm rõ constraint accuracy và có thể khiến các paraphrase cùng group mang giá trị khác nhau; cần schema/version mới. | Có, chưa triển khai |
| C — needs_clarification khi operator hoặc scope thực sự chưa rõ | Giữ nguyên điều chưa biết thay vì suy đoán. | Không hỏi lại câu đã rõ chỉ vì schema chưa có field; schema gap khác linguistic ambiguity. | Không nhất thiết; chờ policy |

**Codex đề xuất B — CHƯA DUYỆT:** Tối đa 150 nghìn: lte; xác nhận total cho nhóm 3 người theo policy scope. Codex đề xuất D08; không điền operator vào gold gốc.

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**

**Đề xuất theo record, CHƯA DUYỆT:** Giữ request_recommendation như candidate nếu reviewer thấy đúng với utterance/context; không suy thực thi hoặc menu fact từ intent.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-AMBPRICE-01

Batch B12 · queue 71 · P1_original_flagged · split dev · group `single-ambprice` · **pending**

**Câu gốc:** Có combo nào 100k không biết tính mỗi người hay cả nhóm

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "needs_clarification",
  "missingSlots": [
    "budget_scope"
  ],
  "reason": "Budget scope omitted",
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
      "id": "b",
      "kind": "budget",
      "text": "Có combo nào 100k không biết tính mỗi người hay cả nhóm",
      "amount": 100000,
      "currency": "VND",
      "scope": null
    }
  ]
}
```

**Rationale nguồn:** Authored paraphrase 1: preserve request_recommendation; budget, clarification. Product bindings refer only to the supplied synthetic scope; no execution or menu claims.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `0abefc711c9c93ab12bb7636472e049586949d63e3757fb6e37531eb7afb9e4b`.

### Q007 — Entity ambiguity

Nguồn `budget_operator`: N2 encodes amount/scope but not strict < versus <=; avoid penalizing this unrepresentable distinction.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ amount/scope N2, bỏ phân biệt operator khi chấm | N2 chưa có field operator. | Tương thích hiện tại nhưng không được tuyên bố đã kiểm tra strict lt/lte. | Không nhất thiết; chờ policy |
| B — Bổ sung operator/approximation/scope evidence ở successor | 100k không biết mỗi người hay cả nhóm: scope unresolved; quan hệ giá bằng/xấp xỉ/ceiling cũng chưa chắc. Không điền total hoặc lte chỉ từ con số. | Làm rõ constraint accuracy và có thể khiến các paraphrase cùng group mang giá trị khác nhau; cần schema/version mới. | Có, chưa triển khai |
| C — needs_clarification khi operator hoặc scope thực sự chưa rõ | Giữ nguyên điều chưa biết thay vì suy đoán. | Không hỏi lại câu đã rõ chỉ vì schema chưa có field; schema gap khác linguistic ambiguity. | Không nhất thiết; chờ policy |

**Codex đề xuất C — CHƯA DUYỆT:** 100k không biết mỗi người hay cả nhóm: scope unresolved; quan hệ giá bằng/xấp xỉ/ceiling cũng chưa chắc. Không điền total hoặc lte chỉ từ con số. Codex đề xuất D08; không điền operator vào gold gốc.

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Clarification policy: missingSlots hiện tại [budget_scope]: phân biệt toàn bộ slot thiếu với slot sẽ hỏi tiếp, không tự điền từ cart.

**Đề xuất theo record, CHƯA DUYỆT:** Đối chiếu loại slot thiếu với evidence và policy D02/D03/D05/D09; giữ pending thay vì tự điền.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-AMBPRICE-02

Batch B12 · queue 72 · P1_original_flagged · split dev · group `single-ambprice` · **pending**

**Câu gốc:** Mình có 100 nghìn nhưng chưa rõ chia suất thế nào

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "needs_clarification",
  "missingSlots": [
    "budget_scope"
  ],
  "reason": "Budget scope omitted",
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
      "id": "b",
      "kind": "budget",
      "text": "Mình có 100 nghìn nhưng chưa rõ chia suất thế nào",
      "amount": 100000,
      "currency": "VND",
      "scope": null
    }
  ]
}
```

**Rationale nguồn:** Authored paraphrase 2: preserve request_recommendation; budget, clarification. Product bindings refer only to the supplied synthetic scope; no execution or menu claims.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `154a2495875847708f09c88c802576ca49a531f6c347d18c0ebbd39ff55eeca7`.

### Q008 — Entity ambiguity

Nguồn `budget_operator`: N2 encodes amount/scope but not strict < versus <=; avoid penalizing this unrepresentable distinction.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ amount/scope N2, bỏ phân biệt operator khi chấm | N2 chưa có field operator. | Tương thích hiện tại nhưng không được tuyên bố đã kiểm tra strict lt/lte. | Không nhất thiết; chờ policy |
| B — Bổ sung operator/approximation/scope evidence ở successor | Có 100 nghìn nhưng chưa rõ chia suất: capacity ceiling lte là proposal; scope còn unresolved như gold, không default total. | Làm rõ constraint accuracy và có thể khiến các paraphrase cùng group mang giá trị khác nhau; cần schema/version mới. | Có, chưa triển khai |
| C — needs_clarification khi operator hoặc scope thực sự chưa rõ | Giữ nguyên điều chưa biết thay vì suy đoán. | Không hỏi lại câu đã rõ chỉ vì schema chưa có field; schema gap khác linguistic ambiguity. | Không nhất thiết; chờ policy |

**Codex đề xuất C — CHƯA DUYỆT:** Có 100 nghìn nhưng chưa rõ chia suất: capacity ceiling lte là proposal; scope còn unresolved như gold, không default total. Codex đề xuất D08; không điền operator vào gold gốc.

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Clarification policy: missingSlots hiện tại [budget_scope]: phân biệt toàn bộ slot thiếu với slot sẽ hỏi tiếp, không tự điền từ cart.

**Đề xuất theo record, CHƯA DUYỆT:** Đối chiếu loại slot thiếu với evidence và policy D02/D03/D05/D09; giữ pending thay vì tự điền.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-HOLDEX-01

Batch B12 · queue 73 · P1_original_flagged · split test · group `single-holdex` · **pending**

**Câu gốc:** Hai đứa ăn, trần 180k, né khoai giúp

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

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
      "id": "b",
      "kind": "budget",
      "text": "Hai đứa ăn, trần 180k, né khoai giúp",
      "amount": 180000,
      "currency": "VND",
      "scope": "total"
    },
    {
      "id": "n",
      "kind": "party_size",
      "text": "Hai đứa ăn, trần 180k, né khoai giúp",
      "value": 2
    },
    {
      "id": "no-fries",
      "kind": "preference",
      "text": "Hai đứa ăn, trần 180k, né khoai giúp",
      "targetId": null,
      "attribute": "ingredient",
      "operator": "neq",
      "value": "potato"
    }
  ]
}
```

**Rationale nguồn:** Authored paraphrase 1: preserve request_recommendation; exclusion, budget, party_size. Product bindings refer only to the supplied synthetic scope; no execution or menu claims.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `89cc0ab78754ff11c51f53cde4f72f405be8519dbda73e248d962cb9a4829b9e`.

### Q009 — Entity ambiguity

Nguồn `budget_operator`: N2 encodes amount/scope but not strict < versus <=; avoid penalizing this unrepresentable distinction.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ amount/scope N2, bỏ phân biệt operator khi chấm | N2 chưa có field operator. | Tương thích hiện tại nhưng không được tuyên bố đã kiểm tra strict lt/lte. | Không nhất thiết; chờ policy |
| B — Bổ sung operator/approximation/scope evidence ở successor | Trần 180k: upper bound lte cho bữa 2 người; không có khoai là exclusion, không phải phủ định recommendation. | Làm rõ constraint accuracy và có thể khiến các paraphrase cùng group mang giá trị khác nhau; cần schema/version mới. | Có, chưa triển khai |
| C — needs_clarification khi operator hoặc scope thực sự chưa rõ | Giữ nguyên điều chưa biết thay vì suy đoán. | Không hỏi lại câu đã rõ chỉ vì schema chưa có field; schema gap khác linguistic ambiguity. | Không nhất thiết; chờ policy |

**Codex đề xuất B — CHƯA DUYỆT:** Trần 180k: upper bound lte cho bữa 2 người; không có khoai là exclusion, không phải phủ định recommendation. Codex đề xuất D08; không điền operator vào gold gốc.

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Negation/exclusion: Kiểm tra polarity của từng operation và exclusion theo target; không bỏ toàn bộ yêu cầu vì một phủ định.

**Đề xuất theo record, CHƯA DUYỆT:** Giữ request_recommendation như candidate nếu reviewer thấy đúng với utterance/context; không suy thực thi hoặc menu fact từ intent.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-HOLDEX-02

Batch B12 · queue 74 · P1_original_flagged · split test · group `single-holdex` · **pending**

**Câu gốc:** Gợi ý bữa cho 2 người không có khoai tây và tổng đừng quá 180 nghìn

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

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
      "id": "b",
      "kind": "budget",
      "text": "Gợi ý bữa cho 2 người không có khoai tây và tổng đừng quá 180 nghìn",
      "amount": 180000,
      "currency": "VND",
      "scope": "total"
    },
    {
      "id": "n",
      "kind": "party_size",
      "text": "Gợi ý bữa cho 2 người không có khoai tây và tổng đừng quá 180 nghìn",
      "value": 2
    },
    {
      "id": "no-fries",
      "kind": "preference",
      "text": "Gợi ý bữa cho 2 người không có khoai tây và tổng đừng quá 180 nghìn",
      "targetId": null,
      "attribute": "ingredient",
      "operator": "neq",
      "value": "potato"
    }
  ]
}
```

**Rationale nguồn:** Authored paraphrase 2: preserve request_recommendation; exclusion, budget, party_size. Product bindings refer only to the supplied synthetic scope; no execution or menu claims.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `01d5e54c441f06bcc22a31e2cc1adf397e260e14ca613e1d5589abb17762ca53`.

### Q010 — Entity ambiguity

Nguồn `budget_operator`: N2 encodes amount/scope but not strict < versus <=; avoid penalizing this unrepresentable distinction.

| Phương án | Lý do | Hệ quả | Contract mới? |
|---|---|---|---|
| A — Giữ amount/scope N2, bỏ phân biệt operator khi chấm | N2 chưa có field operator. | Tương thích hiện tại nhưng không được tuyên bố đã kiểm tra strict lt/lte. | Không nhất thiết; chờ policy |
| B — Bổ sung operator/approximation/scope evidence ở successor | Tổng đừng quá 180 nghìn: total/lte rõ; giữ exclusion khoai riêng. | Làm rõ constraint accuracy và có thể khiến các paraphrase cùng group mang giá trị khác nhau; cần schema/version mới. | Có, chưa triển khai |
| C — needs_clarification khi operator hoặc scope thực sự chưa rõ | Giữ nguyên điều chưa biết thay vì suy đoán. | Không hỏi lại câu đã rõ chỉ vì schema chưa có field; schema gap khác linguistic ambiguity. | Không nhất thiết; chờ policy |

**Codex đề xuất B — CHƯA DUYỆT:** Tổng đừng quá 180 nghìn: total/lte rõ; giữ exclusion khoai riêng. Codex đề xuất D08; không điền operator vào gold gốc.

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Negation/exclusion: Kiểm tra polarity của từng operation và exclusion theo target; không bỏ toàn bộ yêu cầu vì một phủ định.

**Đề xuất theo record, CHƯA DUYỆT:** Giữ request_recommendation như candidate nếu reviewer thấy đúng với utterance/context; không suy thực thi hoặc menu fact từ intent.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-ABS-01

Batch B13 · queue 75 · P2_unflagged_still_pending · split train · group `single-abs` · **pending**

**Câu gốc:** Đổi Pepsi thành bốn phần

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "set_quantity",
      "polarity": "affirmed",
      "targetId": "p",
      "quantityId": "q"
    }
  ],
  "entities": [
    {
      "id": "p",
      "kind": "product",
      "text": "Đổi Pepsi thành bốn phần",
      "productId": "demo-pepsi"
    },
    {
      "id": "q",
      "kind": "quantity",
      "text": "Đổi Pepsi thành bốn phần",
      "mode": "absolute",
      "value": 4
    }
  ]
}
```

**Rationale nguồn:** Authored paraphrase 1: preserve set_quantity; natural, absolute. Product bindings refer only to the supplied synthetic scope; no execution or menu claims.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `e21810725d0b75f74a2ac3c042fdb132f452a50bff12544378b5fa4c5b328821`.

**Không có finding gốc N3.1; vẫn bắt buộc review.**

| Phương án | Lý do | Hệ quả |
|---|---|---|
| U-A — Giữ current golden như candidate sau review | Chưa có finding gốc; cần reviewer xác nhận từ evidence ở trên. | Không thay nguồn; chỉ có thể release sau quyết định thật, không đồng nghĩa auto-approved. |
| U-B — Đề nghị revision/alternative theo D01–D10 | Nếu thấy ambiguity hoặc giới hạn contract, ghi evidence và phương án cụ thể. | Tạo successor candidate/version và đánh giá lại group; không sửa nhãn gốc hoặc bỏ case để tăng điểm. |

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Quantity delta/absolute: Kiểm tra absolute=4 đúng mục tiêu cart/pending_request; không tự tính final quantity hoặc lấy dung tích làm count.
- Other: Không có finding N3.1 không có nghĩa đã đúng. Đối chiếu surface, quantity, polarity, binding, capability và rationale độc lập.

**Đề xuất theo record, CHƯA DUYỆT:** Giữ semantic operation set_quantity với absolute=4 như một candidate chờ reviewer xác nhận; không tạo final quantity.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-ABS-02

Batch B13 · queue 76 · P2_unflagged_still_pending · split train · group `single-abs` · **pending**

**Câu gốc:** Sửa số lượng Pepsi còn 4

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "set_quantity",
      "polarity": "affirmed",
      "targetId": "p",
      "quantityId": "q"
    }
  ],
  "entities": [
    {
      "id": "p",
      "kind": "product",
      "text": "Sửa số lượng Pepsi còn 4",
      "productId": "demo-pepsi"
    },
    {
      "id": "q",
      "kind": "quantity",
      "text": "Sửa số lượng Pepsi còn 4",
      "mode": "absolute",
      "value": 4
    }
  ]
}
```

**Rationale nguồn:** Authored paraphrase 2: preserve set_quantity; natural, absolute. Product bindings refer only to the supplied synthetic scope; no execution or menu claims.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `bfd0dcb87ac9c2278ae133033df6492d610758c274b033725f8985d6f5e53052`.

**Không có finding gốc N3.1; vẫn bắt buộc review.**

| Phương án | Lý do | Hệ quả |
|---|---|---|
| U-A — Giữ current golden như candidate sau review | Chưa có finding gốc; cần reviewer xác nhận từ evidence ở trên. | Không thay nguồn; chỉ có thể release sau quyết định thật, không đồng nghĩa auto-approved. |
| U-B — Đề nghị revision/alternative theo D01–D10 | Nếu thấy ambiguity hoặc giới hạn contract, ghi evidence và phương án cụ thể. | Tạo successor candidate/version và đánh giá lại group; không sửa nhãn gốc hoặc bỏ case để tăng điểm. |

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Quantity delta/absolute: Kiểm tra absolute=4 đúng mục tiêu cart/pending_request; không tự tính final quantity hoặc lấy dung tích làm count.
- Other: Không có finding N3.1 không có nghĩa đã đúng. Đối chiếu surface, quantity, polarity, binding, capability và rationale độc lập.

**Đề xuất theo record, CHƯA DUYỆT:** Giữ semantic operation set_quantity với absolute=4 như một candidate chờ reviewer xác nhận; không tạo final quantity.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-ADD-01

Batch B13 · queue 77 · P2_unflagged_still_pending · split train · group `single-add` · **pending**

**Câu gốc:** Cho mình hai Pepsi nhé

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "add_item",
      "polarity": "affirmed",
      "targetId": "p",
      "quantityId": "q"
    }
  ],
  "entities": [
    {
      "id": "p",
      "kind": "product",
      "text": "Cho mình hai Pepsi nhé",
      "productId": "demo-pepsi"
    },
    {
      "id": "q",
      "kind": "quantity",
      "text": "Cho mình hai Pepsi nhé",
      "mode": "delta",
      "value": 2
    }
  ]
}
```

**Rationale nguồn:** Authored paraphrase 1: preserve add_item; natural, delta. Product bindings refer only to the supplied synthetic scope; no execution or menu claims.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `31ebabd2b7d0523b07e5b2b2703ac7124ada587f11660c6e08e4927f25171e71`.

**Không có finding gốc N3.1; vẫn bắt buộc review.**

| Phương án | Lý do | Hệ quả |
|---|---|---|
| U-A — Giữ current golden như candidate sau review | Chưa có finding gốc; cần reviewer xác nhận từ evidence ở trên. | Không thay nguồn; chỉ có thể release sau quyết định thật, không đồng nghĩa auto-approved. |
| U-B — Đề nghị revision/alternative theo D01–D10 | Nếu thấy ambiguity hoặc giới hạn contract, ghi evidence và phương án cụ thể. | Tạo successor candidate/version và đánh giá lại group; không sửa nhãn gốc hoặc bỏ case để tăng điểm. |

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Quantity delta/absolute: Kiểm tra delta=2 đúng mục tiêu cart/pending_request; không tự tính final quantity hoặc lấy dung tích làm count.
- Other: Không có finding N3.1 không có nghĩa đã đúng. Đối chiếu surface, quantity, polarity, binding, capability và rationale độc lập.

**Đề xuất theo record, CHƯA DUYỆT:** Giữ semantic operation add_item với delta=2 như một candidate chờ reviewer xác nhận; không tạo final quantity.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-ADD-02

Batch B13 · queue 78 · P2_unflagged_still_pending · split train · group `single-add` · **pending**

**Câu gốc:** Lấy giúp tôi 2 Pepsi

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "add_item",
      "polarity": "affirmed",
      "targetId": "p",
      "quantityId": "q"
    }
  ],
  "entities": [
    {
      "id": "p",
      "kind": "product",
      "text": "Lấy giúp tôi 2 Pepsi",
      "productId": "demo-pepsi"
    },
    {
      "id": "q",
      "kind": "quantity",
      "text": "Lấy giúp tôi 2 Pepsi",
      "mode": "delta",
      "value": 2
    }
  ]
}
```

**Rationale nguồn:** Authored paraphrase 2: preserve add_item; natural, delta. Product bindings refer only to the supplied synthetic scope; no execution or menu claims.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `80eb17411a563f87d0e2cbb76bc917eecb603c441230948eb79a6e17529526ec`.

**Không có finding gốc N3.1; vẫn bắt buộc review.**

| Phương án | Lý do | Hệ quả |
|---|---|---|
| U-A — Giữ current golden như candidate sau review | Chưa có finding gốc; cần reviewer xác nhận từ evidence ở trên. | Không thay nguồn; chỉ có thể release sau quyết định thật, không đồng nghĩa auto-approved. |
| U-B — Đề nghị revision/alternative theo D01–D10 | Nếu thấy ambiguity hoặc giới hạn contract, ghi evidence và phương án cụ thể. | Tạo successor candidate/version và đánh giá lại group; không sửa nhãn gốc hoặc bỏ case để tăng điểm. |

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Quantity delta/absolute: Kiểm tra delta=2 đúng mục tiêu cart/pending_request; không tự tính final quantity hoặc lấy dung tích làm count.
- Other: Không có finding N3.1 không có nghĩa đã đúng. Đối chiếu surface, quantity, polarity, binding, capability và rationale độc lập.

**Đề xuất theo record, CHƯA DUYỆT:** Giữ semantic operation add_item với delta=2 như một candidate chờ reviewer xác nhận; không tạo final quantity.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-DEL-01

Batch B13 · queue 79 · P2_unflagged_still_pending · split train · group `single-del` · **pending**

**Câu gốc:** Giảm Pepsi bớt một

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "adjust_quantity",
      "polarity": "affirmed",
      "targetId": "p",
      "quantityId": "q"
    }
  ],
  "entities": [
    {
      "id": "p",
      "kind": "product",
      "text": "Giảm Pepsi bớt một",
      "productId": "demo-pepsi"
    },
    {
      "id": "q",
      "kind": "quantity",
      "text": "Giảm Pepsi bớt một",
      "mode": "delta",
      "value": -1
    }
  ]
}
```

**Rationale nguồn:** Authored paraphrase 1: preserve adjust_quantity; natural, delta. Product bindings refer only to the supplied synthetic scope; no execution or menu claims.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `2684ea99a513c591f5f9cb2cb4c176492f0cc2f277cc5a6d63efae0f0edd06ce`.

**Không có finding gốc N3.1; vẫn bắt buộc review.**

| Phương án | Lý do | Hệ quả |
|---|---|---|
| U-A — Giữ current golden như candidate sau review | Chưa có finding gốc; cần reviewer xác nhận từ evidence ở trên. | Không thay nguồn; chỉ có thể release sau quyết định thật, không đồng nghĩa auto-approved. |
| U-B — Đề nghị revision/alternative theo D01–D10 | Nếu thấy ambiguity hoặc giới hạn contract, ghi evidence và phương án cụ thể. | Tạo successor candidate/version và đánh giá lại group; không sửa nhãn gốc hoặc bỏ case để tăng điểm. |

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Quantity delta/absolute: Kiểm tra delta=-1 đúng mục tiêu cart/pending_request; không tự tính final quantity hoặc lấy dung tích làm count.
- Other: Không có finding N3.1 không có nghĩa đã đúng. Đối chiếu surface, quantity, polarity, binding, capability và rationale độc lập.

**Đề xuất theo record, CHƯA DUYỆT:** Giữ semantic operation adjust_quantity với delta=-1 như một candidate chờ reviewer xác nhận; không tạo final quantity.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-DEL-02

Batch B13 · queue 80 · P2_unflagged_still_pending · split train · group `single-del` · **pending**

**Câu gốc:** Bớt đi 1 Pepsi trong giỏ

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "adjust_quantity",
      "polarity": "affirmed",
      "targetId": "p",
      "quantityId": "q"
    }
  ],
  "entities": [
    {
      "id": "p",
      "kind": "product",
      "text": "Bớt đi 1 Pepsi trong giỏ",
      "productId": "demo-pepsi"
    },
    {
      "id": "q",
      "kind": "quantity",
      "text": "Bớt đi 1 Pepsi trong giỏ",
      "mode": "delta",
      "value": -1
    }
  ]
}
```

**Rationale nguồn:** Authored paraphrase 2: preserve adjust_quantity; natural, delta. Product bindings refer only to the supplied synthetic scope; no execution or menu claims.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `70189373ec033f24d629ac4a00e5249cb5f98b9e469301ca7e94a0ea294e1020`.

**Không có finding gốc N3.1; vẫn bắt buộc review.**

| Phương án | Lý do | Hệ quả |
|---|---|---|
| U-A — Giữ current golden như candidate sau review | Chưa có finding gốc; cần reviewer xác nhận từ evidence ở trên. | Không thay nguồn; chỉ có thể release sau quyết định thật, không đồng nghĩa auto-approved. |
| U-B — Đề nghị revision/alternative theo D01–D10 | Nếu thấy ambiguity hoặc giới hạn contract, ghi evidence và phương án cụ thể. | Tạo successor candidate/version và đánh giá lại group; không sửa nhãn gốc hoặc bỏ case để tăng điểm. |

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Quantity delta/absolute: Kiểm tra delta=-1 đúng mục tiêu cart/pending_request; không tự tính final quantity hoặc lấy dung tích làm count.
- Other: Không có finding N3.1 không có nghĩa đã đúng. Đối chiếu surface, quantity, polarity, binding, capability và rationale độc lập.

**Đề xuất theo record, CHƯA DUYỆT:** Giữ semantic operation adjust_quantity với delta=-1 như một candidate chờ reviewer xác nhận; không tạo final quantity.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-HOK-01

Batch B13 · queue 81 · P2_unflagged_still_pending · split dev · group `single-hok` · **pending**

**Câu gốc:** hok thêm hai Pepsi đâu nha

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "add_item",
      "polarity": "negated",
      "targetId": "p",
      "quantityId": "q"
    }
  ],
  "entities": [
    {
      "id": "p",
      "kind": "product",
      "text": "hok thêm hai Pepsi đâu nha",
      "productId": "demo-pepsi"
    },
    {
      "id": "q",
      "kind": "quantity",
      "text": "hok thêm hai Pepsi đâu nha",
      "mode": "delta",
      "value": 2
    }
  ]
}
```

**Rationale nguồn:** Authored paraphrase 1: preserve add_item; teencode, negation. Product bindings refer only to the supplied synthetic scope; no execution or menu claims.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `c921b9cc7d3ef2cef991fcc810631bd9986600a65aea3d71c59ab1dd1763370f`.

**Không có finding gốc N3.1; vẫn bắt buộc review.**

| Phương án | Lý do | Hệ quả |
|---|---|---|
| U-A — Giữ current golden như candidate sau review | Chưa có finding gốc; cần reviewer xác nhận từ evidence ở trên. | Không thay nguồn; chỉ có thể release sau quyết định thật, không đồng nghĩa auto-approved. |
| U-B — Đề nghị revision/alternative theo D01–D10 | Nếu thấy ambiguity hoặc giới hạn contract, ghi evidence và phương án cụ thể. | Tạo successor candidate/version và đánh giá lại group; không sửa nhãn gốc hoặc bỏ case để tăng điểm. |

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Quantity delta/absolute: Kiểm tra delta=2 đúng mục tiêu cart/pending_request; không tự tính final quantity hoặc lấy dung tích làm count.
- Negation/exclusion: Kiểm tra polarity của từng operation và exclusion theo target; không bỏ toàn bộ yêu cầu vì một phủ định.
- Other: Không có finding N3.1 không có nghĩa đã đúng. Đối chiếu surface, quantity, polarity, binding, capability và rationale độc lập.

**Đề xuất theo record, CHƯA DUYỆT:** Giữ semantic operation add_item [negated] với delta=2 như một candidate chờ reviewer xác nhận; không tạo final quantity.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-HOK-02

Batch B13 · queue 82 · P2_unflagged_still_pending · split dev · group `single-hok` · **pending**

**Câu gốc:** 2 Pepsi thì hok lấy

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "add_item",
      "polarity": "negated",
      "targetId": "p",
      "quantityId": "q"
    }
  ],
  "entities": [
    {
      "id": "p",
      "kind": "product",
      "text": "2 Pepsi thì hok lấy",
      "productId": "demo-pepsi"
    },
    {
      "id": "q",
      "kind": "quantity",
      "text": "2 Pepsi thì hok lấy",
      "mode": "delta",
      "value": 2
    }
  ]
}
```

**Rationale nguồn:** Authored paraphrase 2: preserve add_item; teencode, negation. Product bindings refer only to the supplied synthetic scope; no execution or menu claims.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `1b7155ccd0d59803b0f89d9ee59e524efb72c5cbaeee1b3512e689386692350a`.

**Không có finding gốc N3.1; vẫn bắt buộc review.**

| Phương án | Lý do | Hệ quả |
|---|---|---|
| U-A — Giữ current golden như candidate sau review | Chưa có finding gốc; cần reviewer xác nhận từ evidence ở trên. | Không thay nguồn; chỉ có thể release sau quyết định thật, không đồng nghĩa auto-approved. |
| U-B — Đề nghị revision/alternative theo D01–D10 | Nếu thấy ambiguity hoặc giới hạn contract, ghi evidence và phương án cụ thể. | Tạo successor candidate/version và đánh giá lại group; không sửa nhãn gốc hoặc bỏ case để tăng điểm. |

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Quantity delta/absolute: Kiểm tra delta=2 đúng mục tiêu cart/pending_request; không tự tính final quantity hoặc lấy dung tích làm count.
- Negation/exclusion: Kiểm tra polarity của từng operation và exclusion theo target; không bỏ toàn bộ yêu cầu vì một phủ định.
- Other: Không có finding N3.1 không có nghĩa đã đúng. Đối chiếu surface, quantity, polarity, binding, capability và rationale độc lập.

**Đề xuất theo record, CHƯA DUYỆT:** Giữ semantic operation add_item [negated] với delta=2 như một candidate chờ reviewer xác nhận; không tạo final quantity.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-HOLDABS-01

Batch B14 · queue 83 · P2_unflagged_still_pending · split test · group `single-holdabs` · **pending**

**Câu gốc:** pepsi sua lai so luong cuoi la nam

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "set_quantity",
      "polarity": "affirmed",
      "targetId": "p",
      "quantityId": "q"
    }
  ],
  "entities": [
    {
      "id": "p",
      "kind": "product",
      "text": "pepsi sua lai so luong cuoi la nam",
      "productId": "demo-pepsi"
    },
    {
      "id": "q",
      "kind": "quantity",
      "text": "pepsi sua lai so luong cuoi la nam",
      "mode": "absolute",
      "value": 5
    }
  ]
}
```

**Rationale nguồn:** Authored paraphrase 1: preserve set_quantity; absolute, unaccented. Product bindings refer only to the supplied synthetic scope; no execution or menu claims.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `d417b85db09ea85a63a5b67eeb5b6665e6ff17291e080b2c7e7382cab410f6d3`.

**Không có finding gốc N3.1; vẫn bắt buộc review.**

| Phương án | Lý do | Hệ quả |
|---|---|---|
| U-A — Giữ current golden như candidate sau review | Chưa có finding gốc; cần reviewer xác nhận từ evidence ở trên. | Không thay nguồn; chỉ có thể release sau quyết định thật, không đồng nghĩa auto-approved. |
| U-B — Đề nghị revision/alternative theo D01–D10 | Nếu thấy ambiguity hoặc giới hạn contract, ghi evidence và phương án cụ thể. | Tạo successor candidate/version và đánh giá lại group; không sửa nhãn gốc hoặc bỏ case để tăng điểm. |

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Quantity delta/absolute: Kiểm tra absolute=5 đúng mục tiêu cart/pending_request; không tự tính final quantity hoặc lấy dung tích làm count.
- Other: Không có finding N3.1 không có nghĩa đã đúng. Đối chiếu surface, quantity, polarity, binding, capability và rationale độc lập.

**Đề xuất theo record, CHƯA DUYỆT:** Giữ semantic operation set_quantity với absolute=5 như một candidate chờ reviewer xác nhận; không tạo final quantity.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-HOLDABS-02

Batch B14 · queue 84 · P2_unflagged_still_pending · split test · group `single-holdabs` · **pending**

**Câu gốc:** giu pepsi dung 5 phan thoi

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "set_quantity",
      "polarity": "affirmed",
      "targetId": "p",
      "quantityId": "q"
    }
  ],
  "entities": [
    {
      "id": "p",
      "kind": "product",
      "text": "giu pepsi dung 5 phan thoi",
      "productId": "demo-pepsi"
    },
    {
      "id": "q",
      "kind": "quantity",
      "text": "giu pepsi dung 5 phan thoi",
      "mode": "absolute",
      "value": 5
    }
  ]
}
```

**Rationale nguồn:** Authored paraphrase 2: preserve set_quantity; absolute, unaccented. Product bindings refer only to the supplied synthetic scope; no execution or menu claims.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `eba23ab83fbb5133c97e3bdf6d73a539ecda74e7b73a120e16919f8b4b03ab20`.

**Không có finding gốc N3.1; vẫn bắt buộc review.**

| Phương án | Lý do | Hệ quả |
|---|---|---|
| U-A — Giữ current golden như candidate sau review | Chưa có finding gốc; cần reviewer xác nhận từ evidence ở trên. | Không thay nguồn; chỉ có thể release sau quyết định thật, không đồng nghĩa auto-approved. |
| U-B — Đề nghị revision/alternative theo D01–D10 | Nếu thấy ambiguity hoặc giới hạn contract, ghi evidence và phương án cụ thể. | Tạo successor candidate/version và đánh giá lại group; không sửa nhãn gốc hoặc bỏ case để tăng điểm. |

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Quantity delta/absolute: Kiểm tra absolute=5 đúng mục tiêu cart/pending_request; không tự tính final quantity hoặc lấy dung tích làm count.
- Other: Không có finding N3.1 không có nghĩa đã đúng. Đối chiếu surface, quantity, polarity, binding, capability và rationale độc lập.

**Đề xuất theo record, CHƯA DUYỆT:** Giữ semantic operation set_quantity với absolute=5 như một candidate chờ reviewer xác nhận; không tạo final quantity.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-HOLDDEL-01

Batch B14 · queue 85 · P2_unflagged_still_pending · split test · group `single-holddel` · **pending**

**Câu gốc:** Trong giỏ Pepsi đang ba, mình muốn bớt hai

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "adjust_quantity",
      "polarity": "affirmed",
      "targetId": "p",
      "quantityId": "q"
    }
  ],
  "entities": [
    {
      "id": "p",
      "kind": "product",
      "text": "Trong giỏ Pepsi đang ba, mình muốn bớt hai",
      "productId": "demo-pepsi"
    },
    {
      "id": "q",
      "kind": "quantity",
      "text": "Trong giỏ Pepsi đang ba, mình muốn bớt hai",
      "mode": "delta",
      "value": -2
    }
  ]
}
```

**Rationale nguồn:** Authored paraphrase 1: preserve adjust_quantity; delta, natural. Product bindings refer only to the supplied synthetic scope; no execution or menu claims.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `45e4a46a86bbca8ec9b888611b81cf956e2db9a66f0e5ceccf9c5ce8079806ce`.

**Không có finding gốc N3.1; vẫn bắt buộc review.**

| Phương án | Lý do | Hệ quả |
|---|---|---|
| U-A — Giữ current golden như candidate sau review | Chưa có finding gốc; cần reviewer xác nhận từ evidence ở trên. | Không thay nguồn; chỉ có thể release sau quyết định thật, không đồng nghĩa auto-approved. |
| U-B — Đề nghị revision/alternative theo D01–D10 | Nếu thấy ambiguity hoặc giới hạn contract, ghi evidence và phương án cụ thể. | Tạo successor candidate/version và đánh giá lại group; không sửa nhãn gốc hoặc bỏ case để tăng điểm. |

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Quantity delta/absolute: Kiểm tra delta=-2 đúng mục tiêu cart/pending_request; không tự tính final quantity hoặc lấy dung tích làm count.
- Other: Không có finding N3.1 không có nghĩa đã đúng. Đối chiếu surface, quantity, polarity, binding, capability và rationale độc lập.

**Đề xuất theo record, CHƯA DUYỆT:** Giữ semantic operation adjust_quantity với delta=-2 như một candidate chờ reviewer xác nhận; không tạo final quantity.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-HOLDDEL-02

Batch B14 · queue 86 · P2_unflagged_still_pending · split test · group `single-holddel` · **pending**

**Câu gốc:** Cho giảm đi hai phần Pepsi đang có

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "adjust_quantity",
      "polarity": "affirmed",
      "targetId": "p",
      "quantityId": "q"
    }
  ],
  "entities": [
    {
      "id": "p",
      "kind": "product",
      "text": "Cho giảm đi hai phần Pepsi đang có",
      "productId": "demo-pepsi"
    },
    {
      "id": "q",
      "kind": "quantity",
      "text": "Cho giảm đi hai phần Pepsi đang có",
      "mode": "delta",
      "value": -2
    }
  ]
}
```

**Rationale nguồn:** Authored paraphrase 2: preserve adjust_quantity; delta, natural. Product bindings refer only to the supplied synthetic scope; no execution or menu claims.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `b83896fc2ce647441ff3510cbe0c6b5948bbf2f6dd65031fd031ce583becf860`.

**Không có finding gốc N3.1; vẫn bắt buộc review.**

| Phương án | Lý do | Hệ quả |
|---|---|---|
| U-A — Giữ current golden như candidate sau review | Chưa có finding gốc; cần reviewer xác nhận từ evidence ở trên. | Không thay nguồn; chỉ có thể release sau quyết định thật, không đồng nghĩa auto-approved. |
| U-B — Đề nghị revision/alternative theo D01–D10 | Nếu thấy ambiguity hoặc giới hạn contract, ghi evidence và phương án cụ thể. | Tạo successor candidate/version và đánh giá lại group; không sửa nhãn gốc hoặc bỏ case để tăng điểm. |

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Quantity delta/absolute: Kiểm tra delta=-2 đúng mục tiêu cart/pending_request; không tự tính final quantity hoặc lấy dung tích làm count.
- Other: Không có finding N3.1 không có nghĩa đã đúng. Đối chiếu surface, quantity, polarity, binding, capability và rationale độc lập.

**Đề xuất theo record, CHƯA DUYỆT:** Giữ semantic operation adjust_quantity với delta=-2 như một candidate chờ reviewer xác nhận; không tạo final quantity.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-HOLDMULTI-01

Batch B14 · queue 87 · P2_unflagged_still_pending · split test · group `single-holdmulti` · **pending**

**Câu gốc:** Lấy một Pepsi, còn khoai giá nhiêu

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "add_item",
      "polarity": "affirmed",
      "targetId": "p",
      "quantityId": "q"
    },
    {
      "id": "j",
      "kind": "ask_price",
      "polarity": "affirmed",
      "targetIds": [
        "f"
      ]
    }
  ],
  "entities": [
    {
      "id": "p",
      "kind": "product",
      "text": "Lấy một Pepsi, còn khoai giá nhiêu",
      "productId": "demo-pepsi"
    },
    {
      "id": "q",
      "kind": "quantity",
      "text": "Lấy một Pepsi, còn khoai giá nhiêu",
      "mode": "delta",
      "value": 1
    },
    {
      "id": "f",
      "kind": "product",
      "text": "Lấy một Pepsi, còn khoai giá nhiêu",
      "productId": "demo-fries"
    }
  ]
}
```

**Rationale nguồn:** Authored paraphrase 1: preserve add_item, ask_price; multi_intent, delta. Product bindings refer only to the supplied synthetic scope; no execution or menu claims.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `1a3dc073fb7a371dc6e37952b02f8ada160392480c5b46e0fc3fe2bbfed2ecf7`.

**Không có finding gốc N3.1; vẫn bắt buộc review.**

| Phương án | Lý do | Hệ quả |
|---|---|---|
| U-A — Giữ current golden như candidate sau review | Chưa có finding gốc; cần reviewer xác nhận từ evidence ở trên. | Không thay nguồn; chỉ có thể release sau quyết định thật, không đồng nghĩa auto-approved. |
| U-B — Đề nghị revision/alternative theo D01–D10 | Nếu thấy ambiguity hoặc giới hạn contract, ghi evidence và phương án cụ thể. | Tạo successor candidate/version và đánh giá lại group; không sửa nhãn gốc hoặc bỏ case để tăng điểm. |

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Quantity delta/absolute: Kiểm tra delta=1 đúng mục tiêu cart/pending_request; không tự tính final quantity hoặc lấy dung tích làm count.
- Other: Không có finding N3.1 không có nghĩa đã đúng. Đối chiếu surface, quantity, polarity, binding, capability và rationale độc lập.

**Đề xuất theo record, CHƯA DUYỆT:** Giữ semantic operation add_item, ask_price với delta=1 như một candidate chờ reviewer xác nhận; không tạo final quantity.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-HOLDMULTI-02

Batch B14 · queue 88 · P2_unflagged_still_pending · split test · group `single-holdmulti` · **pending**

**Câu gốc:** Thêm 1 Pepsi rồi báo giá khoai cho mình

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "add_item",
      "polarity": "affirmed",
      "targetId": "p",
      "quantityId": "q"
    },
    {
      "id": "j",
      "kind": "ask_price",
      "polarity": "affirmed",
      "targetIds": [
        "f"
      ]
    }
  ],
  "entities": [
    {
      "id": "p",
      "kind": "product",
      "text": "Thêm 1 Pepsi rồi báo giá khoai cho mình",
      "productId": "demo-pepsi"
    },
    {
      "id": "q",
      "kind": "quantity",
      "text": "Thêm 1 Pepsi rồi báo giá khoai cho mình",
      "mode": "delta",
      "value": 1
    },
    {
      "id": "f",
      "kind": "product",
      "text": "Thêm 1 Pepsi rồi báo giá khoai cho mình",
      "productId": "demo-fries"
    }
  ]
}
```

**Rationale nguồn:** Authored paraphrase 2: preserve add_item, ask_price; multi_intent, delta. Product bindings refer only to the supplied synthetic scope; no execution or menu claims.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `85943006ff8743af4609d733637793edd2933ec740e9c172725a2a3bb368003d`.

**Không có finding gốc N3.1; vẫn bắt buộc review.**

| Phương án | Lý do | Hệ quả |
|---|---|---|
| U-A — Giữ current golden như candidate sau review | Chưa có finding gốc; cần reviewer xác nhận từ evidence ở trên. | Không thay nguồn; chỉ có thể release sau quyết định thật, không đồng nghĩa auto-approved. |
| U-B — Đề nghị revision/alternative theo D01–D10 | Nếu thấy ambiguity hoặc giới hạn contract, ghi evidence và phương án cụ thể. | Tạo successor candidate/version và đánh giá lại group; không sửa nhãn gốc hoặc bỏ case để tăng điểm. |

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Quantity delta/absolute: Kiểm tra delta=1 đúng mục tiêu cart/pending_request; không tự tính final quantity hoặc lấy dung tích làm count.
- Other: Không có finding N3.1 không có nghĩa đã đúng. Đối chiếu surface, quantity, polarity, binding, capability và rationale độc lập.

**Đề xuất theo record, CHƯA DUYỆT:** Giữ semantic operation add_item, ask_price với delta=1 như một candidate chờ reviewer xác nhận; không tạo final quantity.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-MISSING-01

Batch B14 · queue 89 · P2_unflagged_still_pending · split train · group `single-missing` · **pending**

**Câu gốc:** Lấy hai phần giúp mình

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "needs_clarification",
  "missingSlots": [
    "product"
  ],
  "reason": "Quantity supplied without product",
  "intents": [
    {
      "id": "i",
      "kind": "add_item",
      "polarity": "affirmed",
      "targetId": null,
      "quantityId": "q"
    }
  ],
  "entities": [
    {
      "id": "q",
      "kind": "quantity",
      "text": "Lấy hai phần giúp mình",
      "mode": "delta",
      "value": 2
    }
  ]
}
```

**Rationale nguồn:** Authored paraphrase 1: preserve add_item; clarification. Product bindings refer only to the supplied synthetic scope; no execution or menu claims.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `47f0389a8a84dadeb07446d79755fbd07ef8edfa38ffc53e37dedb25ff2cbdda`.

**Không có finding gốc N3.1; vẫn bắt buộc review.**

| Phương án | Lý do | Hệ quả |
|---|---|---|
| U-A — Giữ current golden như candidate sau review | Chưa có finding gốc; cần reviewer xác nhận từ evidence ở trên. | Không thay nguồn; chỉ có thể release sau quyết định thật, không đồng nghĩa auto-approved. |
| U-B — Đề nghị revision/alternative theo D01–D10 | Nếu thấy ambiguity hoặc giới hạn contract, ghi evidence và phương án cụ thể. | Tạo successor candidate/version và đánh giá lại group; không sửa nhãn gốc hoặc bỏ case để tăng điểm. |

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Quantity delta/absolute: Kiểm tra delta=2 đúng mục tiêu cart/pending_request; không tự tính final quantity hoặc lấy dung tích làm count.
- Clarification policy: missingSlots hiện tại [product]: phân biệt toàn bộ slot thiếu với slot sẽ hỏi tiếp, không tự điền từ cart.
- Other: Không có finding N3.1 không có nghĩa đã đúng. Đối chiếu surface, quantity, polarity, binding, capability và rationale độc lập.

**Đề xuất theo record, CHƯA DUYỆT:** Giữ semantic operation add_item với delta=2 như một candidate chờ reviewer xác nhận; không tạo final quantity.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-MISSING-02

Batch B14 · queue 90 · P2_unflagged_still_pending · split train · group `single-missing` · **pending**

**Câu gốc:** Cho mình thêm 2 nhé

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "needs_clarification",
  "missingSlots": [
    "product"
  ],
  "reason": "Quantity supplied without product",
  "intents": [
    {
      "id": "i",
      "kind": "add_item",
      "polarity": "affirmed",
      "targetId": null,
      "quantityId": "q"
    }
  ],
  "entities": [
    {
      "id": "q",
      "kind": "quantity",
      "text": "Cho mình thêm 2 nhé",
      "mode": "delta",
      "value": 2
    }
  ]
}
```

**Rationale nguồn:** Authored paraphrase 2: preserve add_item; clarification. Product bindings refer only to the supplied synthetic scope; no execution or menu claims.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `09706dd32a0424c91881eaa9278925d53844c2a52d908b9079680c72b48585c8`.

**Không có finding gốc N3.1; vẫn bắt buộc review.**

| Phương án | Lý do | Hệ quả |
|---|---|---|
| U-A — Giữ current golden như candidate sau review | Chưa có finding gốc; cần reviewer xác nhận từ evidence ở trên. | Không thay nguồn; chỉ có thể release sau quyết định thật, không đồng nghĩa auto-approved. |
| U-B — Đề nghị revision/alternative theo D01–D10 | Nếu thấy ambiguity hoặc giới hạn contract, ghi evidence và phương án cụ thể. | Tạo successor candidate/version và đánh giá lại group; không sửa nhãn gốc hoặc bỏ case để tăng điểm. |

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Quantity delta/absolute: Kiểm tra delta=2 đúng mục tiêu cart/pending_request; không tự tính final quantity hoặc lấy dung tích làm count.
- Clarification policy: missingSlots hiện tại [product]: phân biệt toàn bộ slot thiếu với slot sẽ hỏi tiếp, không tự điền từ cart.
- Other: Không có finding N3.1 không có nghĩa đã đúng. Đối chiếu surface, quantity, polarity, binding, capability và rationale độc lập.

**Đề xuất theo record, CHƯA DUYỆT:** Giữ semantic operation add_item với delta=2 như một candidate chờ reviewer xác nhận; không tạo final quantity.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-MULTI-01

Batch B15 · queue 91 · P2_unflagged_still_pending · split train · group `single-multi` · **pending**

**Câu gốc:** Thêm hai Pepsi rồi cho xem giỏ

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "add_item",
      "polarity": "affirmed",
      "targetId": "p",
      "quantityId": "q"
    },
    {
      "id": "j",
      "kind": "view_cart",
      "polarity": "affirmed"
    }
  ],
  "entities": [
    {
      "id": "p",
      "kind": "product",
      "text": "Thêm hai Pepsi rồi cho xem giỏ",
      "productId": "demo-pepsi"
    },
    {
      "id": "q",
      "kind": "quantity",
      "text": "Thêm hai Pepsi rồi cho xem giỏ",
      "mode": "delta",
      "value": 2
    }
  ]
}
```

**Rationale nguồn:** Authored paraphrase 1: preserve add_item, view_cart; multi_intent, delta. Product bindings refer only to the supplied synthetic scope; no execution or menu claims.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `606197f9052c3dbcd4668848dee32a3f4f66015d09243591ca3c1ef81f4ce397`.

**Không có finding gốc N3.1; vẫn bắt buộc review.**

| Phương án | Lý do | Hệ quả |
|---|---|---|
| U-A — Giữ current golden như candidate sau review | Chưa có finding gốc; cần reviewer xác nhận từ evidence ở trên. | Không thay nguồn; chỉ có thể release sau quyết định thật, không đồng nghĩa auto-approved. |
| U-B — Đề nghị revision/alternative theo D01–D10 | Nếu thấy ambiguity hoặc giới hạn contract, ghi evidence và phương án cụ thể. | Tạo successor candidate/version và đánh giá lại group; không sửa nhãn gốc hoặc bỏ case để tăng điểm. |

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Quantity delta/absolute: Kiểm tra delta=2 đúng mục tiêu cart/pending_request; không tự tính final quantity hoặc lấy dung tích làm count.
- Other: Không có finding N3.1 không có nghĩa đã đúng. Đối chiếu surface, quantity, polarity, binding, capability và rationale độc lập.

**Đề xuất theo record, CHƯA DUYỆT:** Giữ semantic operation add_item, view_cart với delta=2 như một candidate chờ reviewer xác nhận; không tạo final quantity.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-MULTI-02

Batch B15 · queue 92 · P2_unflagged_still_pending · split train · group `single-multi` · **pending**

**Câu gốc:** Cho mình 2 Pepsi và xem lại giỏ

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "add_item",
      "polarity": "affirmed",
      "targetId": "p",
      "quantityId": "q"
    },
    {
      "id": "j",
      "kind": "view_cart",
      "polarity": "affirmed"
    }
  ],
  "entities": [
    {
      "id": "p",
      "kind": "product",
      "text": "Cho mình 2 Pepsi và xem lại giỏ",
      "productId": "demo-pepsi"
    },
    {
      "id": "q",
      "kind": "quantity",
      "text": "Cho mình 2 Pepsi và xem lại giỏ",
      "mode": "delta",
      "value": 2
    }
  ]
}
```

**Rationale nguồn:** Authored paraphrase 2: preserve add_item, view_cart; multi_intent, delta. Product bindings refer only to the supplied synthetic scope; no execution or menu claims.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `1bdcd680257268f409c11b516a5af0d806360637c5f7e78444416d233142bbf9`.

**Không có finding gốc N3.1; vẫn bắt buộc review.**

| Phương án | Lý do | Hệ quả |
|---|---|---|
| U-A — Giữ current golden như candidate sau review | Chưa có finding gốc; cần reviewer xác nhận từ evidence ở trên. | Không thay nguồn; chỉ có thể release sau quyết định thật, không đồng nghĩa auto-approved. |
| U-B — Đề nghị revision/alternative theo D01–D10 | Nếu thấy ambiguity hoặc giới hạn contract, ghi evidence và phương án cụ thể. | Tạo successor candidate/version và đánh giá lại group; không sửa nhãn gốc hoặc bỏ case để tăng điểm. |

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Quantity delta/absolute: Kiểm tra delta=2 đúng mục tiêu cart/pending_request; không tự tính final quantity hoặc lấy dung tích làm count.
- Other: Không có finding N3.1 không có nghĩa đã đúng. Đối chiếu surface, quantity, polarity, binding, capability và rationale độc lập.

**Đề xuất theo record, CHƯA DUYỆT:** Giữ semantic operation add_item, view_cart với delta=2 như một candidate chờ reviewer xác nhận; không tạo final quantity.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-NEG-01

Batch B15 · queue 93 · P2_unflagged_still_pending · split train · group `single-neg` · **pending**

**Câu gốc:** Đừng thêm hai Pepsi

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "add_item",
      "polarity": "negated",
      "targetId": "p",
      "quantityId": "q"
    }
  ],
  "entities": [
    {
      "id": "p",
      "kind": "product",
      "text": "Đừng thêm hai Pepsi",
      "productId": "demo-pepsi"
    },
    {
      "id": "q",
      "kind": "quantity",
      "text": "Đừng thêm hai Pepsi",
      "mode": "delta",
      "value": 2
    }
  ]
}
```

**Rationale nguồn:** Authored paraphrase 1: preserve add_item; negation. Product bindings refer only to the supplied synthetic scope; no execution or menu claims.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `afe5be5961b04502c2469871ba1972127aaddc51d94273b1973fb1f283c252e3`.

**Không có finding gốc N3.1; vẫn bắt buộc review.**

| Phương án | Lý do | Hệ quả |
|---|---|---|
| U-A — Giữ current golden như candidate sau review | Chưa có finding gốc; cần reviewer xác nhận từ evidence ở trên. | Không thay nguồn; chỉ có thể release sau quyết định thật, không đồng nghĩa auto-approved. |
| U-B — Đề nghị revision/alternative theo D01–D10 | Nếu thấy ambiguity hoặc giới hạn contract, ghi evidence và phương án cụ thể. | Tạo successor candidate/version và đánh giá lại group; không sửa nhãn gốc hoặc bỏ case để tăng điểm. |

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Quantity delta/absolute: Kiểm tra delta=2 đúng mục tiêu cart/pending_request; không tự tính final quantity hoặc lấy dung tích làm count.
- Negation/exclusion: Kiểm tra polarity của từng operation và exclusion theo target; không bỏ toàn bộ yêu cầu vì một phủ định.
- Other: Không có finding N3.1 không có nghĩa đã đúng. Đối chiếu surface, quantity, polarity, binding, capability và rationale độc lập.

**Đề xuất theo record, CHƯA DUYỆT:** Giữ semantic operation add_item [negated] với delta=2 như một candidate chờ reviewer xác nhận; không tạo final quantity.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-NEG-02

Batch B15 · queue 94 · P2_unflagged_still_pending · split train · group `single-neg` · **pending**

**Câu gốc:** Chưa lấy 2 Pepsi đâu

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "add_item",
      "polarity": "negated",
      "targetId": "p",
      "quantityId": "q"
    }
  ],
  "entities": [
    {
      "id": "p",
      "kind": "product",
      "text": "Chưa lấy 2 Pepsi đâu",
      "productId": "demo-pepsi"
    },
    {
      "id": "q",
      "kind": "quantity",
      "text": "Chưa lấy 2 Pepsi đâu",
      "mode": "delta",
      "value": 2
    }
  ]
}
```

**Rationale nguồn:** Authored paraphrase 2: preserve add_item; negation. Product bindings refer only to the supplied synthetic scope; no execution or menu claims.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `deb6b371dac0e8ae927ae437695f171c6eeca8be3e5878b3fda3d2b8ff6ba7f3`.

**Không có finding gốc N3.1; vẫn bắt buộc review.**

| Phương án | Lý do | Hệ quả |
|---|---|---|
| U-A — Giữ current golden như candidate sau review | Chưa có finding gốc; cần reviewer xác nhận từ evidence ở trên. | Không thay nguồn; chỉ có thể release sau quyết định thật, không đồng nghĩa auto-approved. |
| U-B — Đề nghị revision/alternative theo D01–D10 | Nếu thấy ambiguity hoặc giới hạn contract, ghi evidence và phương án cụ thể. | Tạo successor candidate/version và đánh giá lại group; không sửa nhãn gốc hoặc bỏ case để tăng điểm. |

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Quantity delta/absolute: Kiểm tra delta=2 đúng mục tiêu cart/pending_request; không tự tính final quantity hoặc lấy dung tích làm count.
- Negation/exclusion: Kiểm tra polarity của từng operation và exclusion theo target; không bỏ toàn bộ yêu cầu vì một phủ định.
- Other: Không có finding N3.1 không có nghĩa đã đúng. Đối chiếu surface, quantity, polarity, binding, capability và rationale độc lập.

**Đề xuất theo record, CHƯA DUYỆT:** Giữ semantic operation add_item [negated] với delta=2 như một candidate chờ reviewer xác nhận; không tạo final quantity.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-NODIAC-01

Batch B15 · queue 95 · P2_unflagged_still_pending · split train · group `single-nodiac` · **pending**

**Câu gốc:** doi pepsi thanh 3 phan

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "set_quantity",
      "polarity": "affirmed",
      "targetId": "p",
      "quantityId": "q"
    }
  ],
  "entities": [
    {
      "id": "p",
      "kind": "product",
      "text": "doi pepsi thanh 3 phan",
      "productId": "demo-pepsi"
    },
    {
      "id": "q",
      "kind": "quantity",
      "text": "doi pepsi thanh 3 phan",
      "mode": "absolute",
      "value": 3
    }
  ]
}
```

**Rationale nguồn:** Authored paraphrase 1: preserve set_quantity; unaccented, absolute. Product bindings refer only to the supplied synthetic scope; no execution or menu claims.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `25fde1aade446b303f5f36f3481300a41e3ae4bd186bd623694bc4bb840b2b5a`.

**Không có finding gốc N3.1; vẫn bắt buộc review.**

| Phương án | Lý do | Hệ quả |
|---|---|---|
| U-A — Giữ current golden như candidate sau review | Chưa có finding gốc; cần reviewer xác nhận từ evidence ở trên. | Không thay nguồn; chỉ có thể release sau quyết định thật, không đồng nghĩa auto-approved. |
| U-B — Đề nghị revision/alternative theo D01–D10 | Nếu thấy ambiguity hoặc giới hạn contract, ghi evidence và phương án cụ thể. | Tạo successor candidate/version và đánh giá lại group; không sửa nhãn gốc hoặc bỏ case để tăng điểm. |

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Quantity delta/absolute: Kiểm tra absolute=3 đúng mục tiêu cart/pending_request; không tự tính final quantity hoặc lấy dung tích làm count.
- Other: Không có finding N3.1 không có nghĩa đã đúng. Đối chiếu surface, quantity, polarity, binding, capability và rationale độc lập.

**Đề xuất theo record, CHƯA DUYỆT:** Giữ semantic operation set_quantity với absolute=3 như một candidate chờ reviewer xác nhận; không tạo final quantity.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-NODIAC-02

Batch B15 · queue 96 · P2_unflagged_still_pending · split train · group `single-nodiac` · **pending**

**Câu gốc:** sua pepsi con ba

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "set_quantity",
      "polarity": "affirmed",
      "targetId": "p",
      "quantityId": "q"
    }
  ],
  "entities": [
    {
      "id": "p",
      "kind": "product",
      "text": "sua pepsi con ba",
      "productId": "demo-pepsi"
    },
    {
      "id": "q",
      "kind": "quantity",
      "text": "sua pepsi con ba",
      "mode": "absolute",
      "value": 3
    }
  ]
}
```

**Rationale nguồn:** Authored paraphrase 2: preserve set_quantity; unaccented, absolute. Product bindings refer only to the supplied synthetic scope; no execution or menu claims.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `5f74e4981d6c178ed652c546de874ab05df2d65a83ca3702749c0b1e3bc451d0`.

**Không có finding gốc N3.1; vẫn bắt buộc review.**

| Phương án | Lý do | Hệ quả |
|---|---|---|
| U-A — Giữ current golden như candidate sau review | Chưa có finding gốc; cần reviewer xác nhận từ evidence ở trên. | Không thay nguồn; chỉ có thể release sau quyết định thật, không đồng nghĩa auto-approved. |
| U-B — Đề nghị revision/alternative theo D01–D10 | Nếu thấy ambiguity hoặc giới hạn contract, ghi evidence và phương án cụ thể. | Tạo successor candidate/version và đánh giá lại group; không sửa nhãn gốc hoặc bỏ case để tăng điểm. |

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Quantity delta/absolute: Kiểm tra absolute=3 đúng mục tiêu cart/pending_request; không tự tính final quantity hoặc lấy dung tích làm count.
- Other: Không có finding N3.1 không có nghĩa đã đúng. Đối chiếu surface, quantity, polarity, binding, capability và rationale độc lập.

**Đề xuất theo record, CHƯA DUYỆT:** Giữ semantic operation set_quantity với absolute=3 như một candidate chờ reviewer xác nhận; không tạo final quantity.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-OPT-01

Batch B15 · queue 97 · P2_unflagged_still_pending · split train · group `single-opt` · **pending**

**Câu gốc:** Cho mình hai Pepsi size lớn

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "add_item",
      "polarity": "affirmed",
      "targetId": "p",
      "quantityId": "q"
    }
  ],
  "entities": [
    {
      "id": "p",
      "kind": "product",
      "text": "Cho mình hai Pepsi size lớn",
      "productId": "demo-pepsi"
    },
    {
      "id": "q",
      "kind": "quantity",
      "text": "Cho mình hai Pepsi size lớn",
      "mode": "delta",
      "value": 2
    },
    {
      "id": "o",
      "kind": "option",
      "text": "Cho mình hai Pepsi size lớn",
      "targetId": "p",
      "optionId": "size",
      "valueId": "large"
    }
  ]
}
```

**Rationale nguồn:** Authored paraphrase 1: preserve add_item; natural. Product bindings refer only to the supplied synthetic scope; no execution or menu claims.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `c22c96e51cd4efbe5de64add2c44c962f862f4f18e8eebaa69fb8a271748e3ff`.

**Không có finding gốc N3.1; vẫn bắt buộc review.**

| Phương án | Lý do | Hệ quả |
|---|---|---|
| U-A — Giữ current golden như candidate sau review | Chưa có finding gốc; cần reviewer xác nhận từ evidence ở trên. | Không thay nguồn; chỉ có thể release sau quyết định thật, không đồng nghĩa auto-approved. |
| U-B — Đề nghị revision/alternative theo D01–D10 | Nếu thấy ambiguity hoặc giới hạn contract, ghi evidence và phương án cụ thể. | Tạo successor candidate/version và đánh giá lại group; không sửa nhãn gốc hoặc bỏ case để tăng điểm. |

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Quantity delta/absolute: Kiểm tra delta=2 đúng mục tiêu cart/pending_request; không tự tính final quantity hoặc lấy dung tích làm count.
- Other: Không có finding N3.1 không có nghĩa đã đúng. Đối chiếu surface, quantity, polarity, binding, capability và rationale độc lập.

**Đề xuất theo record, CHƯA DUYỆT:** Giữ semantic operation add_item với delta=2 như một candidate chờ reviewer xác nhận; không tạo final quantity.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-OPT-02

Batch B15 · queue 98 · P2_unflagged_still_pending · split train · group `single-opt` · **pending**

**Câu gốc:** Lấy 2 Pepsi chọn cỡ large

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "add_item",
      "polarity": "affirmed",
      "targetId": "p",
      "quantityId": "q"
    }
  ],
  "entities": [
    {
      "id": "p",
      "kind": "product",
      "text": "Lấy 2 Pepsi chọn cỡ large",
      "productId": "demo-pepsi"
    },
    {
      "id": "q",
      "kind": "quantity",
      "text": "Lấy 2 Pepsi chọn cỡ large",
      "mode": "delta",
      "value": 2
    },
    {
      "id": "o",
      "kind": "option",
      "text": "Lấy 2 Pepsi chọn cỡ large",
      "targetId": "p",
      "optionId": "size",
      "valueId": "large"
    }
  ]
}
```

**Rationale nguồn:** Authored paraphrase 2: preserve add_item; natural. Product bindings refer only to the supplied synthetic scope; no execution or menu claims.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `dbd12f7656bf38375d43fa7a26ab52ab2ae9f25ac31b990141c2218dbc34b509`.

**Không có finding gốc N3.1; vẫn bắt buộc review.**

| Phương án | Lý do | Hệ quả |
|---|---|---|
| U-A — Giữ current golden như candidate sau review | Chưa có finding gốc; cần reviewer xác nhận từ evidence ở trên. | Không thay nguồn; chỉ có thể release sau quyết định thật, không đồng nghĩa auto-approved. |
| U-B — Đề nghị revision/alternative theo D01–D10 | Nếu thấy ambiguity hoặc giới hạn contract, ghi evidence và phương án cụ thể. | Tạo successor candidate/version và đánh giá lại group; không sửa nhãn gốc hoặc bỏ case để tăng điểm. |

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Quantity delta/absolute: Kiểm tra delta=2 đúng mục tiêu cart/pending_request; không tự tính final quantity hoặc lấy dung tích làm count.
- Other: Không có finding N3.1 không có nghĩa đã đúng. Đối chiếu surface, quantity, polarity, binding, capability và rationale độc lập.

**Đề xuất theo record, CHƯA DUYỆT:** Giữ semantic operation add_item với delta=2 như một candidate chờ reviewer xác nhận; không tạo final quantity.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-PREF-01

Batch B16 · queue 99 · P2_unflagged_still_pending · split train · group `single-pref` · **pending**

**Câu gốc:** Cho mình hai burger không cay

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "add_item",
      "polarity": "affirmed",
      "targetId": "p",
      "quantityId": "q"
    }
  ],
  "entities": [
    {
      "id": "p",
      "kind": "product",
      "text": "Cho mình hai burger không cay",
      "productId": "demo-burger"
    },
    {
      "id": "q",
      "kind": "quantity",
      "text": "Cho mình hai burger không cay",
      "mode": "delta",
      "value": 2
    },
    {
      "id": "pref",
      "kind": "preference",
      "text": "Cho mình hai burger không cay",
      "targetId": "p",
      "attribute": "spice",
      "operator": "neq",
      "value": "hot"
    }
  ]
}
```

**Rationale nguồn:** Authored paraphrase 1: preserve add_item; exclusion, negation. Product bindings refer only to the supplied synthetic scope; no execution or menu claims.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `3692ff9bc7f1ca2feb4e8edc23741dfe6eabbfc9e836f3977d360fc592bbb8a0`.

**Không có finding gốc N3.1; vẫn bắt buộc review.**

| Phương án | Lý do | Hệ quả |
|---|---|---|
| U-A — Giữ current golden như candidate sau review | Chưa có finding gốc; cần reviewer xác nhận từ evidence ở trên. | Không thay nguồn; chỉ có thể release sau quyết định thật, không đồng nghĩa auto-approved. |
| U-B — Đề nghị revision/alternative theo D01–D10 | Nếu thấy ambiguity hoặc giới hạn contract, ghi evidence và phương án cụ thể. | Tạo successor candidate/version và đánh giá lại group; không sửa nhãn gốc hoặc bỏ case để tăng điểm. |

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Quantity delta/absolute: Kiểm tra delta=2 đúng mục tiêu cart/pending_request; không tự tính final quantity hoặc lấy dung tích làm count.
- Negation/exclusion: Kiểm tra polarity của từng operation và exclusion theo target; không bỏ toàn bộ yêu cầu vì một phủ định.
- Other: Không có finding N3.1 không có nghĩa đã đúng. Đối chiếu surface, quantity, polarity, binding, capability và rationale độc lập.

**Đề xuất theo record, CHƯA DUYỆT:** Giữ semantic operation add_item với delta=2 như một candidate chờ reviewer xác nhận; không tạo final quantity.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-PREF-02

Batch B16 · queue 100 · P2_unflagged_still_pending · split train · group `single-pref` · **pending**

**Câu gốc:** Lấy 2 burger nhưng tránh loại cay

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "add_item",
      "polarity": "affirmed",
      "targetId": "p",
      "quantityId": "q"
    }
  ],
  "entities": [
    {
      "id": "p",
      "kind": "product",
      "text": "Lấy 2 burger nhưng tránh loại cay",
      "productId": "demo-burger"
    },
    {
      "id": "q",
      "kind": "quantity",
      "text": "Lấy 2 burger nhưng tránh loại cay",
      "mode": "delta",
      "value": 2
    },
    {
      "id": "pref",
      "kind": "preference",
      "text": "Lấy 2 burger nhưng tránh loại cay",
      "targetId": "p",
      "attribute": "spice",
      "operator": "neq",
      "value": "hot"
    }
  ]
}
```

**Rationale nguồn:** Authored paraphrase 2: preserve add_item; exclusion, negation. Product bindings refer only to the supplied synthetic scope; no execution or menu claims.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `0e54a24d946fb9f0155417a726b9fdab8671a7659fd5e66cfabd9f63626c9f17`.

**Không có finding gốc N3.1; vẫn bắt buộc review.**

| Phương án | Lý do | Hệ quả |
|---|---|---|
| U-A — Giữ current golden như candidate sau review | Chưa có finding gốc; cần reviewer xác nhận từ evidence ở trên. | Không thay nguồn; chỉ có thể release sau quyết định thật, không đồng nghĩa auto-approved. |
| U-B — Đề nghị revision/alternative theo D01–D10 | Nếu thấy ambiguity hoặc giới hạn contract, ghi evidence và phương án cụ thể. | Tạo successor candidate/version và đánh giá lại group; không sửa nhãn gốc hoặc bỏ case để tăng điểm. |

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Quantity delta/absolute: Kiểm tra delta=2 đúng mục tiêu cart/pending_request; không tự tính final quantity hoặc lấy dung tích làm count.
- Negation/exclusion: Kiểm tra polarity của từng operation và exclusion theo target; không bỏ toàn bộ yêu cầu vì một phủ định.
- Other: Không có finding N3.1 không có nghĩa đã đúng. Đối chiếu surface, quantity, polarity, binding, capability và rationale độc lập.

**Đề xuất theo record, CHƯA DUYỆT:** Giữ semantic operation add_item với delta=2 như một candidate chờ reviewer xác nhận; không tạo final quantity.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-TEEN-01

Batch B16 · queue 101 · P2_unflagged_still_pending · split train · group `single-teen` · **pending**

**Câu gốc:** mk lấy 2 pepsi nha

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "add_item",
      "polarity": "affirmed",
      "targetId": "p",
      "quantityId": "q"
    }
  ],
  "entities": [
    {
      "id": "p",
      "kind": "product",
      "text": "mk lấy 2 pepsi nha",
      "productId": "demo-pepsi"
    },
    {
      "id": "q",
      "kind": "quantity",
      "text": "mk lấy 2 pepsi nha",
      "mode": "delta",
      "value": 2
    }
  ]
}
```

**Rationale nguồn:** Authored paraphrase 1: preserve add_item; teencode, abbreviation, delta. Product bindings refer only to the supplied synthetic scope; no execution or menu claims.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `b8f774c919b4797c941759b321cfc1551dab5224231dc997df75389e8bc4b8d6`.

**Không có finding gốc N3.1; vẫn bắt buộc review.**

| Phương án | Lý do | Hệ quả |
|---|---|---|
| U-A — Giữ current golden như candidate sau review | Chưa có finding gốc; cần reviewer xác nhận từ evidence ở trên. | Không thay nguồn; chỉ có thể release sau quyết định thật, không đồng nghĩa auto-approved. |
| U-B — Đề nghị revision/alternative theo D01–D10 | Nếu thấy ambiguity hoặc giới hạn contract, ghi evidence và phương án cụ thể. | Tạo successor candidate/version và đánh giá lại group; không sửa nhãn gốc hoặc bỏ case để tăng điểm. |

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Quantity delta/absolute: Kiểm tra delta=2 đúng mục tiêu cart/pending_request; không tự tính final quantity hoặc lấy dung tích làm count.
- Other: Không có finding N3.1 không có nghĩa đã đúng. Đối chiếu surface, quantity, polarity, binding, capability và rationale độc lập.

**Đề xuất theo record, CHƯA DUYỆT:** Giữ semantic operation add_item với delta=2 như một candidate chờ reviewer xác nhận; không tạo final quantity.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-TEEN-02

Batch B16 · queue 102 · P2_unflagged_still_pending · split train · group `single-teen` · **pending**

**Câu gốc:** cho mk hai Pepsi đc ko

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "add_item",
      "polarity": "affirmed",
      "targetId": "p",
      "quantityId": "q"
    }
  ],
  "entities": [
    {
      "id": "p",
      "kind": "product",
      "text": "cho mk hai Pepsi đc ko",
      "productId": "demo-pepsi"
    },
    {
      "id": "q",
      "kind": "quantity",
      "text": "cho mk hai Pepsi đc ko",
      "mode": "delta",
      "value": 2
    }
  ]
}
```

**Rationale nguồn:** Authored paraphrase 2: preserve add_item; teencode, abbreviation, delta. Product bindings refer only to the supplied synthetic scope; no execution or menu claims.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `113e87ee3d98362213f06ba453b5f8ad4bb02d925c20f2c74afdd9e938421109`.

**Không có finding gốc N3.1; vẫn bắt buộc review.**

| Phương án | Lý do | Hệ quả |
|---|---|---|
| U-A — Giữ current golden như candidate sau review | Chưa có finding gốc; cần reviewer xác nhận từ evidence ở trên. | Không thay nguồn; chỉ có thể release sau quyết định thật, không đồng nghĩa auto-approved. |
| U-B — Đề nghị revision/alternative theo D01–D10 | Nếu thấy ambiguity hoặc giới hạn contract, ghi evidence và phương án cụ thể. | Tạo successor candidate/version và đánh giá lại group; không sửa nhãn gốc hoặc bỏ case để tăng điểm. |

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Quantity delta/absolute: Kiểm tra delta=2 đúng mục tiêu cart/pending_request; không tự tính final quantity hoặc lấy dung tích làm count.
- Other: Không có finding N3.1 không có nghĩa đã đúng. Đối chiếu surface, quantity, polarity, binding, capability và rationale độc lập.

**Đề xuất theo record, CHƯA DUYỆT:** Giữ semantic operation add_item với delta=2 như một candidate chờ reviewer xác nhận; không tạo final quantity.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-TYPO-01

Batch B16 · queue 103 · P2_unflagged_still_pending · split train · group `single-typo` · **pending**

**Câu gốc:** Cho tôi hai Pesi

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "add_item",
      "polarity": "affirmed",
      "targetId": "p",
      "quantityId": "q"
    }
  ],
  "entities": [
    {
      "id": "p",
      "kind": "product",
      "text": "Cho tôi hai Pesi",
      "productId": "demo-pepsi"
    },
    {
      "id": "q",
      "kind": "quantity",
      "text": "Cho tôi hai Pesi",
      "mode": "delta",
      "value": 2
    }
  ]
}
```

**Rationale nguồn:** Authored paraphrase 1: preserve add_item; typo, delta. Product bindings refer only to the supplied synthetic scope; no execution or menu claims.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `9aa2478cc0c70fac9e3856aa0688eec307d88555243f63c4a2a11a23ca1b39e1`.

**Không có finding gốc N3.1; vẫn bắt buộc review.**

| Phương án | Lý do | Hệ quả |
|---|---|---|
| U-A — Giữ current golden như candidate sau review | Chưa có finding gốc; cần reviewer xác nhận từ evidence ở trên. | Không thay nguồn; chỉ có thể release sau quyết định thật, không đồng nghĩa auto-approved. |
| U-B — Đề nghị revision/alternative theo D01–D10 | Nếu thấy ambiguity hoặc giới hạn contract, ghi evidence và phương án cụ thể. | Tạo successor candidate/version và đánh giá lại group; không sửa nhãn gốc hoặc bỏ case để tăng điểm. |

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Quantity delta/absolute: Kiểm tra delta=2 đúng mục tiêu cart/pending_request; không tự tính final quantity hoặc lấy dung tích làm count.
- Other: Không có finding N3.1 không có nghĩa đã đúng. Đối chiếu surface, quantity, polarity, binding, capability và rationale độc lập.

**Đề xuất theo record, CHƯA DUYỆT:** Giữ semantic operation add_item với delta=2 như một candidate chờ reviewer xác nhận; không tạo final quantity.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-TYPO-02

Batch B16 · queue 104 · P2_unflagged_still_pending · split train · group `single-typo` · **pending**

**Câu gốc:** Lấy dùm hai Pepsii

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "add_item",
      "polarity": "affirmed",
      "targetId": "p",
      "quantityId": "q"
    }
  ],
  "entities": [
    {
      "id": "p",
      "kind": "product",
      "text": "Lấy dùm hai Pepsii",
      "productId": "demo-pepsi"
    },
    {
      "id": "q",
      "kind": "quantity",
      "text": "Lấy dùm hai Pepsii",
      "mode": "delta",
      "value": 2
    }
  ]
}
```

**Rationale nguồn:** Authored paraphrase 2: preserve add_item; typo, delta. Product bindings refer only to the supplied synthetic scope; no execution or menu claims.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `62d5bfb24e6f111861c9510e63d81e286eb6d11d00d5327d923713c1cb386e96`.

**Không có finding gốc N3.1; vẫn bắt buộc review.**

| Phương án | Lý do | Hệ quả |
|---|---|---|
| U-A — Giữ current golden như candidate sau review | Chưa có finding gốc; cần reviewer xác nhận từ evidence ở trên. | Không thay nguồn; chỉ có thể release sau quyết định thật, không đồng nghĩa auto-approved. |
| U-B — Đề nghị revision/alternative theo D01–D10 | Nếu thấy ambiguity hoặc giới hạn contract, ghi evidence và phương án cụ thể. | Tạo successor candidate/version và đánh giá lại group; không sửa nhãn gốc hoặc bỏ case để tăng điểm. |

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Quantity delta/absolute: Kiểm tra delta=2 đúng mục tiêu cart/pending_request; không tự tính final quantity hoặc lấy dung tích làm count.
- Other: Không có finding N3.1 không có nghĩa đã đúng. Đối chiếu surface, quantity, polarity, binding, capability và rationale độc lập.

**Đề xuất theo record, CHƯA DUYỆT:** Giữ semantic operation add_item với delta=2 như một candidate chờ reviewer xác nhận; không tạo final quantity.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-VOLUME-01

Batch B16 · queue 105 · P2_unflagged_still_pending · split train · group `single-volume` · **pending**

**Câu gốc:** Lấy hai chai Pepsi 1.5L

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "add_item",
      "polarity": "affirmed",
      "targetId": "p",
      "quantityId": "q"
    }
  ],
  "entities": [
    {
      "id": "p",
      "kind": "product",
      "text": "Lấy hai chai Pepsi 1.5L",
      "productId": "demo-pepsi"
    },
    {
      "id": "q",
      "kind": "quantity",
      "text": "Lấy hai chai Pepsi 1.5L",
      "mode": "delta",
      "value": 2
    },
    {
      "id": "v",
      "kind": "volume",
      "text": "Lấy hai chai Pepsi 1.5L",
      "value": 1500,
      "unit": "ml",
      "targetId": "p"
    }
  ]
}
```

**Rationale nguồn:** Authored paraphrase 1: preserve add_item; volume, delta. Product bindings refer only to the supplied synthetic scope; no execution or menu claims.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `42b853d5096a2fd1bbf28287a4c5188420211c65189e66a78c06ddc8a85ca07b`.

**Không có finding gốc N3.1; vẫn bắt buộc review.**

| Phương án | Lý do | Hệ quả |
|---|---|---|
| U-A — Giữ current golden như candidate sau review | Chưa có finding gốc; cần reviewer xác nhận từ evidence ở trên. | Không thay nguồn; chỉ có thể release sau quyết định thật, không đồng nghĩa auto-approved. |
| U-B — Đề nghị revision/alternative theo D01–D10 | Nếu thấy ambiguity hoặc giới hạn contract, ghi evidence và phương án cụ thể. | Tạo successor candidate/version và đánh giá lại group; không sửa nhãn gốc hoặc bỏ case để tăng điểm. |

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Quantity delta/absolute: Kiểm tra delta=2 đúng mục tiêu cart/pending_request; không tự tính final quantity hoặc lấy dung tích làm count.
- Other: Không có finding N3.1 không có nghĩa đã đúng. Đối chiếu surface, quantity, polarity, binding, capability và rationale độc lập.

**Đề xuất theo record, CHƯA DUYỆT:** Giữ semantic operation add_item với delta=2 như một candidate chờ reviewer xác nhận; không tạo final quantity.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-VOLUME-02

Batch B16 · queue 106 · P2_unflagged_still_pending · split train · group `single-volume` · **pending**

**Câu gốc:** Cho tôi 2 Pepsi dung tích 1500ml

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "add_item",
      "polarity": "affirmed",
      "targetId": "p",
      "quantityId": "q"
    }
  ],
  "entities": [
    {
      "id": "p",
      "kind": "product",
      "text": "Cho tôi 2 Pepsi dung tích 1500ml",
      "productId": "demo-pepsi"
    },
    {
      "id": "q",
      "kind": "quantity",
      "text": "Cho tôi 2 Pepsi dung tích 1500ml",
      "mode": "delta",
      "value": 2
    },
    {
      "id": "v",
      "kind": "volume",
      "text": "Cho tôi 2 Pepsi dung tích 1500ml",
      "value": 1500,
      "unit": "ml",
      "targetId": "p"
    }
  ]
}
```

**Rationale nguồn:** Authored paraphrase 2: preserve add_item; volume, delta. Product bindings refer only to the supplied synthetic scope; no execution or menu claims.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `dc8ae559e84d188eccbf8e848b12725ed993bf332531b71b7a09035f117fb477`.

**Không có finding gốc N3.1; vẫn bắt buộc review.**

| Phương án | Lý do | Hệ quả |
|---|---|---|
| U-A — Giữ current golden như candidate sau review | Chưa có finding gốc; cần reviewer xác nhận từ evidence ở trên. | Không thay nguồn; chỉ có thể release sau quyết định thật, không đồng nghĩa auto-approved. |
| U-B — Đề nghị revision/alternative theo D01–D10 | Nếu thấy ambiguity hoặc giới hạn contract, ghi evidence và phương án cụ thể. | Tạo successor candidate/version và đánh giá lại group; không sửa nhãn gốc hoặc bỏ case để tăng điểm. |

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Quantity delta/absolute: Kiểm tra delta=2 đúng mục tiêu cart/pending_request; không tự tính final quantity hoặc lấy dung tích làm count.
- Other: Không có finding N3.1 không có nghĩa đã đúng. Đối chiếu surface, quantity, polarity, binding, capability và rationale độc lập.

**Đề xuất theo record, CHƯA DUYỆT:** Giữ semantic operation add_item với delta=2 như một candidate chờ reviewer xác nhận; không tạo final quantity.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-ASSENT-01

Batch B17 · queue 107 · P2_unflagged_still_pending · split train · group `single-assent` · **pending**

**Câu gốc:** ok bạn

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "express_assent",
      "polarity": "affirmed"
    }
  ],
  "entities": []
}
```

**Rationale nguồn:** Authored paraphrase 1: preserve express_assent; natural. Product bindings refer only to the supplied synthetic scope; no execution or menu claims.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `b47035b940b94a7e086ca89b026d3b8a52ff28782b6c68ca4e02d1acb6c81d63`.

**Không có finding gốc N3.1; vẫn bắt buộc review.**

| Phương án | Lý do | Hệ quả |
|---|---|---|
| U-A — Giữ current golden như candidate sau review | Chưa có finding gốc; cần reviewer xác nhận từ evidence ở trên. | Không thay nguồn; chỉ có thể release sau quyết định thật, không đồng nghĩa auto-approved. |
| U-B — Đề nghị revision/alternative theo D01–D10 | Nếu thấy ambiguity hoặc giới hạn contract, ghi evidence và phương án cụ thể. | Tạo successor candidate/version và đánh giá lại group; không sửa nhãn gốc hoặc bỏ case để tăng điểm. |

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Other: Không có finding N3.1 không có nghĩa đã đúng. Đối chiếu surface, quantity, polarity, binding, capability và rationale độc lập.

**Đề xuất theo record, CHƯA DUYỆT:** Giữ express_assent như candidate nếu reviewer thấy đúng với utterance/context; không suy thực thi hoặc menu fact từ intent.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-ASSENT-02

Batch B17 · queue 108 · P2_unflagged_still_pending · split train · group `single-assent` · **pending**

**Câu gốc:** ừ mình đồng ý

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "express_assent",
      "polarity": "affirmed"
    }
  ],
  "entities": []
}
```

**Rationale nguồn:** Authored paraphrase 2: preserve express_assent; natural. Product bindings refer only to the supplied synthetic scope; no execution or menu claims.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `e2562887f04f3756f1b4be770259e86a5c4a5403e1d222611225f0615c334d4d`.

**Không có finding gốc N3.1; vẫn bắt buộc review.**

| Phương án | Lý do | Hệ quả |
|---|---|---|
| U-A — Giữ current golden như candidate sau review | Chưa có finding gốc; cần reviewer xác nhận từ evidence ở trên. | Không thay nguồn; chỉ có thể release sau quyết định thật, không đồng nghĩa auto-approved. |
| U-B — Đề nghị revision/alternative theo D01–D10 | Nếu thấy ambiguity hoặc giới hạn contract, ghi evidence và phương án cụ thể. | Tạo successor candidate/version và đánh giá lại group; không sửa nhãn gốc hoặc bỏ case để tăng điểm. |

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Other: Không có finding N3.1 không có nghĩa đã đúng. Đối chiếu surface, quantity, polarity, binding, capability và rationale độc lập.

**Đề xuất theo record, CHƯA DUYỆT:** Giữ express_assent như candidate nếu reviewer thấy đúng với utterance/context; không suy thực thi hoặc menu fact từ intent.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-BN-01

Batch B17 · queue 109 · P2_unflagged_still_pending · split dev · group `single-bn` · **pending**

**Câu gốc:** Pepsi bn tiền vậy

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "ask_price",
      "polarity": "affirmed",
      "targetIds": [
        "p"
      ]
    }
  ],
  "entities": [
    {
      "id": "p",
      "kind": "product",
      "text": "Pepsi bn tiền vậy",
      "productId": "demo-pepsi"
    }
  ]
}
```

**Rationale nguồn:** Authored paraphrase 1: preserve ask_price; abbreviation, natural. Product bindings refer only to the supplied synthetic scope; no execution or menu claims.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `397cfa99e48aa5a8e7cd43d8cc83dbd78cf0edab371126445aeebcf47e26cecf`.

**Không có finding gốc N3.1; vẫn bắt buộc review.**

| Phương án | Lý do | Hệ quả |
|---|---|---|
| U-A — Giữ current golden như candidate sau review | Chưa có finding gốc; cần reviewer xác nhận từ evidence ở trên. | Không thay nguồn; chỉ có thể release sau quyết định thật, không đồng nghĩa auto-approved. |
| U-B — Đề nghị revision/alternative theo D01–D10 | Nếu thấy ambiguity hoặc giới hạn contract, ghi evidence và phương án cụ thể. | Tạo successor candidate/version và đánh giá lại group; không sửa nhãn gốc hoặc bỏ case để tăng điểm. |

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Other: Không có finding N3.1 không có nghĩa đã đúng. Đối chiếu surface, quantity, polarity, binding, capability và rationale độc lập.

**Đề xuất theo record, CHƯA DUYỆT:** Giữ ask_price như candidate nếu reviewer thấy đúng với utterance/context; không suy thực thi hoặc menu fact từ intent.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-BN-02

Batch B17 · queue 110 · P2_unflagged_still_pending · split dev · group `single-bn` · **pending**

**Câu gốc:** Pepsi giá bn hả bạn

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "ask_price",
      "polarity": "affirmed",
      "targetIds": [
        "p"
      ]
    }
  ],
  "entities": [
    {
      "id": "p",
      "kind": "product",
      "text": "Pepsi giá bn hả bạn",
      "productId": "demo-pepsi"
    }
  ]
}
```

**Rationale nguồn:** Authored paraphrase 2: preserve ask_price; abbreviation, natural. Product bindings refer only to the supplied synthetic scope; no execution or menu claims.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `3d6f8ced7d109d7b19de6bd42e5f591c0ee498c64029be5849198dfdbe332768`.

**Không có finding gốc N3.1; vẫn bắt buộc review.**

| Phương án | Lý do | Hệ quả |
|---|---|---|
| U-A — Giữ current golden như candidate sau review | Chưa có finding gốc; cần reviewer xác nhận từ evidence ở trên. | Không thay nguồn; chỉ có thể release sau quyết định thật, không đồng nghĩa auto-approved. |
| U-B — Đề nghị revision/alternative theo D01–D10 | Nếu thấy ambiguity hoặc giới hạn contract, ghi evidence và phương án cụ thể. | Tạo successor candidate/version và đánh giá lại group; không sửa nhãn gốc hoặc bỏ case để tăng điểm. |

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Other: Không có finding N3.1 không có nghĩa đã đúng. Đối chiếu surface, quantity, polarity, binding, capability và rationale độc lập.

**Đề xuất theo record, CHƯA DUYỆT:** Giữ ask_price như candidate nếu reviewer thấy đúng với utterance/context; không suy thực thi hoặc menu fact từ intent.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-CANCEL-01

Batch B17 · queue 111 · P2_unflagged_still_pending · split train · group `single-cancel` · **pending**

**Câu gốc:** Bỏ đề xuất vừa rồi đi

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "cancel_proposal",
      "polarity": "affirmed"
    }
  ],
  "entities": []
}
```

**Rationale nguồn:** Authored paraphrase 1: preserve cancel_proposal; natural. Product bindings refer only to the supplied synthetic scope; no execution or menu claims.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `18277ce2f07f48b429f247722ab3ae65b129381c3ab55ded609b89d0b97a4096`.

**Không có finding gốc N3.1; vẫn bắt buộc review.**

| Phương án | Lý do | Hệ quả |
|---|---|---|
| U-A — Giữ current golden như candidate sau review | Chưa có finding gốc; cần reviewer xác nhận từ evidence ở trên. | Không thay nguồn; chỉ có thể release sau quyết định thật, không đồng nghĩa auto-approved. |
| U-B — Đề nghị revision/alternative theo D01–D10 | Nếu thấy ambiguity hoặc giới hạn contract, ghi evidence và phương án cụ thể. | Tạo successor candidate/version và đánh giá lại group; không sửa nhãn gốc hoặc bỏ case để tăng điểm. |

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Other: Không có finding N3.1 không có nghĩa đã đúng. Đối chiếu surface, quantity, polarity, binding, capability và rationale độc lập.

**Đề xuất theo record, CHƯA DUYỆT:** Giữ cancel_proposal như candidate nếu reviewer thấy đúng với utterance/context; không suy thực thi hoặc menu fact từ intent.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-CANCEL-02

Batch B17 · queue 112 · P2_unflagged_still_pending · split train · group `single-cancel` · **pending**

**Câu gốc:** Mình không muốn tiếp tục đề xuất đó

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "cancel_proposal",
      "polarity": "affirmed"
    }
  ],
  "entities": []
}
```

**Rationale nguồn:** Authored paraphrase 2: preserve cancel_proposal; natural. Product bindings refer only to the supplied synthetic scope; no execution or menu claims.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `41c7e36392d3aacb689e6ac549baf00ff56b8c2f9eac349ae8a75b9522c28233`.

**Không có finding gốc N3.1; vẫn bắt buộc review.**

| Phương án | Lý do | Hệ quả |
|---|---|---|
| U-A — Giữ current golden như candidate sau review | Chưa có finding gốc; cần reviewer xác nhận từ evidence ở trên. | Không thay nguồn; chỉ có thể release sau quyết định thật, không đồng nghĩa auto-approved. |
| U-B — Đề nghị revision/alternative theo D01–D10 | Nếu thấy ambiguity hoặc giới hạn contract, ghi evidence và phương án cụ thể. | Tạo successor candidate/version và đánh giá lại group; không sửa nhãn gốc hoặc bỏ case để tăng điểm. |

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Other: Không có finding N3.1 không có nghĩa đã đúng. Đối chiếu surface, quantity, polarity, binding, capability và rationale độc lập.

**Đề xuất theo record, CHƯA DUYỆT:** Giữ cancel_proposal như candidate nếu reviewer thấy đúng với utterance/context; không suy thực thi hoặc menu fact từ intent.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-CART-01

Batch B17 · queue 113 · P2_unflagged_still_pending · split train · group `single-cart` · **pending**

**Câu gốc:** Cho mình kiểm tra giỏ nhé

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "view_cart",
      "polarity": "affirmed"
    }
  ],
  "entities": []
}
```

**Rationale nguồn:** Authored paraphrase 1: preserve view_cart; natural. Product bindings refer only to the supplied synthetic scope; no execution or menu claims.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `3535d6eb1e1aa72f6a69cc8053d095b56a52d03557eb8b673c260c6096bd1cd6`.

**Không có finding gốc N3.1; vẫn bắt buộc review.**

| Phương án | Lý do | Hệ quả |
|---|---|---|
| U-A — Giữ current golden như candidate sau review | Chưa có finding gốc; cần reviewer xác nhận từ evidence ở trên. | Không thay nguồn; chỉ có thể release sau quyết định thật, không đồng nghĩa auto-approved. |
| U-B — Đề nghị revision/alternative theo D01–D10 | Nếu thấy ambiguity hoặc giới hạn contract, ghi evidence và phương án cụ thể. | Tạo successor candidate/version và đánh giá lại group; không sửa nhãn gốc hoặc bỏ case để tăng điểm. |

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Other: Không có finding N3.1 không có nghĩa đã đúng. Đối chiếu surface, quantity, polarity, binding, capability và rationale độc lập.

**Đề xuất theo record, CHƯA DUYỆT:** Giữ view_cart như candidate nếu reviewer thấy đúng với utterance/context; không suy thực thi hoặc menu fact từ intent.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-CART-02

Batch B17 · queue 114 · P2_unflagged_still_pending · split train · group `single-cart` · **pending**

**Câu gốc:** Mình đang có những gì trong giỏ

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "view_cart",
      "polarity": "affirmed"
    }
  ],
  "entities": []
}
```

**Rationale nguồn:** Authored paraphrase 2: preserve view_cart; natural. Product bindings refer only to the supplied synthetic scope; no execution or menu claims.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `34494c653019d8927e863d6de27245eebcbbbf12cc48763e675631523e41b873`.

**Không có finding gốc N3.1; vẫn bắt buộc review.**

| Phương án | Lý do | Hệ quả |
|---|---|---|
| U-A — Giữ current golden như candidate sau review | Chưa có finding gốc; cần reviewer xác nhận từ evidence ở trên. | Không thay nguồn; chỉ có thể release sau quyết định thật, không đồng nghĩa auto-approved. |
| U-B — Đề nghị revision/alternative theo D01–D10 | Nếu thấy ambiguity hoặc giới hạn contract, ghi evidence và phương án cụ thể. | Tạo successor candidate/version và đánh giá lại group; không sửa nhãn gốc hoặc bỏ case để tăng điểm. |

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Other: Không có finding N3.1 không có nghĩa đã đúng. Đối chiếu surface, quantity, polarity, binding, capability và rationale độc lập.

**Đề xuất theo record, CHƯA DUYỆT:** Giữ view_cart như candidate nếu reviewer thấy đúng với utterance/context; không suy thực thi hoặc menu fact từ intent.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-CLEAR-01

Batch B18 · queue 115 · P2_unflagged_still_pending · split train · group `single-clear` · **pending**

**Câu gốc:** Làm rỗng toàn bộ giỏ giúp mình

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "clear_cart",
      "polarity": "affirmed"
    }
  ],
  "entities": []
}
```

**Rationale nguồn:** Authored paraphrase 1: preserve clear_cart; natural. Product bindings refer only to the supplied synthetic scope; no execution or menu claims.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `3c2479e0e1c77d1f8a219115f922f6e06ba0c96df07f4290cab70d167c92ab8d`.

**Không có finding gốc N3.1; vẫn bắt buộc review.**

| Phương án | Lý do | Hệ quả |
|---|---|---|
| U-A — Giữ current golden như candidate sau review | Chưa có finding gốc; cần reviewer xác nhận từ evidence ở trên. | Không thay nguồn; chỉ có thể release sau quyết định thật, không đồng nghĩa auto-approved. |
| U-B — Đề nghị revision/alternative theo D01–D10 | Nếu thấy ambiguity hoặc giới hạn contract, ghi evidence và phương án cụ thể. | Tạo successor candidate/version và đánh giá lại group; không sửa nhãn gốc hoặc bỏ case để tăng điểm. |

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Other: Không có finding N3.1 không có nghĩa đã đúng. Đối chiếu surface, quantity, polarity, binding, capability và rationale độc lập.

**Đề xuất theo record, CHƯA DUYỆT:** Giữ clear_cart như candidate nếu reviewer thấy đúng với utterance/context; không suy thực thi hoặc menu fact từ intent.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-CLEAR-02

Batch B18 · queue 116 · P2_unflagged_still_pending · split train · group `single-clear` · **pending**

**Câu gốc:** Mình muốn xóa tất cả món trong giỏ

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "clear_cart",
      "polarity": "affirmed"
    }
  ],
  "entities": []
}
```

**Rationale nguồn:** Authored paraphrase 2: preserve clear_cart; natural. Product bindings refer only to the supplied synthetic scope; no execution or menu claims.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `614bc59b78753d0d9a0d12e257bcdd8054ae6f7c42c7c9f86eeb6e7bb71c42cc`.

**Không có finding gốc N3.1; vẫn bắt buộc review.**

| Phương án | Lý do | Hệ quả |
|---|---|---|
| U-A — Giữ current golden như candidate sau review | Chưa có finding gốc; cần reviewer xác nhận từ evidence ở trên. | Không thay nguồn; chỉ có thể release sau quyết định thật, không đồng nghĩa auto-approved. |
| U-B — Đề nghị revision/alternative theo D01–D10 | Nếu thấy ambiguity hoặc giới hạn contract, ghi evidence và phương án cụ thể. | Tạo successor candidate/version và đánh giá lại group; không sửa nhãn gốc hoặc bỏ case để tăng điểm. |

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Other: Không có finding N3.1 không có nghĩa đã đúng. Đối chiếu surface, quantity, polarity, binding, capability và rationale độc lập.

**Đề xuất theo record, CHƯA DUYỆT:** Giữ clear_cart như candidate nếu reviewer thấy đúng với utterance/context; không suy thực thi hoặc menu fact từ intent.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-CX-01

Batch B18 · queue 117 · P2_unflagged_still_pending · split dev · group `single-cx` · **pending**

**Câu gốc:** mk cx muốn xem menu với giỏ

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "search_product",
      "polarity": "affirmed",
      "targetIds": []
    },
    {
      "id": "j",
      "kind": "view_cart",
      "polarity": "affirmed"
    }
  ],
  "entities": []
}
```

**Rationale nguồn:** Authored paraphrase 1: preserve search_product, view_cart; teencode, multi_intent. Product bindings refer only to the supplied synthetic scope; no execution or menu claims.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `26029cd710dab48a26b1237dfb270cc159eb4caed2caad3cf93dcc3ca659ab3b`.

**Không có finding gốc N3.1; vẫn bắt buộc review.**

| Phương án | Lý do | Hệ quả |
|---|---|---|
| U-A — Giữ current golden như candidate sau review | Chưa có finding gốc; cần reviewer xác nhận từ evidence ở trên. | Không thay nguồn; chỉ có thể release sau quyết định thật, không đồng nghĩa auto-approved. |
| U-B — Đề nghị revision/alternative theo D01–D10 | Nếu thấy ambiguity hoặc giới hạn contract, ghi evidence và phương án cụ thể. | Tạo successor candidate/version và đánh giá lại group; không sửa nhãn gốc hoặc bỏ case để tăng điểm. |

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Other: Không có finding N3.1 không có nghĩa đã đúng. Đối chiếu surface, quantity, polarity, binding, capability và rationale độc lập.

**Đề xuất theo record, CHƯA DUYỆT:** Giữ search_product, view_cart như candidate nếu reviewer thấy đúng với utterance/context; không suy thực thi hoặc menu fact từ intent.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-CX-02

Batch B18 · queue 118 · P2_unflagged_still_pending · split dev · group `single-cx` · **pending**

**Câu gốc:** xem thực đơn rồi xem giỏ cx đc

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "search_product",
      "polarity": "affirmed",
      "targetIds": []
    },
    {
      "id": "j",
      "kind": "view_cart",
      "polarity": "affirmed"
    }
  ],
  "entities": []
}
```

**Rationale nguồn:** Authored paraphrase 2: preserve search_product, view_cart; teencode, multi_intent. Product bindings refer only to the supplied synthetic scope; no execution or menu claims.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `f07c97396108fbcc7a3fcb544893db6689cb0f217772f81a054c2814b5145a8d`.

**Không có finding gốc N3.1; vẫn bắt buộc review.**

| Phương án | Lý do | Hệ quả |
|---|---|---|
| U-A — Giữ current golden như candidate sau review | Chưa có finding gốc; cần reviewer xác nhận từ evidence ở trên. | Không thay nguồn; chỉ có thể release sau quyết định thật, không đồng nghĩa auto-approved. |
| U-B — Đề nghị revision/alternative theo D01–D10 | Nếu thấy ambiguity hoặc giới hạn contract, ghi evidence và phương án cụ thể. | Tạo successor candidate/version và đánh giá lại group; không sửa nhãn gốc hoặc bỏ case để tăng điểm. |

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Other: Không có finding N3.1 không có nghĩa đã đúng. Đối chiếu surface, quantity, polarity, binding, capability và rationale độc lập.

**Đề xuất theo record, CHƯA DUYỆT:** Giữ search_product, view_cart như candidate nếu reviewer thấy đúng với utterance/context; không suy thực thi hoặc menu fact từ intent.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-GREETING-01

Batch B18 · queue 119 · P2_unflagged_still_pending · split train · group `single-greeting` · **pending**

**Câu gốc:** Chào bạn nha

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "greeting",
      "polarity": "affirmed"
    }
  ],
  "entities": []
}
```

**Rationale nguồn:** Authored paraphrase 1: preserve greeting; natural. Product bindings refer only to the supplied synthetic scope; no execution or menu claims.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `847612ac0546b2c3e34c7027906778d6de561ee804b6de7bc528e3898e50bb35`.

**Không có finding gốc N3.1; vẫn bắt buộc review.**

| Phương án | Lý do | Hệ quả |
|---|---|---|
| U-A — Giữ current golden như candidate sau review | Chưa có finding gốc; cần reviewer xác nhận từ evidence ở trên. | Không thay nguồn; chỉ có thể release sau quyết định thật, không đồng nghĩa auto-approved. |
| U-B — Đề nghị revision/alternative theo D01–D10 | Nếu thấy ambiguity hoặc giới hạn contract, ghi evidence và phương án cụ thể. | Tạo successor candidate/version và đánh giá lại group; không sửa nhãn gốc hoặc bỏ case để tăng điểm. |

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Other: Không có finding N3.1 không có nghĩa đã đúng. Đối chiếu surface, quantity, polarity, binding, capability và rationale độc lập.

**Đề xuất theo record, CHƯA DUYỆT:** Giữ greeting như candidate nếu reviewer thấy đúng với utterance/context; không suy thực thi hoặc menu fact từ intent.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-GREETING-02

Batch B18 · queue 120 · P2_unflagged_still_pending · split train · group `single-greeting` · **pending**

**Câu gốc:** hello quán ơi

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "greeting",
      "polarity": "affirmed"
    }
  ],
  "entities": []
}
```

**Rationale nguồn:** Authored paraphrase 2: preserve greeting; natural. Product bindings refer only to the supplied synthetic scope; no execution or menu claims.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `b2d5f2dcfe24d3625dab55472b1597df0d6e6adfe115b02eb5e55bdb01810e4d`.

**Không có finding gốc N3.1; vẫn bắt buộc review.**

| Phương án | Lý do | Hệ quả |
|---|---|---|
| U-A — Giữ current golden như candidate sau review | Chưa có finding gốc; cần reviewer xác nhận từ evidence ở trên. | Không thay nguồn; chỉ có thể release sau quyết định thật, không đồng nghĩa auto-approved. |
| U-B — Đề nghị revision/alternative theo D01–D10 | Nếu thấy ambiguity hoặc giới hạn contract, ghi evidence và phương án cụ thể. | Tạo successor candidate/version và đánh giá lại group; không sửa nhãn gốc hoặc bỏ case để tăng điểm. |

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Other: Không có finding N3.1 không có nghĩa đã đúng. Đối chiếu surface, quantity, polarity, binding, capability và rationale độc lập.

**Đề xuất theo record, CHƯA DUYỆT:** Giữ greeting như candidate nếu reviewer thấy đúng với utterance/context; không suy thực thi hoặc menu fact từ intent.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-HOLDSCOPE-01

Batch B18 · queue 121 · P2_unflagged_still_pending · split test · group `single-holdscope` · **pending**

**Câu gốc:** Pepsi có bán ở phạm vi demo này không

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "ask_availability",
      "polarity": "affirmed",
      "targetIds": [
        "p"
      ]
    }
  ],
  "entities": [
    {
      "id": "p",
      "kind": "product",
      "text": "Pepsi có bán ở phạm vi demo này không",
      "productId": "demo-pepsi"
    }
  ]
}
```

**Rationale nguồn:** Authored paraphrase 1: preserve ask_availability; natural. Product bindings refer only to the supplied synthetic scope; no execution or menu claims.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `d27cdbdc064b214901f7858a0ea9e47ae6ab7c62119c0111908604caae246aa6`.

**Không có finding gốc N3.1; vẫn bắt buộc review.**

| Phương án | Lý do | Hệ quả |
|---|---|---|
| U-A — Giữ current golden như candidate sau review | Chưa có finding gốc; cần reviewer xác nhận từ evidence ở trên. | Không thay nguồn; chỉ có thể release sau quyết định thật, không đồng nghĩa auto-approved. |
| U-B — Đề nghị revision/alternative theo D01–D10 | Nếu thấy ambiguity hoặc giới hạn contract, ghi evidence và phương án cụ thể. | Tạo successor candidate/version và đánh giá lại group; không sửa nhãn gốc hoặc bỏ case để tăng điểm. |

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Other: Không có finding N3.1 không có nghĩa đã đúng. Đối chiếu surface, quantity, polarity, binding, capability và rationale độc lập.

**Đề xuất theo record, CHƯA DUYỆT:** Giữ ask_availability như candidate nếu reviewer thấy đúng với utterance/context; không suy thực thi hoặc menu fact từ intent.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-HOLDSCOPE-02

Batch B18 · queue 122 · P2_unflagged_still_pending · split test · group `single-holdscope` · **pending**

**Câu gốc:** Kiểm tra tình trạng Pepsi ở kênh hiện tại

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "ask_availability",
      "polarity": "affirmed",
      "targetIds": [
        "p"
      ]
    }
  ],
  "entities": [
    {
      "id": "p",
      "kind": "product",
      "text": "Kiểm tra tình trạng Pepsi ở kênh hiện tại",
      "productId": "demo-pepsi"
    }
  ]
}
```

**Rationale nguồn:** Authored paraphrase 2: preserve ask_availability; natural. Product bindings refer only to the supplied synthetic scope; no execution or menu claims.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `8e463dd813a1ba48956ae437d2202a48b214350d51b9505c3c77d922cc267840`.

**Không có finding gốc N3.1; vẫn bắt buộc review.**

| Phương án | Lý do | Hệ quả |
|---|---|---|
| U-A — Giữ current golden như candidate sau review | Chưa có finding gốc; cần reviewer xác nhận từ evidence ở trên. | Không thay nguồn; chỉ có thể release sau quyết định thật, không đồng nghĩa auto-approved. |
| U-B — Đề nghị revision/alternative theo D01–D10 | Nếu thấy ambiguity hoặc giới hạn contract, ghi evidence và phương án cụ thể. | Tạo successor candidate/version và đánh giá lại group; không sửa nhãn gốc hoặc bỏ case để tăng điểm. |

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Other: Không có finding N3.1 không có nghĩa đã đúng. Đối chiếu surface, quantity, polarity, binding, capability và rationale độc lập.

**Đề xuất theo record, CHƯA DUYỆT:** Giữ ask_availability như candidate nếu reviewer thấy đúng với utterance/context; không suy thực thi hoặc menu fact từ intent.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-HOLDTEEN-01

Batch B19 · queue 123 · P2_unflagged_still_pending · split test · group `single-holdteen` · **pending**

**Câu gốc:** k bn ơi, mk đổi ý z

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "needs_clarification",
  "missingSlots": [
    "meaning"
  ],
  "reason": "Ambiguous k/bn without sufficient context",
  "intents": [],
  "entities": []
}
```

**Rationale nguồn:** Authored paraphrase 1: preserve needs_clarification; teencode, abbreviation, clarification. Product bindings refer only to the supplied synthetic scope; no execution or menu claims.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `dd1f2cc5ff739fd63154c5ca5e948fd7fdcaf78020935fb051b0bcd0c54c28bc`.

**Không có finding gốc N3.1; vẫn bắt buộc review.**

| Phương án | Lý do | Hệ quả |
|---|---|---|
| U-A — Giữ current golden như candidate sau review | Chưa có finding gốc; cần reviewer xác nhận từ evidence ở trên. | Không thay nguồn; chỉ có thể release sau quyết định thật, không đồng nghĩa auto-approved. |
| U-B — Đề nghị revision/alternative theo D01–D10 | Nếu thấy ambiguity hoặc giới hạn contract, ghi evidence và phương án cụ thể. | Tạo successor candidate/version và đánh giá lại group; không sửa nhãn gốc hoặc bỏ case để tăng điểm. |

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Clarification policy: missingSlots hiện tại [meaning]: phân biệt toàn bộ slot thiếu với slot sẽ hỏi tiếp, không tự điền từ cart.
- Other: Không có finding N3.1 không có nghĩa đã đúng. Đối chiếu surface, quantity, polarity, binding, capability và rationale độc lập.

**Đề xuất theo record, CHƯA DUYỆT:** Đối chiếu loại slot thiếu với evidence và policy D02/D03/D05/D09; giữ pending thay vì tự điền.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-HOLDTEEN-02

Batch B19 · queue 124 · P2_unflagged_still_pending · split test · group `single-holdteen` · **pending**

**Câu gốc:** bn nói z mk k hiểu

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "needs_clarification",
  "missingSlots": [
    "meaning"
  ],
  "reason": "Ambiguous k/bn without sufficient context",
  "intents": [],
  "entities": []
}
```

**Rationale nguồn:** Authored paraphrase 2: preserve needs_clarification; teencode, abbreviation, clarification. Product bindings refer only to the supplied synthetic scope; no execution or menu claims.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `7d3637d5427bc48ccafde1176a7251323955d905cc7a838c10d69063803d716e`.

**Không có finding gốc N3.1; vẫn bắt buộc review.**

| Phương án | Lý do | Hệ quả |
|---|---|---|
| U-A — Giữ current golden như candidate sau review | Chưa có finding gốc; cần reviewer xác nhận từ evidence ở trên. | Không thay nguồn; chỉ có thể release sau quyết định thật, không đồng nghĩa auto-approved. |
| U-B — Đề nghị revision/alternative theo D01–D10 | Nếu thấy ambiguity hoặc giới hạn contract, ghi evidence và phương án cụ thể. | Tạo successor candidate/version và đánh giá lại group; không sửa nhãn gốc hoặc bỏ case để tăng điểm. |

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Clarification policy: missingSlots hiện tại [meaning]: phân biệt toàn bộ slot thiếu với slot sẽ hỏi tiếp, không tự điền từ cart.
- Other: Không có finding N3.1 không có nghĩa đã đúng. Đối chiếu surface, quantity, polarity, binding, capability và rationale độc lập.

**Đề xuất theo record, CHƯA DUYỆT:** Đối chiếu loại slot thiếu với evidence và policy D02/D03/D05/D09; giữ pending thay vì tự điền.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-OPTIONS-01

Batch B19 · queue 125 · P2_unflagged_still_pending · split dev · group `single-options` · **pending**

**Câu gốc:** Pepsi có những lựa chọn cỡ nào

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "ask_options",
      "polarity": "affirmed",
      "targetIds": [
        "p"
      ]
    }
  ],
  "entities": [
    {
      "id": "p",
      "kind": "product",
      "text": "Pepsi có những lựa chọn cỡ nào",
      "productId": "demo-pepsi"
    }
  ]
}
```

**Rationale nguồn:** Authored paraphrase 1: preserve ask_options; natural. Product bindings refer only to the supplied synthetic scope; no execution or menu claims.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `4a2e5105992805193236185824ba322fd93e7dacd52a01e9f830bb4fe46ed887`.

**Không có finding gốc N3.1; vẫn bắt buộc review.**

| Phương án | Lý do | Hệ quả |
|---|---|---|
| U-A — Giữ current golden như candidate sau review | Chưa có finding gốc; cần reviewer xác nhận từ evidence ở trên. | Không thay nguồn; chỉ có thể release sau quyết định thật, không đồng nghĩa auto-approved. |
| U-B — Đề nghị revision/alternative theo D01–D10 | Nếu thấy ambiguity hoặc giới hạn contract, ghi evidence và phương án cụ thể. | Tạo successor candidate/version và đánh giá lại group; không sửa nhãn gốc hoặc bỏ case để tăng điểm. |

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Other: Không có finding N3.1 không có nghĩa đã đúng. Đối chiếu surface, quantity, polarity, binding, capability và rationale độc lập.

**Đề xuất theo record, CHƯA DUYỆT:** Giữ ask_options như candidate nếu reviewer thấy đúng với utterance/context; không suy thực thi hoặc menu fact từ intent.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-OPTIONS-02

Batch B19 · queue 126 · P2_unflagged_still_pending · split dev · group `single-options` · **pending**

**Câu gốc:** Cho mình biết tùy chọn của Pepsi

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "ask_options",
      "polarity": "affirmed",
      "targetIds": [
        "p"
      ]
    }
  ],
  "entities": [
    {
      "id": "p",
      "kind": "product",
      "text": "Cho mình biết tùy chọn của Pepsi",
      "productId": "demo-pepsi"
    }
  ]
}
```

**Rationale nguồn:** Authored paraphrase 2: preserve ask_options; natural. Product bindings refer only to the supplied synthetic scope; no execution or menu claims.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `e4319422a404dab16c927df9fea0d3a064a383c60b76cd43c4f0e8223bbaec1c`.

**Không có finding gốc N3.1; vẫn bắt buộc review.**

| Phương án | Lý do | Hệ quả |
|---|---|---|
| U-A — Giữ current golden như candidate sau review | Chưa có finding gốc; cần reviewer xác nhận từ evidence ở trên. | Không thay nguồn; chỉ có thể release sau quyết định thật, không đồng nghĩa auto-approved. |
| U-B — Đề nghị revision/alternative theo D01–D10 | Nếu thấy ambiguity hoặc giới hạn contract, ghi evidence và phương án cụ thể. | Tạo successor candidate/version và đánh giá lại group; không sửa nhãn gốc hoặc bỏ case để tăng điểm. |

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Other: Không có finding N3.1 không có nghĩa đã đúng. Đối chiếu surface, quantity, polarity, binding, capability và rationale độc lập.

**Đề xuất theo record, CHƯA DUYỆT:** Giữ ask_options như candidate nếu reviewer thấy đúng với utterance/context; không suy thực thi hoặc menu fact từ intent.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-ORDER-01

Batch B19 · queue 127 · P2_unflagged_still_pending · split dev · group `single-order` · **pending**

**Câu gốc:** Đặt đơn thật và gọi shipper cho tôi

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "unsupported",
  "intents": [
    {
      "id": "i",
      "kind": "unsupported_request",
      "polarity": "affirmed",
      "reason": "Creating real orders is unsupported"
    }
  ],
  "entities": [],
  "reason": "Creating real orders is unsupported"
}
```

**Rationale nguồn:** Authored paraphrase 1: preserve unsupported_request; unsupported. Product bindings refer only to the supplied synthetic scope; no execution or menu claims.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `56b166bca8a3a43603f941f11c4e7a8367b4f98c9c0721c165c7003608de4cc0`.

**Không có finding gốc N3.1; vẫn bắt buộc review.**

| Phương án | Lý do | Hệ quả |
|---|---|---|
| U-A — Giữ current golden như candidate sau review | Chưa có finding gốc; cần reviewer xác nhận từ evidence ở trên. | Không thay nguồn; chỉ có thể release sau quyết định thật, không đồng nghĩa auto-approved. |
| U-B — Đề nghị revision/alternative theo D01–D10 | Nếu thấy ambiguity hoặc giới hạn contract, ghi evidence và phương án cụ thể. | Tạo successor candidate/version và đánh giá lại group; không sửa nhãn gốc hoặc bỏ case để tăng điểm. |

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Other: Không có finding N3.1 không có nghĩa đã đúng. Đối chiếu surface, quantity, polarity, binding, capability và rationale độc lập.

**Đề xuất theo record, CHƯA DUYỆT:** Giữ unsupported_request như candidate nếu reviewer thấy đúng với utterance/context; không suy thực thi hoặc menu fact từ intent.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-ORDER-02

Batch B19 · queue 128 · P2_unflagged_still_pending · split dev · group `single-order` · **pending**

**Câu gốc:** Chốt đơn giao đến nhà luôn đi

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "unsupported",
  "intents": [
    {
      "id": "i",
      "kind": "unsupported_request",
      "polarity": "affirmed",
      "reason": "Creating real orders is unsupported"
    }
  ],
  "entities": [],
  "reason": "Creating real orders is unsupported"
}
```

**Rationale nguồn:** Authored paraphrase 2: preserve unsupported_request; unsupported. Product bindings refer only to the supplied synthetic scope; no execution or menu claims.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `b05b26eb8fdf3945d333aed287410a376f405e21c04847f33efd5bc8a50856d8`.

**Không có finding gốc N3.1; vẫn bắt buộc review.**

| Phương án | Lý do | Hệ quả |
|---|---|---|
| U-A — Giữ current golden như candidate sau review | Chưa có finding gốc; cần reviewer xác nhận từ evidence ở trên. | Không thay nguồn; chỉ có thể release sau quyết định thật, không đồng nghĩa auto-approved. |
| U-B — Đề nghị revision/alternative theo D01–D10 | Nếu thấy ambiguity hoặc giới hạn contract, ghi evidence và phương án cụ thể. | Tạo successor candidate/version và đánh giá lại group; không sửa nhãn gốc hoặc bỏ case để tăng điểm. |

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Other: Không có finding N3.1 không có nghĩa đã đúng. Đối chiếu surface, quantity, polarity, binding, capability và rationale độc lập.

**Đề xuất theo record, CHƯA DUYỆT:** Giữ unsupported_request như candidate nếu reviewer thấy đúng với utterance/context; không suy thực thi hoặc menu fact từ intent.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-PAY-01

Batch B19 · queue 129 · P2_unflagged_still_pending · split train · group `single-pay` · **pending**

**Câu gốc:** Thanh toán hộ mình luôn

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "unsupported",
  "intents": [
    {
      "id": "i",
      "kind": "unsupported_request",
      "polarity": "affirmed",
      "reason": "Payment not supported by NLU tools"
    }
  ],
  "entities": [],
  "reason": "Payment not supported by NLU tools"
}
```

**Rationale nguồn:** Authored paraphrase 1: preserve unsupported_request; unsupported. Product bindings refer only to the supplied synthetic scope; no execution or menu claims.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `31cbbb933d91af50f1db3af90c63d775d3d9ca9da17a7eaef36a18deee7262a9`.

**Không có finding gốc N3.1; vẫn bắt buộc review.**

| Phương án | Lý do | Hệ quả |
|---|---|---|
| U-A — Giữ current golden như candidate sau review | Chưa có finding gốc; cần reviewer xác nhận từ evidence ở trên. | Không thay nguồn; chỉ có thể release sau quyết định thật, không đồng nghĩa auto-approved. |
| U-B — Đề nghị revision/alternative theo D01–D10 | Nếu thấy ambiguity hoặc giới hạn contract, ghi evidence và phương án cụ thể. | Tạo successor candidate/version và đánh giá lại group; không sửa nhãn gốc hoặc bỏ case để tăng điểm. |

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Other: Không có finding N3.1 không có nghĩa đã đúng. Đối chiếu surface, quantity, polarity, binding, capability và rationale độc lập.

**Đề xuất theo record, CHƯA DUYỆT:** Giữ unsupported_request như candidate nếu reviewer thấy đúng với utterance/context; không suy thực thi hoặc menu fact từ intent.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-PAY-02

Batch B19 · queue 130 · P2_unflagged_still_pending · split train · group `single-pay` · **pending**

**Câu gốc:** Trừ tiền thẻ giúp tôi

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "unsupported",
  "intents": [
    {
      "id": "i",
      "kind": "unsupported_request",
      "polarity": "affirmed",
      "reason": "Payment not supported by NLU tools"
    }
  ],
  "entities": [],
  "reason": "Payment not supported by NLU tools"
}
```

**Rationale nguồn:** Authored paraphrase 2: preserve unsupported_request; unsupported. Product bindings refer only to the supplied synthetic scope; no execution or menu claims.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `5c780a5e1953825d8ba69bda66ba3d37e135501fab298c131ce627cd8eef03b8`.

**Không có finding gốc N3.1; vẫn bắt buộc review.**

| Phương án | Lý do | Hệ quả |
|---|---|---|
| U-A — Giữ current golden như candidate sau review | Chưa có finding gốc; cần reviewer xác nhận từ evidence ở trên. | Không thay nguồn; chỉ có thể release sau quyết định thật, không đồng nghĩa auto-approved. |
| U-B — Đề nghị revision/alternative theo D01–D10 | Nếu thấy ambiguity hoặc giới hạn contract, ghi evidence và phương án cụ thể. | Tạo successor candidate/version và đánh giá lại group; không sửa nhãn gốc hoặc bỏ case để tăng điểm. |

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Other: Không có finding N3.1 không có nghĩa đã đúng. Đối chiếu surface, quantity, polarity, binding, capability và rationale độc lập.

**Đề xuất theo record, CHƯA DUYỆT:** Giữ unsupported_request như candidate nếu reviewer thấy đúng với utterance/context; không suy thực thi hoặc menu fact từ intent.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-PRICE-01

Batch B20 · queue 131 · P2_unflagged_still_pending · split train · group `single-price` · **pending**

**Câu gốc:** Pepsi giá bao nhiêu

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "ask_price",
      "polarity": "affirmed",
      "targetIds": [
        "p"
      ]
    }
  ],
  "entities": [
    {
      "id": "p",
      "kind": "product",
      "text": "Pepsi giá bao nhiêu",
      "productId": "demo-pepsi"
    }
  ]
}
```

**Rationale nguồn:** Authored paraphrase 1: preserve ask_price; natural. Product bindings refer only to the supplied synthetic scope; no execution or menu claims.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `69c4aba6f884b2a7fce6c40009eefbddee2634f7165850f35d267578a806512b`.

**Không có finding gốc N3.1; vẫn bắt buộc review.**

| Phương án | Lý do | Hệ quả |
|---|---|---|
| U-A — Giữ current golden như candidate sau review | Chưa có finding gốc; cần reviewer xác nhận từ evidence ở trên. | Không thay nguồn; chỉ có thể release sau quyết định thật, không đồng nghĩa auto-approved. |
| U-B — Đề nghị revision/alternative theo D01–D10 | Nếu thấy ambiguity hoặc giới hạn contract, ghi evidence và phương án cụ thể. | Tạo successor candidate/version và đánh giá lại group; không sửa nhãn gốc hoặc bỏ case để tăng điểm. |

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Other: Không có finding N3.1 không có nghĩa đã đúng. Đối chiếu surface, quantity, polarity, binding, capability và rationale độc lập.

**Đề xuất theo record, CHƯA DUYỆT:** Giữ ask_price như candidate nếu reviewer thấy đúng với utterance/context; không suy thực thi hoặc menu fact từ intent.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-PRICE-02

Batch B20 · queue 132 · P2_unflagged_still_pending · split train · group `single-price` · **pending**

**Câu gốc:** Một phần Pepsi hiện bao tiền

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "ask_price",
      "polarity": "affirmed",
      "targetIds": [
        "p"
      ]
    }
  ],
  "entities": [
    {
      "id": "p",
      "kind": "product",
      "text": "Một phần Pepsi hiện bao tiền",
      "productId": "demo-pepsi"
    }
  ]
}
```

**Rationale nguồn:** Authored paraphrase 2: preserve ask_price; natural. Product bindings refer only to the supplied synthetic scope; no execution or menu claims.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `d102951b38d7f486e6d6c74dacee393f28d96315ee182dd1f44ebab2d69a3c76`.

**Không có finding gốc N3.1; vẫn bắt buộc review.**

| Phương án | Lý do | Hệ quả |
|---|---|---|
| U-A — Giữ current golden như candidate sau review | Chưa có finding gốc; cần reviewer xác nhận từ evidence ở trên. | Không thay nguồn; chỉ có thể release sau quyết định thật, không đồng nghĩa auto-approved. |
| U-B — Đề nghị revision/alternative theo D01–D10 | Nếu thấy ambiguity hoặc giới hạn contract, ghi evidence và phương án cụ thể. | Tạo successor candidate/version và đánh giá lại group; không sửa nhãn gốc hoặc bỏ case để tăng điểm. |

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Other: Không có finding N3.1 không có nghĩa đã đúng. Đối chiếu surface, quantity, polarity, binding, capability và rationale độc lập.

**Đề xuất theo record, CHƯA DUYỆT:** Giữ ask_price như candidate nếu reviewer thấy đúng với utterance/context; không suy thực thi hoặc menu fact từ intent.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-QMISS-01

Batch B20 · queue 133 · P2_unflagged_still_pending · split train · group `single-qmiss` · **pending**

**Câu gốc:** Lấy vài Pepsi

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "needs_clarification",
  "missingSlots": [
    "quantity"
  ],
  "reason": "No exact requested count",
  "intents": [
    {
      "id": "i",
      "kind": "add_item",
      "polarity": "affirmed",
      "targetId": "p",
      "quantityId": null
    }
  ],
  "entities": [
    {
      "id": "p",
      "kind": "product",
      "text": "Lấy vài Pepsi",
      "productId": "demo-pepsi"
    }
  ]
}
```

**Rationale nguồn:** Authored paraphrase 1: preserve add_item; clarification. Product bindings refer only to the supplied synthetic scope; no execution or menu claims.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `c4ec0012a97467ecea1ac195df02e3ecc76d0a7d697c924e11897812c7afa8a3`.

**Không có finding gốc N3.1; vẫn bắt buộc review.**

| Phương án | Lý do | Hệ quả |
|---|---|---|
| U-A — Giữ current golden như candidate sau review | Chưa có finding gốc; cần reviewer xác nhận từ evidence ở trên. | Không thay nguồn; chỉ có thể release sau quyết định thật, không đồng nghĩa auto-approved. |
| U-B — Đề nghị revision/alternative theo D01–D10 | Nếu thấy ambiguity hoặc giới hạn contract, ghi evidence và phương án cụ thể. | Tạo successor candidate/version và đánh giá lại group; không sửa nhãn gốc hoặc bỏ case để tăng điểm. |

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Clarification policy: missingSlots hiện tại [quantity]: phân biệt toàn bộ slot thiếu với slot sẽ hỏi tiếp, không tự điền từ cart.
- Other: Không có finding N3.1 không có nghĩa đã đúng. Đối chiếu surface, quantity, polarity, binding, capability và rationale độc lập.

**Đề xuất theo record, CHƯA DUYỆT:** Đối chiếu loại slot thiếu với evidence và policy D02/D03/D05/D09; giữ pending thay vì tự điền.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-QMISS-02

Batch B20 · queue 134 · P2_unflagged_still_pending · split train · group `single-qmiss` · **pending**

**Câu gốc:** Thêm ít Pepsi nha

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "needs_clarification",
  "missingSlots": [
    "quantity"
  ],
  "reason": "No exact requested count",
  "intents": [
    {
      "id": "i",
      "kind": "add_item",
      "polarity": "affirmed",
      "targetId": "p",
      "quantityId": null
    }
  ],
  "entities": [
    {
      "id": "p",
      "kind": "product",
      "text": "Thêm ít Pepsi nha",
      "productId": "demo-pepsi"
    }
  ]
}
```

**Rationale nguồn:** Authored paraphrase 2: preserve add_item; clarification. Product bindings refer only to the supplied synthetic scope; no execution or menu claims.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `dbc691645e5d753fe03344613f6053ac7a5dabeabcd95bb1752e9b6310f3096d`.

**Không có finding gốc N3.1; vẫn bắt buộc review.**

| Phương án | Lý do | Hệ quả |
|---|---|---|
| U-A — Giữ current golden như candidate sau review | Chưa có finding gốc; cần reviewer xác nhận từ evidence ở trên. | Không thay nguồn; chỉ có thể release sau quyết định thật, không đồng nghĩa auto-approved. |
| U-B — Đề nghị revision/alternative theo D01–D10 | Nếu thấy ambiguity hoặc giới hạn contract, ghi evidence và phương án cụ thể. | Tạo successor candidate/version và đánh giá lại group; không sửa nhãn gốc hoặc bỏ case để tăng điểm. |

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Clarification policy: missingSlots hiện tại [quantity]: phân biệt toàn bộ slot thiếu với slot sẽ hỏi tiếp, không tự điền từ cart.
- Other: Không có finding N3.1 không có nghĩa đã đúng. Đối chiếu surface, quantity, polarity, binding, capability và rationale độc lập.

**Đề xuất theo record, CHƯA DUYỆT:** Đối chiếu loại slot thiếu với evidence và policy D02/D03/D05/D09; giữ pending thay vì tự điền.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-REMOVE-01

Batch B20 · queue 135 · P2_unflagged_still_pending · split train · group `single-remove` · **pending**

**Câu gốc:** Bỏ hẳn dòng Pepsi trong giỏ

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "remove_line",
      "polarity": "affirmed",
      "targetId": "p"
    }
  ],
  "entities": [
    {
      "id": "p",
      "kind": "product",
      "text": "Bỏ hẳn dòng Pepsi trong giỏ",
      "productId": "demo-pepsi"
    }
  ]
}
```

**Rationale nguồn:** Authored paraphrase 1: preserve remove_line; natural. Product bindings refer only to the supplied synthetic scope; no execution or menu claims.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `ea680ce6b4961478c63a82272b7971ce0bc3e0b3175e2c47cff148749f021f57`.

**Không có finding gốc N3.1; vẫn bắt buộc review.**

| Phương án | Lý do | Hệ quả |
|---|---|---|
| U-A — Giữ current golden như candidate sau review | Chưa có finding gốc; cần reviewer xác nhận từ evidence ở trên. | Không thay nguồn; chỉ có thể release sau quyết định thật, không đồng nghĩa auto-approved. |
| U-B — Đề nghị revision/alternative theo D01–D10 | Nếu thấy ambiguity hoặc giới hạn contract, ghi evidence và phương án cụ thể. | Tạo successor candidate/version và đánh giá lại group; không sửa nhãn gốc hoặc bỏ case để tăng điểm. |

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Other: Không có finding N3.1 không có nghĩa đã đúng. Đối chiếu surface, quantity, polarity, binding, capability và rationale độc lập.

**Đề xuất theo record, CHƯA DUYỆT:** Giữ remove_line như candidate nếu reviewer thấy đúng với utterance/context; không suy thực thi hoặc menu fact từ intent.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-REMOVE-02

Batch B20 · queue 136 · P2_unflagged_still_pending · split train · group `single-remove` · **pending**

**Câu gốc:** Xóa món Pepsi khỏi giỏ giúp tôi

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "remove_line",
      "polarity": "affirmed",
      "targetId": "p"
    }
  ],
  "entities": [
    {
      "id": "p",
      "kind": "product",
      "text": "Xóa món Pepsi khỏi giỏ giúp tôi",
      "productId": "demo-pepsi"
    }
  ]
}
```

**Rationale nguồn:** Authored paraphrase 2: preserve remove_line; natural. Product bindings refer only to the supplied synthetic scope; no execution or menu claims.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `3b36f1291746df48f5d4e604243b2ff97a271d401d24026fdc2aff50043f2dce`.

**Không có finding gốc N3.1; vẫn bắt buộc review.**

| Phương án | Lý do | Hệ quả |
|---|---|---|
| U-A — Giữ current golden như candidate sau review | Chưa có finding gốc; cần reviewer xác nhận từ evidence ở trên. | Không thay nguồn; chỉ có thể release sau quyết định thật, không đồng nghĩa auto-approved. |
| U-B — Đề nghị revision/alternative theo D01–D10 | Nếu thấy ambiguity hoặc giới hạn contract, ghi evidence và phương án cụ thể. | Tạo successor candidate/version và đánh giá lại group; không sửa nhãn gốc hoặc bỏ case để tăng điểm. |

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Other: Không có finding N3.1 không có nghĩa đã đúng. Đối chiếu surface, quantity, polarity, binding, capability và rationale độc lập.

**Đề xuất theo record, CHƯA DUYỆT:** Giữ remove_line như candidate nếu reviewer thấy đúng với utterance/context; không suy thực thi hoặc menu fact từ intent.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-SEARCH-01

Batch B20 · queue 137 · P2_unflagged_still_pending · split train · group `single-search` · **pending**

**Câu gốc:** Có những món gì vậy bạn

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "search_product",
      "polarity": "affirmed",
      "targetIds": []
    }
  ],
  "entities": []
}
```

**Rationale nguồn:** Authored paraphrase 1: preserve search_product; natural. Product bindings refer only to the supplied synthetic scope; no execution or menu claims.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `84e5336be77ab728700c2c084de244a2c3e418e6ce1f57b5465c760a4140fb34`.

**Không có finding gốc N3.1; vẫn bắt buộc review.**

| Phương án | Lý do | Hệ quả |
|---|---|---|
| U-A — Giữ current golden như candidate sau review | Chưa có finding gốc; cần reviewer xác nhận từ evidence ở trên. | Không thay nguồn; chỉ có thể release sau quyết định thật, không đồng nghĩa auto-approved. |
| U-B — Đề nghị revision/alternative theo D01–D10 | Nếu thấy ambiguity hoặc giới hạn contract, ghi evidence và phương án cụ thể. | Tạo successor candidate/version và đánh giá lại group; không sửa nhãn gốc hoặc bỏ case để tăng điểm. |

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Other: Không có finding N3.1 không có nghĩa đã đúng. Đối chiếu surface, quantity, polarity, binding, capability và rationale độc lập.

**Đề xuất theo record, CHƯA DUYỆT:** Giữ search_product như candidate nếu reviewer thấy đúng với utterance/context; không suy thực thi hoặc menu fact từ intent.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-SEARCH-02

Batch B20 · queue 138 · P2_unflagged_still_pending · split train · group `single-search` · **pending**

**Câu gốc:** Mình muốn xem các lựa chọn trong menu

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "understood",
  "intents": [
    {
      "id": "i",
      "kind": "search_product",
      "polarity": "affirmed",
      "targetIds": []
    }
  ],
  "entities": []
}
```

**Rationale nguồn:** Authored paraphrase 2: preserve search_product; natural. Product bindings refer only to the supplied synthetic scope; no execution or menu claims.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `9708a80c50a7c6eeef02260a01ec793ad2f22af5d491f9fee6671db644ec9398`.

**Không có finding gốc N3.1; vẫn bắt buộc review.**

| Phương án | Lý do | Hệ quả |
|---|---|---|
| U-A — Giữ current golden như candidate sau review | Chưa có finding gốc; cần reviewer xác nhận từ evidence ở trên. | Không thay nguồn; chỉ có thể release sau quyết định thật, không đồng nghĩa auto-approved. |
| U-B — Đề nghị revision/alternative theo D01–D10 | Nếu thấy ambiguity hoặc giới hạn contract, ghi evidence và phương án cụ thể. | Tạo successor candidate/version và đánh giá lại group; không sửa nhãn gốc hoặc bỏ case để tăng điểm. |

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Other: Không có finding N3.1 không có nghĩa đã đúng. Đối chiếu surface, quantity, polarity, binding, capability và rationale độc lập.

**Đề xuất theo record, CHƯA DUYỆT:** Giữ search_product như candidate nếu reviewer thấy đúng với utterance/context; không suy thực thi hoặc menu fact từ intent.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-ZAY-01

Batch B21 · queue 139 · P2_unflagged_still_pending · split dev · group `single-zay` · **pending**

**Câu gốc:** zay là chọn cái nào

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "needs_clarification",
  "missingSlots": [
    "meaning"
  ],
  "reason": "Ambiguous shorthand without antecedent",
  "intents": [],
  "entities": []
}
```

**Rationale nguồn:** Authored paraphrase 1: preserve needs_clarification; teencode, clarification. Product bindings refer only to the supplied synthetic scope; no execution or menu claims.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `ba8c13697bfa3d2cb04f92a86353f9e39ef1d3d02418bb94452d6bd971b42b73`.

**Không có finding gốc N3.1; vẫn bắt buộc review.**

| Phương án | Lý do | Hệ quả |
|---|---|---|
| U-A — Giữ current golden như candidate sau review | Chưa có finding gốc; cần reviewer xác nhận từ evidence ở trên. | Không thay nguồn; chỉ có thể release sau quyết định thật, không đồng nghĩa auto-approved. |
| U-B — Đề nghị revision/alternative theo D01–D10 | Nếu thấy ambiguity hoặc giới hạn contract, ghi evidence và phương án cụ thể. | Tạo successor candidate/version và đánh giá lại group; không sửa nhãn gốc hoặc bỏ case để tăng điểm. |

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Clarification policy: missingSlots hiện tại [meaning]: phân biệt toàn bộ slot thiếu với slot sẽ hỏi tiếp, không tự điền từ cart.
- Other: Không có finding N3.1 không có nghĩa đã đúng. Đối chiếu surface, quantity, polarity, binding, capability và rationale độc lập.

**Đề xuất theo record, CHƯA DUYỆT:** Đối chiếu loại slot thiếu với evidence và policy D02/D03/D05/D09; giữ pending thay vì tự điền.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.

## N2-ZAY-02

Batch B21 · queue 140 · P2_unflagged_still_pending · split dev · group `single-zay` · **pending**

**Câu gốc:** z là sao, mk chưa rõ

**Trusted context:** C0; seed_demo / n2-synthetic-v1 / demo-a / pickup. Cart r1: line1 → demo-pepsi ×3, options=[]; last-item → demo-pepsi. Không có price/availability/component evidence.

**History được phép (user only):**
Không có prior turn. Không giả lập câu hỏi assistant.

**Golden hiện tại — snapshot nguyên bản, không phải đề xuất mới:**

```json
{
  "status": "needs_clarification",
  "missingSlots": [
    "meaning"
  ],
  "reason": "Ambiguous shorthand without antecedent",
  "intents": [],
  "entities": []
}
```

**Rationale nguồn:** Authored paraphrase 2: preserve needs_clarification; teencode, clarification. Product bindings refer only to the supplied synthetic scope; no execution or menu claims.

**Provenance:** {"source":"synthetic_authored","author":"codex-n2","reviewStatus":"pending_human_review","version":"n2-pilot-v1"}; case hash `1334fcb88fd50e4bd49bff0512292e40b2a411b912861adf5f963e2a43dbcb55`.

**Không có finding gốc N3.1; vẫn bắt buộc review.**

| Phương án | Lý do | Hệ quả |
|---|---|---|
| U-A — Giữ current golden như candidate sau review | Chưa có finding gốc; cần reviewer xác nhận từ evidence ở trên. | Không thay nguồn; chỉ có thể release sau quyết định thật, không đồng nghĩa auto-approved. |
| U-B — Đề nghị revision/alternative theo D01–D10 | Nếu thấy ambiguity hoặc giới hạn contract, ghi evidence và phương án cụ thể. | Tạo successor candidate/version và đánh giá lại group; không sửa nhãn gốc hoặc bỏ case để tăng điểm. |

**Kiểm tra bổ sung, không cộng vào 86 câu hỏi gốc:**
- Clarification policy: missingSlots hiện tại [meaning]: phân biệt toàn bộ slot thiếu với slot sẽ hỏi tiếp, không tự điền từ cart.
- Other: Không có finding N3.1 không có nghĩa đã đúng. Đối chiếu surface, quantity, polarity, binding, capability và rationale độc lập.

**Đề xuất theo record, CHƯA DUYỆT:** Đối chiếu loại slot thiếu với evidence và policy D02/D03/D05/D09; giữ pending thay vì tự điền.

**Chỗ ghi quyết định thật:** Reviewer A: ___; Reviewer B: ___; Adjudicator: ___; Option(s): ___; Evidence/rationale: ___; Policy version: ___; UTC: ___. Trạng thái hiện tại vẫn pending.
