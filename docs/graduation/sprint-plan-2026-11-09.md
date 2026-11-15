# Kế hoạch hoàn thành trước 30/01/2027

Kế hoạch lập ngày 09/11 và cập nhật ngày 15/11/2026 theo thời gian thực hiện người dùng cung cấp, từ 01/10/2026 đến 30/01/2027. Giảng viên yêu cầu **AI thật và triển khai AWS**. Phạm vi local chốt ngày 07/11 là baseline kiểm thử. Kết quả parser mock và kết quả LLM thật được ghi theo từng phép thử.

## Các mốc bàn giao

| Thời gian | Kết quả phải có | Bằng chứng nghiệm thu |
| --- | --- | --- |
| 09–15/11 | Bedrock thật, đóng gói ứng dụng, hạ tầng có thể review | Canary và trình duyệt local đã thử Haiku 5.5 tại Singapore, gồm đề xuất, xác nhận và restart; đóng gói Linux được kiểm tra riêng |
| 16–22/11 | Pilot AWS truy cập HTTPS | Đã thực hiện sớm ngày 15/11, stack/SSM và HTTPS đạt, AI thật trên AWS, cookie/owner/admin, restart và phục hồi bản sao đã kiểm tra |
| 23/11–31/12 | Đánh giá trợ lý và luồng thực tiễn | Tập đánh giá đóng băng trước chạy; accuracy intent/tham số, tỷ lệ xác nhận an toàn, p50/p95, token/cost, lỗi/timeouts; bài dùng thử có đồng ý và dữ liệu ẩn danh |
| 01–15/01/2027 | Hoàn chỉnh báo cáo và hồ sơ nghiệm thu | Kiến trúc thực tế, sơ đồ, truy vết yêu cầu–test, kết quả thực nghiệm, giới hạn, hướng dẫn vận hành/backup/khôi phục |
| 16–24/01/2027 | Chốt phiên bản, diễn tập bảo vệ | Regression cuối, kiểm thử AWS, bản backup kiểm tra được, ZIP/hash, slide và demo 10–15 phút |
| 25–30/01/2027 | Hiệu chỉnh và bàn giao | Sửa theo góp ý, chạy lại ca liên quan, cập nhật release và bằng chứng, nộp hồ sơ cuối |

Các mốc tiếp theo là kế hoạch đề xuất để nhóm phân công và theo dõi. Mốc kết thúc là 30/01/2027, thống nhất với lịch trong hồ sơ Word.

## Phạm vi kỹ thuật của pilot

- Duy trì các luồng khách, quản trị, catalog, giỏ, checkout, đơn, bếp, khuyến mãi, báo cáo, phản hồi và backup đang có.
- Dùng Bedrock Claude Haiku 5.5 qua global inference profile tại `ap-southeast-1`. Thao tác giỏ vẫn phải qua đề xuất và xác nhận phía server, còn lỗi provider được báo có kiểm soát.
- CloudFront HTTPS → nginx → một tiến trình Next.js trong container EC2; dữ liệu JSON trên EBS mã hoá giữ lại khi xóa stack. Thiết kế này giữ các khoá/CAS đang được kiểm thử trong một tiến trình.
- Không mở rộng nhiều instance trước khi chuyển toàn bộ giao dịch/khoá sang kho dữ liệu phù hợp và kiểm thử lại. Adapter DynamoDB chưa phải cấu hình đã nghiệm thu.

Hướng dẫn và chi phí: [AWS readiness](aws-readiness.md).

## Trạng thái và phần còn thiếu

Đã có mã Bedrock với giới hạn request/ngày, canary, Dockerfile, CloudFormation 21 resource và công cụ phát hành source ghim SHA256, S3 VersionId qua SSM. Canary Haiku 5.5 và các luồng AI trên web local đã đạt. Báo cáo tại `output/verification/ai-web-acceptance-20261115.json`. Web local đang dùng hạn mức 25 lượt/ngày UTC đã được người dùng duyệt. Các phép thử gây lỗi mạng dùng mock và ghi bằng chứng riêng.

Container Linux đã build, chạy dưới user `node` và đạt kiểm tra HTTP, checkout, quyền truy cập, giữ dữ liệu qua restart ngày 15/11/2026. Bằng chứng tại `output/verification/linux-container-acceptance-20261115.json`. Pilot AWS đã phát hành tại https://d2qcew89gdrdgt.cloudfront.net, stack CREATE_COMPLETE và SSM release thành công. HTTPS, một lượt AI thật qua trình duyệt, hai luồng đơn, CAS, phản hồi, CSV, restart và phục hồi bản sao vào thư mục riêng đã được kiểm tra. Chi tiết source/version và bằng chứng tại [AWS readiness](aws-readiness.md).

Đợt LLM riêng đã hoàn tất 24 lượt, kết quả và giới hạn tại [báo cáo đánh giá](llm-evaluation-results.md). Công việc tiếp theo gồm review nhãn bởi nhóm, bổ sung tập câu và dùng thử với người tham gia, kiểm tra tải, bản sao độc lập với volume, hoàn chỉnh báo cáo học thuật và slide bảo vệ. Các đợt inference hoặc mở rộng cloud cần phạm vi và ngân sách tương ứng.

Không công bố “100%” cho đến khi các mục trên có bằng chứng. Sinh viên vẫn cần cung cấp thông tin cá nhân/mẫu trường, hiểu mã nguồn, thực hiện dùng thử và biên tập học thuật; không tạo số liệu hoặc phản hồi người dùng giả.
