# N3.1 — Checklist duyệt nhãn tiếng Việt

Trạng thái ngày 2026-11-09: **140/140 pending; 0 human-approved**. Đây là checklist do máy chuẩn bị, không phải xác nhận đã được con người duyệt.

Dataset hash: `7cb3e05aae74e5e45c3af06a042960afa4933c54af05db6f1863ea2f7fc4ef47`. Không sửa nhãn gốc trong N3.1. Quyết định review tách ở `tests/data/nlu/review-manifest.json`, gắn hash từng case.

## Quy trình bắt buộc trước đánh giá thật

- Hai người đọc tiếng Việt gán/kiểm tra nhãn độc lập trước khi xem prediction; người thứ ba phân xử bất đồng.
- Kiểm tra intent, phủ định theo phạm vi, delta/absolute, ngân sách, số người và antecedent trong đúng history được phép.
- Chốt chính sách intent hiện tại so với yêu cầu tích lũy; không coi đề xuất là cart đã thay đổi.
- Xác nhận đúng split/group, nguồn synthetic, context và rationale có đủ bằng chứng.
- Đánh dấu approved / needs_revision / excluded với reviewer, thời gian UTC và lý do. Không tự approve bằng script.
- Case needs_revision phải sang phiên bản dataset mới; không sửa nhãn để khớp model. Giữ lịch sử và hash cũ.
- Khi mismatch, phân xử: lỗi nhãn / lỗi prediction / đáp án khác hợp lệ / contract mơ hồ / thiếu bằng chứng. Không tự quy lỗi cho mô hình.

## Các điểm cần chú ý

Có 86 câu hỏi review trên 74 records; đây không phải số lỗi nhãn đã chứng minh. Xem `docs/nlu-evaluation-readiness.md` và báo cáo audit JSON để biết chi tiết. Rationale có mẫu lặp; entity evidence chưa có token spans.

## Checklist từng record

Mỗi hàng dưới đây vẫn pending. Chỉ người review mới được quyết định; không có phê duyệt nào được tạo ở đây.

| Case | Split | Group | Intent / status | Cần kiểm tra | Quyết định |
|---|---|---|---|---|---|
| N2-ADD-01 | train | single-add | add_item | semantics, rationale, context | pending |
| N2-ADD-02 | train | single-add | add_item | semantics, rationale, context | pending |
| N2-ABS-01 | train | single-abs | set_quantity | semantics, rationale, context | pending |
| N2-ABS-02 | train | single-abs | set_quantity | semantics, rationale, context | pending |
| N2-DEL-01 | train | single-del | adjust_quantity | semantics, rationale, context | pending |
| N2-DEL-02 | train | single-del | adjust_quantity | semantics, rationale, context | pending |
| N2-NEG-01 | train | single-neg | add_item | semantics, rationale, context | pending |
| N2-NEG-02 | train | single-neg | add_item | semantics, rationale, context | pending |
| N2-PREF-01 | train | single-pref | add_item | semantics, rationale, context | pending |
| N2-PREF-02 | train | single-pref | add_item | semantics, rationale, context | pending |
| N2-CON-01 | train | single-con | request_recommendation | budget_operator | pending |
| N2-CON-02 | train | single-con | request_recommendation | budget_operator | pending |
| N2-SEARCH-01 | train | single-search | search_product | semantics, rationale, context | pending |
| N2-SEARCH-02 | train | single-search | search_product | semantics, rationale, context | pending |
| N2-PRICE-01 | train | single-price | ask_price | semantics, rationale, context | pending |
| N2-PRICE-02 | train | single-price | ask_price | semantics, rationale, context | pending |
| N2-TEEN-01 | train | single-teen | add_item | semantics, rationale, context | pending |
| N2-TEEN-02 | train | single-teen | add_item | semantics, rationale, context | pending |
| N2-NODIAC-01 | train | single-nodiac | set_quantity | semantics, rationale, context | pending |
| N2-NODIAC-02 | train | single-nodiac | set_quantity | semantics, rationale, context | pending |
| N2-TYPO-01 | train | single-typo | add_item | semantics, rationale, context | pending |
| N2-TYPO-02 | train | single-typo | add_item | semantics, rationale, context | pending |
| N2-CART-01 | train | single-cart | view_cart | semantics, rationale, context | pending |
| N2-CART-02 | train | single-cart | view_cart | semantics, rationale, context | pending |
| N2-REMOVE-01 | train | single-remove | remove_line | semantics, rationale, context | pending |
| N2-REMOVE-02 | train | single-remove | remove_line | semantics, rationale, context | pending |
| N2-CLEAR-01 | train | single-clear | clear_cart | semantics, rationale, context | pending |
| N2-CLEAR-02 | train | single-clear | clear_cart | semantics, rationale, context | pending |
| N2-ASSENT-01 | train | single-assent | express_assent | semantics, rationale, context | pending |
| N2-ASSENT-02 | train | single-assent | express_assent | semantics, rationale, context | pending |
| N2-GREETING-01 | train | single-greeting | greeting | semantics, rationale, context | pending |
| N2-GREETING-02 | train | single-greeting | greeting | semantics, rationale, context | pending |
| N2-MISSING-01 | train | single-missing | add_item | semantics, rationale, context | pending |
| N2-MISSING-02 | train | single-missing | add_item | semantics, rationale, context | pending |
| N2-QMISS-01 | train | single-qmiss | add_item | semantics, rationale, context | pending |
| N2-QMISS-02 | train | single-qmiss | add_item | semantics, rationale, context | pending |
| N2-VOLUME-01 | train | single-volume | add_item | semantics, rationale, context | pending |
| N2-VOLUME-02 | train | single-volume | add_item | semantics, rationale, context | pending |
| N2-MULTI-01 | train | single-multi | add_item, view_cart | semantics, rationale, context | pending |
| N2-MULTI-02 | train | single-multi | add_item, view_cart | semantics, rationale, context | pending |
| N2-CANCEL-01 | train | single-cancel | cancel_proposal | semantics, rationale, context | pending |
| N2-CANCEL-02 | train | single-cancel | cancel_proposal | semantics, rationale, context | pending |
| N2-PAY-01 | train | single-pay | unsupported_request | semantics, rationale, context | pending |
| N2-PAY-02 | train | single-pay | unsupported_request | semantics, rationale, context | pending |
| N2-REFMISS-01 | train | single-refmiss | remove_line | referent_policy | pending |
| N2-REFMISS-02 | train | single-refmiss | remove_line | referent_policy | pending |
| N2-OPT-01 | train | single-opt | add_item | semantics, rationale, context | pending |
| N2-OPT-02 | train | single-opt | add_item | semantics, rationale, context | pending |
| N2-HOK-01 | dev | single-hok | add_item | semantics, rationale, context | pending |
| N2-HOK-02 | dev | single-hok | add_item | semantics, rationale, context | pending |
| N2-CX-01 | dev | single-cx | search_product, view_cart | semantics, rationale, context | pending |
| N2-CX-02 | dev | single-cx | search_product, view_cart | semantics, rationale, context | pending |
| N2-ZAY-01 | dev | single-zay | needs_clarification | semantics, rationale, context | pending |
| N2-ZAY-02 | dev | single-zay | needs_clarification | semantics, rationale, context | pending |
| N2-BN-01 | dev | single-bn | ask_price | semantics, rationale, context | pending |
| N2-BN-02 | dev | single-bn | ask_price | semantics, rationale, context | pending |
| N2-BUDGET-01 | dev | single-budget | request_recommendation | budget_operator | pending |
| N2-BUDGET-02 | dev | single-budget | request_recommendation | budget_operator | pending |
| N2-OPTIONS-01 | dev | single-options | ask_options | semantics, rationale, context | pending |
| N2-OPTIONS-02 | dev | single-options | ask_options | semantics, rationale, context | pending |
| N2-ORDER-01 | dev | single-order | unsupported_request | semantics, rationale, context | pending |
| N2-ORDER-02 | dev | single-order | unsupported_request | semantics, rationale, context | pending |
| N2-AMBPRICE-01 | dev | single-ambprice | request_recommendation | budget_operator | pending |
| N2-AMBPRICE-02 | dev | single-ambprice | request_recommendation | budget_operator | pending |
| N2-HOLDTEEN-01 | test | single-holdteen | needs_clarification | semantics, rationale, context | pending |
| N2-HOLDTEEN-02 | test | single-holdteen | needs_clarification | semantics, rationale, context | pending |
| N2-HOLDDEL-01 | test | single-holddel | adjust_quantity | semantics, rationale, context | pending |
| N2-HOLDDEL-02 | test | single-holddel | adjust_quantity | semantics, rationale, context | pending |
| N2-HOLDABS-01 | test | single-holdabs | set_quantity | semantics, rationale, context | pending |
| N2-HOLDABS-02 | test | single-holdabs | set_quantity | semantics, rationale, context | pending |
| N2-HOLDEX-01 | test | single-holdex | request_recommendation | budget_operator | pending |
| N2-HOLDEX-02 | test | single-holdex | request_recommendation | budget_operator | pending |
| N2-HOLDMULTI-01 | test | single-holdmulti | add_item, ask_price | semantics, rationale, context | pending |
| N2-HOLDMULTI-02 | test | single-holdmulti | add_item, ask_price | semantics, rationale, context | pending |
| N2-HOLDUNKNOWN-01 | test | single-holdunknown | search_product | absence_vs_ambiguity | pending |
| N2-HOLDUNKNOWN-02 | test | single-holdunknown | search_product | absence_vs_ambiguity | pending |
| N2-HOLDCOMP-01 | test | single-holdcomp | ask_combo_contents | taxonomy_ambiguity | pending |
| N2-HOLDCOMP-02 | test | single-holdcomp | ask_combo_contents | taxonomy_ambiguity | pending |
| N2-HOLDSCOPE-01 | test | single-holdscope | ask_availability | semantics, rationale, context | pending |
| N2-HOLDSCOPE-02 | test | single-holdscope | ask_availability | semantics, rationale, context | pending |
| N2-D-INCREASE-1-1 | train | dialogue-family-increase | view_cart | dialogue_target | pending |
| N2-D-INCREASE-1-2 | train | dialogue-family-increase | adjust_quantity | dialogue_target | pending |
| N2-D-INCREASE-1-3 | train | dialogue-family-increase | set_quantity | dialogue_target | pending |
| N2-D-INCREASE-2-1 | train | dialogue-family-increase | view_cart | dialogue_target | pending |
| N2-D-INCREASE-2-2 | train | dialogue-family-increase | adjust_quantity | dialogue_target | pending |
| N2-D-INCREASE-2-3 | train | dialogue-family-increase | set_quantity | dialogue_target | pending |
| N2-D-REMOVE-1-1 | train | dialogue-family-remove | view_cart | dialogue_target | pending |
| N2-D-REMOVE-1-2 | train | dialogue-family-remove | remove_line | dialogue_target | pending |
| N2-D-REMOVE-1-3 | train | dialogue-family-remove | cancel_proposal | dialogue_target | pending |
| N2-D-REMOVE-2-1 | train | dialogue-family-remove | view_cart | dialogue_target | pending |
| N2-D-REMOVE-2-2 | train | dialogue-family-remove | remove_line | dialogue_target | pending |
| N2-D-REMOVE-2-3 | train | dialogue-family-remove | cancel_proposal | dialogue_target | pending |
| N2-D-BUDGET-1-1 | train | dialogue-family-budget | request_recommendation | clarification_policy, dialogue_target | pending |
| N2-D-BUDGET-1-2 | train | dialogue-family-budget | request_recommendation | dialogue_target | pending |
| N2-D-BUDGET-1-3 | train | dialogue-family-budget | request_recommendation | dialogue_target, budget_operator | pending |
| N2-D-BUDGET-2-1 | train | dialogue-family-budget | request_recommendation | clarification_policy, dialogue_target | pending |
| N2-D-BUDGET-2-2 | train | dialogue-family-budget | request_recommendation | dialogue_target | pending |
| N2-D-BUDGET-2-3 | train | dialogue-family-budget | request_recommendation | dialogue_target, budget_operator | pending |
| N2-D-SPICE-1-1 | train | dialogue-family-spice | add_item | dialogue_target | pending |
| N2-D-SPICE-1-2 | train | dialogue-family-spice | add_item | dialogue_target | pending |
| N2-D-SPICE-1-3 | train | dialogue-family-spice | set_quantity | dialogue_target | pending |
| N2-D-SPICE-2-1 | train | dialogue-family-spice | add_item | dialogue_target | pending |
| N2-D-SPICE-2-2 | train | dialogue-family-spice | add_item | dialogue_target | pending |
| N2-D-SPICE-2-3 | train | dialogue-family-spice | set_quantity | dialogue_target | pending |
| N2-D-VOLUME-1-1 | train | dialogue-family-volume | add_item | dialogue_target | pending |
| N2-D-VOLUME-1-2 | train | dialogue-family-volume | add_item | dialogue_target | pending |
| N2-D-VOLUME-1-3 | train | dialogue-family-volume | set_quantity | dialogue_target | pending |
| N2-D-VOLUME-2-1 | train | dialogue-family-volume | add_item | dialogue_target | pending |
| N2-D-VOLUME-2-2 | train | dialogue-family-volume | add_item | dialogue_target | pending |
| N2-D-VOLUME-2-3 | train | dialogue-family-volume | set_quantity | dialogue_target | pending |
| N2-D-ASSENT-1-1 | train | dialogue-family-assent | add_item | dialogue_target | pending |
| N2-D-ASSENT-1-2 | train | dialogue-family-assent | express_assent | dialogue_target | pending |
| N2-D-ASSENT-1-3 | train | dialogue-family-assent | view_cart | dialogue_target | pending |
| N2-D-ASSENT-2-1 | train | dialogue-family-assent | add_item | dialogue_target | pending |
| N2-D-ASSENT-2-2 | train | dialogue-family-assent | express_assent | dialogue_target | pending |
| N2-D-ASSENT-2-3 | train | dialogue-family-assent | view_cart | dialogue_target | pending |
| N2-D-OPTION-1-1 | dev | dialogue-family-option | ask_options | dialogue_target | pending |
| N2-D-OPTION-1-2 | dev | dialogue-family-option | add_item | dialogue_target | pending |
| N2-D-OPTION-1-3 | dev | dialogue-family-option | add_item | dialogue_target | pending |
| N2-D-OPTION-2-1 | dev | dialogue-family-option | ask_options | dialogue_target | pending |
| N2-D-OPTION-2-2 | dev | dialogue-family-option | add_item | dialogue_target | pending |
| N2-D-OPTION-2-3 | dev | dialogue-family-option | add_item | dialogue_target | pending |
| N2-D-REF-1-1 | dev | dialogue-family-ref | get_product_details | dialogue_target | pending |
| N2-D-REF-1-2 | dev | dialogue-family-ref | ask_price | dialogue_target | pending |
| N2-D-REF-1-3 | dev | dialogue-family-ref | ask_availability | dialogue_target | pending |
| N2-D-REF-2-1 | dev | dialogue-family-ref | get_product_details | dialogue_target | pending |
| N2-D-REF-2-2 | dev | dialogue-family-ref | ask_price | dialogue_target | pending |
| N2-D-REF-2-3 | dev | dialogue-family-ref | ask_availability | dialogue_target | pending |
| N2-D-RECOVERY-1-1 | test | dialogue-family-recovery | add_item | dialogue_target, referent_policy | pending |
| N2-D-RECOVERY-1-2 | test | dialogue-family-recovery | add_item | dialogue_target, referent_policy | pending |
| N2-D-RECOVERY-1-3 | test | dialogue-family-recovery | add_item | dialogue_target, referent_policy | pending |
| N2-D-RECOVERY-2-1 | test | dialogue-family-recovery | add_item | dialogue_target, referent_policy | pending |
| N2-D-RECOVERY-2-2 | test | dialogue-family-recovery | add_item | dialogue_target, referent_policy | pending |
| N2-D-RECOVERY-2-3 | test | dialogue-family-recovery | add_item | dialogue_target, referent_policy | pending |
| N2-D-SWITCH-1-1 | test | dialogue-family-switch | request_recommendation | dialogue_target | pending |
| N2-D-SWITCH-1-2 | test | dialogue-family-switch | request_recommendation | dialogue_target | pending |
| N2-D-SWITCH-1-3 | test | dialogue-family-switch | request_recommendation | dialogue_target, budget_operator | pending |
| N2-D-SWITCH-2-1 | test | dialogue-family-switch | request_recommendation | dialogue_target | pending |
| N2-D-SWITCH-2-2 | test | dialogue-family-switch | request_recommendation | dialogue_target | pending |
| N2-D-SWITCH-2-3 | test | dialogue-family-switch | request_recommendation | dialogue_target, budget_operator | pending |
