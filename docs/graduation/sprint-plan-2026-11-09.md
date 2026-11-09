# Kế hoạch hoàn thành trước 01/01/2027

Cập nhật 09/11/2026: giảng viên yêu cầu **AI thật và triển khai AWS**. Phạm vi local chốt ngày 07/11 vẫn là baseline kiểm thử; chưa đủ để nghiệm thu mục tiêu mới. Không dùng kết quả parser mock làm số đo LLM.

## Các mốc bàn giao

| Thời gian | Kết quả phải có | Bằng chứng nghiệm thu |
| --- | --- | --- |
| 09–15/11 | Bedrock thật, đóng gói ứng dụng, hạ tầng có thể review | Một canary có token usage, proposal chưa đổi giỏ và confirmation đúng; hash source/template; kiểm thử local xanh |
| 16–22/11 | Pilot AWS truy cập HTTPS | Change Set đã duyệt, stack/SSM thành công, URL, kiểm tra cookie/owner/admin, restart giữ dữ liệu; chat thật trên ứng dụng đã deploy |
| 23/11–06/12 | Đánh giá trợ lý và luồng thực tiễn | Tập đánh giá đóng băng trước chạy; accuracy intent/tham số, tỷ lệ xác nhận an toàn, p50/p95, token/cost, lỗi/timeouts; bài dùng thử có đồng ý và dữ liệu ẩn danh |
| 07–20/12 | Hoàn chỉnh báo cáo và hồ sơ nghiệm thu | Kiến trúc thực tế, sơ đồ, truy vết yêu cầu–test, kết quả thực nghiệm, giới hạn, hướng dẫn vận hành/backup/khôi phục |
| 21–27/12 | Chốt phiên bản, diễn tập bảo vệ | Regression cuối, kiểm thử AWS, bản backup kiểm tra được, ZIP/hash, slide và demo 10–15 phút |
| 28–31/12 | Dự phòng sửa lỗi, bàn giao | Chỉ sửa lỗi ảnh hưởng nghiệm thu; chạy lại ca liên quan, cập nhật release và bằng chứng |

Mục tiêu bàn giao chính là 27/12, dành bốn ngày dự phòng trước hạn 01/01/2027. Đây là lịch công việc, không phải tác vụ AWS tự động hoặc lịch hẹn đã được tạo.

## Phạm vi kỹ thuật của pilot

- Duy trì các luồng khách, quản trị, catalog, giỏ, checkout, đơn, bếp, khuyến mãi, báo cáo, phản hồi và backup đang có.
- Dùng Bedrock Claude Haiku 4.5 qua US inference profile; lỗi provider không chuyển âm thầm thành mock. Thao tác giỏ vẫn phải qua đề xuất và xác nhận phía server.
- CloudFront HTTPS → nginx → một tiến trình Next.js trong container EC2; dữ liệu JSON trên EBS mã hoá giữ lại khi xóa stack. Thiết kế này giữ các khoá/CAS đang được kiểm thử trong một tiến trình.
- Không mở rộng nhiều instance trước khi chuyển toàn bộ giao dịch/khoá sang kho dữ liệu phù hợp và kiểm thử lại. Adapter DynamoDB chưa phải cấu hình đã nghiệm thu.

Hướng dẫn và chi phí: [AWS readiness](aws-readiness.md).

## Trạng thái và phần còn thiếu

Đã chuẩn bị mã Bedrock có giới hạn request/ngày, canary tối đa một lần gọi, Dockerfile, CloudFormation 21 resource, phát hành source ghim SHA256 và S3 VersionId qua SSM, kiểm thử offline và preflight chỉ đọc. Quyền/model availability đã kiểm tra; chưa chứng minh inference thành công.

**Chưa hoàn tất:** gọi AI thật, build/chạy image Linux, tạo hạ tầng, phát hành ứng dụng, kiểm thử HTTPS và AI trên AWS, thử khôi phục dữ liệu trên AWS, thí nghiệm LLM, dùng thử người dùng, báo cáo theo mẫu trường và slide cuối. Máy hiện tại chưa có Docker; image phải được build/kiểm chứng ở giai đoạn AWS đã được duyệt hoặc môi trường Docker riêng.

Không công bố “100%” cho đến khi các mục trên có bằng chứng. Sinh viên vẫn cần cung cấp thông tin cá nhân/mẫu trường, hiểu mã nguồn, thực hiện dùng thử và biên tập học thuật; không tạo số liệu hoặc phản hồi người dùng giả.
