# Báo cáo tiến độ ngày 07/11/2026

**Đề tài đề xuất:** Thiết kế và xây dựng hệ thống đặt món trực tuyến ứng dụng trợ lý hội thoại có kiểm soát thao tác.

**Phạm vi buổi này:** báo cáo một phần và xin góp ý hướng triển khai. Thông tin sinh viên, giảng viên và tên đề tài chính thức cần bổ sung theo thực tế.

## 1. Mở đầu — khoảng 45 giây

Em đang xây dựng hệ thống đặt món có hai phía: khách hàng và quản trị. Phần em tập trung là cho khách đặt món qua hội thoại nhưng mọi thao tác thay đổi giỏ đều phải qua kiểm tra nghiệp vụ và xác nhận. Trợ lý chỉ đề xuất; hệ thống quyết định món, giá, quyền truy cập và thao tác được phép.

Trong buổi hôm nay em trình bày luồng từ chọn món đến tạo đơn, cách quản trị cập nhật trạng thái, và kết quả kiểm tra ở môi trường local. Nhà hàng, thanh toán và giao vận hiện là demo.

## 2. Phần đã triển khai — khoảng 1 phút

| Phân hệ | Có thể trình bày |
| --- | --- |
| Khách hàng | Tìm/lọc món không dấu; giỏ hàng; đăng ký/đăng nhập; hồ sơ/đổi mật khẩu; sổ địa chỉ tối đa 5 |
| Trợ lý | Hiểu các mẫu câu được hỗ trợ; xem trước thao tác; xác nhận bằng nút; chặn đề xuất cũ khi giỏ/giá thay đổi |
| Đặt món | Nhận tại cửa hàng/giao hàng; kiểm tra contact và tổng tiền; tránh tạo trùng khi retry cùng khóa; lịch sử/chi tiết/huỷ đơn hợp lệ |
| Quản trị | Xử lý trạng thái đơn; quản lý món/danh mục; khuyến mãi; nhật ký catalog trước/sau; lọc báo cáo và CSV |
| Dữ liệu và kiểm thử | Local lưu qua restart; backup mã hoá/restore; kiểm tra nghiệp vụ, HTTP và giao diện |

## 3. Kiến trúc — khoảng 1 phút

Next.js/React cung cấp giao diện và API. API kiểm tra cookie, owner, origin và schema trước khi gọi service. Service xử lý nghiệp vụ, repository lưu dữ liệu. Bản demo dùng JSON local một tiến trình; adapter DynamoDB và Bedrock đã có mã nguồn nhưng chưa nghiệm thu AWS thật.

Luồng trợ lý là: câu khách → đề xuất action → policy kiểm tra → hiển thị bản xem trước → khách bấm xác nhận → kiểm tra lại giỏ/menu → tool thực thi. Giá lấy từ menu server, không dùng giá do mô hình tự nêu. Đề xuất có ID, hạn dùng và chữ ký dữ liệu để hạn chế thao tác từ tab cũ.

Khi checkout, đơn giữ bản chụp tên món, giá và thông tin nhận hàng. Sửa menu hoặc sổ địa chỉ về sau không sửa đơn đã tạo. Chuyển trạng thái đơn có kiểm tra trạng thái mong đợi, tránh hai yêu cầu cùng ghi đè.

## 4. Demo trọng tâm — khoảng 3 phút

1. Mở trang khách và trang quản trị. Giới thiệu rõ nhãn demo.
2. Trang khách: gửi **Thêm 2 Pepsi vào giỏ hàng**. Chỉ bản xem trước xuất hiện; giỏ chưa đổi. Bấm **Xác nhận thao tác**, đối chiếu số lượng và giá đang hiển thị.
3. Mở checkout, chọn nhận tại cửa hàng, nhập tên/điện thoại giả, kiểm tra tổng tiền và tích xác nhận. Đặt một đơn demo.
4. Trang quản trị: tìm đúng mã đơn, chuyển lần lượt theo các nút hợp lệ. Trang khách mở lại chi tiết để xem trạng thái và các mốc xử lý.
5. Nếu còn thời gian: cho xem sổ địa chỉ, phiếu đơn hoặc nhật ký thay đổi catalog. Không cố chạy hết phân hệ trong buổi báo cáo một phần.

Nếu món Pepsi đang bị ẩn hoặc đổi tên, chọn món đang có từ thực đơn và dùng tên chính xác. Không sửa dữ liệu để giả lập kết quả đã có.

## 5. Kết quả kiểm tra và giới hạn — khoảng 1 phút

Mốc kiểm tra gần nhất của bản source có **89 nhóm nghiệp vụ, 9 nhóm backup/recovery và 73 nhóm HTTP: tổng 171 nhóm**. Đây là số nhóm assertion, không phải code coverage. Xem log kiểm tra đi kèm bản bàn giao; chạy lại npm run check để có bằng chứng của lần chạy mới.

Bộ parser offline có 50 câu tự xây dựng và giữ nguyên nhãn. Mốc trước parser v2 đúng 42/50 intent, 40/50 intent kèm số lượng; bản mới đúng 49/50 ở cả hai, nhóm supported vẫn 40/40. Bộ này đã được xem khi phát triển nên kết quả tăng là hồi quy trên dữ liệu đã biết, không phải kiểm định độc lập, đánh giá LLM hay khảo sát người dùng. Có thêm 61 câu hồi quy ngôn ngữ kiểm tra intent và policy giữ giỏ; không cộng thành số người dùng hoặc điểm LLM. Câu số viết bằng chữ như “Cho mình hai Pepsi” đã hỗ trợ; câu tăng/giảm chưa có số lượng cuối cùng vẫn hỏi lại. Khách luôn phải đọc đề xuất và xác nhận.

Hiện em chưa có nghiệm thu AWS/Bedrock, thanh toán hay giao vận thật. Local chưa phục vụ nhiều tiến trình. Báo cáo giới hạn ở 200 đơn gần nhất. Xác thực email, quên mật khẩu và phân quyền nhiều nhân viên là phần chưa triển khai.

## 6. Phần tiếp theo và góp ý cần xin

Em dự kiến chốt phạm vi sau khi nhận góp ý, ưu tiên làm rõ phương pháp đánh giá, bổ sung câu thử ngoài mẫu và hoàn thiện báo cáo theo cấu trúc của khoa. Nếu giữ AWS trong tên đề tài, cần một đợt cấu hình và kiểm thử tích hợp thật, có bằng chứng riêng; chưa thể kết luận từ mã adapter hiện có.

Các ý em muốn xin góp ý:

- Phần trợ lý có kiểm soát thao tác đã phù hợp trọng tâm khóa luận chưa?
- Nên ưu tiên đánh giá parser/LLM, trải nghiệm đặt món hay nghiệm thu kiến trúc cloud ở giai đoạn tiếp theo?
- Phạm vi cần thu hẹp hoặc bổ sung gì trước mốc báo cáo kế tiếp?

## Câu hỏi có thể gặp

| Câu hỏi | Trả lời ngắn |
| --- | --- |
| AI thực sự ở đâu? | Có lớp provider cho mock/Bedrock. Buổi này dùng parser mock để demo có thể tái lập, chưa gọi LLM thật. Policy và tool không tin trực tiếp kết quả provider. |
| Điểm kỹ thuật đáng chú ý? | Tách đề xuất khỏi thực thi; xác nhận gắn với dữ liệu; kiểm tra owner; snapshot đơn; kiểm tra cạnh tranh cập nhật. Chưa tuyên bố tính mới nghiên cứu so với công trình khác. |
| Có trả tiền/đẩy đơn đến KFC không? | Chưa. Đơn, COD, trạng thái bếp/giao hàng đều nằm trong ứng dụng demo. |
| Mất mạng sau khi đặt thì sao? | Kiểm tra lịch sử trước khi đặt lại. Cùng idempotency key trả lại đơn cũ; một key mới vẫn có thể tạo đơn mới. |
| Vì sao chưa dùng database thật cho demo? | Local giúp tái lập nghiệp vụ và không phụ thuộc tài khoản cloud. JSON chỉ cho một tiến trình; cần nghiệm thu adapter/database trước khi mở rộng. |
| 94 test có chứng minh không còn lỗi? | Không. Chúng bảo vệ các ca đã viết; chưa đo toàn bộ coverage, tải hay có pentest độc lập. |
| Tiến độ bao nhiêu phần trăm? | Em báo theo phân hệ và bằng chứng, chưa có rubric để quy thành phần trăm đáng tin cậy. |

Nguồn đối chiếu: [kiến trúc](architecture.md), [ma trận kiểm thử](testing.md), [parser](evaluation-results.md), [nghiệm thu và giới hạn](acceptance-checklist.md), [lịch sử kiểm chứng](../verification.md).

Phần mở rộng mới có thể demo nếu còn thời gian: Admin tạo mã → checkout áp mã → đối chiếu giảm và phí giao → đặt đơn → xem phiếu. Nếu sửa mã sau báo giá, khách phải áp lại và xác nhận lại. Mỗi đơn một mã dùng lại được, chưa có quota.

Đã có phần mở rộng FR29/FR30: tìm/lọc lịch sử riêng và đặt lại có xem trước giá mới, token 15 phút, giỏ trống và retry không nhân đôi. Có thể demo sau luồng chính nếu còn thời gian; xác nhận đặt lại chỉ thêm giỏ, chưa tạo đơn.

FR32 mở rộng: top món theo completed snapshots, đối soát tiền món/giảm/phí/tổng, CSV và cùng bộ lọc/window. Phạm vi200, không phải toàn lịch sử hoặc tiền thu thực tế.
