@AGENTS.md

# Claude Code — kfc-force-agent

Bổ sung ngắn gọn cho [AGENTS.md](AGENTS.md) (nguồn quy tắc chung) và [CONTRIBUTING.md](CONTRIBUTING.md). Không thay thế, không lặp lại chi tiết — đọc nguồn chính khi cần.

## Stack & bất biến của repo

- Next.js 16 + React 19 + TypeScript strict + Tailwind 4. Next của repo có breaking changes; trước khi sửa Next, đọc `node_modules/next/dist/docs/` — không dựa vào trí nhớ.
- Mặc định `AI_PROVIDER=mock`, `PERSISTENCE_DRIVER=local`: không AWS credentials, không inference trả phí.
- Giá, tổng tiền, danh tính, quyền lấy từ server; client DTO không trusted. Snapshot giá/khuyến mãi trong đơn; checkout giữ idempotency; thay đổi giỏ phải xác nhận token/owner/hạn và dữ liệu hiện tại — không bỏ validation/confirmation.
- State machine: pickup `CONFIRMED → PREPARING → READY → COMPLETED`; delivery dùng `DELIVERING`. Không đổi thứ tự lock; không bỏ `SHOP_ORDER_GATE` nếu chưa phân tích race và có test tái hiện.
- Local JSON + budget Bedrock là một tiến trình; không tăng replica/worker, không nâng cấu hình DynamoDB khi chưa verify giao dịch tương ứng.
- Không đổi API/schema/file dùng chung (`package.json`, shared types, `next.config.ts`, AGENTS.md, skill, CI, script test tổng hợp) khi chưa thống nhất với người tích hợp.
- AWS writes/inference chỉ khi đã duyệt phạm vi và ngân sách — xem `docs/graduation/aws-readiness.md` (hiện chưa có bằng chứng deploy); `npm run aws:preflight` chỉ đọc.

## Kiểm tra

- Sửa code ứng dụng: `npm run check`. Guard nhóm: `npm run team:check`, `npm run test:team`.
- Đổi prompt/parser: thêm `npm run evaluate`. Thay đóng gói: chạy test tương ứng.
- Quy trình đầy đủ (git diff --cached, secret scan, PR review): xem [CONTRIBUTING.md](CONTRIBUTING.md#kiểm-tra-và-dữ-liệu).

## Conventions

- Bình luận/docs/lỗi cho khách: tiếng Việt; code/identifier: tiếng Anh.
- Commit: prefix `feat|fix|docs|chore|test:`, thể mệnh lệnh, ≤50 ký tự.
- Phân biệt implemented / tested / deployed trong mọi báo cáo; không ghi "100%" hay "đã deploy" khi chưa có bằng chứng tương ứng.

## Skills

Claude Code tự khám phá skills (user-level tại `~/.claude/skills/` và plugins); dùng skill khi khớp ngữ cảnh, không lặp lại nội dung skill ở đây. Skill dùng chung bắt buộc của nhóm nằm tại `.agents/skills/kfc-team-development/` (xem AGENTS.md).
