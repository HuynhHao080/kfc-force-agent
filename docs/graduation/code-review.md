# Review và sửa lỗi trước bảo vệ — 2026-11-06

Phạm vi: review thủ công các route account/admin/cart/chat/order, service, policy/tool, repository local/mock và các nhánh lỗi giao diện. Đây là review có trọng tâm, không phải pentest độc lập hay chứng nhận toàn bộ repository không có lỗi. Working tree bao gồm các thay đổi tích luỹ từ các đợt hoàn thiện trước.

## Các lỗi đã xác nhận và sửa

### R01 — P1: xác nhận món mới không ràng buộc giá đã xem

Ở agent-core, đề xuất trước đây chỉ lưu chữ ký giỏ. Khi món được thêm chưa có trong giỏ, đặc biệt khi chưa có giỏ, thay đổi giá menu không đổi chữ ký này. Nhấn xác nhận vẫn thêm món với giá mới dù bản xem trước chứa giá cũ.

Sửa tại [agent-core.ts](../../src/lib/agent/agent-core.ts): lưu thêm pendingMenuSignature từ ID, tên, giá, cờ hiển thị/còn món của các sản phẩm được đề xuất thêm; kiểm tra lại trước khi thực thi. Đề xuất cũ không có chữ ký mới bị vô hiệu và khách phải tạo lại. Không thực hiện lại mutation tự động.

Ca hồi quy mới tái hiện lỗi trên mã trước sửa bằng assertion execution.length = 0 nhưng thực tế là 1. Sau sửa, đổi giá hoặc tên món khi giỏ chưa tồn tại không tạo cart/mutation.

### R02 — P2: JSON mô hình hợp lệ vẫn có thể thông báo thành công sai

Bedrock provider đã có fallback cho văn bản tự do nhưng vẫn chấp nhận JSON hợp schema với actions rỗng hoặc chỉ UNKNOWN và message khẳng định đã thanh toán/đặt đơn. Schema đúng không chứng minh kết quả nghiệp vụ.

Sửa tại [bedrock-llm-provider.ts](../../src/lib/agent/providers/bedrock-llm-provider.ts): khi không có hành động được hỗ trợ, chỉ trả lời làm rõ bằng mẫu cố định, actions rỗng, không yêu cầu xác nhận. Khi có hành động, phản hồi nghiệp vụ vẫn được ghép từ policy/tool. Đổi lại, lời chào tự do từ provider Bedrock cũng dùng lời làm rõ; mock giữ các câu chào được hỗ trợ.

Ca hồi quy dùng transport giả đã thất bại trước sửa vì message chứa “thành công”; sau sửa không còn câu khẳng định đó. Không gọi AWS.

### R03 — P2: giới hạn body được kiểm tra sau khi đã đọc toàn bộ

readJson trước đây dùng request.text rồi so độ dài chuỗi. Body lớn đã được gom vào bộ nhớ trước khi bị chặn; giới hạn cũng đếm ký tự thay vì byte UTF-8.

Sửa tại [bounded-json.ts](../../src/lib/server/bounded-json.ts) và [api.ts](../../src/lib/server/api.ts): giới hạn 16.000 byte, chặn Content-Length vượt giới hạn, đếm từng chunk và huỷ reader khi vượt ngưỡng, decode UTF-8 nghiêm ngặt rồi parse JSON.

Kiểm tra: body đúng ngưỡng vẫn đọc được; Unicode vượt byte bị 413; stream không kết thúc được huỷ sau chunk vượt ngưỡng; UTF-8 sai và JSON có phần dư bị 400. HTTP xác minh cả Unicode và body không khai Content-Length, không tạo giỏ.

### R04 — P2: dữ liệu giao diện cũ còn sau đổi tài khoản nếu refresh lỗi

Logout thành công trước đây chỉ xoá chi tiết đơn được chọn, sau đó chờ refresh để thay profile, giỏ, hội thoại và lịch sử. Nếu refresh lỗi, dữ liệu tài khoản cũ vẫn hiện trên màn hình. Login thành công nhưng refresh lỗi cũng có thể giữ dialog để người dùng gửi lại form.

Sửa tại [storefront.tsx](../../src/components/storefront/storefront.tsx): xoá dữ liệu theo danh tính ngay sau phản hồi auth thành công, vô hiệu thao tác đến khi nạp xong, đóng form login đã thành công và báo lỗi tải dữ liệu riêng. Số thứ tự refresh chặn phản hồi cũ khôi phục state sau đổi phiên.

### R05 — P2: lưu quản trị thành công nhưng báo như lưu thất bại

Sau POST/PATCH, giao diện chờ cả refresh trước khi đóng editor hoặc phát thông báo đồng bộ. Nếu GET tiếp theo lỗi mạng, form vẫn mở và hiện lỗi lưu dù mutation đã commit; tab khách cũng chưa nhận thông báo.

Sửa tại [admin-console.tsx](../../src/components/admin/admin-console.tsx): ghi nhận commit, đóng editor và báo đồng bộ ngay khi mutation thành công. Lỗi tải danh sách được trình bày riêng với hướng dẫn làm mới. Lỗi 401 trong lưu menu xoá state quản trị và đóng editor.

## Review bổ sung: phiên hiển thị và đồng bộ

- **R06/P2 — Account bị thu hồi rơi về guest cũ:** readCustomer trước đây ưu tiên account nhưng fallback sang guest khi account không hợp lệ. Request từ màn hình account cũ có thể thay đổi giỏ guest. Đã chặn fallback khi còn cookie account; bootstrap xoá cookie không hợp lệ và trả một snapshot owner rõ ràng. HTTP kiểm tra kết hợp cookie account đã thu hồi + guest hợp lệ không làm đổi giỏ.
- **R07/P2 — Màn hình A/cookie B:** giỏ, session và lịch sử lấy bằng các request khác nhau; thao tác không chỉ ra owner mà người dùng đang xem. Đã thêm snapshot thống nhất và X-KFC-Owner kiểm tra với cookie trước thực thi. UI không retry mutation khi phiên đổi, xoá state cũ rồi đọc lại. Browser đã dựng cookie B khi màn hình A còn mở để kiểm tra.
- **R08/P2 — Headers bị mất:** helper api trải Headers object thành object thường nên các header động không được gửi đúng. Đã dùng new Headers và giữ code lỗi có cấu trúc; unit kiểm tra header owner và IDENTITY_CHANGED.
- **R09/P2 — Đổi tên món đang trong giỏ không vô hiệu preview quantity:** chữ ký chỉ có ID/quantity/price. Đã thêm nameSnapshot/options vào chữ ký; unit kiểm tra xác nhận không thực thi khi món đổi tên.
- **Vận hành:** admin refresh cập nhật cả selected detail, bỏ qua response cũ, có polling 15 giây/Broadcast/focus và xoá private state khi 401. Không gọi đây là realtime đa thiết bị được bảo đảm SLA.

Bảng nghiệm thu bản local tại [acceptance-checklist.md](acceptance-checklist.md). Các giới hạn phía dưới vẫn áp dụng; review có trọng tâm không phải tuyên bố mọi dòng mã đã được audit độc lập.

## Kiểm chứng và giới hạn

Đợt đầu có 31 nhóm nghiệp vụ và 25 nhóm HTTP; bản hiện hành sau các đợt mở rộng có 40 nhóm nghiệp vụ/provider/client helper và 37 nhóm HTTP. Chi tiết mới nhất tại output/verification/check.log và docs/verification.md.
- Browser fault injection cho R04/R05 được ghi bổ sung tại [verification.md](../verification.md).
- Review React kiểm tra dependency của hook, ref cho thứ tự response, trạng thái khoá thao tác, nhãn lỗi và dialog. Không thêm thư viện hoặc thay đổi dependency.
- Dữ liệu local chỉ phù hợp một tiến trình; chưa có kiểm chứng crash/power-loss, nhiều instance hoặc database phân tán.
- Limiter đăng nhập đang dùng budget toàn cục theo vai trò; cần thiết kế limiter phân tán và chống khoá dịch vụ trước khi phục vụ công khai.
- DynamoDB/Bedrock thật chưa chạy; cần kiểm tra pagination/consistency, transaction và acceptance riêng trước khi dùng cloud. Chưa có email recovery, thanh toán hoặc giao vận thật.
- Dataset parser không thay đổi trong đợt review này; không suy ra chất lượng LLM hoặc mức an toàn hệ thống từ số đo parser.

## Review bổ sung — sổ địa chỉ

Đã bổ sung kiểm tra owner và session sau khi lấy khoá, schema strict, tối đa 5, mặc định duy nhất, compare-and-set tại repository và revision trên UI. Không tự retry mutation bị conflict. Thông tin đơn đã đặt là snapshot độc lập. Điểm còn giới hạn: địa chỉ tự khai báo, chưa có kiểm tra vùng giao; adapter Dynamo chưa có nghiệm thu AWS; local chỉ một tiến trình.

## Review trước báo cáo — 07/11/2026

**P2 — mutation bị chặn nhầm khi truy cập bằng IP loopback.** assertSameOrigin so Origin với request.url.origin. Trong production Next hiện tại, URL nội bộ có thể chuẩn hoá host thành localhost dù trình duyệt truy cập 127.0.0.1. Đã tái hiện POST /api/chat nhận 403 ở 127.0.0.1, trong khi GET trang và health vẫn thành công.

Sửa: so Origin với protocol của URL + Host thực của request, fallback URL khi không có Host; không dùng X-Forwarded-Host. Vẫn từ chối sec-fetch-site=cross-site. HTTP regression trên 127.0.0.1 xác nhận cùng origin qua bước origin đến validation 400, origin localhost khác host bị 403, forwarded-host giả bị 403 và cross-site vẫn 403. Browser đặt đơn demo qua địa chỉ 127.0.0.1 đã thành công. Đây không phải cấu hình reverse proxy/TLS ngoài local; cần kiểm tra riêng trước triển khai.

## Review FR28 — khuyến mãi

Rà các biên: adminApi và quote customerApi giữ ownership/origin; body strict; code normalize; revision CAS tại repository chống mất cập nhật. Checkout tính lại subtotal từ menu và discount từ cấu hình, từ chối giá hoặc revision không còn đúng. Snapshot order và retry không phụ thuộc cấu hình mã sau đó. Mã không hard-delete, không thay contact/giá đơn cũ.

UI không cho gửi đơn với mã đã nhập nhưng chưa áp; thay mức giảm hoặc revision làm mất checkbox xác nhận. Báo giá mới xoá thông báo checkout cũ; lưu admin thất bại tập trung focus vào lỗi. Pattern HTML của code dùng alternation dấu gạch ngang để hợp chế độ Unicode v của browser; server vẫn regex strict. CSV chỉ thêm discount numeric.

Phạm vi còn lại: mã dùng lại được, không quota/reservation/stacking. Không có khóa xuyên bước đọc coupon/commit checkout; hiệu lực tại bước service kiểm tra, thay đổi đồng thời sau bước đó chưa có transaction guard phân tán. Max 200 mã được tuần tự hoá trên admin local, chưa nghiệm thu nhiều instance. Adapter Dynamo có conditional Put nhưng chưa nghiệm thu cloud. Nhật ký catalog hiện không ghi thay đổi coupon.

## Review FR29/FR30 — đặt lại và lọc lịch sử

Kiểm tra token ký tách domain, owner cookie/header, strict schema và nguồn order đúng chủ trước khi trả món. Không nhận giá/qty/items từ body confirm. Source/menu signature kiểm tra lại, món không còn bán/tuỳ chọn/dòng trùng bị từ chối trước ghi. Giỏ không trống được giữ món; chỉ empty base cart cùng ID được thay bằng cart mới.

completeReorder local lưu cart/items/base status trong một snapshot và rollback lỗi. Cart ID xác định theo operation UUID nên lost response/retry không nhân đôi; replay giữ quantity đã sửa sau đó, không invalidate proposal mới và không reopen cart đã checkout. UI diễn đạt replay là yêu cầu đã xử lý, không khẳng định thêm món lần nữa. Modal stale error được focus, không auto retry; closing preview không ghi. Lọc lịch sử dùng filterOrders chung, ẩn chi tiết ngoài bộ lọc; khi đổi identity tab bị clear/unmount nên không giữ query riêng của owner trước.

Giới hạn: empty cart only, standard items 1–100 và tối đa 50 dòng. Không merge giỏ/options tuỳ biến. Không mã hoá token; HMAC + expiry không thay thế customer auth. Token cũ hết hạn hoặc signing key đổi thì không dùng để retry. Adapter Dynamo có transaction nhưng các mutation cart khác chưa có đủ distributed CAS; chưa có cloud acceptance.

## Review FR31 — phạm vi xoá và số lượng

P2 — đề xuất sai phạm vi xoá: trước đây điều kiện CLEAR_CART coi từ trong là đủ, nên “Xoá Pepsi trong giỏ hàng” có thể tạo đề xuất xoá mọi món. Khách vẫn cần xác nhận nhưng phạm vi đề xuất sai. Đã thay bằng grammar scope toàn giỏ rõ ràng; kiểm tra service và HTTP xác nhận xoá Pepsi không xoá dòng khác.

Số chữ trước đây không được tách, có thể rơi về quantity1. Lexical helper mới bảo vệ dung tích, đọc cụm số chữ/Arabic theo vị trí, không chọn số đầu nếu có nhiều số, không làm tròn số lẻ hoặc hiểu 1.000 thành1. Named product có dấu như nấm giữ query; từ không dấu đa nghĩa có thể yêu cầu làm rõ. Numeric unsupported/reserved marker bị hỏi lại. Policy vẫn chịu trách nhiệm giới hạn1–100 và catalog/owner; parser không đọc/ghi giỏ hoặc tự xác nhận.

Phạm vi: grammar rule-based, không phân tích tự do mọi câu tiếng Việt; nhiều món/lệnh và delta relative chưa hỗ trợ, không suy ra ưu đãi/đơn/tiền. Prompt canonical bổ sung quy tắc nhưng chưa có nghiệm thu Bedrock thật. Giữ dataset cũ/baseline và làm rõ kết quả phát triển, không báo98% như độ chính xác người dùng.

## Review FR32 — reporting và reauth sau chờ

Không cộng đơn active/cancelled hoặc menu price hiện tại vào item sales. Check order/item/currency/integer/reconciliation trước aggregate; invalid completed được excluded và thông báo. Revision bảo vệ window dashboard khác sales khi có record mới. Dữ liệu/filter đổi ẩn stale rows/export ngay; response cũ bị bỏ, 401 clear private view. CSV product-name là text có thể nhập bởi admin nên strip Cc/Cf và prefix formula chars trước quote escaping; không đưa contact/query vào CSV.

P2 — staff auth chỉ được kiểm tra trước khi chờ admin lock: logout trong lúc queued vẫn có thể để request cũ gọi operation. Đã kiểm tra lại adminAuthenticated sau lock, khớp cách accountApi reauth. Unit giữ lock/đổi auth-state rồi nhả lock:401 và operation không chạy; HTTP suite cũ/mới vẫn bảo vệ role/revoke. Không tuyên bố dừng request đã thực thi hoặc distributed revoke.

Giới hạn: chỉ200 gần nhất, top10, ngày đặt, completed hợp lệ. Không margin, refund, payment accounting hay item-level net allocation. Adapter/repo cloud chưa nghiệm thu. Invalid records bị loại tạo khác biệt với dashboard tổng nếu dữ liệu hỏng; UI nêu rõ count bị loại.


## Chốt local — retry checkout và gói bàn giao, 07/11/2026

**P2 đã sửa:** checkout trước đây trả đơn theo owner + idempotencyKey mà không so nội dung. Sau khi mất response, khách thay phone/địa chỉ/note/tổng tiền rồi gửi cùng key có thể nhận đơn cũ như thể thay đổi đã được chấp nhận. Không tạo đơn trùng, nhưng phản hồi thành công gây hiểu sai thông tin đã lưu.

Checkout hiện lưu SHA-256 request chuẩn hoá trên cart CHECKED_OUT trong cùng commit order/items/event. Retry cùng nội dung trả đơn đã tạo kể cả menu/coupon thay đổi sau đó. Retry khác nội dung trả IDEMPOTENCY_CONFLICT/409, không ghi lại đơn hoặc đổi key tự động. Lỗi kiểm tra trước khi commit không chiếm key, nên chỉnh đúng request vẫn gửi được. Snapshot cũ thiếu hash so các trường recoverable từ order; không đối chiếu được signature giỏ gốc của snapshot cũ. Hash nội bộ không thêm vào Order DTO.

Một nhóm unit kiểm tra replay, thay từng contact/fulfillment/cart/signature/total/coupon và legacy snapshot; một nhóm HTTP kiểm tra 409/code, retry đúng vẫn cùng ID và chỉ một order. Các ca coupon retry cũ và local restore vẫn qua.

Chốt phạm vi FR01–FR32 local theo lựa chọn người dùng trong [hồ sơ bàn giao](local-release-scope.md). Thêm verifier ZIP đọc-only: outer SHA256, manifest/file hash/size, duplicate/unlisted/unsafe/runtime paths, source hiện hành khi có --current và evaluation provenance. Ba test synthetic kiểm tra tamper, private/traversal/unlisted path, sidecar sai và log thiếu kết quả. Đây không phải secret-content scanner hoặc chứng thực độc lập.

Kết quả hiện hành: npm run check qua lint/typecheck/build, 64 nghiệp vụ + 8 backup/recovery + 59 HTTP =131 nhóm; npm run test:submission qua3 test. Evaluate giữ49/50 intent/joint trên dataset phát triển; audit production dependency không phát hiện vulnerability. Doctor7/7, store preview byte-identical trước/sau probe. ZIP và sidecar .verified.json ghi kết quả đối chiếu cụ thể; không suy ra production readiness.


## Checkout recovery và xác nhận theo giỏ — 07/11/2026

**P2 đã sửa:** mất response sau khi lưu checkout chỉ hiện lỗi và refresh giỏ; khi giỏ đã đóng, modal có thể còn mở với giỏ trống và chưa dẫn đến đơn vừa lưu. Thêm POST /api/checkout/status chỉ đọc dưới customer lock, tìm theo owner + key + cartId; không tạo order/cart/event. Frontend tự kiểm tra sau lỗi mạng/non-JSON/5xx hoặc idempotency conflict, mở đúng chi tiết và thông báo thông tin đã lưu. Nếu tra cứu cũng lỗi, nút kiểm tra lại không gửi checkout. Phiên đổi401/owner409 thì clear private state. Không tự gửi lại lệnh tạo đơn.

**P2 đã sửa:** checkbox trước đây gắn total/fulfillment/promotion revision, nên giỏ đổi nhưng tổng giữ nguyên vẫn giữ tick. Promotion quote cũng chưa ràng buộc signature giỏ. Nay quote gắn cartId/signature; giỏ đổi làm quote mất hiệu lực, giữ contact/code để áp lại; checkbox gắn thêm context giỏ. Server vẫn kiểm tra signature/giá/coupon như trước. Khi giỏ hiện tại trống sau lỗi, UI nêu rõ cần kiểm tra kết quả, khoá form và không trình bày tổng0 như giá trị đơn đã lưu.

Một unit mới kiểm tra status lookup owner/key/cart và dữ liệu không thay đổi; hai HTTP mới kiểm tra auth/schema/unknown fields/origin/no-store/405/null/recovery/wrong-owner/wrong-cart. Bộ chính hiện65+8+61=134 nhóm; các test verifier ZIP riêng3 nhóm. Browser fault injection dùng dữ liệu giả trong .local/checkout-review-20261107 tại3101, tách dữ liệu preview. Ảnh và kết quả chi tiết nằm trong verification.

Giới hạn: request key chỉ nằm trong memory tab, reload thì xem lịch sử; lookup null phản ánh lúc đọc. Customer lock là một tiến trình, không chứng minh phân tán hoặc provider acceptance. Recovery hiển thị snapshot đơn đã lưu từ yêu cầu trước, không coi thông tin khách sửa sau commit là đã cập nhật.


## FR13 — huỷ có lý do và reauth sau customer lock, 07/11/2026

**P2 đã sửa:** adminApi đã kiểm tra session sau admin lock nhưng route đổi trạng thái còn chờ thêm customer lock. Logout/revoke trong lúc chờ lock thứ hai có thể để thao tác tiếp tục. Route nay gọi requireAdminSession sau khi lấy customer lock, trước khi bắt đầu transition. Unit dùng route PATCH/lock thật, auth-state stub: giữ owner lock, đợi detail được đọc, revoke rồi nhả; response401/no-store, transition không chạy. Không tuyên bố dừng thao tác đã bắt đầu hoặc revoke phân tán.

Bổ sung nghiệp vụ huỷ có lý do: schema strict chỉ nhận cancellationReason khi CANCELLED, trim5–300 ký tự; service cũng bảo vệ khi gọi trực tiếp. Chỉ CONFIRMED được huỷ. Reason lưu trong event metadata cùng chuyển trạng thái atomic, không tạo map/data migration mới. Replay cùng expectedStatus/reason/actor admin trả detail, không thêm event; lý do khác hoặc cancellation do customer trả409, không ghi đè. Đơn lịch sử thiếu reason vẫn đọc được, không backfill dữ liệu giả.

Admin có modal riêng ghi rõ lý do hiển thị cho khách, required checkbox, busy guard, giữ reason khi lỗi mạng, focus error khi conflict. Polling dừng trong modal; snapshot expectedStatus được giữ, không tự chuyển sang trạng thái mới để retry. Đóng/giữ đơn không ghi.401 xoá modal/reason và toàn bộ staff private view. Chủ đơn thấy reason bên dưới event; render như text, long token wrap; CSV vẫn không xuất metadata reason.

Kết quả:68 unit+8 backup/recovery+63 HTTP=139 nhóm chính qua lint/typecheck/build;3 test verifier riêng. HTTP chứng minh validation, auth, duplicate/changed retry, ownership và restart. Browser320px chứng minh close/no mutation, lost response sau commit rồi retry chỉ2 events tổng (CONFIRMED+CANCELLED), reason đến customer, HTML-like text không tạo img DOM và document320/320. Race customer cancel trước staff confirm trả409/focus alert/giữ event actor customer. Thu hồi staff khi modal đang mở trả401, reason biến mất và đơn mới còn CONFIRMED. Bằng chứng ảnh và log trong verification.


## FR33 — bảng điều phối bếp, 07/11/2026

Thêm module điều phối staff dùng order snapshots, không thêm persistence mới. GET /api/admin/kitchen strict filter pickup/delivery/all, no-store và auth/admin lock; source200 đơn, đọc chi tiết active theo batch8. buildKitchenBoard tạo DTO allowlist, bốn lane workflow, old-first, preparation chỉCONFIRMED/PREPARING, tổng hợpSKU theo snapshot và cảnh báo excluded records. Không lộ trường contact/giá; note vẫn là dữ liệu riêng staff, có thể chứa thông tin khách tự nhập.

UI bốn cột/thẻ món/ghi chú/thời gian, mobile xếp dọc. Filter/reload keys không hiển thị data sai context. Poll15 giây khi visible, focus/visibility sync, không chồng request. Active/generation/abort guards bỏ response cũ khi đổi filter hoặc unmount, nhất là sau logout. Mutations qua API workflow hiện có với expectedStatus, không gửi items/price/contact; không có nút huỷ trực tiếp, mở chi tiết để làm đúng luồng có reason. Khi response mutation mất, báo lỗi và tải lại state, không auto retry PATCH. Failure GET bỏ cards cũ để không thao tác trên snapshot lỗi;401 clear staff state.

Logout quản trị nay gọi chung clearStaffView, tăng refresh version và xoá audit/editor/selection/state thay vì chỉ một phần state. Browser giữ một response kitchen200, logout rồi cho response về muộn: không phục hồi bảng private. Request đã bắt đầu ghi vẫn theo phạm vi action/auth được kiểm tra tại server; không tuyên bố dừng mutation đã thực thi.

Bốn unit mới kiểm tra snapshot/privacy fields, malformed exclusions, ordering/aggregation/no mutation và source bound/read active only. Hai HTTP mới kiểm tra auth/cache/schema/405 cùng stage/filter/preparation/restart. Bộ chính72+8+65=145 nhóm;3 verifier riêng. Browser dùng4 fake orders đủ4 lane; completed pickup/delivery đúng event count, summary giảm/empty; giữ response filter cũ không overwrite, lost-response PATCH không retry, lỗi500 có phục hồi,401 và logout/unmount clear. Ảnh desktop/mobile/filter đã mở kiểm tra,320px document320.

Giới hạn: nguồn200 gần nhất, không POS/máy in/bếp vật lý, không inventory/allergen matching, không thời gian phục vụ cam kết, không cloud/multi-instance acceptance. GET là snapshot đọc; state có thể đổi sau đó, expectedStatus và auth server mới quyết định ghi. Đơn invalid bị loại có cảnh báo để kiểm tra ở danh sách đơn, không tự sửa dữ liệu hỏng.


## FR34 — tiếp nhận đơn theo cấu hình cửa hàng, 07/11/2026

Thêm ShopService và map menuRepository.shopSettings optional cho backup cũ. Cấu hình strict/revision CAS, public fields only; lịch đủ7ngày HH:mm cùng ngày/close24:00, UTC+7, opens inclusive/closes exclusive. Default có nhãn demo/địa chỉ chưa cấu hình, fee15.000/minimum0/chưa giới hạn lịch để giữ bản local cũ chạy được. Stored settings sai schema failclosed503, không lặng lẽ fallback open. Dynamo dùng consistent Get/conditional Put cùng pattern repo, chưa có nghiệm thu AWS hoặc lock phân tán.

POST checkout/quote kiểm tra shop revision, availability/channel và tiền món tối thiểu, phí giao server. Checkout mới và settings save cùng SHOP_ORDER_GATE trong tiến trình; kiểm lại điều kiện ngay trước commit. Staff/customer API truyền auth guard sau chờ gate, ngăn request queued tiếp tục sau revoke. Unit dùng gate thật và auth guard-state, không mô tả là browser queued-auth test. Order.store snapshot name/address/phone/revision, fee snapshot sẵn có. Existing committed retry chạy trước check terms, giữ đơn cũ khi đóng cửa; hash chỉ thêm shopRevision khi input có để giữ tương thích hash cũ không gửi trường này.

Storefront snapshot có shop; public GET shop không tạo phiên, không cache. Poll30s/focus/visibility/broadcast khi visible, generation guard ngăn response cũ overwrite shop mới từ snapshot. Lỗi public refresh bỏ shop để không bật checkout theo dữ liệu không kiểm tra được. Checkout context thêm revision/channel, bỏ quote/tick cũ khi điều kiện đổi; contact giữ nguyên. Nếu chỉ delivery, mở checkout đúng chế độ và điền đủ saved recipient/phone/address. Pickup point hiển thị theo cấu hình; customer detail/receipt dùng order snapshot. Shop form không tự refresh đè draft;409 giữ draft/focus alert, reload có nhãn bỏ thay đổi,401 unmount/clear staff.

Kết quả:78unit+8backup/recovery+68HTTP=154 nhóm chính qua lint/typecheck/build;3 verifier riêng.6 unit về schema/time/CAS/corrupt/fees/snapshot/gate/auth;3 HTTP public/noCookie/auth/schema/minimum/channel/pause/replay/schedule/restart/escaped receipt. Backup group recovery mở rộng đọc shop bằng process mới và validate source legacy không có map. Browser hai tab fake cho live fee23→31k/reset checkbox/contact giữ, pause/lịch allclosed, snapshot địa chỉA sau đổiB, delivery-only saved address/minimum/coupon, stale409/reload/401.320px không tràn ở các ca đã ghi.

Giới hạn: single shop/single process, không nhiều chi nhánh, overnight/holiday exceptions, distance shipping, shipping provider hoặc payment. Minimum tính tiền món trước discount/fee. Public settings là nội dung sẽ công bố; không nhập secret. Catalog audit chưa ghi shop settings; revision là chống stale write, không phải audit history/tamper-proof log. Default demo không xác minh địa chỉ/điện thoại nhà hàng thật. Chưa có acceptance cloud hoặc thời điểm biên với nguồn clock độc lập.


## FR35 — đánh giá riêng và trao đổi sau hoàn tất, 07/11/2026

FeedbackService chỉ cho owner của COMPLETED lưu1–5 điểm/comment0–1000, revision CAS, exact payload replay; sửa trước reply, giữ nguyên sau reply. Staff một reply5–1000, stale revision chặn context cũ; exact replay không đổi record, text khác sau publish409. Customer route dùng owner header/lock; staff reply admin→owner lock→reauth. Unit giữ owner lock thật, revoke auth-state trước nhả:401 và reply không chạy. Không gán unit guard-state là live queued-cookie proof.

Order.feedback là metadata, không Map mới, không đổi money/items/status/events; cập nhật Order.updatedAt giúp invalidate source revision khi cần. Local write/rollback theo snapshot hiện có. Hộp thư lấy200 feedback updated gần nhất từ toàn orders, không phải200 order-created gần nhất; unit seed201 đơn mới hơn rồi đánh giá order2020 vẫn thấy. Dynamo pointer ADMIN#FEEDBACK và conditional transaction metadata/index replacement, consistent read và revision guard; chưa có live AWS acceptance.

DTO inbox chỉ orderId/fulfillment/feedback, không contact/amount. Text vẫn riêng tư và có thể chứa thông tin khách tự nhập; không coi là dữ liệu công khai hoặc tuyệt đối không có PII. CSV tài chính vẫn allowlist không có feedback/reply; agent menu/cart retrieval không bổ sung feedback source. Receipt không thêm feedback content. Không có email/SMS/provider calls.

Dialog giữ draft khi lỗi và focus error; customer reload có nhãn bỏ draft, sau reply read-only. Staff polling15s visible/focus, dừng khi soạn, filter keys/abort/active guards chặn stale responses, read failure bỏ reply actions cũ;401 clear. Customer identity change cũng clear dialog và không ghi cho owner mới. UI native radio1–5 hỗ trợ keyboard; không dùng star chỉ có màu.

**P2 đã sửa trong review:** sau customer reload answered feedback trong dialog rồi đóng, selected order ngoài dialog còn bản cũ vì focus event quá sớm bị sync closure của modal bỏ qua. onClose nay gọi refresh trực tiếp. Repro trên build cuối: mở review2chưareply, staff reply khi customer dialog mở, reload read-only rồi đóng; reply hiện ngay ở detail và nút edit biến mất, không cần focus event.

Kết quả cuối84unit+8backup/recovery+71HTTP=163 nhóm qua lint/typecheck/build.6 unit và3 HTTP mới về schemas/ownership/replay/races/old-order inbox/DTO/private/CAS/reauth/restart. Backup group hiện có mở rộng feedback+reply đọc bằng process mới. Browser lost response customer/staff retry giữ cùng revision; stale reply409 giữ draft/focus; sau staff reply customer draft edit bịlocked, reload read-only; filters race/read500 recovery, identity-change/header guard và401 staff.320px document320. Ảnh các giai đoạn có fixture khác nhau, ghi rõ trong verification.

Giới hạn: private one-exchange, không public reviews/multi-round ticket/delete/redaction/attachments hoặc sửa reply đã gửi. Chỉ200 feedback mới nhất và summary theofilter, không thống kê toàn lịch sử hay khảo sát người dùng thực. Không thêm audit history cho mỗi revision, không tuyên bố tamper-proof hoặc cloud/multi-instance readiness.

## FR36 — Giỏ nguyên tử và thao tác từ snapshot cũ, 07/11/2026

**P2 xác nhận và đã sửa:** CartService trước đây lưu dòng món trước rồi mới lưu tổng giỏ. Inject lỗi updateCart trên MockRepository: mutation báo lỗi nhưng còn1 dòng trị giá89.000đ, cart.total vẫn0. output/verification/cart-atomic-before.json ghi source SHA256; hash khớp CartService trong archive bất biến 20261107T114844Z. Đây là repro transport/repository giả, không phải đã phá file preview để quan sát.

Service nay chuẩn bị cả metadata/items trong bộ nhớ, gọi saveCartView đúng một lần. assertCartCommit kiểm tra dòng, quantity1–100, giá/subtotal/tổng, options tiêu chuẩn, tối đa50 và owner/status/revision. Mock dùng CAS; Local Proxy lưu toàn view trong một snapshot/rollback. Không sửa mảng repository trước commit. Tạo giỏ và thêm đầu cùng commit nên lỗi không để lại empty cart. Reprice/name refresh cũng một commit. Snapshot legacy thiếu revision vẫn đọc được, nâng cấp khi ghi. Checkout kiểm tra revision, stale commit không mở lại giỏ đã đóng.

**P2 xác nhận và đã sửa:** nút tăng/giảm từ dữ liệu UI cũ có thể gửi quantity tuyệt đối đè ý định mới. Cart API nay nhận X-KFC-Cart-Signature dưới owner lock; sai snapshot trả409 CART_CHANGED. UI gửi chữ ký đang hiển thị, refresh khi409, không tự retry. Browser giữ UIqty1 rồi direct HTTP sửaqty3 (không Broadcast); bấm tăng theoqty1 trả409 và giữqty3, tiếp tục ý định mới sau refresh thànhqty4. Không mô tả ca này là test hai tab có Broadcast bị tắt.

Mất phản hồi sau first-add commit: browser route.fetch nhận201 rồi abort; UI chưa nhận giỏ mới. Bấm lại vẫn gửi headerempty, trả409, chỉ1 món và revision không đổi. Đổi giá89→90k khi UIqty4: giảm theo giá cũ bị409, reprice giữqty4/tổng360k. Thông báo lỗi mạng/5xx/non-JSON riêng cho thao tác giỏ nêu chưa biết kết quả, yêu cầu tải lại và kiểm tra số lượng trước sửa tiếp. Hash là điều kiện nội dung, không phải khoá idempotency tổng quát; legacy API bỏ header vẫn hoạt động và không có stale-UI guarantee.

Năm unit mới kiểm tra commit boundary/faults, concurrent creator/editor CAS, legacy/invalid/foreign-owner/revision, stale checkout/closed-cart và command contract Dynamo bằng client giả. Một data group mới inject7 lỗi thật trên thư mục synthetic temp, so memory+diskbytes và reprice phục hồi; output/verification/cart-atomic-after.json gắn source hash. Hai HTTP group mới kiểm tra stale operations/malformedheader/concurrent snapshot/replay/owner/restart. Bộ chính89unit+9data+73HTTP=171 nhóm;3 verifier riêng. Lint/typecheck/build qua, audit production dependency0 findings. Browser evidence và tình trạng bản build cuối ghi ở verification.

Dynamo dùng một transaction metadata/pointer/diff items, consistent reads và conditional revision; test không tạo AWS client/network. Primitive repository methods còn cho fixture/nội bộ, không bảo đảm chuỗi primitive atomic. Phạm vi nghiệm thu vẫn local một tiến trình, không cloud/distributed acceptance hoặc chứng minh chống mọi lỗi nguồn điện. Repricing GET có thể ghi giá hiện hành; header409 ngăn thay số lượng nhưng không ngăn việc cập nhật giá hợp lệ.

## Đồng bộ checkout và cập nhật bán hàng — 08/11/2026

P2 đã tái hiện trên mock repository bằng một barrier trong lần kiểm tra điều kiện cuối của CheckoutService. Khi checkout đã đọc món, AdminService.saveMenu đổi isAvailable=false và hoàn tất trước commit đơn. Checkout vẫn trả CONFIRMED. Bằng chứng checkout-catalog-before.json ghi trạng thái cùng SHA256 ba service trước sửa.

AdminService.saveMenu/saveCategory và PromotionService.save nay dùng SHOP_ORDER_GATE chung với checkout và cấu hình cửa hàng. Kiểm tra dữ liệu và ghi catalog/audit nằm trong gate. Checkout bắt đầu trước giữ snapshot đã nhận, cập nhật quản trị chờ đến sau commit. Cập nhật quản trị hoàn tất trước khiến checkout kiểm tra trạng thái, chữ ký và revision mới. Khoá lấy theo customer→gate→disk hoặc admin→gate→disk. Các service gọi trực tiếp vẫn giữ chữ ký hàm cũ, thêm callback optional trước xử lý để route kiểm tra lại quyền sau chờ.

Sáu route POST/PATCH menu/categories/promotions truyền requireAdminSession vào callback. Kiểm thử dùng route và lock thật, stub trạng thái xác thực, thu hồi sau khi service đã chờ gate. Cả sáu trả401/no-store, catalog/audit/promotions giữ nguyên. Checkout đánh giá lại mã ngay sau lần kiểm tra shop cuối, ngăn mã hết hạn trong thời gian xử lý được lưu vào đơn. Request bị từ chối giữ giỏ và request key để khách xem lại hoặc gửi lại ý định hợp lệ.

Năm nhóm unit mới kiểm tra checkout-first với ba cập nhật đang chờ, catalog-first với hết món/đổi giá và khôi phục cùng key, sáu route queued-auth, expiry đúng biên bằng clock stub, và ba lỗi repository giải phóng gate. checkout-catalog-after.json ghi source hash cùng các assertion tổng hợp. Khoá là cơ chế của bản local một tiến trình. Các primitive repository ghi trực tiếp dành cho nội bộ tin cậy, nguồn dữ liệu ngoài tiến trình cần transaction/conditional checks riêng. Giá trị quote có thể đổi trước checkout, server vẫn kiểm tra lại lúc nhận đơn.

Kết quả cuối94unit+9data+73HTTP=176 nhóm qua lint/typecheck/build.3 test công cụ gói nộp qua và audit production dependency0 findings. Browser coupon đổi10k→20k bị400, áp lại quote reset checkbox và accepted69k. Hết món bị400, accepted retry/snapshot giữ69k/20k/89k.320px không tràn. Code-review đề cập phạm vi local đã chọn, các ca clock/auth có stub được ghi rõ trong testing.

## Form catalog và cập nhật từ nhiều tab — 08/11/2026

P2 đã tái hiện bằng MockMenuRepository/AdminService. Hai form cùng snapshot ban đầu89k, lần đầu lưu99k, lần sau chỉ sửa mô tả nhưng gửi giá89k làm giá quay lại89k. catalog-editor-before.json ghi kết quả và SHA256 AdminService trước sửa.

Admin catalog DTO thêm catalogRevision tính từ ID/timestamps/trường editable, dữ liệu lưu giữ schema cũ. PATCH nhận optionalheader X-KFC-Catalog-Revision. Service so phiên bản trong acceptance gate sau callback kiểm tra auth, stale payload khác record trả409 CATALOG_CHANGED trước lưu/audit. Exact content replay trả previous, giữ updatedAt/audit. Client cũ không header tiếp tục hành vi cũ, UI mới luôn gửi header. Revision không phải credential hoặc distributed repository CAS.

MenuEditor/CategoryEditor giữ bản nháp khi save/read lỗi, error được focus, nút tải lại ghi rõ bỏ draft. AdminConsole fetch catalog rồi remount bằng version/resetKey khi thành công, resetKey xử lý cả trường hợp server chưa đổi version. Read response có generation guard,401 clear form/private view. Type DTO riêng để catalogRevision không bị đưa vào records. Đổi giá/ảnh ở menu legacy vẫn qua cùng validation và nhật ký hiện có.

Ba unit mới kiểm hash/DTO isolation/legacy, concurrent menu/category one winner/exact replay/audit, malformedheader và failedwrite retry giữversion. Hai HTTP mới kiểm stale/crossentity/header/schema/exactretry/legacy callers cùng restart/readonly bytes/khôngpersist token. Lần HTTP đầu quên đăng nhập staff lại sau restart, response401 khiến helper đọc thiếu data, đã sửa fixture reauth và chạy lại75HTTP thành công.

Browser review còn tìm thấy mobile320 có document365 vì tám nút nav giữ một hàng. CSS dưới720px chuyển nav thành grid4cột, hai hàng, nút cao tối thiểu44px. Bằng chứng UI và số đo bản build cuối ghi tại verification.

Kết quả cuối181 nhóm chính,3 verifier riêng, audit productiondeps0. Browser trên hai tab thật kiểm menu99k/stale89k409, draft/focus/reloadfailure/reloadsuccess và lost-ack exact retry chỉ1audit. Category kiểmstale409, reload cùng revision bỏ draft và401xoáform. Source trước sửa khớp archive20261107T183157Z, source sau sửa khớp proof và checkout hiện hành. Mobile grid đo320/390/430/720/768/1440 không tràn. Token optional cho API cũ và gate local một tiến trình được giữ trong phạm vi nghiệm thu.
