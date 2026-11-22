# Kênh WhatsApp

Issue #16. Giai đoạn 2 làm webhook, chuẩn hoá tin và gửi tin. Giai đoạn 3 làm hàng đợi, worker và định danh khách.

| Phần | Trạng thái |
|---|---|
| Kiểm chữ ký `X-Hub-Signature-256`, xác minh webhook (GET) | Đã code, đã test offline |
| Chuẩn hoá payload Meta thành `InboundMessage` (chữ, nút, danh sách, loại chưa hỗ trợ; bỏ status callback) | Đã code, đã test offline |
| Gửi tin qua Graph API (chữ, nút, danh sách), thử lại có giới hạn | Đã code, đã test với Graph API giả |
| Định danh khách: `wa_` + HMAC của số WhatsApp; trạng thái hội thoại (local, mock, DynamoDB) ghi compare-and-set | Đã code, đã test offline (mock + local); **DynamoDB chưa chạy thật** |
| Hàng đợi local: tuần tự theo khách, song song giữa khách, chống trùng `wamid` | Đã code, đã test offline |
| Gộp tin liên tiếp của một khách thành một lượt | Đã code, đã test offline |
| Worker: ghi trạng thái → gọi agent (cùng pipeline với web) → gửi trả lời; nhân viên tiếp quản thì AI im lặng | Đã code, đã test end-to-end local với AI mock và Graph API giả |
| Driver SQS FIFO, Lambda worker (partial batch), cổng gọi AgentCore | Đã code, đã test với SQS/AgentCore giả; **chưa deploy, chưa nối SDK thật** |
| Cổng Next.js `/api/channels/whatsapp/webhook`, adapter Lambda cho API Gateway | Đã code, đã test offline; Lambda **chưa deploy** |
| Nút xác nhận, checkout trong chat | **Chưa làm** (giai đoạn 4) |
| Thử với Meta thật và điện thoại thật | **Chưa làm** |

## Luồng

```text
Meta → webhook (kiểm chữ ký, chuẩn hoá) → hàng đợi → gộp tin theo khách → worker → ChatService/AgentCore → gửi trả lời
```

1. Meta gửi `POST` tới webhook. Cổng đọc **raw body**, kiểm HMAC-SHA256 bằng `WHATSAPP_APP_SECRET`, so sánh constant-time.
2. Sai hoặc thiếu chữ ký thì trả 401 và không đọc nội dung. Thiếu cấu hình (App Secret, cấu hình gửi tin, `CHANNEL_ID_SECRET`) thì trả 503 (fail closed), không nhận tin rồi im lặng. Body quá 1 MB thì trả 413.
3. Payload được chuẩn hoá. Một webhook có thể có nhiều tin. Tin sai cấu trúc bị bỏ qua; ảnh, sticker và các loại khác thành `unsupported`.
4. Tin được đưa vào hàng đợi, cổng trả 200 ngay. Hàng đợi lỗi thì trả 500 để Meta gửi lại; tin trùng `wamid` bị bỏ.
5. Tin chữ liên tiếp của một khách được gộp thành một lượt (xuống dòng giữa các tin), ví dụ "cho 2 gà" / "à 3 đi" / "thêm pepsi" thành một lượt agent. Nút bấm và loại khác được gửi đi ngay.
6. Worker ghi nhận trạng thái hội thoại (tạo ở tin đầu, cập nhật thời điểm tin gần nhất cho cửa sổ 24 giờ, tên hiển thị) rồi:
   - mode `HUMAN` (nhân viên tiếp quản): không gọi agent, không trả lời;
   - có tin chữ: gọi agent với `platform: "whatsapp"`, phiên `chat_<userId>`, và gửi câu trả lời. Agent lỗi thì gửi câu xin lỗi, không để khách chờ;
   - chỉ có loại chưa hỗ trợ: gửi câu hướng dẫn nhắn bằng chữ.

Mọi thay đổi giỏ vẫn chỉ là đề xuất của agent và cần xác nhận. Giai đoạn 4 sẽ gửi nút xác nhận; gõ chữ "xác nhận" không thực thi.

| | Local (Next.js) | AWS |
|---|---|---|
| Cổng | `src/app/api/channels/whatsapp/webhook/route.ts` | `src/channels/lambda/whatsapp-webhook.ts` sau API Gateway |
| Hàng đợi | Trong tiến trình (`queue.ts`) | SQS FIFO (`sqs-queue.ts`): group = mã khách, dedup = SHA-256 của `wamid` |
| Gộp tin | Hẹn giờ `CHANNEL_DEBOUNCE_MS` (mặc định 2,5 s, tối đa chờ 8 s) | Tin cùng khách trong một lô SQS; độ trễ gom tin đặt ở cấu hình queue khi deploy |
| Khoá theo khách | `withUserLock`, như route web | SQS FIFO tuần tự theo group |
| Agent | `ChatService.processChat` | AgentCore Runtime (`agentCoreChatPort`) |
| Worker | `local-runtime.ts` | `src/channels/lambda/channel-worker.ts`: lỗi của một khách chỉ trả lại tin của khách đó (partial batch) |

SQS và AgentCore được truyền vào dưới dạng cổng (`SqsSendPort`, `AgentCoreInvoke`). Repo chưa thêm dependency `@aws-sdk/client-sqs` hay `@aws-sdk/client-bedrock-agentcore`. Việc thêm hai dependency này và nối SDK thật cần nhóm thống nhất khi làm phần deploy (giai đoạn 7).

## Dữ liệu cá nhân

- Số WhatsApp là dữ liệu liên hệ. `userId` nội bộ là `wa_` + HMAC-SHA256 (khoá `CHANNEL_ID_SECRET`, tối thiểu 32 ký tự) nên không chứa số. Khoá này bắt buộc, vì không có khoá thì từ mã băm dò ngược ra số điện thoại được.
- Số chỉ được lưu trong trạng thái hội thoại (`externalUserId`, cần để trả lời) và trong body tin SQS. Khi deploy, SQS và DynamoDB phải bật mã hoá. Khoá DynamoDB (`CHANNEL#whatsapp#<mã khách>`) và `MessageGroupId` SQS chỉ dùng mã băm.
- Log chỉ ghi loại tin, kết quả, mã lỗi số và số đã che (`84******001`). Log không ghi token, App Secret, nội dung tin hay body phản hồi của Meta.
- Số Việt Nam (`84` + 9 số) được đổi sang `0…` để đặt đơn. Với số nước ngoài, checkout trong chat sẽ hỏi số (giai đoạn 4).

## Giới hạn đã biết

- Hàng đợi và bộ gộp tin local chỉ chạy trong một tiến trình, giống local JSON và budget Bedrock. Tắt tiến trình khi còn tin chờ gộp thì mất các tin đó; Meta không gửi lại vì đã nhận 200. Chạy thật dùng SQS.
- Giống SQS FIFO, một tin bị lỗi khi xử lý thì lần Meta gửi lại cũng bị coi là trùng. Vì vậy worker luôn trả lời khách (xin lỗi) khi agent lỗi.
- Gộp tin giữ các tin mới nhất trong giới hạn 1000 ký tự của chat; tin cũ hơn trong cùng cụm bị bỏ.
- Thử lại sau lỗi mạng có thể làm khách nhận trùng một tin, nếu thực ra Meta đã nhận tin trước đó.
- Nút có tiêu đề tối đa 20 ký tự; nhãn "Xác nhận thao tác" có 17 ký tự nên vừa.

## Kiểm tra

`npm run test:whatsapp-channel` và `npm run test:channel-queue`, đều đã có trong `npm run check`. Test dùng payload mẫu (số và mã giả), AI mock, Graph API giả, SQS giả và AgentCore giả; không gọi mạng.
