# Kiểm thử, đánh giá và truy vết

## Tái lập

```powershell
npm ci
npm run check
npm run evaluate:report
npm audit --omit=dev
```

Check chạy lint, TypeScript, 97 test nghiệp vụ/provider/client helper, 9 nhóm backup/recovery, build và 75 nhóm HTTP. HTTP mở server 3197 với thư mục tạm và mật khẩu quản trị ngẫu nhiên, không dùng dữ liệu đang vận hành. Script có restart để kiểm tra persistence. Cần cổng 3197 trống.

## Ma trận

| Yêu cầu | Tự động                                                                 | Trình duyệt                       |
| ------- | ----------------------------------------------------------------------- | --------------------------------- |
| FR01–03 | Menu visibility, giá server, giới hạn/gộp dòng, qty sai                 | Tìm, thêm/sửa/xoá, responsive     |
| FR04–06 | Intent, update, negation/partial remove, stale UUID, TTL, signature     | Preview, hai tab, xác nhận/bỏ qua |
| FR07–08 | Contact/giá/signature sai, items, retry                                 | Pickup/delivery, checkbox, tổng   |
| FR09–10 | Ownership, huỷ idempotent, race với chuẩn bị                            | Lịch sử, chi tiết, event          |
| FR11    | Register, email trùng, mật khẩu sai, profile không hash, revoke/restart | Account dialog                    |
| FR12    | Guest/customer/forged bị chặn; origin, rate limit, revoke               | Admin login/logout                |
| FR13    | Chặn bước, READY/DELIVERING, terminal, event                            | Xử lý đơn; khách xem lại          |
| FR14    | CRUD/ẩn, giá/ảnh sai, reprice, snapshot cũ                              | Menu editor                       |
| FR15    | Counts/value khớp records                                               | Dashboard, ngày, CSV              |
| FR16    | Restart, HTML/network/timeout                                           | Làm mới, đồng bộ tab              |

97/75 là số nhóm assert được script in, không phải line/branch coverage. Chưa đo coverage, tải production, pentest độc lập hoặc toàn bộ WCAG.

## Hiểu câu

FR26: npm run test:data thêm 9 nhóm CLI/recovery, ngoài 97 nhóm nghiệp vụ và 75 nhóm HTTP (tổng 181 nhóm). Kiểm tra dữ liệu giả trong thư mục tạm; process mới đọc lại login/session/cart/order/audit/address sau restore. Test không sao lưu dữ liệu preview thật.

FR25: unit kiểm tra no-op/validation lỗi không tạo nhật ký, field allowlist bỏ thông tin ngoài catalog, trùng ID audit không làm cập nhật dữ liệu một phần. HTTP kiểm tra staff-only/no-store/405, price before-after, category events và canonical record + history qua restart. Browser kiểm tra tab Nhật ký, bộ lọc và 320px.

FR23/FR24: HTTP kiểm tra snapshot đúng owner và detail, no-store, header owner khác cookie chặn cart/profile/logout; account bị thu hồi kèm guest hợp lệ vẫn 401 cho mutation. Unit kiểm tra Headers/code lỗi và tên món trong signature. Browser dựng màn hình A/cookie B, snapshot 503 sau logout, nhận đơn không Broadcast bằng polling, cập nhật selected detail sau huỷ và thu hồi staff ngoài UI.

FR22: unit kiểm tra thứ tự, tên không dấu trùng, giữ ID/createdAt và ràng buộc món ẩn. HTTP kiểm tra staff/origin/schema, hai POST trùng đồng thời một thành công, chuyển món trước tắt danh mục và dữ liệu qua restart. UI kiểm tra tạo/sửa và phản hồi chặn tắt nhóm có món.

FR20/FR21: HTTP kiểm tra receipt đúng chủ, cache no-store, escape ghi chú và 404 khi thiếu phiên/sai chủ/không có đơn. Unit kiểm tra biên UTC 17:00 tương ứng ngày Việt Nam kế tiếp, ngày inclusive/không hợp lệ, giao các bộ lọc, số liệu completed, giới hạn 14 ngày và CSV không contact. Browser kiểm tra giao diện, nút in và xuất dữ liệu đã lọc.

FR18/FR19: test service giữ ID/email/hash khi sửa tên; chặn ghi theo hash cũ; hai yêu cầu đổi mật khẩu đồng thời chỉ một thành công. HTTP kiểm tra guest/staff/extra ID/origin, mật khẩu sai/mismatch, hai phiên cũ bị vô hiệu, mật khẩu cũ thất bại, dữ liệu qua restart và limiter tách theo tài khoản. Giao diện được kiểm tra riêng bằng Playwright.

Dataset tests/data/intent-cases.vi.json có 50 câu có ID, subset, expectedAction và expectedQuantity nếu có. 40 câu theo cấu trúc hỗ trợ, 10 câu thử thách ngoài mẫu. Dataset tự xây dựng không đại diện cho phân phối người dùng thực tế.

Bộ 50 câu chỉ đo intent đầu tiên và số lượng đầu ra sau khi chuẩn hoá chữ/số. Không đo tìm đúng SKU, chất lượng trả lời, hài lòng, an toàn end-to-end hoặc LLM. SKU/policy/commit có test riêng. Parser mock không có huấn luyện; đây không phải tập kiểm định độc lập cho mô hình học máy.

- Intent accuracy: số câu đúng action / tổng.
- Joint accuracy: đúng intent và quantity được gán nhãn / tổng.
- Precision/recall/F1 theo TP/FP/FN; macro F1 trung bình các intent.
- p50/p95 chỉ tính parser trong bộ nhớ sau warm-up, không gồm HTTP/DB/Bedrock.

JSON report có từng ca, Node/OS và SHA256 dataset/provider. Evaluate trả lỗi nếu nhóm mẫu hỗ trợ bị hồi quy. Challenge giữ nguyên lỗi để mô tả giới hạn, không ép mọi câu đạt 100%.

Xem [kết quả](evaluation-results.md). Không lấy số đo này làm kết quả Bedrock.

## CI

Workflow .github/workflows/ci.yml cấu hình Ubuntu/Windows, Node 24, contents read-only và action pin SHA. Chạy ci/check/evaluate/audit production, không deploy hoặc gọi AWS.

Workflow mới nằm trong working tree. Kết quả local Windows không chứng minh job Ubuntu hoặc GitHub runner đã chạy. Nếu dùng CI làm bằng chứng nộp, bổ sung URL/run ID của lần chạy thật.

## FR27 — Sổ địa chỉ

Unit kiểm tra đúng một mặc định, giới hạn 5, owner và CAS ghi đồng thời. HTTP kiểm tra guest/staff bị chặn, schema strict, owner header, sửa/xoá khác chủ, revision cũ, xác nhận xoá, dữ liệu qua restart và snapshot checkout. Đơn đã đặt giữ contact cũ sau khi sửa/xoá địa chỉ. Backup integration khôi phục địa chỉ bằng service thật trong tiến trình mới.

Playwright FR27: form thêm hai địa chỉ, đổi mặc định, checkout điền contact, chọn nhập tay và chuyển mode giữ sửa, đặt đơn demo, xoá mặc định và đối chiếu contact đơn cũ; conflict 409 không retry, làm mới và focus thông báo. Responsive 320px không tràn ngang. Ảnh trong output/playwright/address-*.png.

Hồi quy origin 07/11: HTTP dùng IP loopback thật thay hostname, đúng Host qua kiểm tra origin, khác origin/forwarded-host giả/cross-site vẫn bị chặn. Browser trên 127.0.0.1 xác nhận chat → proposal → confirm → checkout pickup. demo:doctor chỉ có 7 probe vận hành read-only, không cộng vào 163 nhóm nghiệp vụ/HTTP/recovery.

## FR28 — Khuyến mãi

4 nhóm unit bổ sung kiểm tra số tiền/phần trăm, floor/trần, min, biên bắt đầu/kết thúc, inactive, strict schema, CAS tạo/sửa, checkout revision/giá/retry/snapshot và total không âm. 4 nhóm HTTP bổ sung staff-only/schema/405/no-store, duplicate/concurrent edits, quote riêng đúng chủ, future/expired/inactive/minimum, client tamper, stale revision, checkout retry đồng thời, receipt và restart. HTTP thực sự tạo đơn pickup tổng 0 và đối chiếu delivery vẫn 15.000. CSV có discount_vnd numeric, không thêm contact hay nội dung tự nhập.

Backup integration có một mã thật và restore đọc lại bằng PromotionService trong tiến trình mới. Validator nhận snapshot cũ thiếu promotions; các map trước đó vẫn bắt buộc như cũ. Browser tạo DEMO20 bằng form, apply sai bị chặn, áp mã đúng và reset checkbox, giả lập admin đổi mã giữa quote/checkout, áp lại và đặt đơn; xem phiếu ở 320/1440. Kết quả chi tiết trong verification.

## FR29/FR30 — Đặt lại và lịch sử

5 nhóm unit bổ sung preview riêng đúng chủ/no writes/current prices/no contact; stale menu/availability/options không partial; token tamper/expiry/owner và giỏ đổi; cạnh tranh/duplicate replay, chỉnh quantity sau đó và checkout rồi không reopen; hai preview khác nhau chỉ một giỏ được điền. 4 nhóm HTTP bổ sung auth/strict/405/no-store/owner, stale/forged/price/unavailable, giỏ không trống/duplicate replay/coupon không copy/new proposal không bị xoá và restart/checkout/source giữ nguyên.

Backup integration tạo cart qua ReorderService, thêm quantity bằng API service khác, restore trong process mới rồi retry token: replayed=true và quantity sửa vẫn giữ nguyên. Giả lập path store.json.tmp là directory làm ghi đĩa thất bại; memory/cart và bytes store cũ không đổi, sau bỏ directory test rỗng thì cùng token thực thi được. Đây là fault injection synthetic, không mô phỏng mọi tình huống mất điện. Lọc lịch sử dùng lại filterOrders đã có unit; browser kiểm tra reset/không khớp/status và xem chi tiết.

## FR31 — Parser v2 và bộ hồi quy ngôn ngữ

5 nhóm unit bổ sung: ma trận số chữ (đơn/tens/hundred), corpus 61 câu xét raw intent + quantity + policy preview + giỏ không đổi, xác nhận số chữ tới giỏ đúng đích, REMOVE dòng khác CLEAR giỏ và product/volume lookup (gà sốt nấm không biến thành quantity5). Corpus chỉ là một nhóm trong tổng test, không cộng thêm61 vào số nhóm. Report output/evaluation/language-safety-report.json gồm hash dataset và ba source parser.

4 nhóm HTTP bổ sung: thêm/đổi số chữ vẫn cần xác nhận, “Xoá Pepsi trong giỏ” giữ món còn lại, câu trộn/phủ định/ước lượng/relative giữ giỏ và size/giới hạn số lượng. Confirm add hai mươi mốt khi sẵn1 cho kết quả22, không rơi về1. Các ca cùng message là dữ liệu đã biết, không độc lập với quá trình phát triển.

Dataset intent 50 câu giữ nguyên byte/nhãn/subset, baseline riêng tại tests/baselines/intent-report-before-parser-v2.json. Parser v2 đạt 49/50 intent và joint (98%) so baseline 42/50 và 40/50. Dữ liệu đã được xem để sửa parser nên không gọi holdout hoặc cải thiện chất lượng LLM/người dùng thực. VI-045 vẫn không khớp nhãn UPDATE_CART vì “Giảm Pepsi bớt 1” không cho đích; app chọn hỏi lại để tránh sửa sai. Không sửa nhãn nhằm đạt 100%. Evaluate report ghi aggregate hash cho provider + lexical helper + normalizer và hash evaluator.

## FR32 — Báo cáo món và phiên queued

4 unit mới kiểm tra snapshot name/price/SKU, exclude noncompleted/invalid reconciliation và free-discount delivery, deterministic top10/all totals/distinct order counts, CSV formula/private fields/window hash. Một unit thêm giữ lock, thu hồi auth giả lập trước khi request queued lấy lock; wrapper thật trả401, không gọi operation. Đây là unit mô phỏng auth-state với lock thật, không phải live identity-provider acceptance.

3 HTTP mới: role/no-store/405 và strict duplicate/date/filter; đối chiếu totals/units với completed detail, rename catalog không sửa snapshot; stale window409, filter inclusiveVN và nguồn còn đúng sau restart. UI synthetic kiểm tra 180.000−10.000+15.000=185.000, lọc delivery94.000/pickup91.000, out-of-order response không ghi đè, export không lấy dữ liệu cũ, empty/invalid-date disabled, CSV download thật và revoke staff xoá panel. 320px không tràn ngang. Không thêm test data persistence riêng vì report tính từ order/items đã lưu.

Hồi quy checkout recovery: thêm1 unit lookup owner/key/cart đọc-only và2 HTTP auth/schema/origin/cache/405/unknown/committed/wrong-owner. Kiểm tra browser mất response sau commit, lookup lỗi rồi kiểm tra lại, và quote/checkbox bị vô hiệu khi signature giỏ đổi. Các ca UI fault injection dùng dữ liệu giả, không phải outage provider thật.

FR13 cancellation reason:3 unit mới (schema/service/revoke khi đợi owner lock),2 HTTP mới (validation/replay/public reason/ownership/restart). Browser xác nhận/đóng, lost-response retry, customer/staff conflict,401 clear và render text/long token320px. Reason nằm trong event, không được CSV xuất.

FR33:4 unit về snapshot/DTO, invalid exclusion, deterministic summary/order và source bound;2 HTTP về auth/cache/filter và2fulfillment workflow/restart. Browser4lane, filter stale-response, lost-response PATCH/noauto retry, completed removed/prep empty, read500/retry,401 andlate200afterlogout. Không cộng ca browser hoặc sốitems thành group tự động.

FR34:6unit schema/week/money/time boundary/CAS/corrupt/terms/gate/auth guard;3HTTP public/no-cookie/role/schema/revision/minimum/channel/pause/replay/schedule/restart/receipt. Backup8groups mở rộng shop recovery/legacy optional map. Browser2tab livefee/resetconfirm, pausedcart, schedule, snapshotreceipt, delivery-only savedaddress+minimum+coupon, stale draft409/401 và320px.

FR35:6unit schemas/owner/eligibility/CAS/retry/freeze/old-order-feedbackwindow/DTO/CSV/queuedreauth;3HTTP role/schema/ownership/reply/filter/private/restart/money-status-event invariant. Backup8groups mở rộngprivatefeedback+reply. Browser customer/stafflostresponse, edit-vs-reply409, customerlockedreload, close-sync regression, filterstale/read500, identitychange andstaff401clear,320px.

## FR36 — Commit giỏ và snapshot guard

Tại mốc FR36 ngày07/11/2026:89unit+9data+73HTTP=171 nhóm chính, thêm3 test verifier độc lập. Năm unit mới kiểm tra một commit/mutation, failure không đổi mảng live, concurrent create/edit, revision/legacy/invalid/ownership, stale checkout không đóng và closedcart không reopen; Dynamo command dùng transport giả kiểm tra transaction/conditions/consistent flags, không AWS. Một data group mới tạo7 lỗi filesystem trên store.json.tmp trong thư mục tạm, so raw Maps và bytes file, rồi xác nhận commit thành công khi bỏ chặn. Hai HTTP group mới kiểm tra stale add/qty/remove/clear, malformedheader400, cùng snapshot đồng thời201/409, firstadd retryempty409, owner409 và revision/signature qua restart.

Browser dùng Edge qua Playwright CLI, local fixture riêng: mất response sau commit/old-header retry không trùng; UIqty1/directAPIqty3/stalebutton409/no overwrite; explicitnextintentqty4; price89→90k/stalebutton409/qty4/tổng360k. Mobile320px không tràn. Các console errors do abort và409 là kết quả fault injection được chờ trước, không tính là lỗi JavaScript ứng dụng. Chữ ký optional cho caller cũ; không có cart UUID idempotency để retry mù theo snapshot mới.

## Hồi quy cập nhật bán hàng trong checkout — 08/11/2026

Thêm5 unit group. Checkout-first giữ menu/coupon snapshot khi3 cập nhật staff chờ gate. Catalog-first kiểm tra hết món/giá mới, giữ giỏ và tái sử dụng key sau sửa điều kiện. Cả6 route POST/PATCH menu/categories/promotions dùng auth-state stub với route/lock/service thật, thu hồi khi đã chờ gate trả401 và giữ catalog/audit/promotions. Clock stub đúng endsAt trong final shop check chứng minh mã hết hạn trước commit bị chặn. Repository write failures menu/category/promotion giải phóng gate và checkout tiếp theo chạy được.

Bằng chứng trước/sau có source SHA256 trong evidence/checkout của ZIP. Clock/auth/barrier được điều khiển trong unit. Các ca HTTP hiện có tiếp tục kiểm tra contract API và persistence qua restart.

Lần npm run check ngày08/11/2026 exit0,94unit+9data+73HTTP=176 nhóm. Browser Edge dùng dữ liệu riêng .local/catalog-checkout-review-20261108 trên3101. Mã fixed10k bị đổi20k sau quote79k, POSTorder trả400/PROMOTION_CHANGED và0đơn. Áp lại quote69k bỏ tick cũ, xác nhận mới tạo201. Thêm giỏ mới rồi staff hết món trả400/ITEM_UNAVAILABLE, lịch sử vẫn1đơn. Tắt mã sau accepted vẫn replay đúng đơn/tổng69k/discount20k/unit89k. Document320/viewport320. Hai ảnh trong evidence/ui có tiền và thông báo của đúng giai đoạn. Các race bên trong commit được kiểm tra bằng barrier unit riêng.

## Form món và danh mục từ nhiều tab — 08/11/2026

Bộ hiện hành có97 unit+9 data+75 HTTP=181 nhóm chính, qua lint/typecheck/build. Ba unit mới kiểm tra hash và DTO, concurrent saves của menu/category, exact replay và audit, định dạng header cùng khả năng gửi lại sau lỗi ghi. Hai HTTP mới kiểm tra stale/cross-entity header, caller cũ, replay và revision qua restart. GET giữ nguyên bytes store, catalogRevision không đi vào dữ liệu lưu. Staff đăng nhập lại sau restart theo chính sách session hiện có.

Browser dùng Edge với fixture riêng tại3101. Hai tab món kiểm tra giá89k/99k,409 giữ draft và focus, reload lỗi rồi phục hồi, cùng lost acknowledgement khi lưu100k. Hai PATCH của lần gửi lại chỉ thêm một audit. Hai tab danh mục kiểm tra409, reload lấy tên mới, reload cùng revision bỏ draft và401 xoá form riêng tư. Các race backend dùng gate thật và repositories giả trong unit.

Review phát hiện điều hướng có document365 ở viewport320 khi đủ8 tab. Bản build cuối chuyển thành grid4 cột dưới720px, nút cao tối thiểu44px. Đã đo320/390/430/720/768/1440, mỗi document bằng viewport và đủ8 tab. Bốn ảnh mới đã mở kiểm tra. Ảnh dialog thể hiện phần nhìn thấy trong viewport và form hỗ trợ cuộn.


## Cập nhật phạm vi 09/11/2026

Giảng viên yêu cầu AI thật và triển khai AWS trước 01/01/2027. [Kế hoạch nước rút](sprint-plan-2026-11-09.md) và [AWS readiness](aws-readiness.md) bổ sung mục tiêu/bằng chứng cho phạm vi này. Bộ hiện hành đạt 101 unit + 9 recovery + 76 HTTP = 186 nhóm local, thêm 3 test AWS package offline và 3 test verifier ZIP riêng. Các mốc/số đếm trước đó là lịch sử. Preflight AWS chỉ đọc đã qua; inference, image Linux và nghiệm thu trên AWS còn chờ thực hiện, chưa đánh dấu hoàn tất.
