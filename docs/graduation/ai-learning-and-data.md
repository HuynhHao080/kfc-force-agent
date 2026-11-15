# Cải thiện AI và cập nhật dữ liệu KFC

## Phạm vi ngày 15/11/2026

Bản hỗ trợ mua hàng local đã cập nhật 101 món thuộc chín nhóm từ KFC Việt Nam. Hai món mới so với bộ 99 món là Xô Zòn Zã 159K và Xô Zui Zẻ 139K. Toàn bộ 101 thẻ món quan sát được trong phản hồi TinyFish Fetch đã được nhập, có tên, mô tả, giá hiện tại, ảnh cùng thẻ và nguồn. Bằng chứng đếm và hash tại `output/verification/catalog-coverage-20261115.json`.

Bảng thành phần dị ứng chính thức được tìm thấy ở dạng ảnh. Ứng dụng dẫn người dùng đến trang KFC để xem và xác nhận thông tin. Trang tìm nhà hàng yêu cầu nhập địa chỉ và có nội dung động, lần Fetch chỉ đọc lấy được trang chọn địa điểm. Danh sách địa chỉ nhà hàng chi tiết và dữ liệu theo từng cửa hàng cần nguồn đọc được tương ứng.

## Phương pháp cải thiện AI

Đã áp dụng ví dụ few-shot trong prompt và truy xuất ngữ cảnh từ catalog hiện hành. Context chỉ chứa tối đa 12 món ứng viên, tối đa 12 dòng giỏ với tên, số lượng và giá, kèm tổng số dòng để model nhận biết tập con. Contact, ghi chú riêng, owner/session và metadata tùy ý được loại khỏi context này. Prompt giữ JSON của tin nhắn hiện tại ở cuối để tương thích cơ chế đọc message và giữ nội dung xuống dòng dưới dạng dữ liệu.

Tool SEARCH_MENU hỗ trợ `minPrice`, `maxPrice`, `sort` và `limit`. Khoảng giá là VND cho mỗi sản phẩm. Server kiểm tra giá trị hợp lệ, lọc theo catalog và sắp xếp trước khi lấy số kết quả yêu cầu. Tên món khớp đầy đủ được ưu tiên khi sửa giỏ. Những từ như gà được khớp theo từ trong mô tả để tránh khớp nhầm với ngậy hoặc ngày. Tìm kiếm tên món trên UI hỗ trợ tiền tố để tiếp tục tìm khi đang gõ.

Ví dụ tên ưu đãi có số như Xô Zòn Zã 159K được bổ sung vào prompt. Số 159K thuộc tên món, còn số lượng đặt được lấy riêng từ yêu cầu. Mọi thay đổi giỏ vẫn có bước đề xuất/xác nhận, token, TTL, owner và kiểm tra dữ liệu hiện tại.

Các câu hỏi về bảng dị ứng và tìm nhà hàng được trả bằng đường dẫn KFC đã xác minh, xử lý trực tiếp phía server. Đường dẫn chính thức trong phản hồi có thể bấm được trên UI. Các câu trả lời này đã được kiểm tra không tăng bộ đếm inference.

Phương pháp của đợt này là prompt, truy xuất dữ liệu và kiểm thử hành vi. Fine-tuning trọng số model là một quy trình riêng cần model, dữ liệu đã review, môi trường và ngân sách phù hợp.

## Dữ liệu phát triển và kết quả kiểm tra

`tests/data/kfc-agent-development.vi.json` có 38 câu phát triển gồm tìm theo giá, rẻ nhất, tên biến thể, ưu đãi có số, thêm/đổi/xóa giỏ và hỏi nguồn chính thức. Nhãn được agent hỗ trợ soạn, cần nhóm review trước khi đưa vào hồ sơ học thuật. Các câu này được dùng trong phát triển, cần xây dựng tập độc lập cho đánh giá chất lượng mô hình.

`node scripts/test-agent-learning.cjs` đạt 10 nhóm kiểm tra, gồm chạy lại 38 nhãn hành động qua policy/tool với dữ liệu tổng hợp. Các số này đo kiểm tra domain và cấu hình context, còn độ chính xác phân tích của LLM cần phép đo riêng. `node scripts/test-kfc-catalog.cjs` đạt 11 nhóm kiểm tra nhập dữ liệu và parser.

Đã kiểm tra Haiku 5.5 thật qua web local trong hạn mức 25 lượt/ngày UTC được duyệt. Hai luồng được kiểm tra là tìm tối đa năm món gà dưới 60.000 đồng theo giá tăng dần và đề xuất/thực thi một Xô Zòn Zã 159K sau xác nhận. Sau khi phát hiện lỗi tìm gà khớp vào ngậy, đã sửa bộ tìm kiếm và dùng thêm một lượt web kiểm tra lại. Tổng cộng đợt này dùng ba lượt, bộ đếm local từ 2 lên 5. Kết quả đúng sau sửa tại `output/verification/agent-learning-search-postfix-20261115.json`, kết quả hai luồng ban đầu tại `agent-learning-live-20261115.json`.

Kết quả parser phát triển hiện vẫn là 49/50 intent và joint. Báo cáo 24 lượt LLM của đợt trước có prompt/hash riêng. Mỗi đợt được ghi theo đúng bộ câu và phiên bản tương ứng, cần đối chiếu khi đưa vào báo cáo.

## Cập nhật catalog đang sử dụng

Lệnh `node scripts/sync-kfc-menu.cjs --fetch --job <UUID>` tạo bản thu thập mới. Xem `catalog.json`, nguồn/hash và chênh lệch trước khi áp dụng. Các bước cập nhật local gồm

1. Dừng tiến trình ứng dụng đang dùng đúng `LOCAL_DATA_DIR`.
2. Đặt `KFC_CATALOG_FILE` đến catalog đã review, hoặc dùng snapshot đã review đi kèm source.
3. Đặt `KFC_CATALOG_REFRESH=1`, khởi động một tiến trình ứng dụng.
4. Kiểm tra số món, nguồn, giỏ và bản sao `store.before-catalog-<UUID>.json` trong thư mục private.
5. Đặt lại `KFC_CATALOG_REFRESH=0` sau khi áp dụng thành công.

Cập nhật được dựng trong snapshot riêng rồi đổi file nguyên tử. Bản sao giữ dữ liệu trước cập nhật. Tài khoản, giỏ và snapshot đơn được bảo toàn, món chính thức mất khỏi nguồn được tắt trạng thái và giữ bản ghi. Catalog cũ hơn bản đang dùng bị từ chối. Khi lỗi publish, file dữ liệu cũ còn nguyên. Dữ liệu JSON và quy trình này dùng một tiến trình.

Đã thực hiện cập nhật local từ 99 lên 101 món, kiểm tra bản sao trùng byte với dữ liệu trước cập nhật và giữ các repository ngoài menu. Bằng chứng tại `output/verification/catalog-refresh-live-20261115.json`. Cấu hình refresh của máy đã được đặt lại 0.

## Kiểm tra cuối đợt

`npm run check` đã đạt lint, typecheck, 101 nhóm nghiệp vụ, 10 nhóm dữ liệu/khôi phục, năm test AWS offline, 14 test Bedrock offline, build và 76 nhóm HTTP. Log tại `output/verification/agent-learning-final-check-20261115.log`. Sau khi chỉnh hover thẻ món đã build lại thành công, log `agent-learning-final-build-20261115.log`.

Playwright đạt tám nhóm với catalog 101 món, gồm responsive 320–1440 px, tìm gà đúng từ, chọn món, giỏ, xác nhận/bỏ qua, phân tách phiên, handoff và liên kết nguồn chính thức. Báo cáo `output/verification/agent-learning-ui-browser-20261115.json` dùng provider mock ở tiến trình/data riêng và ngân sách inference bằng 0. Web local cổng 3105 đã được khởi động lại với Bedrock, health 200, catalog 101 món và bộ đếm 5/25 trong ngày UTC ghi khi bàn giao.
