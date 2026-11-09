## Thay đổi và lý do

Task/issue, người phụ trách, hành vi trước → sau:

## Phạm vi và phối hợp

File/phân hệ đã sửa; thay đổi API/type/schema/lock/dependency (nếu có); người phụ trách phần liên quan đã review:

## Kiểm chứng

Ghi lệnh và kết quả thực sự đã chạy, ảnh UI nếu cần. Nêu rõ phần chưa kiểm tra; không đánh dấu test chưa chạy.

- [ ] Đã đọc AGENTS.md; diff không ghi đè công việc ngoài task.
- [ ] `npm run team:check`, `npm run test:team`, `git diff --check` qua.
- [ ] `npm run check` qua nếu sửa code ứng dụng; hoặc giải thích vì sao không cần/chưa chạy.
- [ ] Test parser/package/submission liên quan đã chạy khi có thay đổi.
- [ ] Không chứa credentials/runtime customer data; đã xem staged diff.
- [ ] Giữ owner/auth/origin, giá server, confirmation, revision và idempotency liên quan.

## Ảnh hưởng vận hành và rollback

Dữ liệu cũ có đọc được không? Rollback code có giới hạn gì? AWS/inference đã được duyệt và thực thi chưa? Không có thì ghi rõ không phát sinh.

## Review

Nhờ ít nhất một thành viên khác review; CI phải xanh trước merge. Không tự merge chỉ dựa trên lời agent báo thành công.
