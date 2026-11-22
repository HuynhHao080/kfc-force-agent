# Kênh WhatsApp

Issue #16, giai đoạn 2: webhook, chuẩn hoá tin và gửi tin.

| Phần | Trạng thái |
|---|---|
| Kiểm chữ ký `X-Hub-Signature-256`, xác minh webhook (GET) | Đã code, đã test offline |
| Chuẩn hoá payload Meta thành `InboundMessage` (chữ, nút, danh sách, loại chưa hỗ trợ; bỏ status callback) | Đã code, đã test offline |
| Hàng đợi local: tuần tự theo khách, chống trùng theo `wamid` | Đã code, đã test offline |
| Gửi tin qua Graph API (chữ, nút, danh sách), thử lại có giới hạn | Đã code, đã test với Graph API giả |
| Định danh khách: `wa_` + HMAC của số WhatsApp | Đã code, đã test offline |
| Cổng Next.js `/api/channels/whatsapp/webhook` | Đã code, đã test offline |
| Adapter Lambda cho API Gateway HTTP API | Đã code, đã test với sự kiện giả; **chưa deploy** |
| Worker gọi agent rồi trả lời khách | **Chưa làm** (giai đoạn 3); hiện tin chỉ được ghi log dạng che |
| SQS FIFO, nút xác nhận, checkout trong chat | **Chưa làm** (giai đoạn 3–4) |
| Thử với Meta thật và điện thoại thật | **Chưa làm** |

## Luồng

1. Meta gửi `POST` tới webhook. Cổng đọc **raw body**, kiểm HMAC-SHA256 bằng `WHATSAPP_APP_SECRET`, so sánh constant-time.
2. Sai hoặc thiếu chữ ký thì trả 401 và không đọc nội dung. Chưa cấu hình App Secret thì trả 503 (fail closed). Body quá 1 MB thì trả 413.
3. Payload được chuẩn hoá. Một webhook có thể có nhiều tin. Tin sai cấu trúc bị bỏ qua; ảnh, sticker và các loại khác thành `unsupported`.
4. Tin được đưa vào hàng đợi, cổng trả 200 ngay. Nếu hàng đợi lỗi thì trả 500 để Meta gửi lại; tin trùng `wamid` bị bỏ.

Logic nằm ở `src/lib/channels/whatsapp/webhook.ts`, dùng chung cho cổng Next.js (`src/app/api/channels/whatsapp/webhook/route.ts`) và cổng Lambda (`src/channels/lambda/whatsapp-webhook.ts`).

## Dữ liệu cá nhân

- Số WhatsApp là dữ liệu liên hệ. `userId` nội bộ là `wa_` + HMAC-SHA256 (khoá `CHANNEL_ID_SECRET`, tối thiểu 32 ký tự) nên không chứa số. Khoá này bắt buộc, vì không có khoá thì từ mã băm dò ngược ra số điện thoại được.
- Log chỉ ghi loại tin, mã lỗi số và số đã che (`84******001`). Log không ghi token, App Secret, nội dung tin hay body phản hồi của Meta.
- Số Việt Nam (`84` + 9 số) được đổi sang `0…` để đặt đơn. Với số nước ngoài, checkout trong chat sẽ hỏi số (giai đoạn 4).

## Giới hạn đã biết

- Hàng đợi local chỉ chạy trong một tiến trình, giống local JSON và budget Bedrock. Chạy nhiều tiến trình phải dùng SQS FIFO (giai đoạn 3).
- Giống SQS FIFO, một tin bị lỗi khi xử lý thì lần Meta gửi lại cũng bị coi là trùng và bỏ qua. Worker ở giai đoạn 3 phải báo lỗi cho khách thay vì im lặng.
- Thử lại sau lỗi mạng có thể làm khách nhận trùng một tin, nếu thực ra Meta đã nhận tin trước đó.
- Nút có tiêu đề tối đa 20 ký tự; nhãn "Xác nhận thao tác" có 17 ký tự nên vừa.

## Kiểm tra

`npm run test:whatsapp-channel`, đã có trong `npm run check`. Test dùng payload mẫu trong `tests/data/whatsapp/meta-webhooks.json` (số và mã giả) và Graph API giả, không gọi mạng.
