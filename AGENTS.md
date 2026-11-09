<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# KFC Force Agent — quy tắc cho mọi agent trong nhóm

Đọc [CONTRIBUTING.md](CONTRIBUTING.md) trước khi sửa. Skill dùng chung nằm tại
[.agents/skills/kfc-team-development/SKILL.md](.agents/skills/kfc-team-development/SKILL.md).
Agent không hỗ trợ skill vẫn phải tuân thủ hướng dẫn trong file này. Giữ nguyên block Next.js phía trên.

## Bắt đầu và phạm vi

- Đọc `git status --short`, branch hiện tại, diff liên quan và các tài liệu của phân hệ trước khi viết. Giữ nguyên công việc chưa commit của người khác; không nhận đó là thay đổi của mình.
- Mỗi thành viên dùng clone hoặc worktree, branch và `LOCAL_DATA_DIR` riêng. Một agent ghi trên mỗi worktree. Không sửa cùng thư mục `.next` hoặc dữ liệu demo khi người khác đang chạy.
- Làm theo task/issue đã nhận, ghi rõ file/phân hệ, `LOCAL_DATA_DIR`, cổng và tiêu chí nghiệm thu. Không có issue thì không tạo branch. Xem phân vùng, commit message, Definition of Done và quy trình conflict/revert tại `CONTRIBUTING.md`; muốn đổi API/schema hoặc sang phần người khác đang làm thì thống nhất giao diện và người tích hợp trước.
- Không tự tạo thêm agent cùng sửa workspace; chỉ phân công song song khi người dùng yêu cầu, và phải tách worktree/phạm vi.

## Quy tắc cho agent (bắt buộc)

Agent là công cụ, không phải thành viên quyết định. Agent chỉ làm đúng task đã giao, trong đúng file/branch đã ghi, và dừng lại khi thiếu thông tin.

**Agent bị cấm:**

- `reset --hard`, `clean -fd`, force push, `checkout/restore` ghi đè, `stash/drop`, chọn hàng loạt ours/theirs trên công việc người khác.
- `git add .` / `git add -A` trong workspace có nhiều đợt sửa; phải stage đúng đường dẫn đã review.
- Push trực tiếp `main`, tự merge PR, tự nâng dependency, tự sửa CI/`AGENTS.md`/skill để bỏ qua kiểm tra.
- Xoá test, giảm assertion, đổi snapshot, nới guard chỉ để CI xanh.
- Gọi AWS/LLM trả phí, deploy, execute Change Set, xoá tài nguyên/dữ liệu khi chưa có phê duyệt phạm vi.
- Đưa session/admin credentials, contact khách, ghi chú riêng vào log, DTO, CSV, prompt hoặc Git.
- Ghi “100%”, “AWS đã deploy”, coverage hoặc kết quả chưa chạy như thể đã kiểm chứng.

**Agent bắt buộc:**

- Đọc `AGENTS.md`, `CONTRIBUTING.md` và skill `kfc-team-development` trước khi sửa; với Next.js đọc guide trong `node_modules/next/dist/docs/` đã cài.
- Ghi rõ task, branch, file dự kiến, tiêu chí nghiệm thu; giữ nguyên thay đổi ngoài task.
- Chạy kiểm tra theo `AGENTS.md`, báo đúng lệnh/kết quả đã chạy và phần chưa xác minh.
- Chỉ commit/push khi người dùng giao rõ việc đó kèm file/branch/message; nếu không, dừng ở sửa + kiểm thử local và báo diff.
- Để người khác review trước merge; không tự merge PR do mình viết.

Khi lệnh yêu cầu phá hoại, thiếu file/branch, hoặc đổi API/schema mà chưa thống nhất, agent phải dừng, giải thích rủi ro và hỏi lại — không tự đoán.

## Các bất biến phải giữ

- Giá, tổng tiền, danh tính và quyền lấy từ server. AI chỉ đề xuất; thay đổi giỏ phải xác nhận đúng token/owner/thời hạn và dữ liệu hiện tại. Không bỏ validation/confirmation để demo dễ hơn.
- Giữ idempotency checkout, revision/CAS, snapshot giá/khuyến mãi trong đơn và state machine pickup/delivery. Không đổi thứ tự lock hoặc bỏ `SHOP_ORDER_GATE` nếu chưa phân tích race và có test tái hiện.
- Local JSON và budget Bedrock được thiết kế cho một tiến trình. Không tăng replica/worker hoặc gọi DynamoDB là đã nghiệm thu khi chưa kiểm chứng giao dịch tương ứng.
- Không đưa session/admin credentials, contact khách hoặc ghi chú riêng vào log, DTO công khai, CSV, prompt hoặc Git. Giữ cookie/auth, kiểm tra origin và private/no-store.
- Lỗi Bedrock phải báo lỗi có kiểm soát, không chuyển ngầm sang mock. Test/CI mặc định mock, không AWS credentials và không inference trả phí.
- Không xoá dữ liệu demo, backup, ZIP bằng chứng, canary marker hoặc sửa kết quả cũ để tạo trạng thái thành công. Tài liệu phải phân biệt implemented, tested và deployed.

## Git, kiểm tra và bàn giao

- Không `reset --hard`, `clean -fd`, force push, ghi đè bằng `checkout/restore`, stash/drop hoặc chọn hàng loạt ours/theirs trên công việc người khác. Giải quyết conflict theo từng hunk; không hiểu hợp đồng thì để người phụ trách review.
- Không push trực tiếp `main`, tự merge PR, tự nâng dependency hoặc sửa CI/AGENTS/skill để bỏ qua kiểm tra. Sửa các file dùng chung này khi task yêu cầu, có giải thích và review.
- Không commit/push chỉ vì đã sửa code; làm khi người dùng yêu cầu. Khi stage, chỉ stage đường dẫn đã review; kiểm tra `git diff --cached` và `npm run team:check`. Không dùng `git add .` trong workspace đang có nhiều đợt sửa.
- Với code ứng dụng: chạy `npm run check`; với guard nhóm: `npm run test:team`. Thay parser/prompt chạy thêm `npm run evaluate`; thay đóng gói chạy test tương ứng. Không xoá test, giảm assertion hoặc đổi snapshot chỉ để xanh. Nếu không chạy được, ghi rõ lý do và phần chưa xác minh.
- Báo cáo cuối gồm thay đổi, file liên quan, lệnh/kết quả thực sự đã chạy và giới hạn. Dùng PR template. Không ghi “100%”, “AWS đã deploy” hoặc coverage khi không có bằng chứng tương ứng.

## AWS và hành động bên ngoài

Sửa code, template, tài liệu và test offline trong task không cần hỏi lại từng bước. Yêu cầu chung “hoàn thiện project” không cấp quyền tự triển khai hoặc gọi AI trả phí.
Chỉ người được nhóm giao phụ trách release thực hiện AWS writes/inference theo tài khoản, vùng, resource, ngân sách và số lượt đã được duyệt. Khi đã duyệt đủ phạm vi thì tiếp tục trong phạm vi đó, không hỏi lặp; thay đích/tăng chi phí/phạm vi phải xác nhận lại. Không chia sẻ IAM keys qua repo/chat; mỗi người dùng credentials riêng nếu thực sự cần.
Đọc [AWS readiness](docs/graduation/aws-readiness.md) trước công việc cloud; không tự execute Change Set, retry canary hoặc xoá tài nguyên/dữ liệu. Hiện tài liệu ghi chuẩn bị pilot, chưa phải bằng chứng deploy.
