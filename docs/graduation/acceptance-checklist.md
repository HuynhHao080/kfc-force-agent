# Bảng nghiệm thu phạm vi bản khóa luận

Phạm vi được chốt cho bản demo local một tiến trình, không có rubric riêng của trường. Các mục dưới là chức năng đã triển khai, không phải cam kết sẵn sàng phục vụ khách thật. Chi tiết bằng chứng từng đợt tại [verification](../verification.md), API và [review](code-review.md).

| Phân hệ | Hành vi nghiệm thu | Bằng chứng |
| --- | --- | --- |
| Tài khoản | Đăng ký, email chuẩn hoá/duy nhất, đăng nhập, logout, đổi tên | HTTP account/profile, browser |
| Bảo mật tài khoản | Hash/salt, đổi mật khẩu hiện tại, thu hồi mọi phiên cũ, dữ liệu còn qua restart | Unit CAS/password, HTTP revoke/restart |
| Guest | Phiên ký HttpOnly, dữ liệu tách khỏi account; cookie account bị thu hồi không rơi về guest ngầm | HTTP identity/snapshot |
| Menu | Tìm không dấu, lọc nhóm, món active/available, ảnh local, giá server | Unit/HTTP/browser |
| Danh mục admin | Tạo/sửa/thứ tự/tắt nhóm, chặn nhóm có món và tên trùng | Unit/HTTP/browser categories |
| Món admin | Tạo/sửa/ẩn/hết món, kiểm tra giá và nhóm, giữ snapshot đơn | HTTP menu/snapshot |
| Nhật ký catalog | Before/after món/danh mục, staff-only, đồng lưu dữ liệu, bỏ no-op/lỗi | Unit/HTTP audit, browser |
| Giỏ | Thêm/gộp, tăng/giảm, xoá/xoá hết, 1–100 phần và 50 dòng | Unit/HTTP cart |
| Chat | Structured intent/actions, allowlist policy, món mơ hồ/số lượng sai bị chặn | Unit parser/policy |
| Xác nhận | Bản xem trước, mã UUID/TTL, không thực thi bằng chữ đồng ý, chặn giá/tên/giỏ đổi và tab cũ | Unit/HTTP confirmation |
| Checkout | Pickup/delivery, contact, phí demo, giá và signature server, retry cùng key | Unit/HTTP checkout |
| Theo dõi đơn | Lịch sử/chi tiết/event đúng chủ, huỷ khi CONFIRMED | HTTP ownership/cancel |
| Vận hành | State machine, expectedStatus/CAS, race huỷ/chuẩn bị một bên thắng | HTTP workflows/concurrency |
| Phiếu đơn | Trang riêng đúng chủ, no-store, escape, in qua trình duyệt, nhãn demo | HTTP receipt, browser print media |
| Báo cáo | Ngày Việt Nam, giao bộ lọc, completed value, 14 ngày có dữ liệu, CSV không contact | Unit/report browser/download |
| Nhất quán giao diện | Snapshot một owner; thao tác mang owner đang hiển thị, không retry khi đổi phiên | HTTP headers/snapshot, browser stale display |
| Đồng bộ admin | Broadcast/focus và polling 15 giây khi visible; tạm dừng form đang mở, xoá state khi 401 | Browser background sync |
| Khôi phục | Snapshot JSON local qua restart, lỗi API/network/timeout dễ hiểu | HTTP restart, browser fault injection |
| Backup local | Archive mã hoá, manifest/hash, không overwrite, khôi phục đăng nhập/giỏ/đơn/audit | 9 nhóm test:data, process mới |
| Responsive | Storefront/admin/dialog/receipt có kiểm tra 320px, không tràn ngang ở ca đã ghi | Ảnh và measurements trong verification |
| Tái lập | npm ci/check/evaluate, CI cấu hình, archive manifest/hash và không secret | Log local, workflow, package verifier |
| Hồ sơ khóa luận | FR/use case, kiến trúc/ER/sequence/state, API, test/evaluation, runbook, nguồn, outline | docs/graduation |

## Điều kiện demo

Node + production build đã chuẩn bị, AI_PROVIDER=mock, PERSISTENCE_DRIVER=local, một Node process và ổ đĩa ghi được. Tạo credential admin riêng; dùng dữ liệu giả; không mở file bootstrap hoặc trường mật khẩu trước hội đồng. Gói mã nguồn loại dữ liệu runtime và secret.

## Các giới hạn phải trình bày

- Không có nghiệm thu AWS/Bedrock thật, nhiều instance hoặc tải production; adapter cloud mới là mã nguồn.
- Chat parser có dataset phát triển cố định 50 câu: baseline 42/50 intent, 40/50 joint; parser v2 đúng 49/50 ở cả hai. Ca đã được xem trong phát triển, không phải holdout hay chất lượng LLM. Bộ 61 câu mới là hồi quy tổng hợp intent/policy.
- Thanh toán COD chỉ là trường demo; không thu tiền, gửi nhà hàng/POS hay gọi giao vận thật.
- Báo cáo chỉ trong 200 đơn gần nhất; chưa có truy vấn toàn lịch sử/pagination cho vận hành quy mô lớn.
- Chưa có nhiều nhân viên/quyền chi tiết, email verification/recovery, quota khuyến mãi hoặc tồn kho định lượng.
- Snapshot local không phải database đa tiến trình; chưa chứng nhận WCAG, pentest độc lập, SLA hoặc mất điện/crash recovery.
- Máy in vật lý và PDF xuất qua hộp thoại native chưa có acceptance; nút in và print CSS đã được kiểm tra.

Các tích hợp ngoài cần cấu hình, tài khoản dịch vụ và một đợt nghiệm thu riêng. Không thay thế bằng dữ liệu giả rồi gọi là đã tích hợp thật.

- [x] FR27: CRUD sổ địa chỉ khách hàng, mặc định, giới hạn 5, revision và checkout prefill; unit/HTTP/recovery local.
- [ ] Xác minh địa chỉ/vùng giao thực tế và nghiệm thu adapter cloud cho sổ địa chỉ.

- [x] FR28: quản trị mã giảm giá, quote server, checkout kiểm tra lại và snapshot đơn local.
- [ ] Quota/per-customer, cộng dồn mã, chiến dịch công khai và nghiệm thu adapter cloud.

- [x] FR29: preview/confirm đặt lại giỏ trống theo giá hiện tại, token/ownership/stale/idempotency, atomic local và recovery.
- [x] FR30: tìm và lọc trạng thái lịch sử riêng của khách, reset và empty result.
- [ ] Đặt lại có gộp giỏ/options riêng hoặc nghiệm thu concurrency cloud nhiều instance.

- [x] FR31: số lượng viết bằng chữ, volume giữ trong SKU, phạm vi xoá dòng/toàn giỏ tách rõ, multi-action/ước lượng/phủ định yêu cầu làm rõ.

- [x] FR32: top món/snapshot, đối soát và exclusion, window revision/filter/CSV, reauth staff queued.
- [ ] Báo cáo toàn lịch sử, giá vốn/lợi nhuận, kế toán thanh toán/refund và nghiệm thu cloud.

## Chốt bản local 07/11/2026

Phạm vi đã được người dùng chọn và ghi trong [hồ sơ bàn giao](local-release-scope.md). Lần kiểm tra cuối:131 nhóm assertion chính và3 test verifier ZIP qua; doctor7/7. Các mục tích hợp ngoài chưa đánh dấu ở trên nằm ngoài phạm vi local, không phải bằng chứng đã nghiệm thu. Retry checkout cùng key khác thông tin trả409; bản cũ không hash có giới hạn so sánh được ghi rõ trong hồ sơ.

Đợt tiếp theo bổ sung phục hồi checkout khi mất phản hồi: tra cứu đúng owner/key/cart chỉ đọc, tự mở đơn đã lưu hoặc kiểm tra lại bằng nút riêng; quote/checkbox theo signature giỏ. Bộ kiểm tra hiện134 nhóm chính +3 verifier. Không mở rộng phạm vi cloud/production.

FR13 huỷ có lý do: [x] modal/checkbox, reason public5–300, atomic event, exact retry, conflict không overwrite, customer xem text, reauth sau owner lock, restart. Bộ kiểm tra hiện139 nhóm chính +3 verifier; cloud/hoàn tiền vẫn ngoài phạm vi.

FR33 [x] bảng bếp4lane, snapshot/preparation/filter, correct transitions/old response/no auto mutation retry, read error recovery, auth/logout, restart và320px. Bộ chính145 nhóm +3 verifier. Cửa sổ200; POS/máy in/cloud/SLA ngoài phạm vi.

FR34 [x] thông tin/giờ/kênh/tạm dừng/fee/minimum, revision/gate/auth, public sync, order/receipt snapshot và backup/restart. Bộ chính154 nhóm +3 verifier. Default demo chưa có địa chỉ thực; single shop/local, không overnight/ngày lễ/distance shipping/cloud.

FR35 [x] ownercompletefeedback, edit/revision/replay, staff inbox200feedback+filters/average, one immutable reply, stalecontext/private/auth/backup/restart/mobile. Bộ chính163 nhóm +3 verifier. Không public review, multi-round ticket, attachment hoặc delete/redactionUI.

FR36 [x] một commit metadata/items/totals; firstadd/edit/remove/clear/reprice rollback; owner/ACTIVE/revision CAS và legacy; stale UI/snapshot409/refresh; lost-response retry với snapshot cũ không cộng thêm; checkout/closedcart guard; restart. Bộ hiện hành171 nhóm chính +3 verifier. API cũ không header không có stale-UI guarantee; không nghiệm thu AWS/multi-instance.

Ngày 08/11/2026 đã kiểm tra bổ sung đồng bộ checkout với món/danh mục/khuyến mãi, reauth sau chờ ở6route và revalidate coupon trước commit. Bộ hiện hành94unit+9data+73HTTP=176 nhóm,3 verifier riêng. Browser320px kiểm tra mã cũ/hết món bị chặn, áp lại mã bỏ tick cũ, đơn accepted69.000đ giữ snapshot và replay sau catalog update.

Đợt form catalog08/11/2026 [x] version DTO/optional PATCH header, stale409 giữ dữ liệu và draft, exact replay giữ audit/updatedAt, explicitreload/failedreload/samerevision reset/401 clear, legacy snapshot/restart.97unit+9data+75HTTP=181 nhóm chính,3verifier riêng. Mobile nav8tabs qua320–1440. Caller cũ bỏ header tiếp tục hành vi cũ.


## Cập nhật phạm vi 09/11/2026

Giảng viên yêu cầu AI thật và triển khai AWS trước 01/01/2027. [Kế hoạch nước rút](sprint-plan-2026-11-09.md) và [AWS readiness](aws-readiness.md) bổ sung mục tiêu/bằng chứng cho phạm vi này. Bộ hiện hành đạt 101 unit + 9 recovery + 76 HTTP = 186 nhóm local, thêm 3 test AWS package offline và 3 test verifier ZIP riêng. Các mốc/số đếm trước đó là lịch sử. Preflight AWS chỉ đọc đã qua; inference, image Linux và nghiệm thu trên AWS còn chờ thực hiện, chưa đánh dấu hoàn tất.
