# Agent dùng công cụ (tool-use) với câu trả lời được kiểm chứng

Trạng thái: **implemented + tested offline; chạy thật local (Haiku 4.5); deploy AgentCore v8 ngày 18/11/2026 (xem lượt 5–6 trong agentcore-live-evaluation.md).** Bật bằng `AI_PROVIDER=bedrock` + `KFC_AGENT_MODE=tools`; mặc định vẫn là luồng cũ.

## Vì sao đổi

Luồng cũ: mỗi lượt model chỉ được chọn **một hành động**; mọi câu chữ model viết (hỏi lại, gợi ý, giải thích) bị server bỏ và thay bằng câu cố định hoặc luật từ khoá (`grounded-reply.ts`). Khi người dùng thật test (17/11/2026), các câu như "hôm này mình có 200k, giúp mình lựa đồ ăn đủ cho 2 người", "cho mìn 2 pepsi", "vậy mình còn 200k thì ăn được những gì" nhận câu trả lời vô nghĩa ("không có 'mìn'") vì đó là luật từ khoá, không phải Haiku.

## Cách làm mới

```
khách nói ─► ToolAgent ─► Haiku (tool-use) ─┬─► search_menu        (đọc catalog, đã hiểu không dấu/alias/cỡ)
                 ▲                           ├─► view_cart          (đọc giỏ của chính khách)
                 │                           ├─► get_recent_orders  (3 đơn gần nhất của chính khách, đối chiếu menu hôm nay)
                 │                           ├─► official_info      (dị ứng, nhà hàng, giờ mở cửa)
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

## Nhớ đơn cũ: `get_recent_orders` (issue #16, giai đoạn 5)

Khách nói "như lần trước", "đặt lại", "món tôi hay gọi": model gọi `get_recent_orders`.

- **Trả về:** tối đa 3 đơn gần nhất **của chính khách đó**, mới nhất trước, mỗi đơn có mã đơn (như admin hiển thị), thời điểm, trạng thái, hình thức nhận.
- **Mỗi món được đối chiếu với thực đơn hôm nay:**
  - `available`: kèm giá hiện tại, và `price_changed` nếu khác giá khách đã trả;
  - `sold_out`: không kèm giá;
  - `discontinued`: không kèm giá, nhưng có nhóm món để model tìm món thay thế bằng `search_menu`.
- **Không đưa tên, số điện thoại, địa chỉ của đơn vào prompt.**
- **Đặt lại vẫn là `propose_cart_change`**, nên khách phải bấm “Xác nhận thao tác” như mọi thay đổi giỏ. Bản xem trước của server luôn dùng giá hiện tại; xác nhận thì giỏ được tính theo giá hiện tại.
- **Reply-guard:** vẫn chặn giá cũ và chặn gợi ý lại món đã ngừng bán. Riêng cụm "giá … đã tăng/đổi/giảm" không còn bị coi là câu "đã làm xong", nếu "giá" đứng trước (cách tối đa 3 từ) và không có "mình"/"bạn" chen giữa; "mình đã giảm 1 Pepsi" vẫn bị chặn. Chạy lại guard trên 215 câu trả lời thật của 5 lượt đo: 26 câu "đã làm xong" trước và sau khi sửa, không câu nào đổi kết quả.
- **AgentCore Memory:** chưa dùng. Lịch sử đơn đọc từ repository đơn hàng (local/DynamoDB) nên test được offline.

Test: `test:tool-agent` 31–33.
- Đơn của khách khác không lộ; chỉ 3 đơn.
- Món ngừng bán, tạm hết, đổi giá được đánh dấu đúng.
- Không có dữ liệu liên hệ trong kết quả.
- Đặt lại: không đổi giỏ trước khi bấm nút, tính giá mới.
- Guard với giá cũ, món đã ngừng bán, cụm "giá đã tăng".

Kiểm tra ngược: coi món ngừng bán là còn bán, hoặc bỏ giới hạn 3 đơn → test 31 fail; bỏ ngoại lệ "giá đã tăng" → test 32, 33 fail.

## Chưa làm / giới hạn

- Bản sửa chống bịa món đã deploy (v8); còn bịa trong câu văn xuôi và khoảng giá theo nhóm (lượt 6).
- Chi phí/độ trễ: 2–4 lần gọi Haiku 4.5 mỗi tin (~0,01–0,02 USD, ~6–15 s).
- reply-guard nhận diện tên món bằng khớp chuỗi; model viết tắt tên món ("combo 2 No Nê") sẽ không bị coi là nhắc món (không chặn, cũng không hiện thẻ).
- `grounded-reply.ts` vẫn còn trong luồng cũ (không dùng khi `KFC_AGENT_MODE=tools`); nên gỡ khi luồng tool được nghiệm thu.
