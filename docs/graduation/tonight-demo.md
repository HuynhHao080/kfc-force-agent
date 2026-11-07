# Checklist báo cáo tối 07/11/2026

## Bản nên dùng

Dùng demo local đã build, một tiến trình duy nhất, dữ liệu giả. Không nâng dependency, chuyển database hay bật cloud ngay trước buổi báo cáo. [Bản nói 5–7 phút](supervisor-progress-2026-11-07.md) gồm nội dung, demo và câu hỏi thường gặp.

## Chuẩn bị trước buổi báo cáo

Trong thư mục project:

~~~powershell
# Máy đã cài dependencies: không cần npm ci lại ngay trước giờ demo.
npm run check
# Chỉ khi chưa có credential trong .local/preview:
npm run demo:setup
# Giữ cửa sổ này chạy:
npm run demo:start
~~~

demo:setup không ghi đè credential đã có, không có --reset. Mật khẩu được lưu riêng tại .local/preview/admin-bootstrap.txt; mở riêng trước khi chia sẻ màn hình, không đưa file vào báo cáo. Nếu file bootstrap đã được xoá, dùng mật khẩu đã cất; không tự reset để tìm lại mật khẩu.

Các lệnh demo cố định AI_PROVIDER=mock, PERSISTENCE_DRIVER=local, LOCAL_DATA_DIR=.local/preview; dùng signing key và credential file local. ADMIN_PASSWORD và SESSION_SECRET từ môi trường bị bỏ qua trong riêng các lệnh này. Nếu trước đây dùng override môi trường, phiên cũ có thể phải đăng nhập lại và mật khẩu admin của file có thể khác. Lệnh npm start thông thường vẫn giữ cơ chế cấu hình trước đó.

Lệnh start chỉ lắng nghe 127.0.0.1, dùng build đã có; không tự build/tải gói, không tự tạo tài khoản hay sửa menu. Không chạy hai server trỏ cùng .local/preview, kể cả khác cổng.

Trong cửa sổ thứ hai:

~~~powershell
npm run demo:doctor
~~~

Kết quả phải PASS 7 kiểm tra. Doctor chỉ đọc health/trang và kiểm tra API từ chối request không có cookie; không đăng nhập, không tạo guest/giỏ/đơn, không gọi provider. Báo cáo ở output/verification/demo-readiness.json. PASS không thay thế việc thử đăng nhập và thao tác demo.

Mở:

- Khách: http://127.0.0.1:3100/chat
- Quản trị: http://127.0.0.1:3100/admin

Đăng nhập admin trước khi chia sẻ. Đặt một đơn thử bằng contact hư cấu và đi qua workflow; kiểm tra món dùng cho demo còn hiển thị. Đóng DevTools/network và mọi file mật khẩu. Đảm bảo font/ảnh đã tải, pin đủ và trình duyệt zoom 100%.

## Demo ngắn khi chỉ còn 3–5 phút

1. Nói bài toán và luồng đề xuất → policy → xác nhận → tool.
2. Gửi “Thêm 2 Pepsi vào giỏ hàng”, cho thấy giỏ chưa đổi trước xác nhận; bấm xác nhận.
3. Checkout nhận tại cửa hàng, đọc lại giá/contact, tạo đơn demo.
4. Admin tìm mã đơn và chuyển đúng từng bước; khách xem lại trạng thái.
5. Chốt bằng log kiểm thử và ba giới hạn: mock, local một tiến trình, chưa thanh toán/cloud thật.

Có thể minh hoạ “Thêm hai Pepsi” trên bản mới. Câu nhiều món/thao tác, khoảng số lượng hoặc tăng/giảm chưa có đích sẽ hỏi lại. Nếu câu không được hiểu đúng, dừng ở bản xem trước và dùng thực đơn hoặc gửi lại một món, một số lượng rõ ràng.

## Dự phòng

| Sự cố | Xử lý |
| --- | --- |
| Cổng 3100 đã dùng | Xác định server đang chạy; nếu đúng demo đang dùng thì giữ. Không mở thêm process dùng cùng data. Nếu cần đổi cổng, dừng server đó rồi chạy demo:start -- --port 3102 và demo:doctor -- --port 3102. |
| Chưa có build | Chạy npm run build khi còn thời gian/mạng. Không dùng check trong lúc đang chạy buổi demo vì nó ghi lại build. |
| Mất phản hồi khi đặt | Mở lịch sử xem có đơn chưa; không bấm đặt đơn mới liên tiếp. |
| Admin hết phiên sau restart | Đăng nhập lại bằng credential local; không reset dữ liệu. |
| Không chạy được live | Dùng ảnh evidence/ui trong gói source hoặc output/playwright và log check, nói rõ đây là bằng chứng lần kiểm tra trước. |
| Doctor FAIL | Đọc tên probe lỗi; kiểm tra server/cổng/config trước. Không coi PASS của lần chạy cũ là tình trạng hiện tại. |

Sau báo cáo ghi lại góp ý của giảng viên. Không tuyên bố hoàn thành toàn bộ khóa luận chỉ từ buổi demo này.
