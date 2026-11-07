# Chốt phạm vi và bàn giao bản khóa luận local

Ngày chốt: 07/11/2026. Phạm vi người dùng chọn: **bản khóa luận chạy local, đầy đủ luồng và hồ sơ nghiệm thu**. Bộ yêu cầu của bản này là FR01–FR36 trong [requirements](requirements.md). Những tích hợp ngoài được ghi riêng trong [bảng nghiệm thu](acceptance-checklist.md).

## Luồng phải trình diễn được

| Luồng | Kết quả kiểm chứng của bản local |
| --- | --- |
| Khách guest và khách đăng nhập | Phiên riêng, đăng ký/đăng nhập/đăng xuất, hồ sơ và đổi mật khẩu; không tự gộp giỏ guest vào tài khoản |
| Chọn món | Tìm/lọc menu, giá server, thêm/sửa/xoá giỏ, commit nguyên tử/revision và chặn thao tác theo nội dung cũ |
| Trợ lý | Hiểu mẫu tiếng Việt, đề xuất thao tác, xác nhận rõ ràng; chặn sai owner, quá hạn và giỏ/menu đã đổi |
| Đặt đơn | Nhận tại quầy/giao hàng, liên hệ, địa chỉ, ghi chú, quote khuyến mãi, xác nhận tổng tiền và COD demo |
| Retry checkout | Cùng mã/cùng nội dung trả lại đơn đã tạo; khác nội dung trả409. Mất response có lookup đọc-only và nút kiểm tra lại; giỏ đổi buộc áp lại mã/xác nhận |
| Sau đặt đơn | Lịch sử riêng, lọc/tìm, chi tiết/sự kiện, huỷ đúng trạng thái, phiếu in, đặt lại có preview theo giá hiện tại và checkout riêng |
| Vận hành | Đăng nhập quản trị, xử lý đúng state machine nhận tại quầy/giao hàng, huỷ có xác nhận/lý do hiển thị cho khách, quản lý món/danh mục/khuyến mãi, audit thay đổi catalog |
| Sau nhận món | Đánh giá riêng trên đơn hoàn tất, khách sửa trước trả lời, staff inbox200 đánh giá cập nhật gần nhất, một câu trả lời và revision CAS |
| Tiếp nhận đơn | Thông tin điểm nhận, lịch7ngàyUTC+7, tạm dừng/kênh, fee/minimum, revision; server gate và snapshot điểm nhận trên đơn |
| Bảng bếp | Bốn cột trạng thái, tổng phần chờ/đang làm, lọc hình thức, đồng bộ15 giây và chuyển bước có expectedStatus; mở chi tiết để huỷ/xem contact |
| Báo cáo | Lọc cửa sổ 200 đơn gần nhất, giá trị đơn hoàn tất, top món theo snapshot, đối soát và CSV không có contact/ghi chú |
| Độ bền local | Một tiến trình Node, lưu JSON, ghi atomic/rollback khi lỗi ghi, restart, sao lưu mã hoá và restore vào thư mục mới |
| Bàn giao | Mã nguồn, hướng dẫn, ma trận yêu cầu–kiểm thử, đánh giá parser, bằng chứng local, ZIP có manifest/hash và trình kiểm tra |

Kiểm tra tự động chính: 89 nhóm nghiệp vụ + 9 nhóm backup/recovery + 73 nhóm HTTP = **171 nhóm assertion**. Có thêm 3 test công cụ kiểm tra gói nộp qua `npm run test:submission`. Các số này không phải code coverage. Log của lần chạy hiện hành nằm trong `output/verification/check.log`; archive chứa bản sao tại `evidence/check.log`.

Parser mock đúng 49/50 intent và joint trên tập phát triển đã biết; có 61 câu hồi quy tổng hợp riêng trong unit suite. Đây không phải holdout hoặc kết quả LLM thật. Xem [kết quả và giới hạn](evaluation-results.md).

## Chạy trên máy này

Yêu cầu: Node phù hợp package-lock/Next đang dùng, npm và Python 3 để đóng/kiểm tra ZIP; ổ đĩa ghi được. Cổng 3100 cho demo và 3197 cho HTTP test phải sẵn sàng. Dừng server đang dùng build trước khi build lại.

```powershell
npm ci
npm run check
npm run test:submission
npm run evaluate:report
npm run demo:setup
npm run demo:start
```

`demo:setup` không ghi đè credential đã có. Đọc credential riêng tại vị trí script thông báo; không trình chiếu file bootstrap. `demo:start` dùng mock/local, thư mục `.local/preview` và bind `127.0.0.1:3100`; giữ nguyên dữ liệu qua restart. Khách mở <http://127.0.0.1:3100/chat>, quản trị mở <http://127.0.0.1:3100/admin>.

Trong terminal khác:

```powershell
npm run demo:doctor
```

Doctor chỉ kiểm tra 7 probe HTTP read-only, không thay cho nghiệm thu nghiệp vụ. Xem [kịch bản báo cáo](supervisor-progress-2026-11-07.md) và [runbook](demo-runbook.md) để trình diễn khách đặt đơn → quản trị xử lý → khách xem lại → báo cáo.

## Đóng và xác minh gói nộp

Sau khi có log kiểm tra mới và doctor thành công:

```powershell
npm run submission:pack
npm run submission:verify -- --current
```

ZIP mới và hai sidecar `.sha256`, `.verified.json` nằm trong `output/submission`. Không ghi đè archive cũ. Công cụ verifier đọc ZIP, không giải nén/chạy mã bên trong; kiểm tra hash/size/manifest, đường dẫn, kết quả được ghi trong log, readiness và hash dataset/parser/evaluator. Cờ `--current` so từng file source đã đóng gói với checkout hiện tại. Công cụ không chạy lại test, không chứng thực bên thứ ba và không quét mọi dạng secret có thể xuất hiện trong nội dung.

Muốn kiểm tra một gói cụ thể cùng sidecar:

```powershell
python scripts/verify-submission.py "duong-dan-goi-source.zip"
```

Nếu tự chạy lại `npm run check` và muốn đóng gói log mới, trong PowerShell dùng `npm run check *> output/verification/check.log`, sau đó kiểm tra `$LASTEXITCODE -eq 0` trước bước đóng gói. Có thể mở log để xem chi tiết khi thất bại; không dùng log thành công của bản cũ để chứng minh source mới.

## Ranh giới nghiệm thu

Đây là bản phần mềm và hồ sơ kỹ thuật cho phạm vi local đã chốt. Không có nghiệm thu AWS/Bedrock, thu tiền/POS/giao vận, nhiều instance, tồn kho định lượng, quota mã giảm giá, phân quyền nhiều nhân viên hoặc báo cáo toàn lịch sử. COD và trợ lý mock phải được ghi rõ khi trình bày. Máy in/PDF native, đánh giá người dùng thực, tải lớn, pentest độc lập và chứng nhận WCAG chưa được nghiệm thu.

Dữ liệu cũ chưa có checkout request hash vẫn được đọc: retry so các trường khôi phục được từ snapshot đơn; không thể đối chiếu cartSignature gốc vì bản cũ không lưu. Không sửa lại lịch sử để tạo bằng chứng giả.

Hồ sơ đã có yêu cầu, kiến trúc/ER/sequence/state, API, review, ma trận kiểm thử, đánh giá parser, vận hành và khung báo cáo. Sinh viên cần điền thông tin trường/sinh viên/giảng viên thật, biên tập theo mẫu trường và xin xác nhận của người hướng dẫn. Chưa có chữ ký nghiệm thu hoặc phê duyệt học thuật; không ghi những việc này là đã hoàn thành.
