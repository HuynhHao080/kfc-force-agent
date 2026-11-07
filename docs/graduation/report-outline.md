# Khung khóa luận để sinh viên biên tập

**Cần điền:** [Trường], [Khoa], [Sinh viên], [Mã số], [Giảng viên hướng dẫn], [Niên khóa]. Không thay bằng thông tin suy đoán.

## Tóm tắt gợi ý

Đề tài xây dựng hệ thống đặt món tiếng Việt với giao diện khách và quản trị. Trợ lý chuyển yêu cầu thành đề xuất có cấu trúc; policy, xác nhận và công cụ xác định kiểm soát việc thay đổi giỏ. Hệ thống có account, menu động, checkout kiểm tra lại giá, workflow theo hình thức nhận món, event và báo cáo demo. Triển khai local phục vụ tái lập; adapter cloud tách riêng và chưa nghiệm thu.

Cập nhật số liệu từ report ở lần chạy cuối. Phân biệt parser offline, test nghiệp vụ và đánh giá LLM chưa có.

## Chương 1 — Giới thiệu

Nêu bài toán đồng bộ hội thoại–giỏ–giá–vận hành; mục tiêu, đối tượng, phạm vi, phương pháp phát triển. Giải thích vì sao thêm hội thoại nhưng không cho model tự ghi dữ liệu. Truy vết tới requirements.md.

Không thêm số liệu thị trường, khảo sát hoặc so sánh đối thủ nếu chưa có nguồn và dữ liệu phù hợp.

## Chương 2 — Cơ sở kỹ thuật và liên quan

Trình bày App Router/Route Handlers, Client Components, kiến trúc chia lớp, repository/provider, structured output, policy, confirmation, transaction, idempotency, state machine và session.

Dùng nguồn chính thức trong references.md. Nếu cần nghiên cứu liên quan, sinh viên phải chọn và phân tích paper thực sự phù hợp. Tài liệu SDK không thay cho literature review hoặc bằng chứng hiệu quả thuật toán.

## Chương 3 — Phân tích và thiết kế

Đưa use case, ma trận quyền, component/sequence/ER/state diagrams, data dictionary và các quyết định trong architecture.md. Giải thích một tiến trình, snapshot, giới hạn báo cáo và đường đi khi lỗi.

Mô tả nguồn giá server, UUID/hạn/signature, thu hồi phiên và expectedStatus. Với FR36, minh hoạ commit cả giỏ, revision CAS và header chữ ký nội dung; phân biệt atomicity với idempotency khi mất phản hồi. Phân biệt khoá trong tiến trình với transaction phân tán.

## Chương 4 — Cài đặt

Trình bày phân hệ khách, account, chat, giỏ, checkout, quản trị, báo cáo, persistence. Chọn đoạn mã ngắn minh hoạ ranh giới quyền/commit thay vì chép nguyên file. Ảnh phải từ bản chạy thật và không lộ credential/contact thật.

Với Bedrock, mô tả adapter đã cài; chỉ tuyên bố tích hợp hoạt động khi có lần chạy thật được cấp quyền và bằng chứng. Bản nghiệm thu hiện tại dùng mock.

## Chương 5 — Kiểm thử và đánh giá

Phân loại schema/domain, HTTP, restart, cạnh tranh và trình duyệt. Có thể chọn FR36 làm case study: repro ghi một phần bằng mock, fault injection filesystem thật trên dữ liệu giả, stale UI và mất acknowledgement; đối chiếu before/after SHA256 thay vì chỉ ảnh thành công. Ghi số nhóm test, môi trường, ma trận yêu cầu và log/ảnh rút gọn.

Trình bày dataset 50 câu, cách gán nhãn, supported/challenge, metric, hash và kết quả evaluation-results.md. Phân tích lỗi số lượng bằng chữ, yêu cầu tương đối và cách nói ngoài mẫu. Không lấy latency parser làm latency toàn hệ thống; không báo coverage hoặc tải lớn nếu chưa đo.

## Chương 6 — Kết luận

Đối chiếu mục tiêu với bằng chứng. Các đóng góp có thể chứng minh: end-to-end, xác nhận đúng thay đổi, giá server, checkout, trạng thái có audit và kiểm thử tái lập. Không mô tả chúng như thuật toán mới chưa được nghiên cứu đối sánh.

Giới hạn: local một tiến trình; chưa email recovery/payment/POS; dataset nhỏ tự xây dựng; chưa có người dùng nghiên cứu, cloud acceptance hoặc model evaluation.

Hướng tiếp: storage đa tiến trình, account lifecycle/OIDC, distributed versioning/idempotency, cập nhật đa thiết bị, dataset độc lập và thử model thật trong ngân sách được duyệt.

## Phụ lục

- API/request không token thật.
- Dataset và từng kết quả.
- Hướng dẫn chạy, admin setup và backup.
- CI run ID nếu đã chạy.
- Kịch bản demo, cấu hình và phân công thực tế.

Đây là khung có căn cứ kỹ thuật, chưa phải khóa luận nộp chính thức. Sinh viên cần hiểu, kiểm tra, bổ sung yêu cầu đơn vị và tuân thủ quy định trích dẫn.
