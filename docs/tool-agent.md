# Agent dùng công cụ (tool-use) với câu trả lời được kiểm chứng

Trạng thái: **implemented + tested offline; chạy thật local (Haiku 4.5); deploy AgentCore v8 ngày 18/11/2026 (xem lượt 5–6 trong agentcore-live-evaluation.md).** Bật bằng `AI_PROVIDER=bedrock` + `KFC_AGENT_MODE=tools`; mặc định vẫn là luồng cũ.

## Vì sao đổi

Luồng cũ: mỗi lượt model chỉ được chọn **một hành động**; mọi câu chữ model viết (hỏi lại, gợi ý, giải thích) bị server bỏ và thay bằng câu cố định hoặc luật từ khoá (`grounded-reply.ts`). Khi người dùng thật test (17/11/2026), các câu như "hôm này mình có 200k, giúp mình lựa đồ ăn đủ cho 2 người", "cho mìn 2 pepsi", "vậy mình còn 200k thì ăn được những gì" nhận câu trả lời vô nghĩa ("không có 'mìn'") vì đó là luật từ khoá, không phải Haiku.

## Cách làm mới

```
khách nói ─► ToolAgent ─► Haiku (tool-use) ─┬─► search_menu        (đọc catalog, đã hiểu không dấu/alias/cỡ)
                 ▲                           ├─► view_cart          (đọc giỏ của chính khách)
                 │                           └─► propose_cart_change (CHỈ đề xuất; PolicyEngine kiểm tra)
                 │                                     │
                 └──── kết quả công cụ ◄──────────────┘
Haiku viết câu trả lời ─► reply-guard ─► khách
                             │ sai → báo lỗi cho model viết lại 1 lần → vẫn sai → câu an toàn
```

- Tối đa **4 lần gọi model** mỗi lượt khách; mỗi lần gọi trừ 1 vào giới hạn ngày (`BEDROCK_DAILY_REQUEST_LIMIT`).
- `propose_cart_change` đi qua đúng `executeProposedActions` + `PolicyEngine` + lưu đề xuất (token, hạn 10 phút, chữ ký giỏ/menu) như luồng cũ. Khách vẫn phải bấm **“Xác nhận thao tác”**; chữ "ok" không thực thi.
- Câu hỏi dị ứng/nhà hàng/giờ mở cửa: model gọi `official_info` (chế độ tools không định tuyến bằng từ khoá).

## reply-guard: kiểm tra sự thật, không kiểm tra cách nói (v2, 17/11/2026)

Bản đầu đoán trước những phép tính model được phép làm và bắt model tra lại món đã nói ở lượt trước. Khi người dùng test thật, câu trả lời đúng bị chặn vì một con số chênh lệch giá ("2.000 ₫") — chính lớp kiểm tra trở thành thứ "đính cứng". Bản v2 chỉ chặn 4 lỗi có hại thật:

1. **Gắn sai giá cho món có thật**: số tiền đứng ngay sau tên món (có thể kèm "giá", ":", "-") phải bằng giá catalog hoặc bội số của nó ("2 × Pepsi (Đại): 40.000 ₫"). Tổng, chênh lệch, còn dư, chia người là tự do — tổng tiền thật luôn do server tính khi đề xuất/xác nhận.
2. **Gợi ý món đang hết** mà không nói là hết.
3. **Tuyên bố đã làm**: "đã thêm/đặt/xoá/cập nhật/thanh toán".
4. **Link ngoài** kfcvietnam.com.vn.

Không còn định tuyến bằng từ khoá ở chế độ tools: câu hỏi dị ứng, giờ mở cửa, nhà hàng do model tự gọi công cụ `official_info`.

## File

| File | Nội dung |
|---|---|
| [tool-agent/agent.ts](../src/lib/agent/tool-agent/agent.ts) | Vòng lặp, prompt hệ thống, trace (chỉ số lượt/tên tool/token, không có nội dung tin nhắn) |
| [tool-agent/tools.ts](../src/lib/agent/tool-agent/tools.ts) | Định nghĩa 3 tool + schema kiểm tra tham số |
| [tool-agent/reply-guard.ts](../src/lib/agent/tool-agent/reply-guard.ts) | Kiểm chứng câu trả lời |
| [aws/bedrock.ts](../src/lib/aws/bedrock.ts) | `invokeWithTools`: cùng guardrail với `generateResponse` (model/region bắt buộc, budget, timeout 15 s, không retry, không fallback mock); trần input 48 KB cho vòng tool |
| [agent-core.ts](../src/lib/agent/agent-core.ts) | `runToolAgent` (gắn tool với đúng khách), `storePendingProposal` dùng chung cho cả hai luồng |
| [scripts/test-tool-agent.cjs](../scripts/test-tool-agent.cjs) | 16 test offline |

## Kiểm thử offline (17/11/2026)

`npm run test:tool-agent` 14/14 (v2), model giả lập theo kịch bản, catalog KFC thật, giỏ thật (local JSON): gợi ý 200k cho 2 người có "còn dư"; giá bịa bị bắt và model viết lại; câu "đã thêm" không bao giờ tới khách; món chưa tra không được nhắc; đề xuất → "ok" không chạy → bấm xác nhận → đổi số lượng bằng ID catalog; giỏ trả lời từ `view_cart`; tool lạ/tham số sai không làm sập; giới hạn 4 lần gọi; lỗi Bedrock là lỗi có kiểm soát; request Bedrock đúng định dạng tool-use cho Haiku 4.5 và 5.5.

Kiểm tra đột biến: tắt reply-guard → test 02, 03, 04 fail như mong đợi.

Toàn bộ test cũ vẫn xanh (`npm test` 101, smoke 84, `test:understanding` 22, `test:readonly-agent` 34, `test:bedrock` 14, build, evaluate).

## Chưa làm / giới hạn

- Bản sửa chống bịa món đã deploy (v8); còn bịa trong câu văn xuôi và khoảng giá theo nhóm (lượt 6).
- Chi phí/độ trễ: 2–4 lần gọi Haiku 4.5 mỗi tin (~0,01–0,02 USD, ~6–15 s).
- reply-guard nhận diện tên món bằng khớp chuỗi; model viết tắt tên món ("combo 2 No Nê") sẽ không bị coi là nhắc món (không chặn, cũng không hiện thẻ).
- `grounded-reply.ts` vẫn còn trong luồng cũ (không dùng khi `KFC_AGENT_MODE=tools`); nên gỡ khi luồng tool được nghiệm thu.
