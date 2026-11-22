# Trợ lý hỗ trợ mua hàng KFC

> **Chế độ phụ, không thuộc phạm vi khoá luận** (điều chỉnh 22/11/2026, issue #16). Luồng chính là đặt món trong chat, tạo đơn CONFIRMED rồi chuyển lên kitchen board; kênh chính của khách là WhatsApp. Chế độ này chỉ bật khi `KFC_PURCHASE_ASSISTANT=1`. Code được giữ lại nhưng không phát triển thêm. Thực đơn thật giờ chọn bằng `KFC_CATALOG=kfc`, độc lập với chế độ này. Phần thu thập thực đơn (TinyFish) bên dưới vẫn dùng cho luồng chính.

Người dùng chốt phạm vi ngày 15/11/2026 là website giúp người mua lựa chọn món KFC. Luồng chính gồm xem thực đơn công khai, tìm kiếm tiếng Việt, lọc theo giá, sắp xếp, so sánh tối đa ba món, xem chi tiết và nguồn, chuẩn bị danh sách bằng thao tác trực tiếp hoặc AI, rồi mở KFC Việt Nam để hoàn tất mua hàng.

## Cập nhật AI và dữ liệu mới

Lần Fetch tiếp theo ngày 15/11/2026 đã lấy 101 món thuộc chín nhóm, thêm hai ưu đãi mới. Bản local đã được cập nhật có backup. Tìm theo giá, context từ catalog, bộ 38 câu phát triển và kiểm tra AI thật được ghi tại [hồ sơ cải thiện AI](graduation/ai-learning-and-data.md). Các số liệu 99 món bên dưới giữ bằng chứng của lần thu thập trước.

## Thu thập thực đơn

TinyFish Fetch đã đọc trang công khai tại `https://kfcvietnam.com.vn/menu` ngày 15/11/2026 bằng selector `app-product`. Đã thu thập 99 món thuộc chín nhóm. Parser ghép ảnh và giá trong cùng thẻ sản phẩm, lấy giá hiện tại trước giá gạch ngang. Snapshot công khai tại `src/lib/catalog/kfc-menu.snapshot.json`. Thông tin gồm danh mục, tên món, giá VND, mô tả, ảnh và URL nguồn. Các combo giữ tên và giá niêm yết, lựa chọn chi tiết được hoàn tất trên KFC. Món thiếu giá hoặc danh sách trùng được ghi trong `exclusions`. Ứng dụng giữ thời điểm thu thập, run ID và SHA256 kết quả gốc để đối chiếu.

Thêm `TINYFISH_API_KEY` vào `.env.local` hoặc môi trường riêng của máy. File này được loại khỏi Git và gói phát hành. Lệnh xem kế hoạch chạy offline là

```powershell
node scripts/sync-kfc-menu.cjs
```

Thu thập chỉ đọc bằng TinyFish Fetch với job mới

```powershell
$catalogJob = [guid]::NewGuid().ToString()
node scripts/sync-kfc-menu.cjs --fetch --job $catalogJob
```

Fetch hỗ trợ trang JavaScript. Nếu dùng connector lấy HTML, có thể nhập phản hồi bằng `--import-fetch --job <UUID> --input <file>`. Parser dùng Python chuẩn và schema Zod kiểm tra đầu ra. Fetch có hạn mức miễn phí theo tài khoản.

Khi cần tương tác trang, `--start` tạo một lượt browser agent có thể phát sinh phí. `--collect` đọc trạng thái của đúng lượt đã tạo. Khi còn RUNNING, có thể thu kết quả lại sau. API dùng cấu hình mặc định của tài khoản, các tùy chọn giới hạn bước và strict mode hiện yêu cầu quyền beta. Script không gửi các tùy chọn beta đó. Schema gửi provider dùng các keyword được TinyFish hỗ trợ, sau đó đầu ra được kiểm tra bằng schema local nghiêm ngặt hơn. [TinyFish API](https://docs.tinyfish.ai/api-reference/automation/start-automation-asynchronously), [schema đầu ra](https://docs.tinyfish.ai/agent/api/agent/structured-output), [đọc kết quả](https://docs.tinyfish.ai/api-reference/runs/get-run-by-id).

Kết quả nằm trong `.local/catalog-imports/<job>/catalog.json`, kèm attempt và kết quả gốc. Lỗi hoặc phản hồi POST không rõ phải kiểm tra trong tài khoản trước khi tạo lượt khác. Các phản hồi HTTP 400 do schema và 403 do tính năng beta đã được xử lý trong đợt tích hợp. Marker cũ được giữ lại.

## Khởi tạo bản chạy bằng dữ liệu đã thu thập

Cấu hình riêng của tiến trình gồm

```dotenv
AI_PROVIDER=bedrock
AWS_PROFILE=default
AWS_REGION=ap-southeast-1
BEDROCK_MODEL_ID=global.anthropic.claude-haiku-5-5
BEDROCK_DAILY_REQUEST_LIMIT=25
PERSISTENCE_DRIVER=local
KFC_PURCHASE_ASSISTANT=1
# Empty uses the bundled reviewed public snapshot.
KFC_CATALOG_FILE=
LOCAL_DATA_DIR=.local/kfc-purchase-assistant
```

`KFC_CATALOG_FILE` trống dùng bản công khai đi kèm source. Đợt này khởi tạo dữ liệu riêng tại `.local/kfc-purchase-20261115`. Thư mục dữ liệu mới nhận đúng catalog đã kiểm tra và lưu snapshot ngay khi khởi tạo. Mỗi repository dùng bộ nhớ riêng. Snapshot giữ giá, giỏ, tài khoản và hội thoại qua restart. Khi đã có `store.json`, ứng dụng đọc snapshot hiện có. Việc đổi đường dẫn catalog phục vụ lần khởi tạo mới. Quy trình cập nhật catalog đang sử dụng cần review diff và bảo toàn dữ liệu cũ trước khi áp dụng.

## Mua hàng trên website KFC

Trong chế độ `KFC_PURCHASE_ASSISTANT=1`, giỏ là danh sách chuẩn bị mua. Nút mua mở bảng tóm tắt có số lượng và giá tham khảo, hỗ trợ sao chép rồi mở website KFC chính thức. Người mua chọn lại món, nhà hàng, địa chỉ và thanh toán trên KFC. Bước này cần thao tác của người dùng vì hiện chưa có API đối tác để chuyển giỏ giữa hai website.

API tạo đơn nội bộ và quote khuyến mãi trả hướng dẫn hoàn tất trên KFC trong chế độ này. Các luồng vận hành nội bộ của bản trước tiếp tục có chế độ cấu hình riêng để phục vụ dữ liệu và kiểm thử đã có. UI trợ lý tập trung vào lựa chọn món và danh sách mua.

Ảnh HTTPS chỉ nhận ba miền KFC được kiểm tra, ảnh PNG gốc được giữ đúng đuôi. Khi ảnh nguồn lỗi, giao diện dùng minh họa dự phòng. Giá nguồn và thời điểm thu thập được hiển thị trong chi tiết món. Tình trạng món thực tế phụ thuộc nhà hàng khi người dùng hoàn tất đặt trên KFC.

## Kiểm tra

```powershell
node scripts/test-kfc-catalog.cjs
npm run check
npm run team:check
```

Test/CI dùng dữ liệu tổng hợp và provider mock theo quy định của repo. Bản chạy cho người dùng cấu hình Bedrock và catalog TinyFish. Kiểm tra UI cần thử tìm không dấu, sắp xếp giá, giới hạn ngân sách, so sánh, sửa số lượng, tách phiên, sao chép/mở KFC và khôi phục giỏ sau restart.

Ngày 15/11 đã chạy `npm run check` đạt lint, typecheck, 101 nhóm nghiệp vụ, 10 nhóm dữ liệu/khôi phục, năm test AWS offline, 14 test Bedrock offline, build và 76 nhóm HTTP. Log tại `output/verification/kfc-purchase-release-check-20261115.log`. Bộ `node scripts/test-kfc-catalog.cjs` đạt 11 nhóm, gồm dữ liệu nhập, parser giá/ảnh và bộ phân giải tên chính xác. `npm run evaluate` đạt 49/50 trên tập parser phát triển. Kiểm tra nhóm và ba test submission đều đạt.

Playwright đã chạy thật với catalog 99 món và Bedrock. Các ca đạt gồm sắp xếp/lọc giá/tìm không dấu, so sánh tối đa ba món, chi tiết nguồn, thêm ba Pepsi (Lon) với giá server 60.000 đồng, sao chép và mở KFC, chặn tạo đơn/quote nội bộ. Lượt AI sau khi sửa resolver đề xuất thêm hai phần, giỏ giữ ba trước xác nhận và có năm phần, 100.000 đồng sau xác nhận. Hai lượt AI local đã dùng trong ngày UTC, gồm lượt đầu bị policy chặn do mơ hồ và lượt sau sửa thành công. Báo cáo tại `output/verification/kfc-purchase-browser-20261115.json`, báo cáo lỗi trước sửa được giữ riêng.

Sau restart, giỏ năm Pepsi, hội thoại, catalog và bộ đếm hai lượt AI còn nguyên. Phiên khách mới có giỏ riêng trống. Bảy nhóm trình duyệt/restart đạt, desktop và các chiều rộng 390px, 320px vừa viewport. Ảnh cuối tại `output/verification/kfc-purchase-desktop-final-20261115.png` và `kfc-purchase-mobile-final-20261115.png`. Sau hiệu chỉnh CSS hero đã build lại thành công, log `kfc-purchase-final-ui-build-20261115.log`.

Đã chạy trực tiếp `--fetch` qua REST bằng job `a0979408-98b4-4f85-bf8e-a717ca6a82b9`, thu được cùng 99 món/chín nhóm. Tên, nhóm, giá, mô tả, ảnh và trạng thái của 99 món trùng bản thu từ connector. URL nguồn của connector là `/menu/hot-deal`, REST ghi `/menu`; mỗi bản giữ đúng URL quan sát được. Nguồn và hash được kiểm tra lại trước bàn giao. Web local chạy tại `http://127.0.0.1:3105/chat`, dữ liệu riêng `.local/kfc-purchase-20261115`. Phần phát hành AWS của UI mới cần thực hiện theo phạm vi được duyệt và nghiệm thu lại trên HTTPS.

## Nâng cấp giao diện ngày 15/11/2026

Giao diện trợ lý dùng bảng màu trắng, đỏ và xám nhạt. Catalog hiển thị ba cột trên màn hình rộng, hai cột ở kích thước nhỏ. Banner mobile được rút gọn. Danh mục có nút cuộn và thanh bám khi xem món, có nút xóa bộ lọc. Bấm ảnh mở chi tiết món và thẻ món hiển thị số lượng đang có trong giỏ.

Mobile có thanh Thực đơn, Trợ lý và Giỏ hàng ở cạnh dưới. Trợ lý mở trong native dialog, chia sẻ hội thoại và đề xuất với bản desktop. Có xử lý Tab/Shift+Tab, Escape, đưa focus về nút mở sau khi đóng và tự đóng dialog khi chuyển sang màn hình rộng. Thao tác xác nhận và bỏ qua tiếp tục đi qua các handler hiện có.

`npm run check` đạt, log `output/verification/ui-upgrade-final-check-20261115.log`. Sau hiệu chỉnh CSS đã build lại tại `ui-upgrade-release-build-20261115.log`. Kiểm tra Playwright tại `ui-upgrade-browser-20261115.json` gồm bảy nhóm, thử các chiều rộng 320, 390, 768, 1024 và 1440 px, mở ảnh/chi tiết, giỏ, modal, xác nhận/bỏ qua và chuyển sang KFC. Các kiểm tra UI chạy với provider mock trên cổng 3112 và thư mục dữ liệu riêng, ngân sách inference bằng 0. Web sử dụng tại cổng 3105 tiếp tục cấu hình Bedrock và snapshot TinyFish 99 món.

Ảnh kiểm tra tại `output/verification/ui-upgrade-desktop-20261115.png`, `ui-upgrade-mobile-20261115.png` và `ui-upgrade-assistant-pending-20261115.png`. Các báo cáo trước khi sửa thanh điều hướng mobile và focus được giữ riêng để đối chiếu.

## Lịch sử lần thu thập

Trong kiểm tra AI với catalog thật, tên đầy đủ Pepsi (Lon) từng bị gộp với các combo có Pepsi trong mô tả. Đã sửa bộ phân giải để ưu tiên tên khớp đầy đủ sau chuẩn hóa tiếng Việt. Tên rộng như Pepsi vẫn phải làm rõ khi có nhiều lựa chọn. Có regression riêng trên catalog đã thu thập.

Lượt browser agent `79c2d8bd-bfb5-4e84-9ac8-de91a30d3e17` kết thúc FAILED với lỗi xử lý `INVALID_ARGUMENT` từ provider. TinyFish Fetch sau đó thành công. Mã bộ dữ liệu local là `fetch-bb78d261-967d-45b0-8980-ab85cd7cf9a1`, phương thức `fetch`. Phản hồi gốc được giữ tại `.local/catalog-imports/tinyfish-scoped-fetch-20261115.json` và hash nằm trong snapshot.

Ví dụ giá được đọc trực tiếp gồm Xô Hợp Cạ 189k là 189.000 đồng, 1 Miếng Gà Rán là 37.000 đồng và Pepsi (Lon) là 20.000 đồng. Giá được xác nhận lại trên KFC khi người dùng mua. Các ảnh sản phẩm lấy từ `static.kfcvietnam.com.vn`, ghép trực tiếp theo DOM.
## Món yêu thích và tìm kiếm kết hợp

Đợt bổ sung ngày 15/11/2026 thực hiện trên branch `fix/bedrock-haiku-55-migration`. Phạm vi gồm thẻ món và bộ lọc trong `storefront.tsx`, CSS mua hàng, `FavoritesService`, API `/api/favorites`, snapshot storefront, kiểu preferences và validation/API menu. Server người dùng chạy cổng 3105 với `LOCAL_DATA_DIR=.local/kfc-purchase-20261115`. Kiểm tra trình duyệt dùng các cổng 3112, 3113 và thư mục synthetic riêng. Kiểm tra HTTP dùng cổng 3197 và thư mục tạm riêng.

Người dùng chạm trái tim trên thẻ món để lưu hoặc bỏ lưu, sau đó chọn **Món yêu thích** để xem lại. Bộ lọc này kết hợp với từ khóa, danh mục, giá tối đa và sắp xếp. Trạng thái trái tim dùng `aria-pressed`, có tên món trong nhãn và hỗ trợ bàn phím. Ô tìm kiếm dưới 600 px chiếm đủ chiều rộng vùng lọc.

Danh sách được lưu ở server trong preferences, tối đa 200 món. Phiên khách và từng tài khoản có danh sách riêng. Đăng nhập hiển thị danh sách của tài khoản. Xóa cookie phiên khách làm mất quyền truy cập danh sách của phiên đó. Món đã ngừng hiển thị vẫn được giữ trong dữ liệu yêu thích để có thể xuất hiện lại khi thực đơn khôi phục món.

`GET /api/favorites` trả `itemIds` và `revision`. `PUT /api/favorites` nhận `itemId`, `saved` dạng boolean và `revision` hiện tại. Server xác định người dùng từ cookie, kiểm tra origin, owner hiển thị và dữ liệu đầu vào. Cập nhật từ phiên bản cũ trả 409 `FAVORITES_CHANGED`. UI tải lại snapshot trước lần thao tác tiếp theo. Các tab đồng bộ bằng BroadcastChannel và khi cửa sổ được focus. Giới hạn kiểm chứng hiện tại là local một tiến trình, cùng cơ chế khóa và ghi file của ứng dụng.

`GET /api/menu` đã áp dụng đồng thời `q`, `categoryId`, `minPrice`, `maxPrice`, `sort` và `limit`. Giá là số nguyên VND trong khoảng 0–5.000.000, `limit` từ 1–100, `sort` nhận `price_asc`, `price_desc`, `name`. Khoảng giá đảo ngược và dữ liệu số sai trả 400. Luồng tra cứu món/combo bằng ID và phản hồi thực đơn mặc định được giữ tương thích với caller hiện có.

Kết quả kiểm tra của đợt bổ sung

- `npm run check` đạt, gồm lint, typecheck, 101 nhóm chat mock, 10 nhóm dữ liệu local, các kiểm tra AWS/Bedrock offline, build và 80 nhóm HTTP. Log tại `output/verification/favorites-full-check-20261115.log`.
- `node scripts/test-favorites.cjs` đạt 5 nhóm, gồm preferences cũ, quyền sở hữu, bản sao DTO, sửa đồng thời, idempotency, phiên bản sau thao tác bỏ/lưu lại và giới hạn danh sách.
- `node scripts/test-agent-learning.cjs` đạt 10 nhóm hồi quy dữ liệu và công cụ AI offline.
- Kiểm tra trình duyệt món yêu thích đạt 4 nhóm, kiểm tra lại luồng mua hàng đạt 8 nhóm. Đã kiểm tra chiều rộng 320, 390, 768, 1024 và 1440 px, đăng nhập lại, hai tab và phiên trình duyệt độc lập. Báo cáo món yêu thích tại `output/verification/favorites-ui-20261115.json`.
- Sau chỉnh CSS mobile, build và lint chạy lại đạt. `npm run team:check`, `npm run test:team` đạt.
- Bản local cổng 3105 trả health OK, 101 món/chín nhóm, API yêu thích trả 200 với cache private/no-store. Đợt này dùng 0 lượt inference trả phí. Phần bổ sung này đã nghiệm thu local, phát hành AWS cần một đợt release riêng.

## Cập nhật định kỳ và chi phí

Người dùng đã duyệt bật lịch local ngày 15/11/2026, tối đa 24 lượt TinyFish Fetch/ngày UTC. Cấu hình local hiện dùng `KFC_CATALOG_AUTO_REFRESH=1`, `KFC_CATALOG_INTERVAL_MINUTES=60`, `KFC_CATALOG_DAILY_FETCH_LIMIT=24`. Mẫu `.env.example` để cờ tự động ở 0 để thành viên khác chủ động cấu hình ngân sách của mình.

Lịch chạy trong tiến trình Next.js khi server hoạt động, với purchase assistant và persistence local. `src/instrumentation.ts` khởi tạo một lịch trong tiến trình Node. `src/lib/catalog/catalog-refresh.ts` lưu số lượt trước khi gọi nguồn, giữ hạn mức và thời điểm kiểm tra qua restart, chặn chạy chồng, giãn lần thử khi lỗi tối đa sáu giờ cho cấu hình mặc định. Lỗi ghi trạng thái trước khi gọi sẽ dừng lượt đó. Hạn mức này áp dụng cho lịch của ứng dụng local, các công cụ khác dùng chung tài khoản TinyFish có usage riêng.

Mỗi lượt chỉ Fetch một URL thực đơn, scope `app-product`, chấp nhận cache nguồn tối đa 3.600 giây. Với chu kỳ một giờ, thay đổi trên nguồn có thể cần gần hai giờ để được quan sát, cộng thời gian xử lý và đồng bộ trình duyệt. Thông báo trên web phân biệt thời điểm dữ liệu nguồn và thời điểm kiểm tra thành công. Mô tả TTL được đối chiếu với [Fetch API Reference](https://docs.tinyfish.ai/fetch-api/reference).

Bảng giá tài khoản TinyFish trả về ngày 15/11/2026 có Fetch Builder 0,001 USD/URL và Fetch Hobby 0 USD/URL. Theo mức Builder, 24 URL/ngày tương ứng tối đa 0,024 USD/ngày, khoảng 0,72 USD/30 ngày cho riêng lịch này. Chi phí thực tế phụ thuộc gói và allowance còn lại. Tài liệu TinyFish ghi Search/Fetch có phần miễn phí hằng ngày và có thể trừ ví sau allowance. [TinyFish Documentation](https://docs.tinyfish.ai/)

Parser Python hiện có được dùng lại. Capture thô, attempt và catalog đã kiểm tra được lưu riêng dưới `LOCAL_DATA_DIR/catalog-captures/<UUID>`. Trước khi công bố, hệ thống kiểm tra schema và độ đầy đủ. Capture dưới 80% số món nguồn đang hoạt động hoặc thiếu danh mục đang có sẽ được giữ để review, thực đơn đang phục vụ tiếp tục được dùng. Khi nguồn thực sự thay đổi lớn, cần người tích hợp review capture trước khi nhập theo quy trình thủ công.

`applyLocalCatalog` lấy khóa nghiệp vụ rồi khóa ghi file, đọc snapshot mới nhất, tạo backup và đổi file nguyên tử trước khi cập nhật các map đang phục vụ. Giỏ, đơn, phiên và preferences được giữ từ snapshot mới nhất. Nội dung công khai giống nhau sẽ bỏ qua ghi store và backup, dù metadata capture mới hơn. Capture cũ bị từ chối. Món biến mất trong một capture đủ điều kiện được ngừng hiển thị và giữ lịch sử.

`GET /api/catalog/status` chỉ trả trạng thái đồng bộ và fingerprint nội dung công khai, cache tối đa 30 giây. Trình duyệt kiểm tra trạng thái mỗi phút khi trang hiển thị và tải lại snapshot khi version thay đổi. Thao tác đang diễn ra và các dialog được giữ qua cơ chế tạm dừng kiểm tra. Chế độ mua hàng dùng lịch này, phần polling cấu hình cửa hàng 30 giây được tắt trong chế độ này.

Phạm vi đợt sửa nằm trên branch `fix/bedrock-haiku-55-migration`, gồm catalog worker/fetch/fingerprint, local repository, instrumentation, API trạng thái, snapshot, thành phần hiển thị độ mới và cấu hình runtime. Local chính dùng cổng 3105 và data `.local/kfc-purchase-20261115`. Kiểm tra trình duyệt dùng cổng 3114, data synthetic riêng.

Kết quả nghiệm thu

- `npm run check` đạt, gồm lint, typecheck, 101 nhóm chat, 10 nhóm backup/recovery, kiểm tra AWS/Bedrock offline, build và 80 nhóm HTTP. Log `output/verification/catalog-continuous-full-check-20261115.log`.
- `node scripts/test-catalog-refresh.cjs` đạt 10 nhóm offline về hạn mức, restart, gọi đồng thời, backoff/recovery, khoảng lịch dài, lỗi ghi trạng thái, no-op, khóa công bố, dữ liệu thiếu/cũ, lỗi ghi store và parser Fetch.
- `node scripts/test-agent-learning.cjs` đạt 10 nhóm. `node scripts/test-kfc-catalog.cjs` đạt 11 nhóm. Guard nhóm và lint cuối đạt.
- Trình duyệt đạt bốn nhóm, gồm status/version, nhận giá mới và định giá lại giỏ giữ favorites, lỗi trạng thái giữ menu, các chiều rộng 320/390/768/1440 px. Báo cáo `output/verification/catalog-continuous-browser-20261115.json`.
- Lượt Fetch thật đầu tiên thành công lúc 09:05:13 UTC ngày 15/11/2026, nội dung không đổi. Khởi động lại vẫn dùng một lượt, store được giữ nguyên byte. Lần tiếp theo hẹn lúc 10:05:13 UTC. Báo cáo `output/verification/catalog-continuous-live-20261115.json`. Đợt này dùng 0 lượt Bedrock inference.
- Gói source thêm parser, Next tracing có parser và Docker runtime bổ sung Python 3. Kiểm tra đóng gói offline đạt. Chưa build/chạy image Docker của đợt này vì Docker Desktop Linux daemon chưa hoạt động trên máy. Bản đang nghiệm thu là local, cần kiểm tra image và thực hiện release riêng trước khi dùng phần mới trên AWS.

## Thẻ món trong chat và giọng nói

Đợt bổ sung ngày 15/11/2026 dùng branch hiện tại `fix/bedrock-haiku-55-migration`. Phạm vi gồm các thành phần `src/components/chat`, assistant panel, storefront, ChatService, ngữ cảnh/prompt của agent, validation request, DTO và API đọc lịch sử. Local chính dùng cổng 3105 với data `.local/kfc-purchase-20261115`. Kiểm tra trình duyệt dùng cổng 3115 và data synthetic riêng.

Kết quả LIST_MENU, SEARCH_MENU và GET_MENU_ITEM đã thực thi có thể tạo tối đa sáu thẻ món. Mỗi thẻ có ảnh nguồn, tên, giá đang phục vụ, nút xem chi tiết và nút chọn. Server chỉ lưu ID món trong message, tra lại catalog khi đọc lịch sử và loại món đã ngừng hiển thị. DTO thẻ chỉ có ID, tên, giá và URL ảnh. Giá hoặc ảnh trong lời model được thay bằng dữ liệu tra từ server khi dựng thẻ.

Nút **Chọn món +** gửi `selectedProduct` gồm `itemId` và quantity nguyên 1–100. Server kiểm tra schema nghiêm ngặt và chạy cùng policy/confirmation hiện có. Lượt chọn bằng thẻ dùng 0 lượt inference, kể cả tên ưu đãi có số như Deal 99K. Thao tác vẫn cần token/owner/thời hạn và chữ ký dữ liệu hiện tại để xác nhận. Lịch sử thẻ được phục hồi sau reload/restart. Khi đổi danh tính, chat được remount để xóa bản nháp và dừng micro của phiên cũ.

Micro sử dụng Web Speech API, ưu tiên `SpeechRecognition` hoặc `webkitSpeechRecognition` với ngôn ngữ `vi-VN`. Kết quả chỉ điền vào ô nhập, người dùng sửa lại và bấm gửi. Micro dừng khi đóng phần chat hoặc chuyển tab sang nền. Lỗi quyền, thiếu micro, lỗi mạng và trình duyệt chưa hỗ trợ có thông báo riêng. Cần HTTPS hoặc localhost. Dịch vụ nhận dạng mặc định có thể xử lý âm thanh qua nền tảng của trình duyệt. Ứng dụng gửi văn bản đã được người dùng bấm gửi vào luồng chat. [MDN Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)

Nút **Nghe trả lời** dùng SpeechSynthesis sau khi người dùng bấm. Ưu tiên giọng Việt được cài trên thiết bị, có nút dừng và báo lỗi khi không đọc được. Nội dung có thẻ món được đọc bằng giá hiện tại của thẻ. Chất lượng tiếng Việt phụ thuộc giọng đọc và dịch vụ nhận dạng trên thiết bị.

Prompt được bổ sung hướng dẫn trò chuyện theo ngữ cảnh và server gửi DISPLAYED_PRODUCTS_JSON có vị trí, ID, tên, giá của nhóm thẻ gần nhất. Nhờ đó model có dữ liệu để hiểu yêu cầu như “thêm hai phần món thứ hai vừa xem”. Câu hỏi chưa rõ vẫn cần làm rõ, các thao tác giữ nguyên confirmation. Bộ sáu tình huống ở `tests/data/kfc-rich-conversation.vi.json` do agent soạn cho phát triển, cần nhóm review. Phần cải thiện AI sử dụng hướng dẫn và context, fine-tune trọng số chưa thực hiện.

Lần đọc công khai mới nhất bằng TinyFish có 99 thẻ món, chín nhóm và không có exclusion. Hai món Xô Zòn Zã 159K và Xô Zui Zẻ 139K không xuất hiện trong lần đọc này. Bản local đã nhập capture mới và giữ hai món ở trạng thái ngừng hiển thị, giữ nguyên đơn cũ và preferences. Snapshot bundled 101 món được giữ làm baseline kiểm duyệt trước đó. Các clone mới dùng baseline đó cho tới khi nhập capture mới hoặc bật lịch đã được duyệt. Lịch local 60 phút và trần 24 Fetch/ngày tiếp tục hoạt động.

Kết quả của đợt bổ sung

- `npm run check` đạt sau sửa, gồm 101 nhóm chat, 10 nhóm dữ liệu, AWS/Bedrock offline, build và 83 nhóm HTTP. Bản build và lint được chạy lại sau chỉnh phần hiển thị và đọc giá trong chat. Log chính tại `output/verification/rich-chat-complete-check-20261115.log`.
- `node scripts/test-rich-chat.cjs` đạt bốn nhóm về nguồn thẻ, DTO, lịch sử/giá mới và lựa chọn không qua model nhưng có xác nhận một lần. Các kiểm tra learning/refresh hiện có đều đạt.
- Kiểm tra trình duyệt đạt bảy nhóm, gồm phiên âm điền draft, chọn thẻ trên desktop/mobile qua xác nhận, ảnh/chi tiết, TTS đọc đúng giá thẻ, lỗi và retry micro, đóng dialog dừng micro, đổi danh tính xóa draft, fallback và các chiều rộng 320/390/768/1024/1440 px. Các API speech được mô phỏng để kiểm tra luồng UI, cần nhóm kiểm tra thêm micro và chất lượng âm thanh thật trên thiết bị. Báo cáo tại `output/verification/rich-chat-browser-20261115-audio-price.json`.
- Haiku 5.5 thật tại Singapore đạt ba tình huống phát triển, gồm ba thẻ burger theo giá tăng dần, chọn hai phần của thẻ thứ hai qua câu nối tiếp và xem combo mà giữ giỏ. Counter local tăng từ 5 lên 8 trong hạn mức 25/ngày UTC. Đây là kiểm tra chấp nhận trên tập nhỏ đã biết. Báo cáo tại `output/verification/rich-chat-real-ai-20261115.json`.
- Audit dữ liệu tại `output/verification/rich-chat-catalog-audit-20261115.json`. Phần mới đã kiểm chứng local, phát hành AWS và nghiệm thu image Docker vẫn còn cần thực hiện.

## Chỉnh bố cục và nhận diện giao diện

Đợt chỉnh ngày 15/11/2026 trên branch `fix/bedrock-haiku-55-migration` tập trung vào `src/components/storefront/storefront.tsx`, `assistant-panel.tsx` và `src/app/purchase-storefront.css`. Bản người dùng chạy cổng 3105, data `.local/kfc-purchase-20261115`. Kiểm tra trình duyệt dùng mock AI trên cổng 3116, data synthetic riêng và capture thực đơn công khai 99 món.

Banner dùng nền đỏ, chữ trắng, ba sọc trắng và ảnh món từ catalog. Khu vực nguồn được rút thành thông tin nguồn và liên kết mở KFC. Bộ lọc giá/sắp xếp thu gọn bằng nút có `aria-expanded`, giữ giá trị khi đóng và báo số điều kiện đang áp dụng. Xóa bộ lọc đưa cả sắp xếp về thứ tự thực đơn. Danh mục và món yêu thích tiếp tục truy cập trực tiếp.

Chat tăng chữ nội dung lên 13 px và ô nhập lên 14 px, tăng diện tích nút giọng nói/gửi/xác nhận, làm gọn phần trợ giúp. Trên điện thoại hẹp, giá và nút thêm món nằm thành hai hàng để đọc và bấm rõ hơn. Thông báo thao tác có nút ẩn để người dùng tiếp tục xem thực đơn. Ảnh hero giữ tĩnh. Các selector nhận diện mua hàng được kiểm tra để giữ tương phản trước các style cũ.

`npm run check` đạt, gồm build và 83 nhóm HTTP. `npm run team:check`, `npm run test:team` và `git diff --check` đạt. Sáu nhóm trình duyệt đạt, kiểm tra 11 độ rộng 320/360/390/480/481/600/768/800/801/1024/1440 px, gồm bộ lọc bằng bàn phím, yêu thích, so sánh, chi tiết, số lượng giỏ, đóng giỏ bằng Escape và trả focus, chọn món qua xác nhận trong chat mobile và mở luồng KFC. Lượt nghiệm thu UI dùng 0 lượt inference trả phí.

Bằng chứng nằm ở `output/verification/ui-refinement-complete-check-20261115.log` và `ui-refinement-browser-20261115-final.json`. Ảnh `ui-refinement-desktop-20261115.png` và `ui-refinement-mobile-initial-20261115.png` chụp giao diện lúc mới vào trang. Health local sau khởi động lại trả OK, provider Bedrock. Đợt giao diện này được kiểm chứng local, phát hành AWS cần đợt release riêng.

## Giỏ có ảnh và kiểm tra danh sách mua

Đợt bổ sung trên branch `fix/bedrock-haiku-55-migration` gồm cart panel, hộp xác nhận xóa giỏ, màn hình danh sách mua, `POST /api/cart/review`, helper/DTO review và các kiểm tra liên quan. Server người dùng dùng cổng 3105 với data `.local/kfc-purchase-20261115`. Trình duyệt kiểm tra dùng mock AI trên cổng 3117 và thư mục synthetic riêng, cùng capture công khai 99 món.

Giỏ hiển thị ảnh, số lượng và thành tiền từng món. Nút xóa toàn bộ mở hộp xác nhận với số phần và tổng hiện tại. Hộp thoại giữ nguyên signature lúc mở. Giỏ thay đổi ở tab khác sẽ khiến yêu cầu xóa cũ bị từ chối, người dùng mở lại giỏ hiện tại để xem. Nếu phản hồi xóa bị mất sau khi server đã lưu, UI đọc lại dữ liệu và chặn dùng lại hộp thoại cũ. Các thao tác xóa giữ validation, owner, origin và CAS hiện có.

Trước khi mở màn hình mua, UI gọi API review. Endpoint dùng customer lock rồi SHOP_ORDER_GATE để đọc giỏ/giá và trạng thái niêm yết nhất quán với catalog hiện tại. Response private/no-store gồm basket, checkedAt và thông tin ảnh/trạng thái cho từng dòng. Khi dữ liệu vừa đổi, UI làm mới và thử lại thao tác đọc review tối đa một lần. Thao tác xóa dùng signature ban đầu của hộp thoại.

Màn hình review có ảnh, số lượng, đơn giá, thành tiền, tổng tham khảo và thời điểm kiểm tra. Món thiếu trong catalog hoặc có isActive/isAvailable false được đánh dấu trong giao diện và văn bản xuất. Cờ available biểu thị trạng thái niêm yết trong catalog công khai. KFC xác nhận tình trạng theo nhà hàng khi đặt. Người dùng có thể quay lại sửa giỏ, kiểm tra lại, sao chép hoặc tải `danh-sach-kfc.txt`, rồi mở KFC để chọn món/nhà hàng/thanh toán.

Khi clipboard bị từ chối, phần văn bản mở ra và được chọn để người dùng sao chép thủ công. Thông báo sao chép gắn với đúng nội dung vừa sao chép để cập nhật giá hoặc trạng thái mới có phản hồi chính xác. Văn bản xuất gồm tên, số lượng, tiền và liên kết nguồn. Contact, ghi chú khách và các identifier của giỏ/phiên được loại khỏi nội dung xuất. Nhóm nút hành động được giữ ở đáy vùng cuộn trên mobile.

Kết quả kiểm tra

- `npm run check` đạt, gồm lint/typecheck, 101 nhóm chat, dữ liệu/AWS/Bedrock offline, build và 84 nhóm HTTP. Log `output/verification/shopping-review-complete-check-20261115.log`. Build và lint chạy lại sau chỉnh hộp thoại/footer.
- `node scripts/test-shopping-review.cjs` đạt ba nhóm về nguồn ảnh, giá và signature mới, món thiếu/ngừng hiển thị, export giữ nội dung mua hàng và loại dữ liệu riêng. `node scripts/test-rich-chat.cjs` đạt bốn nhóm. Guard nhóm và `git diff --check` đạt.
- Trình duyệt đạt bảy nhóm về ảnh giỏ, giữ/xóa, chống thao tác từ hộp thoại cũ, sao chép/tải file, clipboard bị từ chối, đổi giá/ngừng niêm yết, các độ rộng 320/390/600/768/1440 px, quay về sửa giỏ và mất phản hồi sau khi xóa đã commit. Báo cáo `output/verification/shopping-review-browser-20261115-final-attempt2.json`.
- Chạy lại sáu nhóm giao diện tổng thể đạt trên 11 độ rộng. Báo cáo `output/verification/shopping-regression-ui-refinement-browser-20261115-final.json`. Kiểm tra dùng 0 lượt inference trả phí.
- Bản local đã được bật lại, health OK, Bedrock được cấu hình và lịch cập nhật catalog vẫn bật. Phần mới cần đợt release riêng để phát hành AWS.
