# Làm việc nhóm ba người và dùng agent

Mỗi người đọc `AGENTS.md`, dùng Node.js 24 và Python 3; cài dependencies bằng `npm ci`. Hạn cuối 01/01/2027, AI thật và AWS là yêu cầu bắt buộc; tiến độ và bằng chứng tại [kế hoạch](docs/graduation/sprint-plan-2026-11-09.md).

## Nhận việc và tránh sửa chồng

Chọn một người tích hợp/release, hai người cùng phát triển. Bảng dưới là gợi ý chia việc, **chưa gán tên cho thành viên**. Ghi người nhận, branch, file dự kiến và tiêu chí nghiệm thu vào issue/PR trước khi làm.

| Luồng | Phạm vi gợi ý | Điểm phải phối hợp |
| --- | --- | --- |
| Giao diện khách và vận hành | `src/components`, page/layout, CSS, public assets | Dùng API/type hiện hành; thay DTO phải thống nhất với backend |
| Nghiệp vụ và API | `src/app/api`, `src/lib/services`, validation, repository, tests | Auth, giá, lock, CAS, schema persistence và retry cần review kỹ |
| AI, AWS và tích hợp | agent/provider/prompt, `infra/aws`, release scripts, hồ sơ | Người release kiểm soát cloud; không thay logic đơn/giỏ từ prompt |

`package*.json`, shared types, `next.config.ts`, `AGENTS.md`, skill, CI và script test tổng hợp là file dùng chung: một task sửa mỗi lần, người tích hợp review. Không hạn chế mỗi người chỉ được một ngôn ngữ/phân hệ; phối hợp theo task thực tế.

Mỗi người một clone là cách dễ nhất. Nếu dùng worktree, tạo từ checkout sạch và branch nền đã được tích hợp. Không tạo worktree từ đợt code chưa commit rồi tưởng nó đã được mang sang. Không build hai branch trên cùng checkout; `.next` và `.local` không dùng chung. Data riêng mặc định nằm trong clone; custom `LOCAL_DATA_DIR` phải khác nhau. Cổng dev/demo/test không được trùng nếu chạy cùng máy.

## Không dùng agent phá project

Agent chỉ được sửa code và chạy kiểm thử local trong phạm vi task đã giao. Các hành động sau **bị cấm** dù agent đề xuất hay người dùng nói chung chung “làm hết đi”:

- Ghi đè công việc chưa commit (`reset --hard`, `clean -fd`, `checkout/restore`, `stash/drop`, force push).
- `git add .` trong workspace đang có nhiều đợt sửa; phải stage đúng file đã review.
- Push trực tiếp `main`, tự merge PR, tự nâng dependency, tự sửa CI/`AGENTS.md`/skill để bỏ qua kiểm tra.
- Xoá test, giảm assertion, đổi snapshot, nới guard chỉ để xanh.
- Gọi AWS/LLM trả phí, deploy, execute Change Set, xoá dữ liệu demo/backup/canary khi chưa có phê duyệt phạm vi.
- Đưa credentials, contact khách, ghi chú riêng vào log/Git/prompt.

Nếu agent yêu cầu làm một trong các việc trên, hoặc task thiếu branch/file/tiêu chí, **dừng lại và hỏi lại**. Agent phải từ chối lệnh phá hoại và nêu cách an toàn thay thế (branch riêng, commit đúng file, PR để người khác review).

## Quy trình một thay đổi

Sau khi clone bản nền đã được push:

```powershell
git status --short
git switch main
git pull --ff-only origin main
git switch -c feat/<ten-ban>-<task>
npm ci
Copy-Item .env.example .env.local  # chỉ khi file chưa tồn tại
```

Chỉ switch/pull khi checkout sạch; nếu có thay đổi, hoàn tất hoặc nhờ người sở hữu xử lý trước. `feat/`, `fix/`, `docs/` đều được; mỗi task một branch. Agent đọc skill trong `.agents/skills/kfc-team-development/SKILL.md`; Claude đọc `CLAUDE.md` trỏ đến `AGENTS.md`. Công cụ khác cần chỉ rõ đọc `AGENTS.md`, không giả định mọi agent tự nạp skill.

Prompt giao việc mẫu:

> Đọc AGENTS.md, CONTRIBUTING.md và skill kfc-team-development trong repo. Task: […]. Phạm vi file: […]. Tiêu chí nghiệm thu: […]. Giữ nguyên thay đổi ngoài task, không đổi API/schema khi chưa thống nhất, không AWS writes/inference trả phí. Sửa và kiểm thử local; báo diff, kết quả và phần chưa xác minh. Chưa commit/push/merge.

Sau thay đổi, chạy kiểm tra theo `AGENTS.md`. Trước commit/push, **người dùng giao rõ việc commit/push cho agent** hoặc tự chạy các lệnh sau, thay đúng file/branch:

```powershell
git diff --check
git diff -- <cac-file-cua-task>
git add -- <cac-file-da-review>
git diff --cached --stat
git diff --cached
npm run team:check
git commit -m "feat: <noi-dung-task>"
git push -u origin feat/<ten-ban>-<task>
```

Mở PR về `main`, điền template; cần ít nhất một người khác review và CI xanh trên Windows/Linux. Không force push hoặc tự merge khi agent vừa viết code. Conflict phải hiểu cả hai thay đổi rồi chạy lại test; không chọn toàn bộ ours/theirs. Khi đổi API, đưa cập nhật caller/types/tests/docs vào cùng PR hoặc thống nhất thứ tự merge tương thích.

## Kiểm tra và dữ liệu

`npm run team:check` đọc danh sách file tracked/staged, chặn một số đường dẫn private/build/backup trong Git và quét staged diff cho secret độ tin cậy cao (AWS access key, private key). Nó **không quét lịch sử Git hay chứng minh code đúng**. Luôn xem staged diff, dùng GitHub secret scanning nếu repo hỗ trợ. `.env.example` chỉ chứa placeholder; `.local`, credentials, dữ liệu khách và `output` không push. Bằng chứng công khai được chọn lọc/ẩn danh trong tài liệu, không force-add toàn bộ runtime folder.

`npm run check` chạy local mock, không cloud; `npm run test:team` kiểm tra guard nhóm và `npm run test:submission` kiểm tra verifier gói. CI cũng chạy các kiểm tra này. Không giảm test hoặc nới guard để hợp thức hoá file riêng tư. Secrets đã lỡ push phải thu hồi/rotate và xử lý lịch sử cùng người quản lý repo; chỉ thêm `.gitignore` không gỡ secret cũ.

## Thiết lập GitHub do chủ repo thực hiện (checklist)

Chủ repo làm một lần, chụp lại bằng chứng trong issue/PR:

1. Settings → Rules/Branches → bảo vệ `main`: bắt buộc PR, ít nhất 1 approval của người khác, dismiss approval khi có code mới, resolve conversations, required CI `verify (ubuntu-latest)` và `verify (windows-latest)`, chặn force push/deletion, áp dụng cho người quản trị nếu gói GitHub hỗ trợ.
2. Chọn tên check thực tế sau lần CI đầu; nếu repo/gói không hỗ trợ enforcement, nhóm phải review thủ công và ghi rõ giới hạn — tài liệu này không tự bật branch protection.
3. `.github/CODEOWNERS` đã liệt kê username thật cho file dùng chung (`@HuynhHao080`, `@minhkhanh39`); khi biết username thành viên thứ ba thì bổ sung và bật required code-owner review nếu hỗ trợ. Không dùng tên mẫu.
4. Mỗi người dùng tài khoản GitHub riêng và quyền repo cần thiết; không chia sẻ PAT hoặc IAM key. CI hiện không deploy và không cần AWS secrets.

Agent không được tự bật/tắt branch protection, tự sửa CI để bỏ qua kiểm tra, hay tự merge khi chưa có approval độc lập.

Đợt chuẩn bị hiện tại đang có nhiều thay đổi chưa commit từ các lần làm trước. Người tích hợp cần review toàn bộ baseline trước lần push đầu; không chỉ push bộ hướng dẫn mà bỏ quên source được tài liệu tham chiếu. Không có commit/push hoặc cài đặt GitHub nào tự thực hiện khi viết hướng dẫn này.
