# Đo agent bằng hội thoại nhiều lượt

Trạng thái: **implemented + tested offline; lượt 1 chạy với Haiku 4.5 thật ngày 18/11/2026 (code chưa deploy).**

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

## Lượt 1 (18/11/2026, Haiku 4.5, chạy local)

91/120 lượt gọi model được duyệt. **30/43 lượt đạt, 19/25 hội thoại đạt.** Báo cáo: `output/evaluation/conversations-2026-11-18T12-52-55-347Z.json`. Đạt trọn các nhóm: ngân sách (3/3), hỏi lại cỡ và trả lời ngắn ở lượt sau, lọc giá, thông tin combo, dị ứng/giờ mở cửa, câu chèn lệnh, tiếng Anh lẫn, chọn theo thứ tự gợi ý, số lượng viết bằng chữ.

Đọc tay các lượt trượt:

| Lỗi | Lượt | Nguyên nhân |
|---|---|---|
| Bảo khách bấm “Xác nhận thao tác” nhưng **không tạo đề xuất** | CV-25#3 "xoá hết giỏ", CV-09#5 "bỏ burger" | Model chỉ viết chữ, không gọi `propose_cart_change` |
| Đề xuất đã tạo nhưng khách nhận "Xin lỗi…" | CV-02#3, CV-09#1 | Hết 4 lượt gọi (tra từng món một) hoặc lượt cuối rỗng; CV-02#3 còn thiếu Mì Ý Gà Viên |
| Hỏi lại khi đã có món đúng tên | CV-02#1 "2 miếng gà rán", CV-24#1 "1 cơm gà rán", CV-09#3 giỏ chỉ có 1 loại Pepsi | Kết quả tìm không cho biết món nào trùng đúng tên |
| Món ngừng bán: "không có", gõ sai "zone", không gợi ý bản 179K | CV-06 | Tìm "xô zòn zã 159k" ra rỗng, không có dữ liệu thay thế |
| **Lỗi của bộ đo** | CV-04 | Luật cấm "có coca" bắt nhầm câu đúng "không có Coca"; đã bỏ luật này |

Kèm theo, reply-guard bắt nhầm (gây viết lại, tốn lượt gọi): danh sách cỡ "- Vừa: 17.000 ₫" dưới tên Pepsi, gạch đầu dòng là câu hỏi/hướng dẫn, và hai số "46.000 ₫ … 184.000 ₫" bị đọc dính.

### Đã sửa sau lượt 1 (offline, chưa đo lại)

- `search_menu`: đánh dấu `exact` và đưa lên đầu món trùng đúng tên khách gọi (bỏ số lượng đầu tên); khi rỗng, báo `discontinued` (món ngừng bán trùng tên) và `similar` (tìm lại sau khi bỏ "159k").
- Agent: nếu đã có đề xuất mà hết lượt gọi/trả lời rỗng, khách nhận tóm tắt đề xuất do server tạo thay vì "Xin lỗi…". Prompt: đề xuất luôn món `exact`; giỏ chỉ có một dòng khớp thì đổi/bỏ luôn; chỉ nhắc nút khi đề xuất đã được tạo; gọi nhiều `search_menu` trong một lượt.
- reply-guard: chặn câu nhắc “Xác nhận thao tác” khi không có đề xuất nào đang chờ; cho qua dòng cỡ/biến thể khi có món thật chứa các chữ đó với đúng giá; chỉ kiểm từ vựng ở gạch đầu dòng có dạng món (có giá, có "+", hoặc ngắn và không phải câu hỏi); tách số tiền dính nhau.
- Test 22–24 trong `test:tool-agent` (22/22), tắt từng thay đổi → test tương ứng fail. Phát lại 115 câu trả lời thật: chặn đúng 9 câu sai đã biết, không chặn nhầm thêm câu nào; 41/41 câu của lượt 1 qua.

## Lượt 2 (18/11/2026, Haiku 4.5, sau các bản sửa của lượt 1)

91/120 lượt gọi. **37/43 lượt đạt (lượt 1: 30), 21/25 hội thoại đạt (lượt 1: 19).** Báo cáo: `output/evaluation/conversations-2026-11-18T13-42-27-052Z.json`. Sửa giỏ đạt 3/3: "xoá hết giỏ", "bỏ burger" tạo đề xuất thật (guard bắt câu nhắc nút khi chưa có đề xuất, model tự sửa; một lượt hết bước nhận tóm tắt đề xuất của server); "1 cơm gà rán" đề xuất ngay; đổi ý sang mì ý + burger đề xuất đủ hai món.

Còn trượt (đọc tay):

| Lượt | Hiện tượng | Nguyên nhân |
|---|---|---|
| CV-01#2 "lấy cái đầu tiên bạn gợi ý" | Gợi ý lại món khác thay vì đề xuất phương án 1 | Model không bám câu trả lời trước |
| CV-02#1 "2 miếng gà rán" | Hỏi lại, không đưa ra "2 Miếng Gà Rán" | Model tra "gà rán": tên khách nói không được đánh dấu `exact`, món bị cắt khỏi kết quả |
| CV-06 "xô zòn zã 159k" | "không có", viết "zone" | Model tra "xô zone zã": không khớp món ngừng bán |
| CV-17 câu chèn lệnh | Giỏ an toàn nhưng khách nhận câu dự phòng | Guard chặn cả câu giải thích "không thể tự xác nhận, bạn bấm…" |

### Đã sửa sau lượt 2 (offline, chưa đo lại)

- `search_menu` so tên món với **chính câu của khách** (không chỉ từ khoá model gõ): món khách gọi tên được `exact` và đứng đầu kể cả khi vượt `limit`; món ngừng bán khách nhắc tới được báo `discontinued` kèm `similar` dù model gõ sai.
- Guard chỉ chặn câu **bảo khách bấm nút** khi chưa có đề xuất; câu có phủ định/điều kiện ("không thể", "chỉ khi", "sau khi", "nếu") được qua.
- Prompt: khách chọn theo thứ tự ("cái đầu tiên", "phương án 2") thì lấy đúng mục đó và đề xuất luôn.
- Test 25–26 (`test:tool-agent` 24/24); tắt từng bản sửa → test tương ứng fail. Phát lại 151 câu trả lời thật: chặn đúng 9 câu sai đã biết, không chặn nhầm.

## Lượt 3 (18/11/2026, Haiku 4.5, sau các bản sửa của lượt 2)

93/120 lượt gọi. **38/43 lượt đạt, 21/25 hội thoại đạt.** Báo cáo: `output/evaluation/conversations-2026-11-18T13-51-21-865Z.json`.

Bốn lỗi của lượt 2 đã khỏi: "lấy cái đầu tiên" đề xuất đúng phương án 1; "2 miếng gà rán" đề xuất "2 Miếng Gà Rán"; "xô zòn zã 159k" → "đã ngừng bán… còn Xô Zòn Zã 179K"; câu chèn lệnh được từ chối rõ, giỏ an toàn, không còn câu dự phòng.

Còn trượt (đọc tay):

| Lượt | Hiện tượng | Ghi chú |
|---|---|---|
| CV-02#3 | Câu trả lời ghi "Mì Ý Gà Viên + Burger Tôm", **đề xuất thật là Burger Gà Yo + Burger Tôm**; mở đầu "Mình vừa thêm" | Nghiêm trọng: chữ và đề xuất không khớp; guard chưa so hai thứ này; "vừa thêm" chưa nằm trong mẫu câu tuyên bố đã làm |
| CV-09#5 "bỏ burger ra" | Model nhắc nút mà không gọi công cụ, guard chặn đúng 2 lần, hết bước → câu dự phòng | Lượt 2 đạt: không ổn định |
| CV-20 "hai cái bánh trứng" | Hỏi lại đơn lẻ hay combo | Lượt 1, 2 đạt: không ổn định |
| CV-01#3 | Giỏ 2 dòng, tiêu chí cần 1 | **Lỗi bộ đo**: "phương án 1" gồm hai combo, đề xuất cả hai là đúng; tiêu chí "đúng 1 dòng" sai |

Guard vẫn phải bắt "Xong…" ở đầu câu nhiều lần (tốn lượt gọi viết lại).

| Lượt | Lượt khách đạt | Hội thoại đạt | Lượt gọi |
|---|---|---|---|
| 1 | 30/43 | 19/25 | 91 |
| 2 | 37/43 | 21/25 | 91 |
| 3 | 38/43 | 21/25 | 93 |
