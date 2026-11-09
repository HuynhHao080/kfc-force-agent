# Yêu cầu và phạm vi

## Bài toán

Hệ thống đặt món phải giữ nhất quán giữa món đang bán, giá, giỏ và đơn. Khi thêm hội thoại, phần hiểu câu có thể thiếu hoặc hiểu sai thông tin. Đề tài tách đề xuất khỏi thực thi; policy và xác nhận kiểm soát các thao tác thay đổi giỏ.

Quy mô đến từ các phân hệ khách–vận hành, ràng buộc dữ liệu, xử lý lỗi và bằng chứng kiểm chứng. Chưa có yêu cầu đo đạc chứng minh cần microservice hoặc khả năng chịu tải lớn.

## Tác nhân

| Tác nhân           | Quyền                                                                            |
| ------------------ | -------------------------------------------------------------------------------- |
| Khách guest        | Có phiên riêng; dùng menu, chat, giỏ và đơn thuộc phiên                          |
| Khách có tài khoản | Đăng ký/đăng nhập/đăng xuất; giỏ và lịch sử theo tài khoản trên trình duyệt khác |
| Quản trị           | Đăng nhập riêng; xử lý đơn đúng trạng thái, quản lý món, xem báo cáo và CSV      |
| Provider hiểu câu  | Chỉ trả đề xuất có cấu trúc; không tự quyết định giá hoặc truy cập repository    |

Hiện có một tài khoản quản trị vận hành local, chưa phải hệ thống nhiều nhân viên với quyền chi tiết. Role/userId từ body không cấp quyền.

## Yêu cầu và nghiệm thu

| ID   | Yêu cầu        | Tiêu chí                                                                    |
| ---- | -------------- | --------------------------------------------------------------------------- |
| FR01 | Menu công khai | Tìm có/không dấu, lọc danh mục, ẩn món không bán                            |
| FR02 | Giỏ hàng       | Giá server, gộp dòng, sửa/xoá đúng giỏ                                      |
| FR03 | Giới hạn       | 1–100 phần/dòng, tối đa 50 dòng; vẫn gộp dòng cũ khi đủ 50                  |
| FR04 | Hiểu câu       | Gọi, đổi số lượng, xoá, xem menu/giỏ theo các mẫu công bố                   |
| FR05 | Policy         | Thiếu/mơ hồ/sai số lượng không làm đổi trạng thái                           |
| FR06 | Xác nhận       | UUID, 15 phút và preview; tab cũ không thực hiện/bỏ qua nhầm đề xuất mới    |
| FR07 | Checkout       | Kiểm tra giỏ/giá; commit đơn, món, event và đóng giỏ cùng nhau              |
| FR08 | Retry          | Cùng khách và khoá checkout trả cùng đơn                                    |
| FR09 | Theo dõi       | Khách chỉ xem món, tổng, trạng thái và event thuộc mình                     |
| FR10 | Huỷ            | Khách chỉ huỷ CONFIRMED; race với chuẩn bị chỉ có một bên thắng             |
| FR11 | Tài khoản      | Email duy nhất, mật khẩu băm, phiên có thể thu hồi; không tự nhập giỏ guest |
| FR12 | Staff auth     | Không mật khẩu mặc định; cookie tách vai trò; logout vô hiệu token          |
| FR13 | Vận hành       | Pickup/delivery khác bước; chặn bỏ bước/quay lại; event ghi vai trò         |
| FR14 | Menu admin     | Thêm/sửa/ẩn/hết món; giá đơn cũ giữ nguyên snapshot                         |
| FR15 | Báo cáo        | Tối đa 200 đơn gần nhất; giá trị completed demo; CSV không contact          |
| FR16 | Khôi phục/lỗi  | Restart giữ dữ liệu local, đồng bộ tab, thông báo mạng dễ hiểu              |
| FR17 | Tái lập        | Check và evaluate không cần AWS                                             |
| FR18 | Hồ sơ khách | Sửa họ tên của chính mình; không đổi ID/email/role hoặc lộ credential |
| FR19 | Đổi mật khẩu | Kiểm tra mật khẩu hiện tại, xác nhận mới; phiên cũ hết hiệu lực, dữ liệu tài khoản còn nguyên |
| FR20 | Phiếu đơn | Chủ đơn xem/in phiếu dùng snapshot; nhãn demo, no-store và không lộ contact cho người khác |
| FR21 | Lọc báo cáo | Ngày Việt Nam, trạng thái, hình thức và tìm kiếm áp dụng nhất quán cho danh sách/stats/CSV trong 200 đơn |
| FR22 | Danh mục | Staff tạo/sửa/thứ tự/tắt nhóm món; chặn tên trùng, tắt nhóm có món và gán món vào nhóm đã tắt |
| FR23 | Nhất quán phiên | Snapshot đúng một owner; thao tác từ giao diện cũ không áp dụng cho owner mới; account bị thu hồi không rơi về guest ngầm |
| FR24 | Đồng bộ quản trị | Cập nhật queue/chi tiết theo broadcast/focus và 15 giây khi visible; dừng lúc sửa form và xoá state khi phiên staff hết hạn |
| FR25 | Nhật ký catalog | Staff xem 200 thay đổi món/danh mục mới nhất; dữ liệu và log cùng commit, không ghi no-op/lỗi hoặc credential |
| FR26 | Sao lưu local | CLI mã hoá/verify/restore vào đích mới; chặn password sai/tamper/path bất thường và đọc lại bằng service thật |

## Use case trọng tâm

**UC01 — Hội thoại:** khách gửi yêu cầu; provider tạo action; policy tìm món và kiểm tra số lượng; server lưu action cụ thể với UUID/hạn/signature giỏ; khách xem preview rồi xác nhận đúng mã; server kiểm tra lại trước khi gọi tool.

**UC02 — Checkout:** khách nhập thông tin, chọn pickup/delivery và xác nhận; server đọc lại menu/giỏ; repository commit đơn, items, event và CHECKED_OUT. Mất phản hồi thì kiểm tra lịch sử hoặc dùng lại cùng khoá.

**UC03 — Vận hành:** quản trị mở đơn CONFIRMED và chọn bước tiếp theo. Service kiểm tra expectedStatus và fulfillment; repository cập nhật có điều kiện kèm event. Khách xem trạng thái nội bộ demo.

**UC04 — Sửa menu:** quản trị thay giá hoặc đánh dấu hết món. Giỏ chưa đặt reprice khi tải; đề xuất/checkout cũ bị kiểm tra lại. Đơn đã tạo giữ snapshot.

**UC05 — Account:** email được chuẩn hoá, mật khẩu băm với salt; cookie cần session server còn hiệu lực. Logout thu hồi đúng phiên. Giỏ guest và tài khoản không tự gộp.

**UC06 — Quản lý tài khoản:** khách mở Tài khoản của tôi, sửa họ tên hoặc đổi mật khẩu. Server kiểm tra cookie customer, origin, schema và mật khẩu hiện tại. Repository cập nhật có điều kiện theo hash trước; thành công đổi password version và yêu cầu mọi trình duyệt cũ đăng nhập lại. Request đổi mật khẩu được giới hạn 10/phút/tài khoản trong tiến trình. Không có gửi email hoặc reset mật khẩu khi quên.

## Giới hạn phi chức năng

- Chưa có số đo chứng minh SLA, tải production, độ sẵn sàng cloud hoặc khả năng phục vụ khách thật.
- Local dùng một tiến trình Node, ổ đĩa ghi được, dữ liệu nhỏ; không nhiều worker cùng snapshot JSON.
- Khoá theo khách là trong tiến trình. Chuyển trạng thái đơn có compare-and-set; mọi thao tác giỏ chưa có cơ chế phân tán đầy đủ.
- Guest/customer session tối đa 30 ngày; staff tối đa 8 giờ và mất sau restart.
- Giới hạn đăng nhập là 10 lần/phút cho từng vai trò trên toàn tiến trình, chưa phải rate limiter phân tán/per-IP.
- Chưa có xác thực email, email recovery, thanh toán, POS/bếp, định vị, upload ảnh hoặc nhiều nhân viên.
- Adapter cloud có mã nguồn chưa đồng nghĩa đã được nghiệm thu trên AWS thật.

## FR27 — Sổ địa chỉ giao hàng

Khách đăng nhập lưu tối đa 5 địa chỉ (nhãn, tên người nhận, điện thoại, địa chỉ đầy đủ). Địa chỉ đầu tiên tự là mặc định; chọn mặc định mới hoặc xoá mặc định vẫn giữ đúng một mặc định khi còn địa chỉ. Sửa/xoá yêu cầu revision hiện tại và cookie đúng chủ. Checkout chỉ điền gợi ý, luôn cho sửa và yêu cầu xác nhận. Đơn đã đặt giữ snapshot contact. Không xác minh địa chỉ thực tế hoặc phạm vi giao hàng.

## FR28 — Khuyến mãi và báo giá có kiểm soát

Quản trị tạo/sửa/tắt mã phần trăm hoặc cố định, thời gian, tiền món tối thiểu và trần phần trăm. Mã duy nhất không phân biệt hoa/thường; cập nhật theo revision. Khách áp một mã trong checkout, server tính giảm tiền món và giữ phí giao. Chỉnh/bỏ mã làm mất xác nhận cũ trên UI. Mã đổi giữa quote/checkout bị kiểm tra lại. Đơn giữ snapshot mức giảm và mã; retry không tạo thêm đơn. Hỗ trợ tổng 0 khi giảm toàn bộ tiền món và pickup. Không triển khai quota, giới hạn mỗi khách, tích lũy nhiều mã hoặc chính sách riêng từng SKU trong đợt này.

## FR29 — Đặt lại đơn có kiểm soát

Chỉ chủ đơn xem trước các dòng món theo giá/tên hiện tại. Cần giỏ trống; không tự xoá hoặc gộp món đang có. Preview không tạo giỏ hoặc đơn; token HMAC theo owner/source/menu/base-cart hết hạn 15 phút. Xác nhận kiểm tra lại rồi lưu một giỏ mới cùng các dòng một lần; retry không nhân đôi hoặc sửa lại giỏ sau đó. Không sao chép voucher/contact/ghi chú/phí giao. Source order không đổi. Khách vẫn checkout để tạo đơn mới. Món hết bán, tuỳ chọn cũ chưa hỗ trợ, dòng trùng hoặc số lượng sai bị từ chối toàn bộ.

## FR30 — Lọc lịch sử đơn của khách

Tìm mã/tên người nhận không dấu, giao với trạng thái; hiển thị số đơn khớp và xoá lọc. Không tìm thấy thì báo rõ; chi tiết ngoài bộ lọc được ẩn. Chỉ xử lý tập lịch sử đã lấy đúng owner, không thêm endpoint đọc đơn người khác.

## FR31 — Hiểu số lượng và phạm vi thao tác an toàn

Mock parser nhận số chữ một..một trăm theo cấu trúc rõ; số ngoài 1–100, âm/fraction đi qua policy hoặc được hỏi lại, không mặc định 1 khi đọc không được. Dung tích số ml/l/lít được giữ trong query món; không tự đổi 1500ml thành 1.5L. Số mơ hồ/ước lượng, nhiều số lượng, nhiều món/thao tác hay điều kiện thì cần gửi lại một yêu cầu rõ. Tăng/giảm vẫn yêu cầu đích cuối (lên/còn/thành), chưa có delta arithmetic. “Trong giỏ” không phải scope toàn bộ; chỉ rõ toàn giỏ mới CLEAR_CART. Tất cả mutation vẫn có preview/UUID/TTL/signature/confirmation.

## FR32 — Món bán chạy và đối soát báo cáo

Quản trị xem top10 SKU theo số phần từ đơn COMPLETED có chi tiết hợp lệ, trong cửa sổ200 gần nhất và cùng bộ lọc. Hiển thị gross trước giảm, discount, deliveryFee, net= gross−discount+fee; không gọi là tiền thu/lợi nhuận. Group SKU qua các lần đổi tên/giá bằng snapshot, count order distinct. Đơn sai reconciliation bị loại và cảnh báo. Dashboard revision ràng buộc window; filter đổi không dùng kết quả hoặc CSV cũ. CSV nguồn rõ, không contact và trung hoà formula text.

## Bổ sung nghiệm thu FR13 — huỷ đơn có lý do

Quản trị huỷ đơn CONFIRMED qua modal xác nhận, lý do5–300 ký tự được nói rõ sẽ hiển thị cho khách. Lưu status/event/reason atomic; retry chính xác không thêm event, khác lý do hoặc đơn đã bị khách huỷ thì conflict. Giữ reason khi lỗi mạng để retry; trạng thái đã đổi phải đóng/xem lại, không tự retry theo trạng thái mới. Chủ đơn và staff xem reason dưới sự kiện, render text an toàn. Polling tạm dừng trong modal; phiên hết hạn xoá toàn bộ state private.


## FR33 — Điều phối bếp theo trạng thái

Staff mở Bảng bếp, xem CONFIRMED/PREPARING/READY/DELIVERING trong200 đơn gần nhất, theo thứ tự đặt cũ trước. Mỗi thẻ có shortID, pickup/delivery, snapshot món/số phần, ghi chú và số phút từ lúc đặt. Tổng hợp phần còn chờ/đang làm theo SKU, không tính món đã sẵn sàng/giao vào nhu cầu chuẩn bị. Nhãn tổng hợp dùng snapshot tên gần nhất, từng thẻ giữ snapshot gốc. Không đọc giá/tên catalog hiện tại để sửa đơn đã đặt.

Lọc riêng pickup/delivery; đồng bộ15 giây khi visible, focus/visibility và manual refresh. Chuyển đúng bước bằng API workflow đã có và expectedStatus; không huỷ trực tiếp từ bảng, mở chi tiết để xử lý huỷ có lý do. Kết quả cũ khi đổi bộ lọc/unmount hoặc sau thao tác không được ghi đè view mới. Lỗi API/phiên hiển thị rõ,401 clear staff state. Không tự retry mutation khi lỗi mạng; tải lại để người vận hành xem kết quả.

GET DTO không gửi trường customerName/phone/shippingAddress/price. Ghi chú của khách có thể chứa thông tin riêng tư, nên toàn bảng vẫn cần staff auth/no-store; không gọi là bảng công khai hoặc không có PII tuyệt đối. Đơn active thiếu chi tiết, options chưa hỗ trợ, quantity sai, lane/date sai bị loại và cảnh báo count để staff kiểm tra danh sách gốc. Chỉ cửa sổ200, không phải queue toàn lịch sử hay hệ thống POS/máy in/kết nối bếp vật lý; thời gian không phải SLA hoặc dự đoán hoàn tất.


## FR34 — Thông tin cửa hàng và điều kiện tiếp nhận đơn

Staff cấu hình tên/địa chỉ/điện thoại/thông báo công khai, bật/tắt nhận đơn và từng kênh pickup/delivery, phí giao0–200.000đ, minimum tiền món0–10.000.000đ. Lịch7ngày theo UTC+7: mỗi ngày nghỉ hoặc opensAt<closesAt, nhận từ giờ mở bao gồm đến giờ đóng không bao gồm;24:00 là hết ngày. Chưa hỗ trợ qua đêm/ngày lễ ngoại lệ. Manual pause chặn mọi lịch.

Khách xem thông tin, trạng thái, điều kiện và giờ; checkout dùng revision hiện tại, quote server và phí/minimum do server quyết định. Cấu hình đổi thì xem lại điều kiện/tick xác nhận. Giỏ vẫn được xem/sửa khi tạm ngừng; đơn đang xử lý vẫn được vận hành/huỷ đúng workflow. Request retry đã commit vẫn trả snapshot cũ kể cả cửa hàng đóng; không tạo đơn mới. Order store snapshot giữ điểm nhận/liên hệ/revision, fee đã có trong snapshot order; chỉnh cấu hình không sửa lịch sử.

Settings save/checkout mới đi qua cùng local acceptance gate, kiểm tra lại auth sau chờ; closed/revision/minimum sai không chiếm request key hoặc đóng giỏ. save theo revision CAS, form stale không overwrite. Map shopSettings optional để đọc backup cũ; mặc định có nhãn demo, địa chỉ chưa cấu hình, fee15.000, minimum0 và chưa giới hạn giờ, không tự đoán địa chỉ KFC thật. Khôi phục/restart giữ cấu hình. Adapter Dynamo chỉ có mã nguồn, chưa nghiệm thu concurrency phân tán.


## FR35 — Đánh giá sau hoàn tất và trả lời riêng

Chủ đơn COMPLETED, guest hoặc account, chấm1–5 điểm và nhận xét0–1.000 ký tự. Một feedback gắn với đơn, sửa theo revision trước khi staff trả lời. Gửi lại cùng nội dung trả cùng record, không tạo thêm bản. Sau reply, giữ nguyên trao đổi; request khác nội dung bị409. Không đổi tiền/trạng thái/events của đơn khi feedback; chỉ metadata feedback/updatedAt được cập nhật.

Staff có hộp thư200 đánh giá cập nhật gần nhất, lọc điểm/chờ/đã trả lời, summary theo cùng bộ lọc. Đánh giá mới trên đơn cũ vẫn được lấy, không giới hạn theo200 đơn đặt gần nhất. Mỗi feedback một câu trả lời5–1.000 ký tự, CAS với revision khách; nếu khách vừa sửa, không gửi reply theo nội dung cũ. Reply chính xác retry trả lại record, khác text sau publish bị409. Poll15s khi visible, dừng khi editor mở, response cũ sau filter/unmount không restore state.

Feedback/reply chỉ đúng chủ đơn và staff đọc, không public menu, không đưa vào AI retrieval hoặc CSV tài chính. Customer thao tác có owner-header guard; staff reply reauth sau owner lock. UI giữ draft khi lỗi, focus alert, reload có nhãn bỏ draft;401 clear private form. Không file upload, multi-round ticket, chỉnh reply đã gửi hoặc moderation/public review. Nguồn200 feedback gần nhất, không toàn bộ lịch sử thống kê.

## FR36 — Giỏ hàng nhất quán và chặn thao tác theo dữ liệu cũ

Mỗi thao tác thêm/gộp, sửa số lượng, xoá dòng, xoá giỏ và cập nhật giá/tên từ menu phải lưu metadata, toàn bộ dòng món và tổng tiền cùng một commit. Lỗi lưu không để lại dòng mới, tổng cũ hoặc giỏ rỗng do lần thêm đầu thất bại. Repository kiểm tra owner, trạng thái ACTIVE và revision trước ghi; hai cập nhật cùng revision chỉ một được chấp nhận, giỏ đã checkout không được mở lại.

Giao diện gửi chữ ký giỏ vừa hiển thị cho các nút sửa giỏ. Nếu giỏ/menu đã thay đổi, trả409 CART_CHANGED, tải giỏ mới và yêu cầu khách xem lại; không tự gửi lại thao tác. Khi phản hồi thêm món bị mất, gửi lại với chữ ký cũ bị chặn để khách kiểm tra số lượng đã lưu. Chữ ký là điều kiện nội dung, không phải credential hoặc khoá idempotency tổng quát. API cũ không gửi header vẫn được hỗ trợ; snapshot cũ thiếu revision được nâng cấp ở lần ghi kế tiếp.

## Bổ sung FR07, FR14, FR28 và FR34 ngày 08/11/2026

Checkout và cập nhật món/danh mục/khuyến mãi/cấu hình dùng chung gate trong bản local. Bản ghi đơn phải phản ánh một thứ tự xử lý xác định với các cập nhật bán hàng. Quyền staff được kiểm tra lại sau chờ. Mã hết hạn trong lúc xử lý bị từ chối trước commit, giỏ và request key còn dùng được cho yêu cầu hợp lệ tiếp theo. Đơn đã lưu và retry đúng giữ snapshot ban đầu.

## Bổ sung FR14 và FR22 — sửa thực đơn từ nhiều tab

Form sửa món và danh mục gửi phiên bản của dữ liệu đã xem. Khi dữ liệu mới khác nội dung bản nháp, server trả409 CATALOG_CHANGED và giữ bản lưu hiện tại. Form giữ các trường người quản trị đang nhập, focus thông báo và cho phép tải lại với nhãn bỏ bản nháp. Tải lại lỗi giữ draft, tải lại thành công thay toàn bộ form bằng dữ liệu mới. Gửi lại đúng nội dung đã lưu trả record hiện tại và giữ số entry audit. Header optional để caller API cũ tiếp tục chạy. Giao diện hiện tại luôn gửi header khi PATCH.


## Cập nhật phạm vi 09/11/2026

Giảng viên yêu cầu AI thật và triển khai AWS trước 01/01/2027. [Kế hoạch nước rút](sprint-plan-2026-11-09.md) và [AWS readiness](aws-readiness.md) bổ sung mục tiêu/bằng chứng cho phạm vi này. Bộ hiện hành đạt 101 unit + 9 recovery + 76 HTTP = 186 nhóm local, thêm 3 test AWS package offline và 3 test verifier ZIP riêng. Các mốc/số đếm trước đó là lịch sử. Preflight AWS chỉ đọc đã qua; inference, image Linux và nghiệm thu trên AWS còn chờ thực hiện, chưa đánh dấu hoàn tất.
