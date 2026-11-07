# API tài khoản và quản trị

Các phản hồi riêng dùng Cache-Control: private, no-store. Thao tác từ origin khác bị chặn. Quyền và userId lấy từ cookie server, không từ body.

## Tài khoản khách

| Endpoint                 | Body/hành vi                                                                |
| ------------------------ | --------------------------------------------------------------------------- |
| POST /api/auth/register  | email, fullName, password 10–128 ký tự; email duy nhất; cấp customer cookie |
| POST /api/auth/login     | email, password; cấp một phiên mới                                          |
| GET /api/auth/session    | profile public hoặc null; không hash/salt                                   |
| DELETE /api/auth/session | Thu hồi đúng session, xoá cookie                                            |

GET /api/session cũng trả profile. Cookie customer hợp lệ được ưu tiên trước guest. ID account khác guest, không tự chuyển giỏ/lịch sử. Customer session lưu repository và sống qua restart local; cookie đã logout không dùng lại được.

Email được chuẩn hoá chữ thường. Đăng ký không cấp quyền staff. Chưa có email verification hoặc email recovery.

## Quản lý hồ sơ và mật khẩu

Hai endpoint sau chỉ nhận customer account đang đăng nhập; guest và staff không được dùng thay thế. Kiểm tra lại phiên sau khi lấy khoá theo tài khoản; không lấy ID chủ thể từ body.

| Endpoint | Body / kết quả |
| --- | --- |
| PATCH /api/account/profile | fullName 2–100 ký tự sau trim; chỉ trả profile id/email/fullName |
| POST /api/account/password | currentPassword, newPassword, confirmPassword; mới 10–128 ký tự, khác cũ và khớp xác nhận |

Body strict: trường ngoài schema bị 400; không đổi email, ID, role hoặc hash từ client. Sai mật khẩu hiện tại trả PASSWORD_INCORRECT/400, không thay mật khẩu hoặc thu hồi phiên. Xung đột phiên bản mật khẩu trả ACCOUNT_CHANGED/409. Phiên không còn hợp lệ trả 401. Kiểm tra origin và giới hạn body chung vẫn áp dụng.

Đổi mật khẩu commit hash/salt/KDF mới có điều kiện theo hash cũ. Mọi cookie customer cũ chứa version của hash trước nên không còn truy cập tài khoản, kể cả trên trình duyệt khác và sau restart local. Cookie hiện tại được xoá; kết quả thành công là reauthenticate=true. Không đổi account ID, giỏ, đơn hoặc snapshot tên khách trong đơn đã đặt.

Phiên cũ bị vô hiệu về mặt xác thực; record session không bị quét xoá cùng lúc đổi mật khẩu. Expiry/repository sẽ xử lý record hết hạn. Các request đã được cấp quyền và đang thực thi không bị huỷ từ xa. Chưa có cơ chế revocation phân tán được nghiệm thu trên cloud.

Giới hạn đổi mật khẩu là 10 yêu cầu/phút/tài khoản trong tiến trình (gồm yêu cầu sai validation), tách khỏi budget đăng nhập. Không tin accountId/IP do client cung cấp. Hồ sơ public không chứa mật khẩu, hash hoặc salt. Không log body chứa mật khẩu.

Nếu mất phản hồi sau khi đổi mật khẩu, kiểm tra bằng đăng nhập lại; không tự retry mutation. Đây là đổi mật khẩu khi còn đăng nhập, không thay thế chức năng quên mật khẩu/email recovery.

## Quản trị

Các endpoint dưới cần staff cookie và nonce còn hiệu lực, cookie customer/guest không thay thế được.

| Endpoint                          | Hành vi                                                   |
| --------------------------------- | --------------------------------------------------------- |
| GET /api/admin/auth               | configured/authenticated, không credential                |
| POST /api/admin/auth              | password; chưa cấu hình 503, sai 401, quá lượt 429        |
| DELETE /api/admin/auth            | Thu hồi staff nonce và xoá cookie                         |
| GET /api/admin/orders             | Tối đa 200 đơn gần nhất và thống kê từ tập đó             |
| GET /api/admin/orders?orderId=... | Chi tiết, món, events                                     |
| PATCH /api/admin/orders           | orderId, expectedStatus, nextStatus; bước sai/cũ trả 409  |
| GET /api/admin/menu               | Toàn menu và danh mục, gồm món ẩn/hết                     |
| POST /api/admin/menu              | Tạo món; giá 1.000–5.000.000đ, danh mục hợp lệ, ảnh local |
| PATCH /api/admin/menu             | itemId và toàn bộ trường chỉnh sửa; giữ ID/createdAt      |

Món gồm name, description, categoryId, price, imageUrl, isActive, isAvailable. Tên trùng trả 409. Ảnh chỉ nhận sáu minh hoạ local đang có. Không hard-delete làm mất snapshot đơn.

Staff được cấu hình trên máy chủ, không qua đăng ký public. Session tối đa 8 giờ; logout/restart hoặc đổi credential làm mất hiệu lực. Login limit toàn cục từng vai trò 10/phút là biện pháp demo, chưa phải limiter phân tán/per-IP.

## Trạng thái

- Pickup: CONFIRMED → PREPARING → READY → COMPLETED.
- Delivery: CONFIRMED → PREPARING → DELIVERING → COMPLETED.
- CONFIRMED có thể CANCELLED.
- Terminal không quay lại; khách chỉ tự huỷ CONFIRMED.
- Cập nhật và event cùng commit; retry bước đã đạt không thêm event.

Event có actor customer/admin và previousStatus khi chuyển bước. Hiện một credential admin chung, chưa truy vết từng nhân viên.

## Danh mục thực đơn

GET/POST/PATCH /api/admin/categories đều cần staff cookie; origin và giới hạn body dùng quy tắc chung. GET trả toàn bộ categories, gồm danh mục đã tắt, theo displayOrder tăng dần (cùng thứ tự thì so ID). POST trả 201; PATCH giữ id và createdAt.

Body POST gồm name (trim, 2–80 ký tự), description (tối đa 240, mặc định rỗng), displayOrder (số nguyên 0–999), isActive (boolean). PATCH thêm categoryId. Trường ngoài schema bị 400; tên trùng không phân biệt hoa/thường/dấu bị DUPLICATE_CATEGORY/409, không có ID bị CATEGORY_NOT_FOUND/404.

Không hard-delete danh mục. Tắt danh mục còn bất kỳ món tham chiếu nào (kể cả món ẩn/hết món) bị CATEGORY_IN_USE/409. Quản trị chuyển món sang danh mục đang hoạt động khác rồi mới tắt. API món từ chối gán danh mục đã tắt. Đơn cũ giữ snapshot, không bị sửa theo việc đổi danh mục.

Trong bản local một tiến trình, khoá admin dùng chung tuần tự hoá lưu món và lưu danh mục, kể cả hai request tạo tên trùng đồng thời. Chưa có ràng buộc tham chiếu phân tán được kiểm chứng cho nhiều instance/AWS. Public /api/menu chỉ trả danh mục đang hoạt động.

## Lọc báo cáo quản trị

GET /api/admin/orders vẫn trả tập tối đa 200 đơn gần nhất và stats của tập đó. UI lọc trong tập đã tải; không gọi đây là báo cáo toàn lịch sử. Bộ lọc gồm status, fulfillment, query mã/tên/điện thoại không dấu, ngày bắt đầu/kết thúc inclusive theo Asia/Ho_Chi_Minh. Ngày bắt đầu sau ngày kết thúc được báo lỗi và chặn CSV.

Danh sách, stats, biểu đồ/bảng ngày và CSV cùng dùng tập đã lọc. Giá trị chỉ cộng COMPLETED, theo ngày đặt, không phải ngày hoàn tất/thu tiền. Biểu đồ giữ tối đa 14 ngày có dữ liệu trong tập lọc. CSV có BOM UTF-8, chỉ machine-owned fields; không xuất tên, phone, address, note hoặc query.

## Đồng bộ quản trị

Khi staff đã đăng nhập, UI làm mới queue/menu/chi tiết đang chọn qua BroadcastChannel, focus/visibility và chu kỳ 15 giây khi trang visible. Tạm dừng khi thao tác đang chạy hoặc editor món/danh mục mở; không gửi lại mutation. Kết quả refresh cũ bị bỏ qua, lỗi 401 xoá dữ liệu riêng khỏi state và chuyển về login. Đây là polling/Broadcast trong demo, không phải dịch vụ realtime hoặc bảo đảm cập nhật ngay trên mọi thiết bị.

## Nhật ký thay đổi catalog

GET /api/admin/catalog-audit cần staff cookie, trả entries tối đa 200 bản mới nhất và limit=200, private/no-store. Không có endpoint sửa/xoá nhật ký. POST/PATCH/DELETE không hỗ trợ (405). Khách guest/customer không được đọc.

Mỗi entry gồm id, actor=admin, action MENU_CREATED/MENU_UPDATED/CATEGORY_CREATED/CATEGORY_UPDATED, entityId/entityName, createdAt và changes gồm field/before/after. Chỉ trường catalog trong allowlist được ghi; không lưu request body, mật khẩu, cookie, contact hoặc phiên khách. Quản trị hiện dùng một credential chung nên không quy kết được từng nhân viên.

AdminService tạo entry sau validation, repository lưu record catalog + entry cùng một mutation. Local proxy ghi chúng trong cùng snapshot/rollback; adapter DynamoDB dùng TransactWrite nhưng chưa được kiểm chứng AWS. No-op hoặc yêu cầu bị từ chối không tạo entry. Các thay đổi cũ trước khi có chức năng này không được dựng lại/backfill. Thay đổi trạng thái đơn vẫn xem trong OrderEvent của từng đơn.

Đây là nhật ký ứng dụng, không phải chứng cứ chống sửa ở cấp ổ đĩa: chủ máy vẫn có thể sửa store.json. Giới hạn 200 là giới hạn đọc, không phải chính sách tự xoá các entry cũ. Chưa có retention/archive hoặc nhiều nhân viên.

## Health

GET /api/health trả phiên bản/phạm vi demo và tên driver/provider cấu hình. Không probe AWS; bản hiện tại ghi cloudVerified=false và paymentsEnabled=false.

## Sổ địa chỉ khách hàng

GET/POST/PATCH/DELETE /api/account/addresses dùng accountApi: cookie customer, same-origin, X-KFC-Owner nếu gửi phải khớp, khoá tài khoản và kiểm tra lại session. Response private/no-store gồm addresses và revision (64 hex). Guest/staff bị 401. GET storefront trả addressBook cho customer, null cho guest. Không nhận userId từ body.

POST: label (2–50), recipientName (2–100), phone dạng 0 hoặc +84 và 9 chữ số, addressLine (10–300), isDefault boolean, revision. PATCH thêm addressId. DELETE chỉ addressId, revision, confirm=true. Schema strict; quá 5 bị ADDRESS_LIMIT/400, sai chủ/không tồn tại ADDRESS_NOT_FOUND/404, revision cũ ADDRESS_BOOK_CHANGED/409. UI yêu cầu làm mới rõ ràng, không gửi lại mutation tự động.

Địa chỉ đầu tiên tự mặc định; chọn địa chỉ khác sẽ bỏ mặc định cũ, xoá mặc định chọn bản còn lại lâu nhất. Địa chỉ là text đầy đủ, không áp đặt đơn vị hành chính. Checkout sao chép contact khi đặt, không liên kết động với sổ địa chỉ. Chưa xác minh định vị/vùng giao. Local lưu một snapshot atomic. Dynamo dùng một ADDRESS_BOOK item với conditional Put theo revision, đọc tương thích ADDRESS# cũ; chưa nghiệm thu trên AWS.

## Khuyến mãi và báo giá checkout

GET/POST/PATCH /api/admin/promotions dành cho staff, private/no-store, same-origin. Không hard-delete. POST tạo mã, PATCH sửa theo code và revision hiện tại; mã là khóa bất biến trong giao diện, muốn đổi tên mã thì tạo mã mới và tắt mã cũ. Code chuẩn hoá hoa, 3–24 ký tự A–Z/0–9/_/-. Title 2–100, discountType percent/fixed, value số nguyên (percent 1–100, fixed 1–1.000.000), minimumSubtotal 0–10.000.000, maxDiscount 0–1.000.000 (chỉ percent; 0 = không trần), startsAt/endsAt ISO có timezone, isActive boolean. startsAt phải trước endsAt. Schema strict. PATCH thêm revision UUID.

Trùng mã PROMOTION_EXISTS/409; bản sửa cũ hoặc CAS thua PROMOTION_CHANGED/409. Không tự retry. Tối đa 200 mã trong bản local; tắt mã thay vì xoá. Local lưu promotions Map cùng snapshot; backup mới có map này, validator vẫn nhận backup cũ chưa có promotions. Dynamo adapter dùng PROMOTIONS/code và conditional Put (chưa nghiệm thu cloud).

POST /api/checkout/quote cần phiên guest/customer và X-KFC-Owner đúng nếu gửi. Body strict: cartId, cartSignature, fulfillment pickup/delivery, promotionCode. Server đọc giỏ/menu và điều kiện mã, trả cartId/cartSignature/subtotal/discount/deliveryFee/total/promotion {code,title,revision,discount}. Chỉ báo giá, không tạo đơn hoặc gắn mã vào giỏ. Có thể reprice các dòng menu theo cơ chế getCartView hiện có. Response private/no-store.

Mã phải active, startsAt <= thời điểm kiểm tra < endsAt và subtotal >= minimumSubtotal. Phần trăm làm tròn xuống đồng, sau đó áp trần nếu có; số tiền cố định không vượt tiền món. Không giảm phí giao 15.000. Chỉ một mã/đơn, mã dùng nhiều lần, chưa có quota/per-customer, cộng dồn hoặc phân nhóm món. Tính hợp lệ được kiểm tra tại service khi báo giá và khi checkout, không có reservation/quota hay bảo đảm phân tán cho thay đổi xảy ra sau bước kiểm tra đó.

POST /api/orders có thêm cặp promotionCode/promotionRevision tùy chọn; phải có cả hai hoặc không có. expectedTotal cho phép 0 để hỗ trợ giảm 100% khi pickup. Checkout đọc lại điều kiện và revision, tính lại tiền; không tin discount từ client. Mã không sẵn/ngoài hạn PROMOTION_UNAVAILABLE/400, chưa đạt minimum PROMOTION_MINIMUM/400, revision thay đổi PROMOTION_CHANGED/400, sai tổng PRICE_CHANGED/400. Giỏ đổi CART_CHANGED/400. Không tạo đơn khi bị từ chối. Retry cùng idempotency key trả snapshot đơn đã có, kể cả mã sau đó hết hạn/tắt.

Order có discount và promotion snapshot. Chi tiết khách/admin, phiếu đơn hiển thị mã/mức giảm cũ. Báo cáo completed value dùng order.total sau giảm. Nhân viên cung cấp mã cho khách qua kênh demo; chưa có trang chiến dịch công khai hoặc gửi thông báo/email.

CSV báo cáo có thêm discount_vnd numeric để đối chiếu subtotal − discount + delivery_fee = total; không xuất title hay contact theo chương trình.

## Đặt lại đơn

POST /api/orders/reorder: body strict {orderId}, 1–100 ký tự. Chỉ guest/customer sở hữu đơn, same-origin và X-KFC-Owner đúng nếu có. Trả orderId/items/subtotal/confirmationToken/expiresAt, private/no-store. Items gồm current name/unitPrice/quantity/subtotal và previousName/previousUnitPrice để đối chiếu. Không trả contact, note, coupon hoặc địa chỉ từ đơn. Không tạo cart/order; đọc getCartView có thể reprice giỏ hiện có như trước.

Token HMAC dùng domain reorder riêng, gắn owner/order/operation UUID/sourceSignature/menuSignature/baseCartId/expiry 15 phút. Token ký nhưng không mã hoá; không thay thế cookie đăng nhập, không tin dữ liệu edit của client. Không lưu token vào repository. PUT /api/orders/reorder body strict {confirmationToken (tối đa 2048), confirm:true}. GET/DELETE không hỗ trợ (405).

Xác nhận kiểm tra lại chủ, giỏ trống/cùng base cart, source và tên/giá/tình trạng món. Tạo cart ID xác định theo owner + operation UUID, items mới và metadata sourceOrderId/reorderOperationId. Local repository completeReorder kiểm tra điều kiện và lưu toàn bộ trong một snapshot/rollback. Giỏ rỗng cũ thành ABANDONED; không xoá nội dung lịch sử. Dynamo adapter có TransactWrite cho cart/items/pointer/base status, chưa nghiệm thu AWS hoặc cạnh tranh với mọi mutation nhiều instance.

Response PUT là CartView + replayed boolean. Retry token còn hạn đã thực thi chỉ trả giỏ hiện tại, không thêm hoặc hoàn nguyên chỉnh sửa mới và không xoá chat proposal mới. Nếu cart đã checkout/không còn active thì chặn, không mở lại. Chưa tạo order khi confirm đặt lại; cần checkout riêng và tự chọn contact/fulfillment/mã giảm giá hiện tại. Mọi trạng thái order của chính chủ có thể làm nguồn khi lines hợp lệ, kể cả đơn đã huỷ.

Mã lỗi: ORDER_NOT_FOUND/404; REORDER_CART_NOT_EMPTY/409; REORDER_UNAVAILABLE/409; REORDER_INVALID/409 cho source rỗng/quá 50 dòng/số lượng ngoài 1–100/options hoặc duplicate SKU; REORDER_CHANGED/409 khi source/menu/base-cart/điều kiện ghi đổi; REORDER_EXPIRED/409 cho token hỏng/hết hạn/khác owner; REORDER_ALREADY_USED/409 nếu cart đã kết thúc. Không tự retry write khi lỗi stale; yêu cầu preview mới. Retry mất phản hồi phải dùng đúng token còn hạn, xem giỏ trước nếu chưa biết kết quả.

## Mẫu hội thoại parser offline

/api/chat không đổi schema/quyền. Mock parser nhận “Thêm hai Pepsi”, “Đổi Pepsi thành ba”, “Xoá Pepsi trong giỏ hàng”; mutation vẫn qua policy và nút xác nhận. Câu nhiều lệnh/món/số lượng, ước lượng hoặc tăng/giảm chưa có đích trả lời làm rõ thay vì chọn một phần để thực thi. Dung tích ml/lít giữ trong query và phải khớp catalog, không tự chuyển sang SKU khác. Chưa có delta arithmetic hay xử lý mọi cấu trúc tiếng Việt. Bedrock chỉ được bổ sung hướng dẫn prompt, chưa có acceptance thật trong đợt này.

## Món bán chạy và đối soát

GET /api/admin/sales cần staff cookie, private/no-store. Chỉ đọc dữ liệu, không có POST. Query strict: status all/PENDING/CONFIRMED/SUBMITTED/PREPARING/READY/DELIVERING/COMPLETED/CANCELLED, fulfillment all/pickup/delivery, search trim tối đa100, from/to YYYY-MM-DD hoặc rỗng. Ngày inclusive theo Việt Nam, from<=to, reject ngày không có thật. Unknown hoặc duplicate query bị400. Không echo raw search vào report/CSV.

Admin dashboard GET /api/admin/orders thêm revision SHA256 của 200 records được lấy, bao gồm các trường dùng lọc/đối soát. Sales có query basisRevision64hex tùy chọn; khi có và khác window hiện tại trả SALES_CHANGED/409. Đây là change detector, không phải auth token. UI luôn gửi revision dashboard, ẩn dữ liệu/export cũ ngay khi filter/basis đổi; nếu window đổi thì dùng nút Làm mới dữ liệu quản trị phía trên để lấy window mới.

Report trả generatedAt/basisRevision/sampleLimit200/sampledOrders/matchedOrders/completedOrders/excludedOrders/units/gross/discount/deliveryFee/net/topLimit10/products. Chỉ hoàn tất trong bộ lọc, đọc items tối đa8 orders song song. Kiểm tra currencyVND, số nguyên an toàn không âm, qty1–100, 1–50lines, item.orderId đúng, unitPrice*qty=subtotal, sum line=order.subtotal và subtotal−discount+fee=total. Completed không đủ/không khớp bị loại, đếm excludedOrders và UI cảnh báo; không gọi tổng này là doanh thu toàn hệ thống.

Gộp theo menuItemId, name lấy từ snapshot completed mới nhất theo createdAt rồi ID. Đếm tổng số phần, số order distinct có món và tiền món trước giảm. Sắp units giảm dần, gross giảm dần rồi ID; chỉ trả top10. Tổng ở report tính tất cả món hợp lệ nên có thể lớn hơn tổng top10. Không phân bổ discount/fee vào từng SKU, không tính margin/profit/payment hoặc refund. Đơn hoàn tất tính theo ngày đặt, không phải ngày thu tiền.

CSV món gồm ID/name snapshot/units/order_count/gross cùng sample limit/counts, excluded count, generatedAt và source revision. Không contact/note/coupon title/raw query. Text cells bỏ control/format chars và prefix apostrophe khi có thể là formula (=,+,-,@ sau whitespace); CSV escape quotes và BOM UTF-8. Đơn zero-total do giảm100% vẫn có phần/gross/discount đúng và giữ phí delivery nếu có.

Staff APIs kiểm tra auth lần nữa khi đã lấy được lock quản trị. Logout/credential revoke trong lúc request đang xếp hàng không được tiếp tục operation dưới phiên cũ. Không tuyên bố huỷ mọi request đã bắt đầu thực thi trước logout.
