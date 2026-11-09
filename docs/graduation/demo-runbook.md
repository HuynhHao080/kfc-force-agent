# Vận hành và kịch bản bảo vệ

## Chuẩn bị

```powershell
npm ci
# Chỉ copy nếu chưa có .env.local:
Copy-Item .env.example .env.local
npm run admin:setup
npm run check
npm run evaluate:report
npm start
```

Mở /chat và /admin ở hai tab. Chọn mock + local để không phụ thuộc inference/cloud. Mật khẩu quản trị ngẫu nhiên được ghi vào LOCAL_DATA_DIR/admin-bootstrap.txt, không in console. Không có mật khẩu mặc định. Đọc file trên máy riêng; không chụp hoặc đưa vào bản nộp. Hash/salt ở admin-credentials.json.

Script dừng nếu đã cấu hình. Đổi lại bằng npm run admin:setup -- --reset; credential cũ không còn dùng cho staff session. Nếu có ADMIN_PASSWORD trong môi trường, biến này được ưu tiên và cần ít nhất 12 ký tự. Thay biến cần restart.

Script có tuỳ chọn --password-stdin để tự chọn mật khẩu thay vì tạo file bootstrap. Không đặt mật khẩu trực tiếp vào command line/source/Git. Không tự reset vào môi trường đã có dữ liệu mà chưa kiểm tra.

## Kịch bản khoảng 12–15 phút

| Mốc   | Nội dung                                | Điểm kỹ thuật                                       |
| ----- | --------------------------------------- | --------------------------------------------------- |
| 0–2   | Bài toán, tác nhân, phạm vi             | Hiểu câu tách khỏi thực thi; cloud chưa nghiệm thu  |
| 2–4   | Đăng ký, tìm món, thêm qua chat         | Session server, giá menu, structured proposal       |
| 4–6   | Preview, xác nhận, đổi số lượng, tab cũ | UUID, TTL, signature; chữ ok không thực thi         |
| 6–8   | Checkout                                | Snapshot món, phí giao, idempotency và commit       |
| 8–11  | Admin xử lý từng bước; khách xem lại    | ExpectedStatus, nhánh pickup/delivery và event      |
| 11–12 | Sửa giá/ẩn món                          | Đơn cũ giữ snapshot, giỏ reprice                    |
| 12–13 | Thống kê/CSV                            | Completed value demo, tối đa 200 đơn, không contact |
| 13–15 | Test, dataset, giới hạn                 | Test nghiệp vụ khác đo parser, chưa có đánh giá LLM |

Dùng email example.test và contact hư cấu. Không mở payload đăng nhập trước hội đồng. TTL có thể giải thích bằng test dựng thời điểm hết hạn; không cần chờ 15 phút hoặc sửa dữ liệu vận hành trong buổi demo.

Các bước bếp/giao hàng do admin thao tác trong ứng dụng, không phải POS hoặc tài xế thật. Có thể trình bày một nhánh và chứng minh nhánh còn lại bằng test HTTP.

## Xử lý sự cố

Demo nhật ký: sửa giá một món rồi mở Admin → Nhật ký. Đối chiếu giá trước/sau; lọc Sửa món và tìm tên không dấu. Lưu lại nội dung y hệt sẽ không tạo thêm entry. Chỉ có thay đổi catalog từ khi bổ sung chức năng được ghi; lịch sử trạng thái đơn nằm ở chi tiết đơn, admin hiện dùng credential chung.

Demo danh mục: Admin → Thực đơn → Thêm danh mục; đặt thứ tự 0 để hiện trước. Sửa một món sang danh mục mới rồi thử tắt nhóm: hệ thống yêu cầu chuyển món ra trước. Chuyển món sang nhóm đang dùng khác, tắt nhóm trống và kiểm tra nhóm không còn trên trang khách. Không xoá snapshot đơn cũ.

Demo phiếu đơn: khách mở chi tiết đơn → Xem / In phiếu đơn; kiểm tra giá snapshot và nhãn chưa thu tiền. In / Lưu PDF mở hộp thoại của trình duyệt, không tự gửi file ra ngoài. Demo báo cáo: chọn hình thức, trạng thái và khoảng ngày; đối chiếu số đơn/giá trị với CSV. Phạm vi vẫn là tối đa 200 đơn gần nhất, không phải toàn lịch sử.

Demo mở rộng tài khoản: đăng nhập ở hai trình duyệt, mở Tài khoản của tôi và sửa họ tên. Đổi mật khẩu bằng tài khoản giả; phiên cũ ở cả hai trình duyệt không còn truy cập account. Đăng nhập bằng mật khẩu mới: giỏ/lịch sử vẫn còn. Không quay hoặc chụp trường mật khẩu đã điền; đây không phải luồng quên mật khẩu.

| Sự cố                        | Cách xử lý                                                                               |
| ---------------------------- | ---------------------------------------------------------------------------------------- |
| Mất phản hồi checkout        | Xem lịch sử; retry đúng thao tác dùng cùng key                                           |
| Đề xuất hết hạn/giỏ đổi      | Gửi lại yêu cầu, xem preview mới                                                         |
| Staff mất phiên sau restart  | Đăng nhập lại, nonce staff chỉ trong tiến trình                                          |
| Account không thấy giỏ guest | Đúng thiết kế, không tự gộp hai chủ thể                                                  |
| Giá đổi/hết món              | Làm mới; server từ chối checkout cũ                                                      |
| Cổng 3197 bị dùng            | Kiểm tra và dừng test server của chính mình, không dừng tiến trình không rõ nguồn        |
| Snapshot hoặc ổ đĩa lỗi      | Dừng server, sao lưu cả thư mục, khôi phục bản tốt; không xoá dữ liệu để giả lập sửa lỗi |

## Bàn giao

Dùng [công cụ backup/verify/restore](../local-backup.md) để sao lưu mã hoá trước khi demo hoặc chuyển máy. Dừng server, dùng đúng thư mục và môi trường; restore vào thư mục mới rồi đổi LOCAL_DATA_DIR. Không đưa archive riêng tư hoặc mật khẩu vào gói mã nguồn/bản báo cáo.

Dừng server trước khi sao lưu LOCAL_DATA_DIR. Giữ store.json, session-secret và credential hash nếu cần phục hồi dữ liệu/phiên. Bootstrap password là hỗ trợ local, không đưa vào bản nộp công khai.

Gói mã nguồn gồm source, lockfile, script, dataset, tài liệu, .env.example. Loại .env.local, .local, node_modules, .next, output và .playwright-cli. Người nhận tự tạo admin và cấu hình riêng.

Để demo không mạng sau chuẩn bị, dùng production build đã tạo trước. npm ci và lần build đầu có thể cần internet để tải dependencies/font; không mô tả quá trình cài đặt là hoàn toàn offline.

## Demo sổ địa chỉ

Đăng nhập khách → Sổ địa chỉ → thêm Nhà và Công ty → chọn Công ty mặc định. Thêm món, mở checkout, chọn Giao tận nơi: kiểm tra tên/phone/address điền từ Công ty; có thể đổi địa chỉ hoặc nhập tay. Xác nhận đặt đơn demo. Sửa/xoá Công ty rồi mở lại đơn: contact cũ phải giữ nguyên. Muốn minh hoạ conflict, hai tab cùng mở sổ địa chỉ; một tab lưu, tab kia lưu revision cũ sẽ yêu cầu làm mới.

## Demo khuyến mãi

Admin → Khuyến mãi → Tạo mã (ví dụ DEMO20, giảm 20%, trần 20.000, đơn từ 50.000, thời gian hiện tại đến ngày sau). Khách thêm món đủ minimum → checkout nhập DEMO20 → Áp dụng mã. Đối chiếu giảm và phí giao; tích lại xác nhận rồi đặt đơn. Mở phiếu và chi tiết admin để thấy mã/snapshot. Admin đổi điều kiện hoặc tắt mã: đơn cũ không đổi; quote mới theo điều kiện mới hoặc bị từ chối. Hai tab admin sửa cùng revision chỉ một tab được lưu; tab kia làm mới, không retry tự động. Mã minh hoạ không phải voucher KFC thật.

## Demo đặt lại đơn

Khách → Đơn của tôi → tìm mã/tên hoặc chọn trạng thái → mở chi tiết → Đặt lại món trong đơn này. Nếu giỏ đang có món, app yêu cầu khách tự hoàn tất hoặc xoá; không tự ghi đè. Xem tên/giá hiện tại và khác biệt giá cũ, đóng preview để minh hoạ giỏ chưa đổi. Mở lại rồi xác nhận thêm vào giỏ; đơn cũ và voucher cũ không được sao chép vào đơn mới. Checkout riêng để tạo đơn mới. Nếu muốn minh hoạ stale, mở preview rồi admin đổi giá món; xác nhận bị chặn, khách xem preview mới. Không cần sửa dữ liệu vận hành để mô phỏng lỗi đĩa; dùng test:data.

## Demo món bán chạy

Hoàn tất một đơn pickup và một delivery (có thể dùng mã giảm) theo workflow hợp lệ. Admin → Báo cáo → Món bán chạy. Đối chiếu gross−discount+fee=net, số phần và snapshot tên/giá. Lọc hình thức/ngày; xuất CSV món chỉ khi dữ liệu đã tải. Nếu báo window đã đổi, bấm Làm mới phía trên. Có thể đổi tên/giá menu để chỉ ra order cũ không đổi; tên report chỉ đổi khi có completed snapshot mới hơn. Không trình bày đây là doanh thu đã thu/lợi nhuận.


## Nếu mất mạng lúc đặt đơn

Không kết luận đơn thất bại chỉ từ lỗi mạng. Giao diện sẽ kiểm tra yêu cầu vừa gửi bằng thao tác chỉ đọc. Nếu tìm thấy, xem chi tiết thông tin đã lưu. Nếu chưa tra cứu được, dùng “Kiểm tra đơn vừa gửi”; thao tác này không tạo đơn. Sau reload, xem “Đơn của tôi” trước khi đặt lại. Nếu giỏ/menu thay đổi, áp lại mã giảm giá và tick xác nhận mới. Không dùng tổng tiền hiện tại của giỏ để thay cho snapshot đơn đã lưu.

## Trình diễn huỷ có lý do

Chọn đơn CONFIRMED trong quản trị → Huỷ đơn demo → nhập lý do hiển thị cho khách → tick xác nhận → Xác nhận huỷ đơn. Mở chi tiết đúng chủ đơn ở trang khách để xem lý do trong lịch sử trạng thái. Giữ đơn/đóng modal không ghi. Nếu đơn đã đổi, đóng và làm mới; không đổi expectedStatus để ép huỷ. Mất phản hồi thì xem trạng thái hoặc gửi lại đúng cùng lý do, không sửa lý do lịch sử đã huỷ.

## Bảng bếp trong báo cáo

Sau khi khách tạo đơn, mở quản trị →06 Bảng bếp. Giới thiệu bốn cột và tổng phần chờ/đang làm; chọn pickup/delivery để lọc. Bắt đầu chuẩn bị, Món đã chuẩn bị xong rồi hoàn tất nhận/giao demo; chỉ có bước hợp lệ theo fulfillment. Đơn hoàn tất rời bảng, tổng cần chuẩn bị giảm. Mở chi tiết đơn để xem contact hoặc huỷ có lý do. Đây là view nội bộ từ200 đơn gần nhất, không gửi lệnh đến bếp vật lý và thời gian không phải SLA.

## Điều kiện tiếp nhận đơn

Quản trị →07 Cửa hàng: nhập điểm nhận/liên hệ, chỉnh phí giao/minimum, bật kênh, tạm ngừng hoặc lịch7ngày. Lưu rồi mở trang khách để xem public status. Bỏ Nhận đơn mới chặn đơn mới nhưng vẫn xử lý đơn đã có; demo nhận đơn trở lại thì bật nhận đơn và kiểm tra lịch/kênh. Lịch cùngngày, UTC+7, opens inclusive/closes exclusive; chưa hỗ trợ overnight/ngày lễ. Thông tin mặc định là placeholder demo, cần sinh viên tự cấu hình phù hợp. Đổi fee khi checkout mở yêu cầu xem lại/tick mới; đơn cũ/receipt giữ địa chỉ và fee snapshot. Nếu409 khi lưu, đọc draft rồi chọn tải lại bỏ thay đổi chưa lưu; không gửi revision mới để ép ghi đè.

## Sau nhận món — đánh giá riêng

Hoàn tất đơn qua workflow quản trị. Khách vào Đơn của tôi →chọn đơn→Đánh giá đơn đã nhận, chấm1–5/nhận xét và lưu. Quản trị →08 Đánh giá, lọc điểm/chờtrảlời và trả lời đúng nội dung hiện tại. Nếu khách vừa sửa, đóng editor và tải lại trước khi trả lời; không ép revision. Khách mở lại chi tiết để đọc reply; sau replytraođổiđượcgiữnguyên. Mất response thì gửi lại đúng nội dung hoặc tải lại đánh giá, không đổi draft để che kết quả chưa biết. Nội dung riêng, không nằm trên menu/CSV/AI. Hộp thư200feedback theo thời điểm cập nhật, không phải200order mới.

## Minh hoạ dữ liệu giỏ cũ — FR36

Mở hai tab cùng phiên, thêm món rồi thay số lượng ở tab còn lại. App chủ động đồng bộ nên tab thường tự cập nhật; nếu một tab thật sự giữ snapshot cũ, thao tác sửa trả thông báo giỏ đã thay đổi và hiển thị số lượng mới để khách xem lại. Không ép gửi revision/chữ ký mới để bỏ qua cảnh báo. Khi mất phản hồi thêm món, đọc giỏ trước khi thêm tiếp; bản kiểm thử có fault injection response và lỗi đĩa bằng dữ liệu giả, không cần phá file demo thật để trình diễn. Để giải thích tính nguyên tử, xem evidence/cart/cart-atomic-before.json và cart-atomic-after.json trong ZIP.

## Minh hoạ hai tab sửa món

Mở cùng món ở hai tab quản trị. TabA đổi giá và lưu, tabB sửa mô tả rồi lưu bằng snapshot cũ. TabB nhận thông báo409, mô tả đang soạn được giữ, giá mới ở server tiếp tục có hiệu lực. Đọc lại draft rồi chọn Tải lại món · bỏ bản nháp để xem giá mới. Sau khi kiểm tra, sửa và lưu theo dữ liệu mới. Danh mục có cùng luồng. Trên mobile, tám mục điều hướng xếp thành hai hàng để các nút nằm trong màn hình.
