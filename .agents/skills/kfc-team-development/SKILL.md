---
name: kfc-team-development
description: Implement or review changes in the KFC Force Agent repository with the three-person Git workflow, application invariants, and local verification. Use when working on this project; deployment still requires its own approved scope.
---

# Phát triển KFC Force Agent trong nhóm

Repo root là thư mục chứa `package.json` và `AGENTS.md` phía trên thư mục skill này.
Đọc `AGENTS.md` và `CONTRIBUTING.md` tại repo root; dùng hướng dẫn trong repo thay vì đường dẫn/skill cá nhân của một thành viên.

1. Xác định task, branch, người phụ trách và file được sửa. Đọc status/diff hiện có; giữ nguyên thay đổi ngoài task. Nếu task chưa rõ, review và nêu một phần việc cụ thể trước khi thay đổi hợp đồng dùng chung. Thiếu branch/file/tiêu chí thì dừng và hỏi lại, không tự đoán.
2. Đọc mã và test của luồng cần thay đổi. Với Next.js, đọc guide liên quan trong bản `node_modules/next/dist/docs/` đã cài bằng `npm ci`. Không áp dụng hướng dẫn Next cũ theo trí nhớ.
3. Thực hiện trong clone/worktree riêng. Giữ invariants server-authoritative price/owner, confirmation, checkout idempotency, revision/CAS, order snapshots và one-process persistence. Không “sửa” lỗi bằng cách bỏ auth, lock, validation hoặc assertion. Cấm `reset --hard`, `clean -fd`, force push, ghi đè `checkout/restore`, `stash/drop`, `git add .`, push trực tiếp `main`, tự merge PR, nâng dependency, sửa CI/`AGENTS.md`/skill để bỏ qua kiểm tra, xoá test/giảm assertion/đổi snapshot để xanh.
4. Chạy các kiểm tra trong `AGENTS.md` phù hợp với thay đổi, dùng mock và dữ liệu synthetic riêng. Không gọi AWS/LLM thật để kiểm thử thông thường. Ghi rõ test chưa chạy hoặc failure còn lại. Không ghi “100%”, “AWS đã deploy” hoặc coverage khi không có bằng chứng.
5. Review diff của mình, private-path guard và PR template; nêu ảnh hưởng API/data, bằng chứng và cách rollback code. Để người khác review trước merge. Chỉ commit/push khi người dùng giao rõ việc đó kèm file/branch/message; nếu không, dừng ở sửa + kiểm thử và báo diff. Không tự merge PR do mình viết.

Đối với cloud, đọc `docs/graduation/aws-readiness.md`. Phân biệt chuẩn bị template, preflight chỉ đọc, inference thật và deploy thật. Quyền cho một bước không mở rộng sang retry, tăng quota hoặc xoá dữ liệu. Giữ các phê duyệt đã có trong phiên làm việc; không hỏi lặp một phạm vi đã được duyệt rõ.
