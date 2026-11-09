# Verification — 2026-11-06

Môi trường: Windows, Node.js 26.3.0, Next.js 16.4.5. Dùng provider mock và lưu trữ local; không gọi AWS, không gửi đơn đến nhà hàng, không thu tiền.

## Tự động

`npm run check` đã đạt:

- ESLint: không lỗi/cảnh báo.
- TypeScript: không lỗi.
- 12 kiểm tra service/policy/tool; bao gồm cập nhật giá menu và chặn checkout cũ.
- Production build: thành công; không còn cảnh báo tracing toàn project.
- 11 kịch bản HTTP trên production server; bao gồm hai khách độc lập, xác nhận đồng thời, giá/ownership, idempotency, lưu món trong đơn, phí giao, huỷ đơn và khôi phục sau khi dừng/khởi động lại server.

Sau thay đổi cuối về focus và màu trạng thái huỷ, lint, typecheck và build đã chạy lại thành công. Các thay đổi đó không đổi nghiệp vụ server.

`npm audit --omit=dev`: **0 vulnerabilities**. Audit toàn bộ dependency còn **8 cảnh báo moderate** trong cây ESLint/TypeScript-ESLint/minimatch dành cho development. Không áp dụng đề xuất downgrade ESLint config sang Next 15 vì project đang dùng Next 16.

## Trình duyệt thật

Dùng Playwright CLI với Microsoft Edge tại `http://localhost:3100/chat`. Chrome không có trên môi trường này, nên chuyển sang Edge đã cài.

Đã thao tác và quan sát:

1. Tải menu, tìm Pepsi và chỉ thấy món phù hợp.
2. Thêm bằng nút trên card; giỏ hiển thị số lượng và giá.
3. Gửi `Thêm 2 Pepsi vào giỏ hàng`; giỏ chưa đổi cho đến khi nhấn xác nhận.
4. Sau xác nhận, giỏ từ 1 lên 3 phần, tổng 75.000đ.
5. Checkout giao hàng: nhập tên, số điện thoại, địa chỉ; phí giao 15.000đ, đơn tổng 90.000đ.
6. Xem chi tiết đơn với 3 phần, phí giao, thông tin khách và sự kiện ghi nhận; huỷ qua dialog, xuất hiện trạng thái/sự kiện huỷ.
7. Sau restart production server, cùng cookie vẫn thấy hội thoại và lịch sử đơn.
8. Trên build cuối, checkout nhận tại cửa hàng: checkbox chưa đánh dấu chặn submit; đánh dấu rồi đặt đơn 25.000đ thành công, phí giao 0đ. Focus chuyển đến tiêu đề lịch sử đơn. Huỷ đơn và kiểm tra focus vẫn ở tiêu đề.
9. Giả lập riêng `POST /api/cart` trả 500: thông báo lỗi hiển thị, giỏ giữ nguyên; bỏ mock rồi thao tác lại thành công.
10. Tải lại build cuối với network bình thường: console không có error; favicon SVG tải được.

Responsive: kiểm tra desktop 1440px, tablet 768px, mobile 390px và 320px. `document.documentElement.scrollWidth` bằng viewport tại các chiều rộng đã đo 768/390/320px; không tràn ngang. Ở 320px, toàn bộ ảnh trong trang tải được. Đã xem ảnh desktop, đơn mobile và dialog checkout để kiểm tra bố cục.

Ảnh local (bị Git ignore):

- `output/playwright/desktop.png`
- `output/playwright/tablet.png`
- `output/playwright/mobile-320.png`
- `output/playwright/mobile-order.png`
- `output/playwright/mobile-checkout.png`

## Giới hạn kiểm chứng

Chưa chạy AWS thật, tích hợp bếp/giao vận, thanh toán, tài khoản đăng nhập hoặc kiểm tra tải nhiều instance. Bộ local được thiết kế cho một tiến trình. Chưa thực hiện audit accessibility theo toàn bộ WCAG. Các test chứng minh luồng demo đã nêu, không phải chứng nhận sẵn sàng vận hành thực tế.

## Hoàn thiện chat và đồng bộ nhiều tab — 2026-11-06

Bổ sung mã UUID và hạn 15 phút cho từng đề xuất, ràng buộc với trạng thái giỏ lúc xem trước. `confirmationId` bắt buộc khi xác nhận; bỏ qua cũng phải khớp mã. Đề xuất có bản xem trước tên món, số lượng và giá, hiện trong chat/session API. Tin nhắn đồng ý đơn thuần giữ đề xuất để khách nhấn nút; không tự thực hiện thay đổi.

Bộ kiểm tra hiện tại: **21 test nghiệp vụ/client helper + 14 kịch bản HTTP = 35 kiểm tra**. `npm run check` chạy lint, TypeScript, test, build và HTTP. Các ca mới gồm gọi món tự nhiên, đổi số lượng, nhãn 1.5L, số lượng sai, câu phủ định, tin nhắn nhiều dòng, mã đề xuất cũ, hết hạn, giá thay đổi, đồng ý bằng chữ và lỗi mạng/timeout/HTML.

Kiểm tra trình duyệt bằng Playwright CLI / Edge:

- “Cho mình 2 combo gà cay” hiển thị đề xuất 318.000đ; giỏ vẫn trống.
- Tạo đề xuất 3 combo ở tab khác; bấm xác nhận từ tab cũ bị chặn, giỏ vẫn trống và giao diện yêu cầu xem lại đề xuất mới 477.000đ.
- Sau khi xem lại và bấm lần nữa, giỏ có 3 combo. Câu “Đổi combo gà cay thành 4” hiển thị bản xem trước 636.000đ trước khi thực hiện.
- Trên build có BroadcastChannel: tạo đề xuất đổi thành 5 ở tab thứ nhất; tab thứ hai tự hiển thị bản xem trước 795.000đ. Xác nhận ở tab thứ hai cập nhật giỏ tab thứ nhất thành 5 phần, không reload trang.
- “Cho mình 1 Pepsi 1.5L” hiển thị đúng 1 phần, 25.000đ, kèm hạn xác nhận.
- Giả lập API cart trả 502 với HTML: hiển thị thông báo tiếng Việt và nút “Làm mới dữ liệu”. Bỏ mock, nhấn làm mới: giỏ giữ nguyên 5 combo, đề xuất Pepsi được khôi phục, không gửi lại thao tác thêm.
- Bản xem trước không tràn ngang tại 390px và 320px; đã xem ảnh phần chat mobile. Sau reload với mạng bình thường, console không có error.

Ảnh bổ sung: `output/playwright/chat-confirmation-desktop.png`, `chat-confirmation-mobile.png`, `chat-panel-mobile.png`.

BroadcastChannel chỉ báo có dữ liệu đổi, không gửi thông tin khách qua kênh. Trình duyệt không hỗ trợ vẫn đồng bộ khi focus/hiện lại trang hoặc làm mới thủ công. Trong lúc checkout đang mở, đồng bộ nền không ghi đè nội dung form; server vẫn kiểm tra giỏ khi submit.

## Mở rộng các phân hệ khóa luận — 2026-11-06

Ghi nhận phần này là kết quả đợt mở rộng trước review. Kết quả mới nhất nằm ở mục review phía cuối.

Phần này thay thế trạng thái chưa có tài khoản trong các ghi nhận lịch sử phía trên. Bản hiện tại bổ sung đăng ký/đăng nhập khách hàng, phiên có thể thu hồi, vai trò quản trị riêng, quản lý thực đơn, hàng đợi đơn, workflow nhận tại quầy/giao hàng, báo cáo demo và xuất CSV.

Kết quả chạy cuối trên Windows / Node v26.3.0 / Next.js 16.4.5:

- npm run check hoàn tất: lint, TypeScript, **28 nhóm nghiệp vụ/provider/client helper**, production build và **24 nhóm HTTP** đều qua. Đây là 52 nhóm kiểm tra, không phải số đo coverage.
- HTTP kiểm tra account qua restart, logout từng phiên, phân quyền khách/nhân viên, chuyển trạng thái, race huỷ/chuẩn bị, thay đổi menu, giá và báo cáo. Dữ liệu kiểm thử nằm trong thư mục tạm riêng.
- Bedrock chỉ được kiểm tra bằng transport giả: payload/history/usage, timeout signal, lỗi cấu hình/transport/response và grounding theo kết quả tool. Không có invocation AWS; thiếu cấu hình không được trả mock success.
- npm audit --omit=dev báo 0 vulnerabilities tại thời điểm kiểm tra. Không suy ra toàn bộ dependency phát triển hoặc ứng dụng không có lỗ hổng.
- git diff --check qua; các trace .next/**/*.nft.json không chứa đường dẫn dữ liệu .local, bootstrap, credential hoặc .env.local.
- npm run evaluate:report: 50 câu synthetic, đúng intent 42/50 (84%), đúng intent và số lượng 40/50 (80%), macro F1 0.8166. Nhóm supported 40/40; nhóm challenge đúng intent 2/10 và joint 0/10. Báo cáo giữ nguyên các ca thất bại, hash và giới hạn phương pháp.

Playwright CLI / Microsoft Edge trên production preview:

1. Đăng ký tài khoản khách bằng dữ liệu giả; giỏ khách vãng lai không bị tự chuyển sang tài khoản.
2. Đặt 1 Burger Gà Rán nhận tại quầy, 89.000đ. Quản trị chuyển CONFIRMED → PREPARING → READY → COMPLETED. Chi tiết và lịch sử sự kiện ở tab khách cập nhật; nút huỷ biến mất sau khi bắt đầu chuẩn bị.
3. Báo cáo hiển thị một đơn hoàn tất, giá trị demo 89.000đ; các đơn huỷ không được cộng vào giá trị hoàn tất.
4. Quản trị tạo món Combo Khóa Luận giá 129.000đ, mô tả rõ là demo; thực đơn ở tab khách cập nhật.
5. Quản trị tại 390px và 320px không tràn ngang; phép đo tại 320px cho innerWidth = scrollWidth = 320. Đã xem ảnh menu mobile và form thêm món. Console tại lần kiểm tra cuối có 0 error.

Ảnh bổ sung ở output/playwright: admin-desktop.png, admin-report-desktop.png, admin-mobile.png, admin-menu-editor.png, graduation-customer-order.png. Log check ở output/verification/check.log. Script đóng gói chỉ đưa source và bằng chứng được chọn vào archive, loại dữ liệu khách, credential, dependency, build và Git.

Hồ sơ kỹ thuật tại docs/graduation bao gồm yêu cầu/use case, kiến trúc/sequence/ER/state, ma trận kiểm thử, đánh giá, kịch bản demo, nguồn tham khảo và khung báo cáo. CI Ubuntu/Windows Node 24 đã cấu hình nhưng chưa chạy trên GitHub. Chưa xác minh AWS thật, thanh toán/giao vận, nhiều instance hoặc chất lượng LLM thật. Đây là hệ thống demo phục vụ khóa luận; sinh viên cần biên tập báo cáo chính thức và bổ sung thông tin trường/cá nhân.

## Review và sửa lỗi — 2026-11-06

Review có trọng tâm được ghi tại docs/graduation/code-review.md: 5 lỗi về chữ ký giá món mới, JSON mô hình không có hành động nhưng thông báo thành công, giới hạn body sau khi đọc toàn bộ, state tài khoản sau logout và phản hồi mutation quản trị khi GET tiếp theo thất bại.

Kết quả mới nhất:

- npm run check qua lint, typecheck, 31 nhóm nghiệp vụ/provider/client helper, production build và 25 nhóm HTTP: tổng 56 nhóm. Log mới thay thế tại output/verification/check.log.
- Hai ca hồi quy về món mới đổi giá và JSON thông báo thành công đã chạy thất bại trước sửa, sau sửa đều qua. Bộ đọc JSON kiểm tra cả giới hạn byte Unicode, đúng ngưỡng, stream vô hạn bị huỷ, header vượt ngưỡng, UTF-8 sai và JSON có phần dư.
- HTTP kiểm tra body Unicode và body chunked trả 413, không tạo giỏ. Các test account/role/workflow/concurrency/restart trước đó tiếp tục qua.
- npm run evaluate giữ kết quả 42/50 intent (84%), 40/50 joint (80%). Không thay dataset/parser để làm đẹp số liệu.
- npm audit --omit=dev báo 0 vulnerabilities. git diff --check qua; trace .next không chứa credential/bootstrap, dữ liệu .local hoặc .env.local.

Playwright CLI / Edge, production server 3101, thư mục dữ liệu giả riêng .local/review-20261106:

1. Seed tài khoản giả Review Privacy, giỏ 2 Burger Gà Rán và tin nhắn giả riêng tư. Giả lập GET /api/cart trả 503 sau khi logout. UI xoá tên, tin nhắn và giỏ cũ ngay; giỏ đếm 0, nút thêm bị khoá đến khi tải dữ liệu. Bỏ route giả, reload khôi phục phiên khách bình thường.
2. Đăng nhập quản trị, mở form tạo món Review Save Recovery. Cho POST đi qua nhưng giả lập GET /api/admin/menu trả 503. Editor đóng, UI ghi rõ món đã lưu và yêu cầu làm mới. Đếm đúng 1 POST và kiểm tra API thật có đúng 1 món cùng tên. Bỏ lỗi giả lập, nhấn Làm mới: món xuất hiện.
3. Hai HTTP 503 do fault injection xuất hiện trong console lúc kiểm tra là có chủ ý. Sau bỏ route giả và điều hướng lại, console không có error/warning.

Ảnh đã chụp: output/playwright/review-logout-network-error.png và review-admin-save-network-error.png; đã xem ảnh quản trị để kiểm tra nội dung phản hồi. Không sửa dữ liệu preview cũ và không gọi AWS.

## Quản lý hồ sơ và đổi mật khẩu — 2026-11-06

Bổ sung hộp thoại Tài khoản của tôi cho khách đăng nhập, PATCH /api/account/profile và POST /api/account/password. Schema chỉ cho sửa họ tên hoặc gửi current/new/confirm password; không nhận ID/email/role từ client. Repository cập nhật từng trường theo điều kiện hash trước để không ghi đè phiên bản mật khẩu mới.

Đổi mật khẩu dùng salt ngẫu nhiên/KDF hiện hành, làm mất hiệu lực mọi cookie customer chứa version cũ. Cookie hiện tại được xoá; không đổi account ID hoặc xoá giỏ/đơn. Không có email recovery. Thao tác đổi mật khẩu có budget 10 yêu cầu/phút/tài khoản trong tiến trình, riêng với budget đăng nhập; request đang thực thi không bị huỷ từ xa. Các record session cũ không được quét xoá ngay, nhưng không còn xác thực được theo password version.

Kiểm tra tự động:

- npm run check qua lint, typecheck, **33 nhóm nghiệp vụ/provider/client helper + 29 nhóm HTTP = 62 nhóm**, production build thành công. Log hiện hành ở output/verification/check.log.
- Service kiểm tra profile giữ ID/email/hash, DTO public không có credential, chặn ghi theo hash cũ; hai yêu cầu đổi mật khẩu đồng thời chỉ một thành công.
- HTTP kiểm tra guest/staff/origin/extra ID, tên sai, mật khẩu hiện tại sai, xác nhận không khớp, hai phiên cũ bị thu hồi, mật khẩu cũ không đăng nhập được. Mật khẩu mới/profile/giỏ/đơn còn qua restart; limiter của một tài khoản không làm cạn budget đổi mật khẩu của tài khoản khác.
- npm audit --omit=dev báo 0 vulnerabilities. Không thay dependency. Trace build không chứa dữ liệu .local, credential hoặc bootstrap.

Playwright CLI / Edge trên production build 3101, dữ liệu giả riêng .local/account-review-20261106:

1. Tạo tài khoản giả Sinh viên bảo mật và giỏ 2 Burger Gà Rán. Mở Tài khoản của tôi, đổi tên thành Sinh viên đã cập nhật; lời chào và profile API cập nhật, không chứa hash.
2. Desktop chụp ảnh hộp thoại. Tại 320px, innerWidth = document scrollWidth = 320; dialog clientWidth = scrollWidth = 284. Đã xem ảnh mobile, mật khẩu trống khi chụp.
3. Nhập sai mật khẩu hiện tại: hiện lỗi đúng, chưa logout và các trường password được xoá. Gửi đúng: dialog đóng, profile cũ/giỏ trên UI bị xoá, hiện yêu cầu đăng nhập lại.
4. Đăng nhập bằng mật khẩu mới qua form UI: tên cập nhật và giỏ 2 món khôi phục. Secret synthetic tạm của script đã được xoá khỏi sessionStorage. Reload cuối console có 0 error/warning; HTTP 400 khi cố tình nhập sai mật khẩu trước đó là có chủ ý.

Ảnh: output/playwright/account-settings-desktop.png và account-settings-mobile.png. Chỉ dữ liệu giả được dùng; không gọi AWS hoặc thay dữ liệu preview cũ.

## Phiếu đơn và bộ lọc báo cáo — 2026-11-06

Bổ sung trang server /orders/[orderId]/receipt, nút mở phiếu từ chi tiết đơn và nút gọi hộp thoại in của trình duyệt. Trang dùng snapshot đã đặt, kiểm tra chủ đơn, private/no-store và robots noindex/nofollow. Phiếu ghi rõ demo/chưa thu tiền/không phải hoá đơn VAT. Không gửi file ra ngoài hoặc tự mở máy in.

Bộ lọc quản trị dùng chung hàm cho danh sách, thống kê và CSV: query không dấu, trạng thái, hình thức nhận, khoảng ngày inclusive theo Asia/Ho_Chi_Minh. UI lọc trên tối đa 200 đơn đã tải; không truy vấn toàn lịch sử. Summarizer được dùng chung với AdminService, completed value theo ngày đặt và tối đa 14 ngày có dữ liệu.

Kết quả tự động:

- npm run check qua lint, typecheck, production build, **36 nhóm nghiệp vụ/provider/client helper + 31 nhóm HTTP = 67 nhóm**. Log hiện hành ở output/verification/check.log.
- Unit kiểm tra biên UTC 17:00, ngày đầu/cuối inclusive, ngày không tồn tại/khoảng ngược, tìm không dấu và giao bộ lọc. Stats chỉ cộng completed; CSV chỉ có trường máy sinh, không contact/note.
- HTTP receipt đúng chủ trả 200 và no-store, nội dung ghi chú HTML được escape. Thiếu phiên, khác chủ hoặc không có đơn trả 404; không lộ phone/tên khách.
- npm audit --omit=dev báo 0 vulnerabilities; git diff --check qua; trace build không chứa credential/bootstrap hoặc dữ liệu .local.

Playwright CLI / Edge, production 3101, dữ liệu giả riêng .local/receipt-report-review-20261106:

1. Seed một đơn pickup 89.000đ và một delivery 104.000đ. Từ UI Đơn của tôi mở chi tiết và link Xem / In phiếu đơn, tab mới hiển thị đúng Burger 89.000đ + phí 15.000đ.
2. Phiếu tại 320px: innerWidth = scrollWidth = 320. Đã chụp desktop/mobile. Kiểm tra nút in bằng stub window.print và emulated print media: gọi đúng action, ẩn navigation/nút, giữ bảng món/tổng và disclaimer; đã xem ảnh print layout. Chưa kiểm tra máy in vật lý hoặc lưu một file PDF qua hộp thoại native.
3. Admin hoàn tất đơn delivery qua workflow. Lọc delivery + COMPLETED + tên không dấu + ngày hiện tại: hiển thị 1/2 đơn, completed value 104.000đ.
4. Tải CSV bằng nút UI; đối chiếu cả Blob và file download thật: BOM UTF-8, một dòng dữ liệu delivery/COMPLETED, total_vnd=104000, không có phone/tên/address/note. Bản evidence ở output/verification/filtered-orders-demo.csv.
5. Khoảng 2099-01-01 đến 2000-01-01 hiện lỗi và khoá CSV; xoá bộ lọc khôi phục 2 đơn. Admin ở 320px không tràn ngang. Console kiểm tra cuối có 0 error/warning.

Ảnh: output/playwright/receipt-desktop.png, receipt-mobile.png, receipt-print-layout.png, admin-filtered-report.png, admin-report-filter-mobile.png. Đã xem ảnh print layout và báo cáo desktop. Không gọi AWS hoặc thay dữ liệu preview cũ.

## Quản trị danh mục thực đơn — 2026-11-06

Bổ sung GET/POST/PATCH /api/admin/categories và giao diện tạo/sửa tên, mô tả, thứ tự, trạng thái trên tab Thực đơn. Cùng thứ tự thì so ID; chỉ danh mục active xuất hiện ở public menu. Không hard-delete. Danh mục còn bất kỳ món nào, kể cả món đã ẩn/hết, bị chặn tắt; cần chuyển toàn bộ món sang danh mục active khác trước. Giá/tên snapshot trong đơn đã đặt không bị sửa.

Kết quả mới nhất:

- npm run check qua lint, TypeScript, production build, **38 nhóm nghiệp vụ/provider/client helper + 34 nhóm HTTP = 72 nhóm**. Log ở output/verification/check.log.
- Unit kiểm tra tạo/sửa giữ ID/createdAt, thứ tự 0/999, tên trùng không dấu, schema strict và chặn tắt nhóm có món ẩn.
- HTTP kiểm tra staff/origin/schema, hai POST trùng đồng thời chỉ một 201 (còn lại 409), chuyển món trước tắt, từ chối gán món vào danh mục đã tắt, lưu thứ tự/trạng thái/chuyển món qua restart.
- npm audit --omit=dev báo 0 vulnerabilities. git diff --check qua; build trace không chứa credential/bootstrap hoặc dữ liệu .local. Không thay dependency hoặc gọi AWS.

Playwright CLI / Edge trên production 3101, dữ liệu giả riêng .local/category-review-20261106:

1. Admin → Thực đơn → Thêm danh mục: tạo Nhóm món demo, mô tả và thứ tự 0. UI đóng editor, hiển thị nhóm mới; /api/menu trả nhóm này đầu tiên.
2. Sửa tên thành Nhóm demo đã tắt, thứ tự 999 và bỏ Đang sử dụng. Admin vẫn giữ nhóm ở cuối; public menu không còn nhóm.
3. Mở Bữa trưa có 3 món, bỏ Đang sử dụng rồi lưu. Server/UI chặn bằng CATEGORY_IN_USE/409; editor giữ nguyên, public menu vẫn có Bữa trưa.
4. Ở 320px: page scrollWidth = viewport = 320; dialog scrollWidth = clientWidth = 284. Đã xem ảnh hộp thoại mobile; nút lưu phía dưới có thể cuộn tới. Sau đóng và reload, console có 0 error/warning; 409 trước đó là ca kiểm thử có chủ ý.

Ảnh output/playwright/admin-categories-desktop.png và admin-category-guard-mobile.png được thêm vào gói evidence. Thư mục preview cũ được giữ nguyên. Ràng buộc tham chiếu hiện dựa trên service + khoá admin một tiến trình; adapter DynamoDB chưa được nghiệm thu về race nhiều instance.

## Chốt review luồng và nghiệm thu bản local — 2026-11-06

Phạm vi chức năng được tổng hợp tại docs/graduation/acceptance-checklist.md, FR01–FR24. Review bổ sung ghi tại code-review.md (R06–R09): account bị thu hồi fallback sang guest, màn hình/cookie khác owner, mất Headers động và tên món không nằm trong signature.

Đã bổ sung GET /api/storefront để trả session/menu/basket/history/detail cùng một owner dưới khoá theo khách; UI bỏ ghép nhiều request riêng. Header X-KFC-Owner chỉ ràng buộc owner đang hiển thị, không thay cookie xác thực. Account cookie không hợp lệ làm mutation 401 dù còn guest hợp lệ; bootstrap xoá account cookie và trả owner guest rõ ràng. Recheck xác thực sau khi chờ khoá. Chữ ký giỏ bổ sung tên snapshot/options.

Admin có Broadcast/focus/polling 15 giây khi visible, không chạy lúc form đang mở/đang thao tác; refresh cập nhật cả detail đang chọn, bỏ kết quả cũ và xoá state khi 401. Không có mutation tự retry.

Kết quả cuối:

- npm run check qua lint, TypeScript, production build, **40 nhóm nghiệp vụ/provider/client helper + 37 nhóm HTTP = 77 nhóm**. Log hiện hành: output/verification/check.log.
- Unit kiểm tra Headers object không mất owner header, code lỗi có cấu trúc và preview quantity bị vô hiệu khi món trong giỏ đổi tên.
- HTTP kiểm tra snapshot/default guest/no-store/chi tiết khác chủ null; header owner sai chặn cart/profile/logout mà không làm thay đổi tài khoản; account bị thu hồi + guest hợp lệ không mutation hoặc xem receipt theo guest ngầm, bootstrap xoá cookie account rõ ràng.
- npm audit --omit=dev báo 0 vulnerabilities; git diff --check qua. Build trace không chứa .local, credential hoặc bootstrap. Không thay dependency/cấu hình cloud và không gọi AWS.

Playwright CLI / Edge, production 3101, dữ liệu giả .local/full-review-20261106:

1. Tạo A có 1 Burger, tải UI A. Đổi cookie sang B qua đăng ký API mà giữ màn hình A. Bấm Thêm Pepsi từ màn hình A: IDENTITY_CHANGED/409, UI chuyển sang B và giỏ B vẫn trống. Đăng nhập A để kiểm tra: vẫn chỉ 1 Burger. Secret synthetic tạm đã xoá khỏi sessionStorage.
2. Với UI A, giả lập /api/storefront trả 503 sau logout. UI xoá lời chào/giỏ cũ, count 0 và khoá nút thêm. Bỏ route giả, reload về guest bình thường. Ảnh full-logout-snapshot-error.png.
3. Đăng nhập admin với hàng đợi trống. Tạo một đơn guest bằng API mà không phát Broadcast. Trong chu kỳ polling, card Đơn tự đồng bộ tự xuất hiện, không bấm làm mới. Mở detail, huỷ qua API khách: selected detail tự chuyển Đã huỷ ở chu kỳ tiếp theo. Ảnh full-admin-auto-sync.png, đã xem.
4. Thu hồi staff bằng API ngoài UI. Polling phát hiện 401, trở về form login và xoá tên/chi tiết đơn khỏi màn hình. Reload cuối console có 0 error/warning; 409/503/401 do các ca thử trước đó là có chủ ý.

Các ảnh được đưa vào gói source/evidence. Không sửa dữ liệu preview cũ. Bản nghiệm thu local không đồng nghĩa nghiệm thu AWS, thanh toán, email recovery, giao vận thật, nhiều nhân viên hoặc khả năng chịu tải production.

## Nhật ký thay đổi catalog — 2026-11-06

Bổ sung GET /api/admin/catalog-audit và tab Nhật ký. Mỗi lần AdminService tạo/sửa món hoặc danh mục có entry gồm action, entityId/entityName, actor admin chung, thời gian và field before/after. Builder chỉ chọn các trường catalog cho phép; không lưu body, account/credential hoặc contact của đơn. No-op/lỗi validation không ghi entry. OrderEvent vẫn là nhật ký trạng thái của từng đơn.

Repository lưu catalog record và entry cùng mutation: local proxy dùng một snapshot/rollback, DynamoDB adapter dùng TransactWrite (chưa chạy AWS). Trùng audit ID trong mock bị từ chối trước khi đổi bất kỳ Map nào. Không có API sửa/xoá entry; đây không phải cơ chế chống chủ máy sửa file. Không backfill thay đổi cũ, không có retention tự xoá; UI/API đọc tối đa 200 entry gần nhất.

Kết quả kiểm tra cuối:

- npm run check qua lint, typecheck, production build, **42 nhóm nghiệp vụ/provider/client helper + 39 nhóm HTTP = 81 nhóm**. Log cuối: output/verification/check.log.
- Unit kiểm tra category before/after, no-op và duplicate validation không tăng log; builder bỏ trường ngoài catalog; audit ID trùng giữ nguyên data/history.
- HTTP kiểm tra staff-only, no-store, POST không hỗ trợ 405, giá 39000 → 49000, không log lần lưu y hệt hoặc duplicate; record canonical và log menu/category còn qua restart.
- npm audit --omit=dev báo 0 vulnerabilities. git diff --check qua; trace build không chứa runtime .local hoặc credential/bootstrap. Không thêm dependency hay gọi AWS.

Playwright CLI / Edge, production 3101, dữ liệu giả .local/audit-review-20261106:

1. Tạo Nhóm audit demo qua API; sửa Burger Gà Rán bằng UI từ 89.000đ lên 99.000đ. Nhật ký hiển thị đúng hai entry, gồm giá trước/sau và minh hoạ legacy PNG đổi sang SVG theo editor.
2. Lọc CATEGORY_CREATED + tìm nhom audit demo cho một entry; displayOrder 0 hiển thị đúng 0. Lọc MENU_UPDATED + burger ga ran cho một entry; từ khoá không có kết quả hiện empty state.
3. Tại 320px, page scrollWidth = viewport = 320. Điều hướng admin bốn tab xếp lại trên mobile, không tràn ngang. Chụp catalog-audit-desktop.png và catalog-audit-mobile.png; đã xem ảnh mobile.
4. Bản build cuối sửa normalization cả Đ/đ. Tạo Đồ kiểm thử audit và tìm do kiem thu audit trong tab Nhật ký: đúng một entry. Console cuối có 0 error/warning.

Ảnh được thêm vào gói source/evidence. Preview cũ được giữ nguyên; sau cập nhật, lịch sử của preview bắt đầu từ các thay đổi catalog mới, không dựng lại quá khứ.

## Backup và khôi phục local — 2026-11-06

Bổ sung scripts/local-data.cjs, npm scripts data:backup/data:verify/data:restore và tài liệu docs/local-backup.md. Archive .kfcbackup mã hoá AES-256-GCM, scrypt/salt/IV ngẫu nhiên, AAD xác thực header và manifest SHA256 từng file. Password chỉ qua stdin, không command argument; lỗi JSON được chuẩn hoá để không in nội dung dữ liệu hỏng.

Allowlist store.json, session-secret hiệu lực và admin-credentials.json nếu có; không bootstrap/temp/env/cloud credential. Restore chỉ vào đích chưa tồn tại, kiểm tra manifest/path/byte/hash và ghi qua staging cùng thư mục cha; không ghi đè nguồn hoặc đích đã có. Source đổi trong quá trình thu thập bị từ chối, không retry. Operator vẫn cần dừng server để backup có phối hợp; chưa có lock đa tiến trình/mất điện acceptance.

Kết quả:

- npm run check qua lint, typecheck, **42 nhóm nghiệp vụ + 8 nhóm backup/recovery + 39 nhóm HTTP = 89 nhóm**, production build thành công. Log cuối: output/verification/check.log.
- Backup encrypted không chứa plaintext password/key hoặc bootstrap/temp marker. Correct password verify qua; sai password và ciphertext bị sửa bị chặn.
- Restore có byte canonical trùng nguồn, từ chối đích có dữ liệu và SESSION_SECRET override không khớp; archive có tên ../ bị từ chối trước tạo đích.
- Process Node mới dùng service thật đăng nhập lại, đọc 2 phần trong giỏ, 1 đơn, 1 audit entry và auth session đã lưu. Tất cả fixture nằm trong thư mục tạm synthetic; không sao lưu hoặc thay dữ liệu preview thật.
- Thử file thay đổi trong lúc capture: không tạo archive. Snapshot sai bị chặn, thông báo JSON parse không in marker riêng tư; environment signing key được capture vào payload mã hoá.
- PowerShell function trong tài liệu được kiểm tra bằng Parser, không lỗi cú pháp. Encoding stdin được đặt UTF-8 tạm thời để giữ Unicode rồi khôi phục.
- npm audit --omit=dev báo 0 vulnerabilities, git diff --check qua; build trace không chứa data/credential/archive riêng tư.

CI hiện gọi npm run check nên bao gồm test:data; chưa có bằng chứng chạy GitHub Actions trong đợt này. .gitignore/Next trace/source packer loại .kfcbackup và staging; source packer còn loại tên runtime canonical nếu vô tình đặt trong source roots.

Giới hạn giữ nguyên: restore dữ liệu lịch sử cũng có thể phục hồi hash mật khẩu/phiên cũ; xem hướng dẫn về signing key, staff restart và guest history. Không tự tạo credential bootstrap từ hash, không sao lưu ADMIN_PASSWORD override hoặc cấu hình cloud. Bản này không phải backup AWS/DR production.

## Sổ địa chỉ và checkout — 2026-11-06

Bổ sung FR27: GET/POST/PATCH/DELETE /api/account/addresses, AddressService, revision SHA256/CAS, tối đa 5 và mặc định duy nhất. Tất cả endpoint dùng cookie customer/accountApi; body strict không nhận owner. Storefront snapshot trả book riêng customer; clear khi đổi danh tính. Checkout giao hàng điền từ địa chỉ mặc định, cho chọn khác/nhập tay và luôn yêu cầu xác nhận.

Bằng chứng đợt này:

- npm run check qua lint, TypeScript, 44 nhóm nghiệp vụ + 8 backup/recovery + 42 HTTP = 94 nhóm; production build thành công. Log output/verification/check.log. Không gọi AWS.
- Unit kiểm tra giới hạn/default/khác chủ và hai ghi cùng revision chỉ một thành công. HTTP kiểm tra role, strict schema, owner header, revision cũ, xác nhận xoá, restart, book trong snapshot và contact đơn giữ nguyên. Recovery dùng service thật đọc lại một địa chỉ sau restore trong process mới.
- Edge/Playwright trên production build cổng 3101 với .local/address-review-20261106 riêng: đăng ký fixture, tạo Nhà/Công ty qua form, đổi mặc định, giao hàng điền đúng tên/phone/address; chọn nhập tay và đổi pickup/delivery vẫn giữ nội dung sửa. Xác nhận đơn 104.000 đồng = Burger 89.000 + phí 15.000. Xoá Công ty qua UI, Nhà trở thành mặc định, đơn cũ giữ địa chỉ Công ty.
- Mô phỏng tab khác sửa book khi editor mở: lưu từ revision cũ bị 409, không ghi đè; nút Làm mới đọc book mới và không gửi lại mutation. Bản cuối tập trung focus vào thông báo conflict; kiểm tra focus trực tiếp qua DOM.
- Viewport 320: document 320/320, dialog 284/284, không tràn ngang. Ảnh đã mở kiểm tra: address-book-desktop.png, address-book-mobile.png, address-checkout-mobile.png, address-conflict-mobile.png trong output/playwright. Modal dài cuộn dọc.
- npm audit --omit=dev: 0 vulnerabilities. git diff --check không báo lỗi whitespace (có cảnh báo quy tắc CRLF của Git).
- Preview .local/preview được giữ nguyên dữ liệu và khởi động lại production cổng 3100; health local/mock/demo, cloudVerified=false, paymentsEnabled=false.

Giới hạn: địa chỉ tự khai báo, chưa xác minh bản đồ/vùng giao; Dynamo conditional Put ADDRESS_BOOK mới chỉ review/typecheck, chưa nghiệm thu cloud. Local chỉ một process. Không coi 94 nhóm là line/branch coverage hay nghiệm thu toàn bộ production.

## Chuẩn bị báo cáo tiến độ — 07/11/2026

Đã bổ sung scripts/demo.cjs và npm scripts demo:start/setup/doctor. Start cố định mock/local/.local/preview, local credential/signing files, bind 127.0.0.1; không tự build/reset/tạo dữ liệu mẫu. Setup gọi utility hiện có và từ chối thay credential đã tồn tại. Doctor đọc 7 probe health/pages/protected APIs, không mang cookie hoặc gọi provider; ghi JSON chỉ gồm trạng thái và phiên bản. Không probe storefront bootstrap vì endpoint này có thể tạo guest mới.

Đã phát hiện và sửa lỗi P2 kiểm tra origin khi Next chuẩn hoá request URL localhost nhưng browser dùng 127.0.0.1. Origin hiện đối chiếu Host thực, không tin forwarded-host; cross-site vẫn bị chặn. Chi tiết trong graduation/code-review.md.

Bằng chứng hiện tại:

- npm run check qua lint/typecheck, **44 nhóm nghiệp vụ + 8 backup/recovery + 43 HTTP = 95 nhóm**, build production thành công. HTTP bổ sung case loopback đúng host/cross-origin/forwarded-host/cross-site. Log output/verification/check.log.
- npm run evaluate:report chạy lại 50 câu: overall 84% intent/80% joint, supported 40/40, challenge 2/10 intent và 0/10 joint. Không đổi dataset hoặc parser để tăng điểm.
- Port không hợp lệ bị từ chối; doctor khi không có server trả exit 1/FAIL. demo:setup trên credential có sẵn trả exit 1 và bytes credential không đổi.
- demo:start chạy production 127.0.0.1:3100. Doctor cuối PASS 7/7, so bytes store.json trước/sau không đổi. Doctor không phải nghiệm thu đăng nhập/đặt hàng.
- Edge/Playwright trên địa chỉ mới: gửi Thêm 2 Pepsi; trước xác nhận giỏ 0 dòng, sau xác nhận đúng quantity 2. Checkout pickup qua UI tạo một đơn CONFIRMED tổng 50.000 với contact giả Khách báo cáo demo. Preview giữ toàn bộ dữ liệu cũ và có thêm đơn thử này. Không thực hiện thanh toán hoặc gọi AWS.
- Ảnh tonight-chat-preview.png (full page, proposal), tonight-order.png được mở kiểm tra. Tạo proposal bổ sung chỉ để chụp rồi Bỏ qua; không thêm đơn thứ hai.
- npm audit --omit=dev: 0 vulnerabilities; git diff --check qua.

Tài liệu mới: graduation/supervisor-progress-2026-11-07.md (bản nói 5–7 phút và Q&A), graduation/tonight-demo.md (chuẩn bị, kịch bản ngắn, xử lý sự cố). Tổng quan hồ sơ đồng bộ số test hiện tại. Chưa có buổi nghiệm thu cloud/LLM/provider thật, CI remote, thử tải hoặc góp ý của giảng viên được ghi nhận.

## Khuyến mãi FR28 — 07/11/2026

Bổ sung PromotionService, cấu hình mã trong IMenuRepository (Map local/mock; conditional Put Dynamo chưa nghiệm thu), API staff GET/POST/PATCH /api/admin/promotions và POST /api/checkout/quote cho guest/customer. Checkout nhận code/revision, tính discount phía server và snapshot vào order; history/admin/receipt thể hiện mã và mức giảm. Không quota/stacking/hard delete. CSV thêm discount_vnd numeric.

Bằng chứng lần chạy cuối:

- npm run check qua lint/typecheck, **48 nhóm nghiệp vụ + 8 backup/recovery + 47 HTTP = 103 nhóm**, production build thành công; log output/verification/check.log. Không gọi AWS.
- 4 unit mới: math/cap/min/time boundary, strict schema, unique/CAS concurrent create/edit, stale revision/total, retry/snapshot và full discount. CSV hồi quy đối chiếu discount numeric, vẫn không xuất contact.
- 4 HTTP mới: staff-only/schema/405/no-store, duplicate/CAS, quote owner/unknown fields/inactive/future/expired/minimum, stale revision khi giá không đổi, tổng client sai, hai checkout cùng key một đơn, receipt, restart. Tạo thật đơn pickup tổng 0; delivery quote khi giảm hết tiền món vẫn 15.000.
- Backup recovery fixture có RECOVERY20, process mới restore và đọc lại được bằng PromotionService. Validator nhận snapshot cũ thiếu promotions. Không thay credential hoặc dữ liệu preview để chạy test này.
- Edge production 3101 dùng .local/promotion-review-20261107 riêng: đăng nhập staff bằng credential synthetic, tạo DEMO20 qua form (20%, minimum 50.000, trần 10.000); admin 1440/320 không tràn ngang.
- Khách qua UI chọn Burger 89.000, mã sai BADCODE bị chặn, mã đúng demo20 chuẩn hoá DEMO20; giảm 10.000 và phí giao 15.000, tổng 94.000. Thay tiền/revision reset checkbox. Khi staff sửa title sau quote (giá không đổi), đặt bị từ chối và chưa có đơn. Áp lại rồi xác nhận tạo một đơn demo 94.000, giữ promotion snapshot.
- Phiếu đơn tại 1440/320 hiện DEMO20, discount 10.000, total 94.000. Checkout 320 có document 320/320 và dialog 284/284. Ảnh promotions-admin-desktop/mobile, promotions-checkout-mobile, promotions-order-mobile, promotions-receipt-desktop/mobile trong output/playwright; đã mở kiểm tra admin/checkout/receipt.
- Trên build cuối: HTML pattern chặn code có space, nhận DEMO-20; không còn lỗi pattern Unicode v. Hai editor cũ/mới cho conflict và focus vào thông báo; Làm mới đọc bản mới, không retry. Reapply quote xoá checkout error cũ và bỏ trạng thái checkbox cũ. Script promotions-final-ui.txt ghi assert cho các hành vi này.
- CSV synthetic promotion-orders-demo.csv đối chiếu 89.000 − 10.000 + 15.000 = 94.000, không contact. npm audit --omit=dev: 0 vulnerabilities, git diff --check qua.
- Dừng server fixture 3101; preview .local/preview giữ dữ liệu, khởi động qua demo:start tại 127.0.0.1:3100, demo:doctor PASS 7/7. Không tự seed mã mới vào preview hoặc reset credential.

Giới hạn: dữ liệu coupon dùng lại được, không có usage counter/reservation/per-customer, phân loại SKU hay chiến dịch gửi email. Điều kiện được đọc lại tại service trước checkout; chưa có transaction guard giữa coupon config và order trên nhiều instance. Mã bị sửa sau bước kiểm tra service không có bảo đảm phân tán. Catalog audit chỉ món/danh mục; thay đổi coupon chưa có audit riêng. Tích hợp AWS/LLM/payment/POS vẫn chưa nghiệm thu.

## Đặt lại có kiểm soát và lọc lịch sử — 07/11/2026

Bổ sung FR29/FR30: POST/PUT /api/orders/reorder, ReorderService, CartRepository.completeReorder, signed preview riêng domain reorder; giỏ mới theo operation ID, không chuyển coupon/contact/phí cũ. OrderPanel có tìm không dấu/mã/người nhận + trạng thái, count/reset/empty result, ẩn chi tiết ngoài bộ lọc.

Bằng chứng lần chạy cuối:

- npm run check qua lint/typecheck, **53 nhóm nghiệp vụ + 8 backup/recovery + 51 HTTP = 112 nhóm**, production build thành công; output/verification/check.log. Không gọi AWS.
- 5 unit mới: current/previous prices và privacy/no cart creation; unavailable/options/stale không partial; token giả/hết hạn/khác owner; cart có món hoặc thay base; concurrency cùng token một cart, giữ edit quantity sau retry và cart checkout không reopen; hai token cạnh tranh chỉ một plan điền giỏ.
- 4 HTTP mới: role/owner/header/strict body/405/no-store; fake token/stale price/unavailable; giỏ không trống/đã đổi và concurrent confirm; cart không copy voucher từ source có discount; replay không xoá chat proposal mới; marker/token/cookie tồn tại qua restart; checkout riêng và source snapshot giữ nguyên.
- test:data mở rộng fixture ReorderService: xác nhận rồi tăng quantity lên 2, backup/restore trong process mới, replay=true cùng cart ID và quantity vẫn 2. Fault injection directory store.json.tmp khiến ghi snapshot lỗi; cart memory trở về null và bytes store.json không đổi. Xoá directory test rỗng rồi cùng token thực hiện thành công. Không giả lập trên dữ liệu preview.
- Edge production 3101 dùng .local/promotion-review-20261107 (synthetic) riêng. Có source coupon 94.000/discount10.000. Đổi giá Burger từ snapshot89.000 lên90.000, preview cho thấy khác biệt; đóng preview giỏ không có món mới. Khi giỏ đang có một Burger, UI chặn đặt lại và giữ quantity.
- Browser lịch sử: query không khớp và trạng thái COMPLETED ra empty result, chi tiết ngoài lọc biến mất; reset khôi phục danh sách; tìm last8 ID đúng. Mobile tìm không dấu khach dat lai khớp Khách đặt lại demo, hiện 1/2 đơn; document 320/320.
- Browser preview tại 320: document320/320, dialog284/284. Admin đổi giá90.000→91.000 sau preview: confirm409, error focus, giỏ rỗng. Đóng/xem mới rồi mock mạng: route.fetch cho server commit thực, route.fulfill trả503 để mô phỏng mất response. Retry cùng token trả replay và giỏ chỉ có một Burger, cùng cart ID; order count vẫn1, discount/fee đều0. Không retry write tự động.
- Khách checkout riêng, tên/phone/coupon không tự lấy từ source. Tạo một order mới 91.000 pickup, discount0/fee0; source vẫn94.000/discount10.000, số orders2. Ảnh reorder-preview-desktop/mobile, reorder-stale-mobile, reorder-retry-mobile, reorder-order-desktop/mobile và order-history-desktop/mobile. Đã mở kiểm tra preview/stale/history.
- npm audit --omit=dev: 0 vulnerabilities. git diff --check qua. Dừng server synthetic3101, khởi động preview giữ nguyên .local/preview qua demo:start, doctor PASS7/7 tại127.0.0.1:3100. Không seed source order hoặc đổi giá preview chính trong đợt này.

Giới hạn: chỉ giỏ trống, món chuẩn và không gộp/options tuỳ biến. Preview15phút, cần đúng cookie owner và signing key; token không chứa contact nhưng không được coi là mã hoá. Reorder chỉ tạo cart; order mới luôn qua checkout. Local chỉ một process; adapter Dynamo transaction chưa nghiệm thu concurrency/cloud và các cart mutation khác chưa đầy đủ distributed CAS. Lọc khách chỉ trên tập lịch sử local đã tải; chưa có phân trang quy mô lớn.

## Parser v2, phạm vi xoá và hỗ trợ dùng chat — 07/11/2026

Xác nhận lỗi: câu Xoá Pepsi trong giỏ hàng trước đây có thể thành CLEAR_CART do điều kiện từ trong. Sửa grammar scope rõ toàn giỏ, giữ REMOVE riêng dòng và vẫn xác nhận. Lexical helper mới bảo vệ dung tích ml/lít, đọc số chữ theo vị trí, từ chối số nhiều/ước lượng/unsupported thay vì default1; tăng/giảm thiếu đích tiếp tục hỏi lại. Thêm help native details trong chat. Prompt canonical và TypeScript đã sync.

Bằng chứng lần cuối:

- npm run check qua lint/typecheck, **58 nhóm nghiệp vụ + 8 backup/recovery + 55 HTTP = 121 nhóm**, build production thành công. Log output/verification/check.log, không gọi AWS.
- 5 unit mới có ma trận số chữ, corpus61 câu raw intent/quantity + policy preview + giỏ giữ nguyên, confirm số chữ vào cart, xoá dòng giữ món khác/CLEAR riêng và lookup nấm/dung tích. Corpus là một nhóm trong tổng121, không cộng61 lần nữa. output/evaluation/language-safety-report.json lưu61/61 pass và hashes.
- 4 HTTP mới: từ câu số chữ đến confirm đúng2 rồiđổi1; Xoá Pepsi trong giỏ giữ dòng khác; mixed/negated/conditional/vague/relative giữ basket; size không có trong catalog và quantity ngoài giới hạn bị chặn. Hai mươi mốt khi sẵn1 tạo22 sau confirm, không rơi về1.
- Giữ byte/nhãn/subset dataset50 câu và baseline trước parser v2:42/50 intent,40/50 joint. Evaluate mới49/50 cả hai, supported40/40 và challenge9/10. VI-045 (Giảm Pepsi bớt1) giữ nhãn UPDATE_CART nhưng parser chọn hỏi đích; không sửa nhãn để đạt100. Dữ liệu đã xem khi sửa parser nên đây là phát triển/hồi quy, không là holdout, khảo sát hoặc chất lượng LLM.
- Baseline JSON tại tests/baselines/intent-report-before-parser-v2.json và Markdown tương ứng trong graduation. Report mới có provider hash, aggregate parser hash cho main provider/helper/normalizer, evaluator hash và dataset hash để truy vết helper changes.
- Edge production3101 với .local/language-review-20261107 riêng: mở help bằng keyboard Enter; 320px document320/320. Thêm Burger qua UI, gửi Cho mình hai chai Pepsi1,5 lít: trước confirm giỏ chỉ Burger, sau confirm có2 Pepsi. Câu thêm hai Pepsi và xoá toàn bộ giỏ chỉ yêu cầu làm rõ, giỏ giữ nguyên. Đổi Pepsi thành ba sau confirm có3. Xoá Pepsi trong giỏ hàng preview chỉ dòng Pepsi; confirm giữ Burger. Checkout mới tên/phone giả tạo đơn pickup89.000.
- Ảnh language-help-desktop/mobile, language-remove-preview-mobile, language-order-mobile trong output/playwright; đã mở kiểm tra help/mobile và preview scope. Không chụp hoặc xuất credential.
- npm audit --omit=dev:0 vulnerabilities; git diff --check qua. Dừng server synthetic3101, preview .local/preview giữ nguyên dữ liệu/credential và chạy demo:start127.0.0.1:3100. Doctor đọc7 probe, không tạo đơn hoặc gọi provider.

Giới hạn: parser rule-based ưu tiên hỏi lại, chưa giải mọi câu tiếng Việt/multi-item/delta hay viết tắt/đơn vị khối lượng. Tên không dấu trùng từ số có thể yêu cầu làm rõ. Các số liệu là ca phát triển tổng hợp đã biết, không độc lập. Không có nghiệm thu Bedrock/AWS/payment/POS thật hoặc production load.

## Món bán chạy, đối soát và queued staff auth — 07/11/2026

Bổ sung GET /api/admin/sales, aggregateSales/productSalesCsv, order-window revision và SalesReportPanel trong Admin→Báo cáo. Dùng completed order/item snapshots, top10 theo units trong200 gần nhất; totals gross/discount/fee/net trên mọi món hợp lệ. Invalid completed bị excluded có cảnh báo. Không đọc menu hiện tại để tính lịch sử.

Bằng chứng cuối:

- npm run check qua lint/typecheck, **63 nhóm nghiệp vụ +8 backup/recovery +58 HTTP =129 nhóm**, production build thành công; output/verification/check.log. Không gọi AWS.
- 4 unit mới: group SKU/name/price snapshot; reconciliation và full-discount delivery/excluded records; deterministic top10/totals tất cả/distinct orders; CSV control/format+formula protection, không contact, source revision metadata.
- 1 unit auth mới dùng wrapper adminApi và lock thật với auth-state stub: giữ lock, request qua kiểm tra auth đầu rồi chờ, thu hồi auth trước khi nhả lock; response401/no-store và operation không chạy. Fix kiểm tra lại adminAuthenticated sau lock; không tuyên bố huỷ operation đã bắt đầu.
- 3 HTTP mới: staff-only/cache/405, invalid dates/unknown/duplicate filters; totals/units đối chiếu completed detail, rename catalog không thay products snapshot; window cũ409 sau order mới, pickup+search+ngày inclusiveVN, completed totals/products giống sau restart. JSON report synthetic tại output/verification/sales-report-demo.json, không contact/query fields.
- Edge production3101 dùng .local/promotion-review-20261107 riêng. Chuyển hai order synthetic từ CONFIRMED sang COMPLETED theo workflow pickup/delivery; report units2, gross180.000, discount10.000, fee15.000, net185.000. Không sửa/truy cập credential hoặc order preview chính để tạo fixture.
- UI lọc delivery: gross89.000−discount10.000+fee15.000=net94.000, một phần; pickup gross/net91.000. CSV được tải qua download event và saveAs vào output/verification/product-sales-ui.csv, có sample/window counts/revision và không phone/contact/query. Đây là fixture UI2 orders, khác fixture HTTP của JSON report.
- Chặn response delivery cũ bằng route.fetch/gate, đổi pickup, cho response cũ về sau: pickup91.000 vẫn giữ. Export cũ disabled khi key/filter/loading đổi. Empty search và ngày đảo ngược disabled export và có thông báo. Reset khôi phục185.000. Thu hồi staff qua auth DELETE rồi refresh panel:401, login hiện và report private unmount.
- 320px document320/320. Đã mở kiểm tra sales-products-desktop/mobile và sales-products-filtered-mobile; có sales-expired-view-mobile. Không chụp trường password đã điền; private login fixture không được đưa vào archive.
- npm audit --omit=dev:0 vulnerabilities; git diff --check qua. Server synthetic3101 đã dừng; preview .local/preview giữ nguyên, demo:start127.0.0.1:3100, doctor PASS7/7.

Giới hạn: cửa sổ200 đơn, top10, completed hợp lệ theo ngày đặt. Gross từng SKU trước discount, không phân bổ phí/giảm, không lợi nhuận/tiền thực thu/refund. Invalid records làm totals panel khác stats toàn bộ; UI nêu excluded count. Fingerprint chỉ phát hiện window thay đổi, không cấp quyền; cookie staff bắt buộc. Chưa nghiệm thu cloud, tải lớn hoặc kế toán thanh toán thật.


## 2026-11-07 — chốt phạm vi khóa luận local và gói bàn giao

Người dùng chọn bản khóa luận chạy local, đầy đủ luồng và hồ sơ nghiệm thu. Phạm vi FR01–FR32, điều kiện tái lập và giới hạn nằm trong docs/graduation/local-release-scope.md; không đổi các ghi nhận lịch sử ở trên.

- Fix P2 checkout replay: pin request hash trong cart commit atomic, cùng key/khác thông tin trả409 thay vì trả success đơn cũ. Legacy backup không hash so trường recoverable, không rewrite lịch sử. Thêm1 unit và1 HTTP; giữ các ca giá/coupon/confirmation/backup trước đây.
- npm run check exit0: lint, typecheck, **64 unit +8 backup/recovery +59 HTTP =131 nhóm**, build production. Log output/verification/check.log. HTTP dùng temp synthetic, restart thành công, không gọi AWS.
- npm run test:submission:3 test qua; gói bị đổi file, có đường dẫn private/traversal/file thừa, sidecar sai hoặc log không có kết quả bị từ chối.
- npm run evaluate:report:49/50 intent vàjoint,40/40 supported,9/10 challenge; tập phát triển đã biết. Corpus61/61 qua trong unit, không cộng thành61 nhóm riêng. Hash nguồn/dataset/evaluator được verifier so với ZIP.
- npm audit --omit=dev:0 vulnerabilities; git diff --check qua, chỉ cảnh báo LF/CRLF đã có. Không khẳng định không có mọi lỗ hổng.
- Restart demo:start mock/local tại127.0.0.1:3100 với thư mục .local/preview có sẵn, không reset credential/dữ liệu. Doctor7/7, SHA256 store.json trước/sau giống nhau.
- submission:pack tạo ZIP mới dưới output/submission; submission:verify -- --current thành công: manifest/hash/size của248 file, không file thừa/thiếu, nguồn đóng gói khớp checkout; log ghi131 nhóm, readiness và evaluation provenance hợp lệ. Sidecar .sha256/.verified.json nằm ngoài ZIP, tránh tự tham chiếu.

Không thêm integration production, không gọi cloud/LLM, không commit hoặc publish. Hồ sơ kỹ thuật không thay cho chữ ký nghiệm thu và báo cáo theo mẫu trường đã được giảng viên duyệt. Archive chứa bằng chứng các đợt local với thời điểm riêng; ảnh UI trước đó không được mô tả là ảnh chụp lại ở đợt chốt này.


## 2026-11-07 — checkout recovery, quote theo signature và xác nhận lại

Phạm vi tiếp tục là bản khóa luận local. Đã xử lý hai lỗi UX được xác nhận: mất response sau commit không dẫn đến đơn đã lưu; quote/checkbox chưa ràng buộc đầy đủ với nội dung giỏ.

- Thêm POST /api/checkout/status strict key/cart, owner-private, no-store, same-origin và customer lock. Chỉ tìm/đọc detail; không tạo đơn, đổi giỏ, ghi event hoặc invalidate proposal. Null với unknown key, wrong owner/cart; không lộ tồn tại đơn khác.
- UI tra cứu sau lỗi mạng/non-JSON/5xx hoặc idempotency conflict. Đơn tìm thấy được mở kèm thông báo kiểm tra snapshot đã lưu. Nếu lookup cũng lỗi, nút Kiểm tra đơn vừa gửi chỉ gọi lookup, không retry POST orders. Request key còn trong memory của tab; reload thì xem lịch sử.
- Quote khuyến mãi bound cartId/signature. Giỏ đổi thì discount cũ không còn hiện applied, phải áp lại/bỏ mã; giữ nguyên contact/code. Checkbox thêm cart context nên đổi tên/món/qty dù tổng giữ nguyên cũng bỏ tick. Giỏ trống sau lỗi khoá form, giải thích cần kiểm tra kết quả và không hiện tổng0 như giá trị đơn.
- npm run check exit0 sau bản UI cuối: lint/typecheck/build, **65 unit +8 backup/recovery +61 HTTP =134 nhóm**. Thêm1 unit lookup read-only/owner/key/cart và2 HTTP schema/auth/origin/no-store/405/uncommitted/committed/wrong owner/cart. Không gọi AWS. HTTP dùng thư mục tạm và kiểm tra restart.
- Một lượt test HTTP mới ban đầu lỗi ở helper test cố đọc JSON từ response405 trống của Next; đã sửa dùng fetch kiểm tra status trực tiếp. Toàn bộ check sau đó qua; không thay behavior405 của ứng dụng.
- npm run test:submission qua3 test; npm audit --omit=dev không phát hiện vulnerability; git diff --check qua.
- Edge production3101, synthetic .local/checkout-review-20261107: route.fetch cho POST orders commit201 rồi route.abort phản hồi. UI tự lookup một lần và mở cùng orderID; chỉ1 POST,1 lookup, history1order. Ảnh checkout-recovered-mobile.png.
- Lượt tiếp theo: POST đã commit nhưng response và lookup tự động đều bị abort. Refresh thấy giỏ đóng, modal còn nút Kiểm tra đơn vừa gửi. Bấm nút: tổng1POST/2lookup, history chỉ tăng1order. Sau sửa empty-cart UI, chạy lại trên build cuối: history2→3,1POST/2lookup, không có Tổng thanh toán0 trong modal,320px document320. Ảnh checkout-check-again-mobile.png đã chụp lại và mở kiểm tra.
- Fixture catalog: đổi tên Burger nhưng giữ giá89.000 trong modal; submit signature cũ bị400, refresh giữ contact và bỏ tick dù tổng không đổi. Áp RECOVER10 rồi đổi tên tiếp: quote cũ mất hiệu lực, submit disabled, thông báo áp lại, contact giữ nguyên. Áp lại quote thành công và vẫn phải tick mới; history không tăng. Ảnh checkout-stale-quote-mobile.png đã mở kiểm tra. Setup ban đầu dùng seed image.png bị strict API từ chối; fixture sửa sang image.svg đúng allowlist rồi toàn bộ ca qua. Không nới schema để thuận test.
- Catalog fixture được trả tên gốc, staff logout; server3101 đã dừng. Dữ liệu giả được giữ để tái hiện, không đưa runtime folder vào ZIP. Các console network/400 error trong ca fault injection là lỗi chủ động tạo.
- Preview chính khởi động build mới tại127.0.0.1:3100 qua demo:start; doctor7/7, hash store trước/sau giống nhau. Không reset credential hoặc dữ liệu preview.

Giới hạn: một tiến trình local; không chứng minh recovery khi crash/mất điện, phân tán hoặc provider thật. Screenshot thể hiện dữ liệu tổng hợp. Không dùng test count làm code coverage; các ảnh UI ở đợt trước vẫn giữ thời điểm và phạm vi riêng.


## 2026-11-07 — huỷ đơn có lý do và kiểm tra phiên sau customer lock

- Giữ phạm vi local FR01–FR32; mở rộng nghiệm thu FR13 bằng cancellation reason public. Không đổi các trạng thái được phép huỷ: chỉ CONFIRMED, không huỷ PREPARING/READY/DELIVERING/COMPLETED.
- Thêm modal xác nhận staff, lý do5–300 ký tự, nói rõ sẽ hiển thị cho khách; required checkbox. Đóng/giữ đơn không ghi. Reason được giữ khi network failure và focus alert khi stale conflict; polling ngừng trong modal.401 xoá reason/private view.
- API PATCH admin/orders strict, chỉ cho reason khi CANCELLED; service có guard riêng. Event metadata.cancellationReason+actor admin+previousStatus lưu cùng status atomic. Retry cùng thông tin không nhân đôi, khác lý do/actor/expectedStatus trả409, không ghi đè customer cancellation. Legacy cancelled events không có reason vẫn đọc được.
- Fix P2: staff auth trước admin lock/sau admin lock chưa đủ khi route chờ tiếp owner lock. Thêm requireAdminSession sau owner lock trước transition. Unit giữ owner lock thật, revoke auth-state trước khi nhả và kiểm tra401/no-store/transition không chạy; không gọi là real-browser queued logout hoặc distributed proof.
- npm run check exit0: lint/typecheck, **68 nghiệp vụ +8 backup/recovery +63 HTTP =139 nhóm**, production build thành công. Thêm3 unit và2 HTTP cho schema/service retry/auth-queue/public-reason/ownership/restart. npm run test:submission qua3; npm audit --omit=dev:0 vulnerabilities.
- Browser Edge production3101, .local/cancellation-review-20261107 chỉ dữ liệu giả. Setup hai đơn fake cùng owner, staff riêng. Mở modal rồi Giữ đơn: status CONFIRMED/events1. Xác nhận reason có text giống HTML/100 ký tự liên tiếp; route.fetch commit200 rồi abort response, retry cùng form:2 PATCH nhưng tổng2 events (CONFIRMED+CANCELLED), cùng reason. Không auto retry mutation.
- Trang khách mở đúng đơn, thấy reason đầy đủ. .order-events img count0, document320/viewport320; long token wrap. Ảnh admin-cancel-reason-mobile.png và customer-cancel-reason-mobile.png đã mở kiểm tra.
- Đơn thứ hai: staff mở modal, customer PATCH huỷ trước; staff submit trả409, alert nhận keyboard focus. Reason vẫn có trong form để đọc nhưng không được ghi; events2 và event cuối actor customer/no admin reason. Ảnh admin-cancel-conflict-mobile.png đã mở kiểm tra.
- Tạo đơn giả thứ ba, staff mở modal rồi revoke admin qua DELETE auth: submit401, login hiện, modal/reason private biến mất. Đơn thứ ba còn CONFIRMED/events1. Các network/409/401 console errors là lỗi chủ động tạo.

Không đưa runtime fixture/credential vào source ZIP. Lý do là nội dung public cho đúng chủ đơn, không phải ghi chú nội bộ; không đưa vào CSV. Chưa có acceptance cloud, multi-instance hoặc workflow hoàn tiền/thanh toán thật. Các ca browser không thay cho chứng nhận accessibility/pentest độc lập.

Đã dừng server fixture3101. Bản mới chạy qua demo:start tại127.0.0.1:3100; doctor7/7 và store preview byte-identical trước/sau.32 build traces không chứa local runtime/credential/backup paths; git diff --check qua. Archive mới được kiểm tra bằng submission:verify -- --current; sidecar ghi số file và SHA256 cụ thể.


## 2026-11-07 — FR33 bảng bếp và điều phối thao tác

- Bổ sung FR33 trong phạm vi khóa luận local: bốn lane CONFIRMED/PREPARING/READY/DELIVERING, snapshot món/qty/note, tuổi đơn, preparation summary, filter, auto sync và chuyển đúng bước. Source200 gần nhất, completed/cancelled không lên bảng; invalid active records excluded+warning. Không thêm persistence hoặc cloud writes.
- GET /api/admin/kitchen staff-only, private/no-store, strict fulfillment và duplicate/unknown reject. DTO không gửi các trường tên/điện thoại/địa chỉ/giá; note vẫn staff-private. Detail batch8, sortedoldfirst, summary chỉchờ/đang làm, không dùng current menu. PATCH dùng order API hiện có và expectedStatus; mở chi tiết để huỷ có reason.
- npm run check exit0: lint/typecheck/build, **72 nghiệp vụ +8 backup/recovery +65 HTTP =145 nhóm**. Thêm4 unit về aggregation/snapshot/validation/privacy/source limit và2 HTTP auth/filter/cache/lanes/workflow/preparation/restart. npm run test:submission3 qua, npm audit --omit=dev:0 vulnerabilities, git diff --check qua.
- Edge3101 dùng .local/kitchen-review-20261107 giả lập4 orders: pickup1Burger CONFIRMED, delivery2Burger PREPARING có note, pickup1Pepsi READY, delivery2Khoai DELIVERING. Bảng4cards/4lane, summary3Burger chờ1/đang2, ảnh1440desktop và320mobile. Đã mở ảnh kitchen-desktop.png, kitchen-mobile.png.
- Filter race: giữ response delivery bằng route.fetch/gate, chuyển pickup rồi thả response delivery cũ; pickup2cards vẫn đúng. Chuyển delivery2cards, summary2Burger, resetall4cards.320px document320, kitchen-filter-mobile.png đã mở kiểm tra. Lượt đầu helper dùng getByLabel exact không khớp select có option text, sửa locator role/name trước khi chạy lại; không đổi code app để thuận fixture.
- UI workflow: pickupCONFIRMED→PREPARING bị mất response sau server commit bằng route.abort, bảng reload sangPREPARING chỉ1PATCH/2events tổng, không auto retry. Sau đó pickup→READY→COMPLETED và deliveryPREPARING→DELIVERING→COMPLETED: tổng5PATCH đúng payload orderId/expectedStatus/nextStatus, mỗi order4events; completed rời board còn2cards, preparation empty. Mở detail của ready order từboard đúngID.
- Read fault: GET500 structured message chủ động tạo, board bỏ cards để không giữ nút cũ. Unroute/Làm mới khôi phục. Revoke staff qua DELETE rồi refreshboard:401, login hiện và board unmount. Relogin rồi giữ mộtGET200, logout UI, thả response muộn: không phục hồi kitchen state, authfalse. Logout UI dùng clearStaffView chung, invalidates refresh và clear audit/editor/selection. Các console network/500/401 là fault injection có chủ đích.

Các ảnh là fixture4order ở thời điểm trước khi thao tác hoàn tất; không phải số liệu preview chính. Không đưa dữ liệu runtime hoặc synthetic credential fixture vào ZIP. Note có thể chứa PII do khách nhập nên bảng vẫn private; không gọi đây là DTO tuyệt đối không có PII. Không nghiệm thu queue toàn lịch sử, SLA, cloud, máy in hoặc POS/bếp thực tế.

Đã dừng fixture3101, khởi động build mới qua demo:start tại127.0.0.1:3100. Doctor7/7; store preview byte-identical trước/sau.33 build traces không có local runtime/credential/backup paths. Gói mới đối chiếu bằng submission:verify -- --current; SHA256/file count/check totals nằm trong sidecar .verified.json, không ghi đè archive cũ.


## 2026-11-07 — FR34 cửa hàng và điều kiện nhận đơn

- Mở rộng local FR34: public shop information/status; staff settings revision CAS, nhận đơn/kênh/fee/minimum/lịch7ngày UTC+7. Cùng local gate settings save và checkout, auth guard sau chờ, order store snapshot và recheck trước commit. Không cloud writes; default demo giữ compatibility.
- npm run check exit0 sau UI cuối: lint/typecheck/build, **78 nghiệp vụ +8 backup/recovery +68 HTTP =154 nhóm**.6unit mới,3HTTP mới. Unit gate giữ queue/pause rồi checkout bị từ chối, giỏ/key chưa commit dùng lại được sau mở; auth guard401 không ghi. Đây là service guard-state test dưới lock thật, không real queued-cookie revoke test.
- Test:data vẫn8groups nhưng fixture chứa shopSettings, fresh process đọc đúng789 Recovery shop/fee22k, source legacy bỏ promotions/shopSettings vẫn validate. Restore không sửa preview thật.
- HTTP publicshop200/no-store/no Set-Cookie; staff401, strict body400, revision409. Minimum/channels/pause bị server chặn, cart không mất; replay committed giữ store/fee cũ khi đóng. Allclosed schedule/restart và receipt snapshot/escaped HTML qua. Staff vẫn xử lý đơn cũ khi dừng nhận đơn.
- Browser Edge3101 dùng .local/shop-review-20261107 tách preview. Staff UI điền tên/địa chỉA/phonefake/fee23k; customer tab khác đặt1Burger. Đổi fee31k khi modal đang mở: total120k, checkbox bỏ tick, contact giữ. Tick mới vàcheckout201 ghi31k/storeA/revision mới. Ảnh shop-settings-mobile.png, shop-checkout-mobile.png đã mở kiểm tra.
- Pause UI: khách thấy tạm ngừng, vẫn thêm giỏ nhưng nútcheckout disabled; đơn cũ còn nguyên. Đổi addressB/fee27k, mở receipt đơn đầu: vẫn addressA và31k. shop-public-closed-mobile.png và shop-receipt.png. Schedule enabled/all7days nghỉ +accepting true cho outside-hours; disable schedule, pickupoff/deliveryon hoạt động lại.
- Account fake mới/saved address default: delivery-only checkout tự chọndelivery, recipient/phone/address khớp book, pickupdisabled.1Burger89k dưới min178k chặn submit. ThêmBurger đủ178k, ápSHOP10 giảm10k, phí27k: order201 total195k/storeB; historyaccount1order, không nhập guestorder. Ảnh shop-delivery-address-mobile.png; saved address prefill đã sửa cho mode delivery ngay từ lúc mở.
- Concurrent form: API giả lập editor khác cập nhật revision; form cũ thửfee26k nhận409, errorfocus, draft26k giữ và serverfee27k không đổi. Reload bỏ draft nạp27k. Draft announcement rồi revokeadmin: save401/login, panel biến mất và publicsettings không nhận draft. Admin document320/viewport320.

Ảnh là dữ liệu giả theo từng thời điểm, không phải thông tin nhà hàng thực. Chưa ghi nhận chữ ký nghiệm thu học thuật, SLA, overnight/holiday, đa chi nhánh, payment hoặc cloud acceptance. Cấu hình có địa chỉ chưa xác minh; lịch dùng clock máy chủ. Nhật ký catalog không ghi settings changes; CAS không thay cho audit history.

Các ảnh shop-settings/public-closed/checkout/receipt/delivery-address đã mở kiểm tra. Đã dừng fixture3101, khởi động build mới qua demo:start tại127.0.0.1:3100. Doctor7/7 và publicshop200/no-store/7ngày; store preview byte-identical trước/sau.35 build traces không có local runtime/credential/backup paths. npm run test:submission3qua; npm audit --omit=dev:0; git diff --check qua. Gói nộp mới được đối chiếu --current, sidecar ghi hash/sốfile/tổng154 cụ thể; archive cũ giữ nguyên.


## 2026-11-07 — FR35 đánh giá sau đơn hoàn tất và phản hồi riêng

- Scope local tiếp tục: owner COMPLETED feedback1–5/comment0–1000, edit trước reply,1staff reply5–1000, exact replay/revisionCAS, immutable sau publish. Metadata Order.feedback/updatedAt, không money/status/items/events. Không đưa vào publicmenu/shop, CSV hoặc agent retrieval.
- Hộp thư200 feedback updated gần nhất, không chỉ recent200orders. Local lọc/sort toànorderMap; Dynamo ADMIN#FEEDBACK timestamp/order/revision pointer, consistent read/conditional transaction metadata+replace index, chưa nghiệm thu cloud. Không thêm map nên backupformat cũ giữ compatibility.
- npm run check exit0 sau fix UI cuối: lint/typecheck/build, **84 nghiệp vụ +8 backup/recovery +71 HTTP =163 nhóm**.6unit mới: schema, owner/completed, replay/edit/replyfreeze, CASrace,201orders mới không che feedback mới trên oldorder/DTO/CSV, queuedstaffreauth.3HTTP mới: schema/auth/ownership/eligibility, inbox/reply/context/replay/lock/private publicabsence, restart/financial/events invariants. Test:data group6 mở rộng: process mới đọc rating4/Recoveryreply, cùng login/session/cart/shop/address/audit đã có.
- Edge3101 .local/feedback-review-20261107 chỉ fake data: tạo3pickup orders,2complete/1confirmed. Confirmed không có nút review. CompleteA mởdialog rồi đóng không ghi; gửi5điểm/HTML-like text, route.fetch commit200 rồiabort response, bấm lại:2POST nhưng revision/created record giữ nguyên, không auto retry; .order-feedback img0. TạoB2điểm qua fixtureAPI.
- Staff mobile source2feedback mean3.5/pending2, feedback-admin-mobile.png. MởreplyA5điểm rồi customer sửa4/commentmới: staff send409, alertfocus, draftgiữ. feedback-stale-mobile.png. Close/reload source mean3.0, mởreplyA4/commentmới, feedback-reply-mobile.png. Helper lần đầu locator text trùng giữa background+modal, đã scope dialog; không sửa app để thuận locator.
- Staff replyA route.fetch200 rồiabort, retry2POST cùng message giữ revision đãcommit. Customer đang có draft3 trước reply, savebịlocked, draft giữ; explicitreload thấy reply/read-only. Trong bước đóngdialog, phát hiện actualUI stale outer detail: focus sync còn dùng closure modal và bỏ qua. Đã sửa onClose gọi refresh trực tiếp, build/check lại.
- Buildcuối regression trênB: customer mởedit2, staff reply bằng fixtureAPI, reloadread-only rồi đóng; detail hiện reply ngay/núteditkhôngcòn, không phát focus. feedback-customer-reply-mobile.png đã chụp lại ởB; A/B là hai đơn khác nhau. TạoCcomplete+review3 để tiếp tụcfilter/auth. Tổng3feedback avg3.0,2replied/1pending.
- Filters: giữ response replied sau route.fetch, đổi pending rồi thảresponsecũ; vẫnC3pending. Rating4+pendingempty, rating3pendingmean3.0, resetall3entries. GET500 giả lập bỏ entries/nút cũ; unroute+reloadkhôi phục.
- Customer mởCeditdraft1, fixture APIregister đổi sangaccountmới khi modal mở; submit owner-header mismatch, modalclear/private draft không còn, owner mớiGET C404, staffinboxC vẫn3. Staff mởreplyC draft rồi DELETE adminauth: submit401/login/panelclear; reloginAPIđọcC chưa córeply, draftkhôngghi. Không thật sự gửi thông báo cho người khác.
- Mobile images feedback-customer/admin/stale/customer-reply đã mở kiểm tra; feedback text và response render như text. Document320/viewport320 ở các ca đã ghi. Các network/409/401/500 console errors do fault injection hoặc server restart có chủ đích.

Không có public rating, attachment, multi-round support, redaction/delete UI, hoặc audit tamper-proof từngrevision. Đây là acceptancelocal với dữ liệu tổng hợp; không khảo sát người dùng thực, SLA, cloud/LLM/provider acceptance. Ảnh source2feedback thuộc trước edit/reply; ảnh customerreply cuối thuộcB, không mô tả tất cả ảnh cùng một snapshot.

Đã mở kiểm tra thêm ảnh feedback-reply-mobile.png, đủ5 ảnh của đợt này. Đã dừng fixture3101, chạy build mới qua demo:start127.0.0.1:3100. Doctor7/7 và2 feedback private probes401/no-store; store preview byte-identical trước/sau.37 build traces không chứa local runtime/credential/backup paths. npm run test:submission3qua, audit productiondeps0vulnerabilities, git diff --check qua. Archive mới đối chiếu --current, sidecar lưu hash/sốfile/tổng163; giữ archive cũ.

## 2026-11-07 — FR36 giỏ nguyên tử, CAS và stale UI

- Repro trước sửa dùng MockCartRepository, inject updateCart throw: add báo lỗi nhưng còn1line89.000đ, total0. cart-atomic-before.json lưu sourceSHA256 fbb724a8e73751155f6e5c074e94ee45b1a9dab6e78a1460957d9f4a119cdc5e; đối chiếu khớp CartService trong archive giữ nguyên 20261107T114844Z. Không dùng filesystem preview hoặc AWS để tạo lỗi trước sửa.
- CartService chuẩn bị full view, không mutate mảng live; add đầu/gộp/sửa/remove/clear/reprice gọi saveCartView một lần. Repository validation+owner/ACTIVE/revision CAS, local Proxy snapshot/rollback. Legacy không revision đọc được/nâng cấp khi ghi. Checkout chống revision cũ và không mở lại closedcart. Primitive methods vẫn tồn tại cho fixture/nội bộ, không có bảo đảm transaction nếu caller tự nối các primitive.
- X-KFC-Cart-Signature optional cho API cũ, currentUI luôn gửi; absentcart dùng empty, activeempty dùng signature thật. Snapshot mismatch409 CART_CHANGED, UI refresh và không auto mutation retry. Auth/ownerheader/origin vẫn độc lập. Giá đổi có thể được reprice nguyên tử khi đọc trước409; không viết quantity từ UI cũ. Chữ ký là precondition nội dung, không UUID idempotency chung.
- Thêm5unit (singlecommit/fault/livearray, creator/editor race, legacy/invalid/foreign/stale, stalecheckout/closedcart, Dynamo commandcontract). Dynamo client export bị thay bằng transport giả, không khởi tạo AWS client/network; kiểm một TransactWrite, conditional metadata/pointer và consistent flags. Chưa có AWS acceptance.
- Thêm1data group dùng temp riêng, store.json.tmp là directory rỗng do test tạo.7 lỗi firstadd/merge/newSKU/qty/remove/clear/reprice: Maps và storebytes giữ nguyên ở assertions đã ghi; nhả chặn thì reprice thành công/tổng khớp. cart-atomic-after.json ghi scope7cases và current CartService SHA256. Không mô phỏng mọi tình huống mất điện. Không đổi store preview.
- Thêm2HTTPgroup cuối suite: staleadd/qty/remove/clear409, malformed400, cùng signature đồng thời201/409, activeempty khác absentcart, oldheader replay không trùng, owner409, signature/revision/items giữ qua restart. Lần fullcheck đầu qua lint/typecheck/build,89unit+9data+73HTTP=171;3testsubmission riêng qua, audit productiondeps0, diffcheck qua.
- Browser Edge/Playwright trên3101, .local/cart-review-20261107 synthetic: firstadd route.fetch201 rồiabort, UI chưa nhậncart; bấm lại headerempty409,2POST nhưng qty1/revision giữ nguyên. cart-retry-mobile.png. Không auto retry, không thử cộng lại theo signature mới.
- Giữ UIqty1 rồi directAPI PATCHqty3 bằng cùng cookie (không Broadcast), UI còn1; bấm Tăng gửiqty2 theooldsignature,409/refreshqty3, rawrevision không đổi. Sau xemgiỏ mới, bấm Tăng thànhqty4. cart-stale-mobile.png. Đây là stale UI qua direct fixtureAPI, không phải test hai tab tắt Broadcast.
- Staff đổi Burger89→90k khi UIqty4; bấm Giảm theo oldprice409, giỏ reprice nhưng qty4/tổng360k, cart-repriced-mobile.png. Mobile document320/viewport320. Các console errors là1abort+3x409 đã chờ trước; không thấy uncaught application exception.
- Checkout pickup qua UI1440:4Burger90k/tổng360k, activecart trởnull; bấm thêm tạo giỏ mớiqty1/tổng90k, orderitems vẫnqty4/90k. Script đầu đợi nhầm heading Đơn# thay vì Chi tiết#, timeout sau201; kiểm tra lại actualDOM và tiếp tục assertions bằng ordercard/API, không gửi lại checkout. Desktop1440/1440.
- Mở kiểm tra3ảnh: fullPage ở vị trí scrolled ban đầu có thể hiện skiplink cố định ngoài viewport trong ảnh dài. Sẽ chụp lại từ scrollTop0 trên build cuối. Không đổi CSS để phục vụ ảnh. Sau review đã đổi riêng thông báo ambiguous cart result (network/5xx/non-JSON) sang yêu cầu tải lại và kiểm tra số lượng; kiểm tra build cuối được ghi tiếp bên dưới.

Bản build cuối sau chỉnh thông báo đã được kiểm tra lại bằng fixture mới .local/cart-final-review-20261107, cùng Edge3101. Lost-response/headerempty retry, staleqty1→external3→409→explicit4 và price89→90k/qty4/tổng360k đều qua. Inject500 và200non-JSON trước ghi: mỗi ca chỉ1PATCH, revision giữ nguyên, thông báo nêu chưa xác định kết quả; nút Làm mới dữ liệu không gửi mutation. Checkout UI1440 trả201/tổng360k, chi tiết hiển thị, activecart đóng; thêm tiếpqty1/tổng90k tạo cartId khác. Script cuối dùng đúng heading Chi tiết#, không timeout/retry checkout. Các log kết quả browser nằm trong output/playwright/cart-*-result.log, không đưa cookie/runtime/script fixture vào ZIP.

Ba ảnh cart-retry/stale/repriced-mobile đã chụp lại từ scrollTop0 và mở kiểm tra: không còn fixed skiplink bị đưa vào giữa ảnh dài, document320/viewport320. Đã đóng session browser và dừng fixture3101. Main demo chạy build mới qua demo:start127.0.0.1:3100, doctor7/7; SHA256 store preview trước/sau doctor giống nhau.37 build traces không chứa .local, store/session/credential/bootstrap hoặc backup paths. Bằng chứng JSON before/after và3ảnh mới được bổ sung vào allowlist ZIP, archive lịch sử không bị sửa hoặc xoá.

Full npm run check cuối exit0 sau toàn bộ code: lint/typecheck/build,89unit+9data+73HTTP=171 nhóm. npm run test:submission chạy lại3/3; git diff --check qua. Source hash trong cart-atomic-after khớp CartService hiện hành,4 log browser cuối có passed=true/không CLI error. Log check.log đầy đủ chỉ có một summary mỗi suite. Phạm vi vẫn bản khóa luận local; không AWS writes, deployment, commit/push, payment/POS/provider acceptance. Manifest/hash và sidecar verified của gói nộp là kết quả công cụ ở bước đóng gói, không dùng để chứng nhận độc lập hoặc production readiness.


## 2026-11-08 — Checkout và cập nhật bán hàng đồng thời

- Checkout-catalog-before.json là repro mock repository/services có barrier ở lần checkoutTerms cuối. AdminService.saveMenu(isAvailable=false) hoàn tất trước commit, checkout vẫnCONFIRMED. SHA256 trước sửa của checkout/admin/promotion services khớp source trong archive giữ nguyên20261107T122853Z. Dữ liệu thật/preview không tham gia repro.
- AdminService.saveMenu/saveCategory và PromotionService.save thêm SHOP_ORDER_GATE chung với checkout/settings. Public method signatures thêm callbackoptional, caller cũ tiếp tục chạy. Sáu POST/PATCH menu/categories/promotions truyền requireAdminSession sau chờ gate. Lock order customer/admin→gate→disk, không xin owner/admin lock từ bên trong gate. Checkout re-evaluate coupon sau finalshopcheck và trước completeCheckout.
-5 unit mới dùng services/lock thật với mocks: checkout-first chặn3writes trước commit và exact retry giữsnapshot, catalog-first hếtmón/giá mới từ chối giữgiỏ/key,6route authrevoked sau serviceentry trả401/no-store/nochanges, clockstub=endsAt chặn expirygiữkey,3repo failures giải phónggate. checkout-catalog-after.json ghi assertions và SHA256 source hiện tại đã đối chiếu. Lần đầu helper ghi proof dùng nhầm globalWebCrypto.createHash khiến script exit1 sau assertions, đã đổi sang node:crypto và chạy lại toàn bộ suite thành công.
- Full npm run check cuối exit0, lint/typecheck/build,94unit+9data+73HTTP=176groups. HTTP suite giữ73groups kiểm contract/persistence thật ở server3197/thư mục temp.3 test:submission qua, npm audit --omit=dev báo0 vulnerabilities và git diff --check qua.
- Edge/Playwright local3101 .local/catalog-checkout-review-20261108 dùng dữ liệu giả. APIstaff tạo CATALOG10 fixed10k. CustomerUI thêmBurger89k/checkoutpickup/áp mã total79k/tick. StaffAPI đổi20k theo revision cũ hợp lệ, customer gửi quote cũ nhận400 PROMOTION_CHANGED, orders0. Ảnh catalog-checkout-stale-mobile là phần dialog có tổng cũ/thông báo, giữ đúng bối cảnh trước áp lại.
- Customer áp lại quote69k, checkbox trởunchecked, tickmới/POST201; detail69k/discount20k/unit89k, catalog-checkout-order-mobile.png. Tạo giỏ mới khi menu còn available, mở checkout rồi staffAPI tắt món và mã, confirmtrả400 ITEM_UNAVAILABLE/history vẫn1order. Retry body của accepted request trả201 cùngID dùmón/mã đãtắt, detail snapshot vẫn69k/20k/89k. Browser case là stale displayed terms qua APIstaff, race nội bộ dùng barrier unit như trên. Cả2ảnh đã mở kiểm tra, document320/viewport320. Console400 là response nghiệp vụ được chờ trước.
- Main build mới chạy qua demo:start127.0.0.1:3100. Doctor7/7, hash storepreview trước/sau giốngnhau.37 build traces không chứa .local/store/session/credential/bootstrap/backup paths. Hai JSON và2ảnh mới được thêm explicitallowlist trong packer. Source archive trước giữ nguyên. Verifier --current và sidecar ghi kết quả gói bàn giao cụ thể.

## 2026-11-08 — Phiên bản form catalog và điều hướng trên mobile

- Repro dùng MockMenuRepository và AdminService với hai editor cùng giá ban đầu 89.000đ. A lưu 99.000đ, B sửa mô tả kèm giá cũ làm giá trở về 89.000đ. catalog-editor-before.json lưu source SHA256 ee5b1f6f910d686e7e36bf0c0c181171e2a22e1b9ebd6711a1b30b6828cc7f36, khớp AdminService trong archive giữ nguyên 20261107T183157Z. Repro dùng dữ liệu giả.
- Thêm catalogRevision và các DTO CatalogMenuItem, CatalogCategory, AdminCatalog. Hash bao gồm ID, timestamps và các trường editable xác định. GET trả clone có token, record và schema persistence giữ định dạng cũ. PATCH nhận optional header X-KFC-Catalog-Revision. Header sai định dạng trả400, nội dung cũ khác record trả409 trong acceptance gate sau reauth. Exact content replay trả previous, giữ updatedAt và audit. UI hiện tại luôn gửi header khi PATCH. Caller cũ bỏ header tiếp tục hành vi cũ.
- MenuEditor và CategoryEditor giữ draft khi lỗi, focus thông báo và có nút tải lại ghi rõ bỏ bản nháp. AdminConsole chỉ đọc catalog khi reload, kiểm tra generation và remount form bằng resetKey sau khi đọc thành công. resetKey cũng xử lý trường hợp server trả cùng revision. Lỗi đọc giữ draft,401 clear staff view. Ba TSX đã được kiểm tra type-only imports, busy state, native dialog, error focus và generation guard.
- Ba unit mới đưa tổng lên97. Hai HTTP mới đưa tổng lên75, kiểm tra thêm revision qua restart, bytes dữ liệu giữ nguyên khi GET và token không đi vào raw store. Lần full check đầu, fixture quên đăng nhập staff lại sau restart nên nhận401 rồi đọc thiếu array. Đã sửa fixture và chạy lại75 HTTP, sau đó full check cuối exit0 qua lint/typecheck/build,97 unit+9 data+75 HTTP=181 nhóm. Ba test công cụ gói nộp qua, production dependency audit báo0 vulnerabilities và git diff --check qua.
- Browser Edge dùng dữ liệu riêng trong .local/catalog-editor-review-20261108 tại3101. Hai tab quản trị thật cùng mở Burger89k. TabA lưu99k, tabB sửa mô tả và gửi giá89k nhận409. Server giữ99k, draft còn và alert được focus. Ảnh catalog-menu-conflict-mobile.png ghi đúng trạng thái này. Reload GET500 giữ draft, sau bỏ fault và tải lại thì form có99k và bỏ draft. Helper ban đầu đợi input visible quá sớm, đã đổi sang chờ DOM value rồi chạy lại đầy đủ trên build cuối.
- TabB lưu theo dữ liệu mới rồi mở lại sửa100k. route.fetch nhận200, sau đó abort acknowledgement. UI giữ draft, lần gửi lại trả200 với cùng updatedAt và giá100k. Hai PATCH chỉ thêm một entry audit. Ảnh catalog-menu-retry-mobile.png chụp sau mất phản hồi. Ca này kiểm tra exact content replay của PATCH.
- Hai tab danh mục cùng mở Bữa sáng với thứ tự1. A đổi tên, B sửa thứ tự9 và gửi tên cũ nhận409, draft và focus được giữ. Ảnh catalog-category-conflict-mobile.png chụp trước reload. Reload lấy tên mới, sau đó lưu mô tả đã xem lại. Một PATCH500 rồi reload cùng revision vẫn bỏ draft9 về thứ tự1. Ca tiếp theo giữ draft riêng tư, thu hồi staff bằng fixture API rồi reload trả401. Dialog bị xoá và draft không xuất hiện trong login view. Đăng nhập lại qua API cho thấy dữ liệu đã lưu giữ đúng tên, thứ tự1 và mô tả đã xác nhận.
- Review tìm thấy document rộng365px ở viewport320px, phần tràn là nút08 Đánh giá. CSS dưới720px chuyển nav sang grid4 cột và hai hàng, brand được wrap, nút cao tối thiểu44px. Build cuối đo320/390/430/720/768/1440 đều có document bằng viewport, đủ8 tab và các nút nằm trong màn hình. Bốn ảnh mới đã mở kiểm tra, ảnh dialog thể hiện phần đang nhìn thấy trong viewport.
- Demo chính tại127.0.0.1:3100 đạt doctor7/7, SHA256 store preview trước và sau giống nhau.37 build traces đã kiểm tra đường dẫn runtime, credential và backup. Hash source trước/sau đã đối chiếu, ba log browser cuối đều passed=true. Hai JSON và bốn ảnh mới nằm trong allowlist đóng gói. Đã đóng browser thử và dừng fixture3101.


## 2026-11-09 — Chuẩn bị AI thật và pilot AWS

- Giảng viên yêu cầu AI thật và AWS, hạn 01/01/2027. Đã bổ sung kế hoạch mốc 09/11–31/12 và runbook chi phí/triển khai/nghiệm thu; baseline local cũ giữ làm lịch sử.
- Sửa Bedrock Anthropic Messages chỉ gửi temperature hoặc top_p cho Haiku 4.5; bảo toàn top_p=0, kiểm tra sampling/maxTokens, mặc định512 output và giới hạn32.000byte body. Thêm giới hạn persisted25request/ngày UTC trước gửi, fail closed khi counter lỗi/futureday hoặc hết quota; SDK maxAttempts1 và15s timeout. Counter là kiểm soát một tiến trình, không phải hard USD cap.
- CLI canary mặc định chỉ đọc; --invoke yêu cầu account chính xác và UUIDv4 mới, tạo marker exclusive trước tối đa một lượt gọi. Canary dùng giỏ in-memory synthetic, kiểm tra proposal chưa đổi giỏ rồi confirmation đúng SKU/số lượng; chưa thực thi lượt trả phí.
- Dockerfile standalone Node24 non-root, runtime EBS, nginx origin secret; CloudFormation21resource với EC2t3.medium,52GiBgp3 tổng cộng, CloudFront HTTPS/no-cache, EIP, S3private/versioned,3secret, IMDSv2 và scoped IAM. AMI yêu cầu ID cụ thể. DataEBS/S3/secrets Retain. Một máy/một tiến trình giữ đúng phạm vi khoá giao dịch hiện tại; không phải nghiệm thu DynamoDB hoặc HA. CloudFront–origin HTTP giới hạn prefixlist+secret; không TLS xuyên suốt.
- Template bfa59184326ffe947435db408833b8d70447cbe5239a57547800fc1024dbcf7e đã qua cfn-lint và AWS ValidateTemplate chỉ đọc. Plan đề xuất AMI ami-09f02015912e773f7 tại us-west-2, account kết thúc0098 chưa xác nhận. Bedrock metadata AUTHORIZED/AVAILABLE, profile ACTIVE; inferenceCalls0 và applicationDeployed=false. AWS PriceList chỉ đọc cho tổng cơ sở39,378USD/730giờ, chưa gồm inference/traffic/request/thuế/CPUcredits.
- Source tar SHA256 2e9d2db5bf318724dde0d0f5a961a3b3aedb98d9f567f34f794df5225385702c chứa176sourcefiles và manifest. Release chuẩn bị pin S3VersionId+SHA, xác minh template/CREATEadditions/parameters, tải exactversion và SSM một host. Không createChangeSet, execute, PutObject, SSM hoặc inference nào đã chạy. Base image chưa pin digest. Máy không có Docker nên Linux image build/run còn chờ nghiệm thu.
- Full npm run check exit0: lint, TypeScript,101unit+9recovery+76HTTP=186 nhóm chính,3test AWS package offline. Thêm3test verifierZIP riêng qua; npm audit --omit=dev báo0vulnerabilities. Bash -n bootstrap/release và git diff --check qua. Fixture proxy ban đầu dùng fetch khiến Host bị runtime thay; đổi sang node:http và đã chạy lại toàn bộ check. Ca mới kiểm tra Securecookie, guest/admin cùng origin và403khác origin qua production Next.
- Demo127.0.0.1:3100 chạy build mới, doctor7/7. SHA256storepreview giữ nguyên trước/sau;37buildtraces không có đường dẫn runtime/credential/backup bị cấm. aws-preparation-checks.json ghi riêng trạng thái Docker/AI/deploy chưa xác minh. ZIP đóng gói chỉ lấy6fileinfra công khai theo allowlist, không quét private target/config.


## 2026-11-09 — Quy trình nhóm ba người và skill dùng chung

- Mở rộng AGENTS.md, giữ block Next.js; thêm CONTRIBUTING.md, skill kfc-team-development trong .agents/skills, metadata Codex và PR template. CLAUDE.md hiện có tiếp tục trỏ AGENTS.md. Skill nằm trong repo và ZIP, không sửa skill toàn cục trên máy thành viên. Chưa gán username hoặc CODEOWNERS khi chưa có thông tin thật.
- Quy định task/branch/clone hoặc worktree/data riêng; review file dùng chung và hợp đồng API/schema; bảo toàn auth, confirmation, CAS, idempotency, locks và historical evidence. AWS chỉ thực hiện trong phạm vi được duyệt; không hỏi lặp phạm vi đã được duyệt.
- Thêm team:check đọc Git index, chặn đường dẫn private/runtime/key/backup; không sửa hoặc unstage file và không phải content/history secret scanner. test:team qua33case synthetic. Thử riêng trên Git repo tạm: README staged qua, .env.local staged bị chặn exit1 và nội dung/index giữ nguyên. Kiểm tra không dùng dữ liệu hay repo thật để tạo file private.
- CI Windows/Linux thêm guard, test guard và3test verifierZIP. Đã kiểm tra cấu trúc YAML và các step; chưa có bằng chứng workflow chạy trên GitHub. Branch protection cần chủ repo bật; chưa sửa remote settings, commit, push, merge hoặc chạy AWS.
- Skill quick_validate qua; lint, test:submission3/3, test:aws3/3 và git diff --check qua. Không sửa logic ứng dụng nên không lặp full186nhóm của lần kiểm tra ngay trước đó; check.log được giữ với thời điểm/bằng chứng cũ. AWS source tar mới do package.json thêm scripts: SHA25626f5bbe20ea14c8ddcbd15597dd6cc8dad84f01a385c8ece716db43659ef20e8. Source tar cũ và ZIP cũ giữ nguyên.
