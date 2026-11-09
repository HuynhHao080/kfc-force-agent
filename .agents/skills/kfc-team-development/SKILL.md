---
name: kfc-team-development
description: Implement or review changes in the KFC Force Agent repository with the three-person Git workflow, application invariants, and local verification. Use when working on this project; deployment still requires its own approved scope.
---

# Phát triển KFC Force Agent trong nhóm

Repo root là thư mục chứa `package.json` và `AGENTS.md` phía trên thư mục skill này.
Đọc `AGENTS.md` và `CONTRIBUTING.md` tại repo root; dùng hướng dẫn trong repo thay vì đường dẫn/skill cá nhân của một thành viên.

1. Xác định task, branch, người phụ trách và file được sửa. Đọc status/diff hiện có; giữ nguyên thay đổi ngoài task. Nếu task chưa rõ, review và nêu một phần việc cụ thể trước khi thay đổi hợp đồng dùng chung.
2. Đọc mã và test của luồng cần thay đổi. Với Next.js, đọc guide liên quan trong bản `node_modules/next/dist/docs/` đã cài bằng `npm ci`. Không áp dụng hướng dẫn Next cũ theo trí nhớ.
3. Thực hiện trong clone/worktree riêng. Giữ invariants server-authoritative price/owner, confirmation, checkout idempotency, revision/CAS, order snapshots và one-process persistence. Không “sửa” lỗi bằng cách bỏ auth, lock, validation hoặc assertion.
4. Chạy các kiểm tra trong `AGENTS.md` phù hợp với thay đổi, dùng mock và dữ liệu synthetic riêng. Không gọi AWS/LLM thật để kiểm thử thông thường. Ghi rõ test chưa chạy hoặc failure còn lại.
5. Review diff của mình, private-path guard và PR template; nêu ảnh hưởng API/data, bằng chứng và cách rollback code. Để người khác review trước merge. Không tự commit/push/merge nếu chưa được yêu cầu.

Đối với cloud, đọc `docs/graduation/aws-readiness.md`. Phân biệt chuẩn bị template, preflight chỉ đọc, inference thật và deploy thật. Quyền cho một bước không mở rộng sang retry, tăng quota hoặc xoá dữ liệu. Giữ các phê duyệt đã có trong phiên làm việc; không hỏi lặp một phạm vi đã được duyệt rõ.
