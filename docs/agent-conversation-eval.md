# Đo agent bằng hội thoại nhiều lượt

Trạng thái: **implemented + tested offline (18/11/2026). Chưa chạy với Haiku thật.**

## Mục đích

Bộ 20 câu một lượt (`evaluate-agentcore-live.cjs`) chấm theo kiểu luồng cũ và không đo được hội thoại nối tiếp. Bộ này đo agent như khách thật dùng: hỏi, đổi ý, trả lời ngắn dựa trên lượt trước, bấm xác nhận, sửa giỏ. Mỗi lượt có tiêu chí khách quan, để mỗi lần sửa agent đều đo lại được thay vì cảm tính.

**Đây là bộ phát triển** (`status: development`): do người làm agent viết, dùng để sửa và đo lại. Không dùng làm số liệu đánh giá cuối; bộ độc lập phải do người khác viết và chỉ chạy một lần.

## Thành phần

| File | Nội dung |
|---|---|
| [tests/data/agent-conversations/conversations.vi.json](../tests/data/agent-conversations/conversations.vi.json) | 25 hội thoại, 37 lượt khách + 6 lần bấm xác nhận; trạng thái catalog mong đợi (món đã ngừng bán) |
| [scripts/conversation-eval-core.cjs](../scripts/conversation-eval-core.cjs) | Kiểm tra bộ dữ liệu với catalog thật và chấm từng lượt |
| [scripts/evaluate-conversations.cjs](../scripts/evaluate-conversations.cjs) | Chạy qua pipeline thật (ChatService → ToolAgent → Bedrock → PolicyEngine → giỏ) trên thư mục dữ liệu mới |
| [scripts/test-conversation-eval.cjs](../scripts/test-conversation-eval.cjs) | 6 test offline cho bộ chấm, dùng tóm tắt đề xuất và giỏ thật do server sinh |

Nhóm hội thoại: ngân sách (2 người, 1 người, nhóm 4), đổi ý, hỏi lại cỡ và trả lời ngắn ở lượt sau, món không bán (Coca, cà phê, trà sữa), món đã ngừng bán, lọc giá, thành phần và so sánh combo, sửa giỏ (thêm/đổi/bỏ/xoá hết, giỏ trống), câu phủ định, "ok" không phải xác nhận, câu chèn lệnh, tiếng Anh lẫn, chọn theo thứ tự gợi ý, số lượng viết bằng chữ, dị ứng, giờ mở cửa.

## Tiêu chí chấm

Mọi lượt khách: không lỗi, không trả câu dự phòng, câu trả lời qua reply-guard với catalog hiện tại (không bịa món/giá, không nói "đã thêm").

Theo từng lượt (khai báo trong `expect`): có/không có đề xuất; đúng hành động, đúng món, đúng số lượng, không thừa món; trần tổng tiền/giá món; phải hỏi lại; phải nhắc tới nội dung (chấp nhận không dấu, "20.000"/"20k"); không được nhắc; không gợi ý món đã ngừng bán; số thẻ món và trần giá thẻ món; giỏ hàng thật sau lượt (đúng món, đúng số lượng, hoặc trống); câu trả lời có tổng tiền giỏ.

Một hội thoại đạt khi mọi lượt đạt. Báo cáo ghi nguyên văn câu trả lời, đề xuất, giỏ và lý do từng lượt trượt để đọc lại bằng mắt.

## Chạy

```powershell
npm run evaluate:conversations -- --dry-run          # kiểm tra bộ dữ liệu, không gọi model
npm run test:conversation-eval                       # test bộ chấm, offline
# Chạy thật (tốn phí Bedrock, cần duyệt số lượt):
$env:AWS_PROFILE="kfc-dev"; $env:AWS_REGION="ap-southeast-1"
$env:BEDROCK_MODEL_ID="global.anthropic.claude-haiku-4-5-20251001-v1:0"
npm run evaluate:conversations -- --approve-invocations 120 [--only CV-01,CV-03]
```

`--approve-invocations` là trần cứng: trở thành giới hạn ngày của thư mục dữ liệu mới; không bắt đầu lượt mới khi còn dưới 4 lượt gọi. Ước tính 2–3 lượt gọi mỗi lượt khách (khoảng 80–110 cho cả bộ), tối đa 148.

## Kiểm thử bộ chấm

`npm run test:conversation-eval` 6/6. Kiểm tra đột biến: cho "không đề xuất" luôn đạt, bỏ kiểm tra món thừa, không đọc dòng "Đổi … thành …", bỏ kiểm tra tổng giỏ, bỏ fact check → mỗi trường hợp đều làm test fail.

## Giới hạn

- Chấm tự động đo hành vi (đề xuất, giỏ, sự thật), không đo giọng văn tự nhiên; vẫn cần đọc báo cáo.
- Chạy local với Bedrock thật (cùng model, cùng code với AgentCore); chưa có chế độ gọi thẳng runtime AgentCore.
- Một số lượt chấp nhận nhiều cách đúng (ví dụ "4 cái bánh trứng": hộp 4 hoặc 4 cái lẻ, hoặc hỏi lại).
