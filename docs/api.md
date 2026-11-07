# Customer API

Khởi tạo bằng `GET /api/session`; giữ cookie nhận được. Tất cả API giỏ, chat và đơn lấy khách từ cookie đã ký, bỏ qua `userId` do client truyền. Yêu cầu đổi dữ liệu từ origin khác bị từ chối.

| Endpoint                              | Hành vi                                                                                         |
| ------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `GET /api/session`                    | Cấp/khôi phục cookie khách; trả hội thoại gần đây và cờ chờ xác nhận                            |
| `GET /api/menu`                       | Thực đơn đang bán; hỗ trợ `q`, `categoryId`, `itemId`, `bundleId`                               |
| `GET /api/cart`                       | `{cart, items, signature}` hoặc giỏ trống                                                       |
| `POST /api/cart`                      | `{menuItemId, quantity}`; giá lấy từ menu                                                       |
| `PATCH /api/cart`                     | `{itemId, quantity}`; chỉ dòng thuộc giỏ khách                                                  |
| `DELETE /api/cart?itemId=...`         | Xoá một dòng; không có itemId thì xoá toàn giỏ                                                  |
| `POST /api/chat`                      | `{message, confirm?: boolean, confirmationId?: string}`; xác nhận phải khớp mã đề xuất đang xem |
| `DELETE /api/chat?confirmationId=...` | Huỷ đúng đề xuất đang xem; mã cũ trả 409                                                        |
| `GET /api/orders`                     | Lịch sử đơn của khách                                                                           |
| `GET /api/orders?orderId=...`         | Chi tiết, món và sự kiện; trả 404 nếu không thuộc khách                                         |
| `POST /api/orders`                    | Checkout; xem payload dưới                                                                      |
| `PATCH /api/orders`                   | `{orderId, confirm: true}`; huỷ đơn đang CONFIRMED, không lặp sự kiện khi retry                 |
| `GET /api/health`                     | Health check                                                                                    |

Payload checkout:

```json
{
  "cartId": "ID cart từ GET /api/cart",
  "cartSignature": "signature từ GET /api/cart",
  "customerName": "Khách Demo",
  "phone": "0901234567",
  "fulfillment": "delivery",
  "address": "123 Đường Mẫu, Phường 1, TP Hồ Chí Minh",
  "note": "",
  "expectedTotal": 90000,
  "idempotencyKey": "UUID mới cho một checkout, giữ nguyên khi retry",
  "confirm": true
}
```

`fulfillment` là `pickup` hoặc `delivery`. Địa chỉ giao ít nhất 10 ký tự. Tổng tiền bằng giá menu hiện tại × số lượng + phí giao (delivery 15.000đ, pickup 0đ). Không chấp nhận giá do client quyết định. `cartSignature` và `cartId` ràng buộc nội dung giỏ khách vừa xem.

Checkout commit đơn, món, sự kiện CONFIRMED và giỏ CHECKED_OUT cùng nhau. Một khoá checkout được phạm vi hoá theo khách; retry trả cùng đơn, kể cả khi giỏ đã đóng. Sau checkout, thêm món tạo giỏ mới.

Lỗi API có dạng `{error: string, code?: string}`. JSON/input/nghiệp vụ sai trả 400, chưa có phiên trả 401, origin bị chặn trả 403, đơn không tồn tại/không thuộc khách trả 404, bỏ qua đề xuất cũ trả 409, lỗi nội bộ trả 500. Phản hồi riêng có `Cache-Control: private, no-store`.

## Đề xuất có thời hạn và nhiều tab

`GET /api/session` và phản hồi chat có `pendingConfirmation: null` hoặc:

```json
{
  "id": "UUID của đề xuất",
  "expiresAt": "ISO 8601 UTC, hết hạn sau 15 phút",
  "summary": ["Thêm 2 × Combo Gà Cay: 318.000 ₫"]
}
```

Gửi `{message: "Xác nhận", confirm: true, confirmationId: pendingConfirmation.id}` để xác nhận. Thiếu mã hoặc mã sai định dạng trả 400. Mã thuộc đề xuất cũ trả phản hồi chat không thực hiện công cụ, kèm đề xuất hiện tại để khách xem lại. Không tự gửi lại với mã mới.

Đề xuất hết hạn không thực hiện được. Nếu nội dung giỏ hoặc giá đã thay đổi so với bản xem trước, đề xuất bị vô hiệu và khách phải gửi yêu cầu mới. Đề xuất từ phiên bản cũ không có metadata này phải được tạo lại sau cập nhật.

`DELETE /api/chat?confirmationId=...` chỉ huỷ mã khớp đề xuất còn hiệu lực; mã cũ trả 409 và giữ nguyên đề xuất mới. Các API sửa giỏ/checkout vẫn chủ động vô hiệu hoá đề xuất của phiên.

`actions` trong phản hồi có thể là mảng rỗng khi trợ lý chào hỏi, cần thêm thông tin hoặc không đề xuất công cụ. `UPDATE_CART` được hỗ trợ qua câu như “Đổi Pepsi thành 3”, dùng ID dòng thuộc giỏ hiện tại và vẫn cần xác nhận.

Tin nhắn đồng ý bằng chữ (ví dụ `Xác nhận`, `ok`) khi có đề xuất còn hiệu lực không thực hiện công cụ và không xoá đề xuất; server trả lại cùng mã để khách tiếp tục dùng nút xác nhận.
# Giới hạn body JSON

Các endpoint mutation dùng bộ đọc chung giới hạn 16.000 byte UTF-8, bao gồm body gửi theo chunk không có Content-Length. Vượt giới hạn trả HTTP 413 với code BODY_TOO_LARGE; JSON/UTF-8 sai trả 400. Đây là giới hạn byte của toàn bộ body, không phải chỉ độ dài trường message.

## Snapshot và ràng buộc phiên hiển thị

GET /api/storefront khởi tạo/khôi phục phiên và trả ownerId, session (profile/messages/pending), menu, basket, history và detail. orderId query là tuỳ chọn; detail chỉ trả khi đúng chủ, ngược lại null. Basket có thể null khi chưa có giỏ. Phản hồi private/no-store; đọc dữ liệu riêng theo cùng một owner dưới khoá theo khách. Giao diện dùng endpoint này thay vì ghép nhiều request riêng.

UI gửi X-KFC-Owner cho thao tác dựa trên dữ liệu đang hiển thị. Nếu cookie đã đổi sang tài khoản khác, trả IDENTITY_CHANGED/409 trước mutation. Header không cấp quyền; cookie vẫn là nguồn xác thực. Các client cũ không gửi header vẫn dùng xác thực cookie, nên client tương tác mới cần gửi header để có hàng rào chống màn hình cũ.

Cookie customer không còn hiệu lực sẽ khiến API riêng trả 401 dù trình duyệt còn cookie guest hợp lệ. GET /api/storefront hoặc /api/session xoá cookie account không hợp lệ rồi khởi tạo/khôi phục guest một cách rõ ràng. Chữ ký giỏ bao gồm ID, món, tên snapshot, số lượng, giá và options; đổi tên món cũng yêu cầu xem lại đề xuất.

## Phiếu đơn hàng riêng tư

GET /orders/[orderId]/receipt là trang HTML động, không phải endpoint JSON. Dùng cookie của chủ đơn guest/customer, không cấp quyền bằng orderId hoặc userId từ client. Thiếu phiên, sai chủ hoặc không có đơn trả 404, không hiển thị contact. Phản hồi private/no-store và robots noindex/nofollow.

Phiếu dùng tên món, đơn giá, số lượng, phí/tổng đã chụp trong đơn; trạng thái là lúc mở trang. Ghi chú được React escape. Nút In / Lưu PDF gọi hộp thoại in của trình duyệt; khách chọn máy in hoặc Save as PDF. Không phát hành hoá đơn VAT, không xác nhận thu tiền và không tự gửi phiếu ra ngoài. Phiếu có thông tin liên hệ nên người dùng cần cân nhắc nơi in/chia sẻ.


Sổ địa chỉ: GET/POST/PATCH/DELETE /api/account/addresses dành cho customer, revision chống ghi đè, tối đa 5. Chi tiết schema và mã lỗi trong [accounts-and-admin-api.md](accounts-and-admin-api.md#sổ-địa-chỉ-khách-hàng). Storefront snapshot thêm addressBook (guest null).

Khuyến mãi: GET/POST/PATCH /api/admin/promotions (staff); POST /api/checkout/quote (guest/customer). Checkout nhận promotionCode + promotionRevision tùy chọn. [Chi tiết](accounts-and-admin-api.md#khuyến-mãi-và-báo-giá-checkout).

Đặt lại: POST /api/orders/reorder nhận orderId để xem trước; PUT nhận confirmationToken và confirm=true để thêm lại vào giỏ trống. Cả hai yêu cầu phiên guest/customer, strict body và owner header như các mutation khác. [Chi tiết](accounts-and-admin-api.md#đặt-lại-đơn).

GET /api/admin/sales (staff) cung cấp top món/đối soát với filter và optional basisRevision để khớp cửa sổ dashboard. [Chi tiết](accounts-and-admin-api.md#món-bán-chạy-và-đối-soát).


## Kiểm tra kết quả checkout sau mất phản hồi

POST `/api/checkout/status` nhận strict JSON `{ idempotencyKey: UUID, cartId: string }`, yêu cầu phiên khách hiện hành, cùng origin và header X-KFC-Owner khi giao diện có owner. Trả200 `{ order: OrderDetail | null }`; chỉ có order khi key + cartId thuộc owner. Key sai, cart sai hoặc owner khác đều trả null, không lộ sự tồn tại của đơn. 400 với schema sai,401 khi chưa có phiên,409 khi owner hiển thị khác cookie,403 khác origin,405 cho GET. Response private/no-store.

Endpoint chỉ đọc dưới cùng customer lock với checkout; không tạo đơn/giỏ/event hoặc xác nhận proposal. Trong bản local một tiến trình, lookup chờ checkout cùng owner đang giữ lock hoàn tất. Null là trạng thái tại lúc đọc, không phải cam kết cho mọi request tương lai hoặc concurrency phân tán.

Giao diện tự tra cứu sau lỗi mạng/timeout/non-JSON/5xx hoặc IDEMPOTENCY_CONFLICT. Nếu tìm thấy sẽ mở chi tiết và thông báo đơn từ yêu cầu trước đã được lưu. Nếu chưa tra cứu được, nút “Kiểm tra đơn vừa gửi” cho phép kiểm tra lại mà không gửi POST tạo đơn. Request key chỉ ở memory của tab; sau reload người dùng xem lịch sử riêng.


## Lý do huỷ đơn của quản trị

PATCH /api/admin/orders khi nextStatus=CANCELLED bắt buộc cancellationReason trim từ5 đến300 ký tự. Đây là lý do công khai cho chủ đơn; được lưu trong metadata.cancellationReason của event CANCELLED cùng actor=admin/previousStatus, trong cùng commit chuyển trạng thái. Schema strict, chỉ cho reason với CANCELLED; request sai trả400. Chỉ CONFIRMED được huỷ như workflow hiện hành.

Retry cùng orderId/expectedStatus/nextStatus/reason trả lại detail mà không thêm event. Nếu đơn đã bị khách huỷ, expectedStatus khác, hoặc lý do khác sau commit thì409 ORDER_CONFLICT; không sửa lý do lịch sử. Chủ đơn đọc lý do qua detail riêng, quản trị qua detail staff. Không đưa lý do vào CSV báo cáo. Đơn huỷ lịch sử thiếu lý do vẫn đọc được, không bịa hoặc backfill reason.

Staff auth được kiểm tra sau admin lock và kiểm tra lại sau customer lock ngay trước bắt đầu transition; request bị revoke trong lúc chờ thì401/no-store và không ghi. Không cam kết huỷ request đã bắt đầu thực thi hoặc thu hồi phân tán.


## Bảng bếp — GET /api/admin/kitchen

Staff cookie bắt buộc; response private/no-store. Query duy nhất fulfillment=all|pickup|delivery (mặc địnhall); unknown/duplicate/value sai400. GET chỉ đọc, POST405. Trả generatedAt, sampleLimit200, sampledOrders, fulfillment, matchedActiveOrders/excludedActiveOrders, counts theo4 trạng thái, cards và preparation.

Card allowlist: id/status/fulfillment/createdAt/updatedAt/note/items. Item chỉ menuItemId/name snapshot/quantity. Không gửi trường contact/currency/giá; note vẫn là dữ liệu riêng cho staff. Cards sort createdAt rồi id tăng dần. Preparation chỉ CONFIRMED/PREPARING, gồm menuItemId/name/waiting/preparing/total, sort total giảm rồiid; tên là snapshot gần nhất trong các thẻ cần chuẩn bị. Không dùng current menu.

Đơn có details thiếu/sai/duplicateSKU/options không hỗ trợ/date/lane sai bị exclude khỏi board và đếm cảnh báo. Detail fetch theo batch8, giới hạn nguồn200. completed/cancelled không lên bảng. Board là snapshot đọc, có thể thay đổi ngay sau đó; PATCH /api/admin/orders luôn kiểm tra expectedStatus và staff auth sau các lock, không tin trạng thái hiển thị. Không thêm endpoint ghi hoặc trường persistence cho FR33.


## Cấu hình cửa hàng và tiếp nhận đơn

GET /api/shop công khai/no-store, không tạo guest cookie, trả configured/settings/availability. Settings chỉ là dữ liệu công khai; không nhập secret hoặc ghi chú nội bộ. Availability có open/canPickup/canDelivery/message/checkedAt. Khách vẫn phải kiểm tra điều kiện server tại checkout.

GET/PATCH /api/admin/shop cần staff cookie và same-origin khi ghi. PATCH strict full fields+revision (default hoặcUUID), không nhận updatedAt từ client. Revision sai409 SHOP_CHANGED; schema sai400. Lịch đủ7day0–6, HH:mm trongngày, close24:00 được phép, không overnight. Body có name/address/phone/announcement/acceptingOrders/pickupEnabled/deliveryEnabled/deliveryFee/minimumSubtotal/scheduleEnabled/hours. CAS lưuUUIDrevision mới; reauth sau acceptance gate trước ghi.

POST orders/checkout quote thêm shopRevision optional cho legacy default. Khi đã cấu hình, bắt buộc khớp revision hiện hành; thiếu/cũ409 SHOP_CHANGED. Default chưa lưu vẫn chấp nhận API legacy không gửi revision. SHOP_CLOSED409 cho pause/outsidehours/channeloff, MINIMUM_ORDER400 tính tiền món trước giảm/phí. Delivery fee tính từ cấu hình; pickup0. Quote và checkout đều kiểm tra, checkout kiểm lại ngay trước commit. Lỗi trước commit giữ giỏ/request key dùng được sau khi sửa điều kiện.

Local gate tuần tự hoá save settings và checkout. Quyền customer/staff được kiểm tra sau chờ gate; không cam kết huỷ request đã bắt đầu hoặc transaction phân tán. Replay đơn đã commit không bị đóng cửa/revision mới làm thay đổi; hash request có shopRevision khi được gửi. Order store chỉ snapshot name/address/phone/revision công khai, receipt và detail dùng snapshot này. Không backfill location cho order legacy thiếu store.


## Đánh giá riêng và phản hồi cửa hàng

GET /api/orders/feedback?orderId=... yêu cầu customer cookie và đúng chủ, no-store; trả {eligible,feedback}. Chỉ chấp nhận một query orderId hợp lệ, unknown/duplicate400, owner khác404, không có phiên401. POST cùng route strict {orderId,rating1..5,comment0..1000,revision?UUID}; comment trim/defaultempty. Chỉ COMPLETED, chưa đủ điều kiện409 FEEDBACK_NOT_READY. Create không revision, edit khớp current revision;409 FEEDBACK_CHANGED nếu stale, FEEDBACK_LOCKED sau reply. Nội dung trùng current được replay an toàn, kể cả reply vừa xuất hiện.

GET /api/admin/feedback?rating=all|1..5&response=all|pending|replied staff-only/private/no-store, unknown/duplicate400. Source200 feedback cập nhật gần nhất, sampledFeedbacks/matchedFeedbacks/unanswered/averageRating (null khiempty) và entries {orderId,fulfillment,feedback}; không đưa contact/amount. Comment vẫn là dữ liệu riêng có thể chứa thông tin khách tự nhập. Tất cả summary theo bộ lọc hiện tại, không phải rating công khai/toàn lịch sử.

POST /api/admin/feedback strict {orderId,revisionUUID,message5..1000}, staff+owner lock+reauth. Khách sửa trước reply thì409; chưa cófeedback404. Một reply immutable, exact same message retry trả record; khác text FEEDBACK_REPLIED409. Reply commit đổi revision, đóng edit phía khách. API chỉ ghi feedback/updatedAt, không OrderEvent trạng thái, không đổi total/items. Same-origin guard khi ghi, không auto retry mutation.

Local feedback nằm trong Order.feedback nên snapshot/backup cũ không cần map mới. Dynamo adapter có ADMIN#FEEDBACK pointer theo timestamp/order/revision, transaction conditional metadata+index replacement, chưa có live AWS acceptance; list theo feedback time để đơn cũ không bị bỏ khỏi hộp thư chỉ vì date đặt cũ.

## Điều kiện sửa giỏ theo nội dung đã xem — FR36

POST/PATCH/DELETE /api/cart nhận header X-KFC-Cart-Signature. Dùng signature từ GET /api/cart hoặc storefront; chỉ dùng literal empty khi cart=null, không dùng cho một giỏ ACTIVE có0 dòng. Header sai định dạng trả400 INVALID_CART_SNAPSHOT; nội dung hiện tại khác trả409 CART_CHANGED trước mutation. Giao diện hiện tại luôn gửi header, tải giỏ mới khi409 và không tự retry. X-KFC-Owner/cookie/origin vẫn được kiểm tra độc lập; hash không cấp quyền.

Header optional để tương thích client cũ, vì vậy client bỏ header không có bảo đảm chặn thao tác theo snapshot UI. Cart.revision là CAS nội bộ repository, có thể thiếu trong snapshot legacy và được bổ sung khi ghi; không dùng revision thay cho cartSignature của checkout. Giá/tên đổi có thể được reprice nguyên tử khi đọc; request mang signature trước đổi giá bị409. Mất response không chứng minh thất bại: đọc lại giỏ trước khi phát sinh ý định mới. Đây không phải idempotency key cho mọi lần thêm món.
