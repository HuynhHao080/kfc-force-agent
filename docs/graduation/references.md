# Nguồn tham khảo kỹ thuật

Các nguồn dưới được kiểm tra trực tiếp ngày 2026-11-06. Khi nộp, chuyển sang kiểu trích dẫn của trường và ghi ngày truy cập của chính mình.

1. **Next.js — Route Handlers.** Cách tổ chức HTTP handler trong App Router. Tài liệu cục bộ của phiên bản đang cài vẫn quyết định khi triển khai project. [Nguồn chính thức](https://nextjs.org/docs/app/getting-started/route-handlers).
2. **Node.js — crypto/scrypt.** API băm mật khẩu và tham số tính toán. [Node.js crypto](https://nodejs.org/api/crypto.html#cryptoscryptpassword-salt-keylen-options-callback).
3. **OWASP — Password Storage.** Nguồn chọn cấu hình scrypt N=2^15, r=8, p=3; không đồng nghĩa chứng nhận toàn hệ thống. [Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#scrypt).
4. **AWS — Bedrock InvokeModel.** API inference adapter hướng tới; quyền và model cần cấu hình/kiểm chứng riêng, chưa phải bằng chứng đã gọi thật. [API reference](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_InvokeModel.html).
5. **GitHub Actions — checkout.** Bước lấy source; workflow pin SHA tra từ tag v7 và chỉ có quyền read. [actions/checkout](https://github.com/actions/checkout).
6. **GitHub Actions — setup-node.** Thiết lập Node trong workflow; project cấu hình Node 24. [actions/setup-node](https://github.com/actions/setup-node).

## Bằng chứng nội bộ

- package.json / lockfile: phiên bản thực.
- test-chat.cjs / smoke-chat.cjs: điều kiện, assert.
- intent-cases.vi.json / evaluate-intents.cjs: dataset, metric.
- verification.md / evaluation-results.md: kết quả và giới hạn.

Bằng chứng cài đặt/đánh giá nội bộ không thay cho công trình học thuật độc lập.
