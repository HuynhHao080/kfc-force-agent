# Hồ sơ kỹ thuật phục vụ khóa luận

**Tên đề tài gợi ý:** Thiết kế và xây dựng hệ thống đặt món trực tuyến ứng dụng trợ lý hội thoại có kiểm soát thao tác.

Hồ sơ này bám theo mã nguồn và kết quả chạy của KFC Force Agent. Đây chưa phải bản khóa luận nộp chính thức. Sinh viên cần bổ sung thông tin cá nhân, mẫu của trường, rà soát trích dẫn và hiểu các kết quả trước khi sử dụng. Nhà hàng, giao hàng và thanh toán đều là demo.

| Tài liệu                                | Mục đích                                                    |
| --------------------------------------- | ----------------------------------------------------------- |
| [Yêu cầu và phạm vi](requirements.md)   | Phân hệ, tác nhân, use case, tiêu chí nghiệm thu            |
| [Kiến trúc và dữ liệu](architecture.md) | Thành phần, sequence, ER, trạng thái và quyết định thiết kế |
| [Kiểm thử và đánh giá](testing.md)      | Truy vết yêu cầu, cách đo và giới hạn suy luận              |
| [Kết quả parser](evaluation-results.md) | Số đo thực tế, hash dataset/provider và các ca lỗi          |
| [Vận hành và demo](demo-runbook.md)     | Chuẩn bị, quản trị, kịch bản bảo vệ và khôi phục            |
| [Khung báo cáo](report-outline.md)      | Cấu trúc chương để sinh viên biên tập                       |
| [Nguồn tham khảo](references.md)        | Nguồn chính thức và nội dung áp dụng                        |

## Mục tiêu mới: AI thật và AWS trước 01/01/2027

Yêu cầu giảng viên cập nhật 09/11 đã mở rộng phạm vi so với baseline local. Xem [kế hoạch nước rút](sprint-plan-2026-11-09.md) và [AWS readiness/runbook](aws-readiness.md). Hạ tầng và canary đã được chuẩn bị; preflight chỉ đọc không chứng minh inference hoặc deploy thành công.

## Báo cáo tiến độ với giảng viên — 07/11/2026

Mở [bản báo cáo 5–7 phút](supervisor-progress-2026-11-07.md) và [checklist chạy tối nay](tonight-demo.md). Đây là báo cáo một phần, không phải nghiệm thu toàn bộ khóa luận.

## Bằng chứng hiện có

Vận hành dữ liệu: [sao lưu mã hoá và khôi phục local](../local-backup.md), có 9 nhóm kiểm tra riêng trong npm run check.

Xem [bảng nghiệm thu các phân hệ](acceptance-checklist.md) để phân biệt chức năng đã triển khai của bản local và tích hợp ngoài chưa được nghiệm thu.

Đợt review mới nhất: [5 lỗi được xác nhận và sửa](code-review.md), kèm ca hồi quy và kiểm tra lỗi mạng trên trình duyệt. Chi tiết tái lập và giới hạn được ghi trong báo cáo.

- Storefront tại /chat và giao diện vận hành tại /admin.
- Phiên khách, tài khoản khách có đăng nhập và vai trò quản trị riêng.
- Menu động, giỏ, chat có xác nhận, checkout, hai luồng xử lý đơn, báo cáo và CSV.
- 101 nhóm kiểm tra nghiệp vụ/provider/client helper + 76 nhóm HTTP + 9 nhóm backup/recovery đã chạy local (186 nhóm); không phải số đo code coverage.
- Dataset 50 câu tự xây dựng: 40 câu theo cấu trúc hỗ trợ, 10 câu thử thách ngoài mẫu. Không có khảo sát người dùng hoặc đo Bedrock.
- CI đã được cấu hình; chưa có bằng chứng GitHub Actions chạy thật cho đến khi repository được người dùng đẩy lên và workflow chạy.

## Bản local đã chốt

Xem [phạm vi và bàn giao local](local-release-scope.md) cho điều kiện nghiệm thu, lệnh chạy và xác minh ZIP. `npm run test:submission` có thêm 3 test chống sửa gói/đường dẫn; không cộng vào 186 nhóm nghiệp vụ–HTTP–recovery.

## Trước khi nộp

Điền [Trường], [Khoa], [Sinh viên], [Mã số], [Giảng viên], [Niên khóa] theo thông tin thực. Không đưa mật khẩu, .env.local, .local hoặc thông tin liên hệ thật vào bản nộp công khai.

Khuyến mãi FR28: quản trị mã phần trăm/cố định, thời hạn/minimum/trần, quote server, checkout kiểm tra lại, snapshot giảm giá và CSV có discount_vnd. Không quota/cộng dồn mã.

FR29/FR30: lọc lịch sử khách và đặt lại có preview/confirmation token, giỏ trống, giá hiện tại, replay không nhân đôi, lỗi đĩa rollback và restore marker. Khách vẫn checkout riêng.

FR31: parser số chữ/Arabic và phạm vi xoá dòng/toàn giỏ; 61 câu hồi quy policy nằm trong unit suite. Đối chiếu [baseline trước v2](evaluation-baseline-before-parser-v2.md) và [kết quả hiện tại](evaluation-results.md); dữ liệu phát triển đã biết, không phải holdout.

FR32: món bán chạy từ completed snapshots, đối soát gross/discount/fee/net, source-window revision, top10/200 và CSV chống formula. Staff API reauth sau chờ lock.

FR33: bảng bếp4 cột trạng thái, tổng phần chờ/đang làm, lọc pickup/delivery, đồng bộ15 giây và chuyển bước với expectedStatus.200 đơn gần nhất; không POS/bếp vật lý hoặc SLA.

FR34: cấu hình cửa hàng/tiếp nhận đơn, weeklyhoursUTC+7/pause/channels/fee/minimum, server acceptance gate và snapshot điểm nhận/receipt. Local defaults giữ backup cũ, không phải địa chỉ nhà hàng đã xác minh.

FR35: đánh giá sau hoàn tất và câu trả lời riêng, owner/role/CAS/replay, hộp thư200feedback/filter/summary, bảo toàn ngữ cảnh saureply và recovery. Không phải đánh giá công khai hoặc khảo sát người dùng thực.

FR36: giỏ ghi nguyên tử, lỗi ghi không để lại dòng/tổng một phần; revision CAS và header chữ ký chặn nút sửa theo nội dung cũ. Bằng chứng before/after, lỗi đĩa synthetic, browser mất phản hồi và reprice nằm trong hồ sơ review/verification.
