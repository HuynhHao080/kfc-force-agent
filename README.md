# KFC Force Agent — hệ thống đặt món và vận hành demo

Project khóa luận có tài khoản khách, thực đơn động, giỏ hàng, trợ lý hội thoại có kiểm soát, checkout, quản trị đơn/món và báo cáo. Next.js 16.4.5, React 19, TypeScript, Tailwind CSS 4; provider và repository có adapter riêng.

**Đây là project học tập, không phải kênh đặt hàng chính thức của KFC. Đơn demo không được gửi đến nhà hàng và không thu tiền.**

## Làm việc nhóm

Ba thành viên dùng branch và clone/worktree riêng, đọc [CONTRIBUTING.md](CONTRIBUTING.md) và [AGENTS.md](AGENTS.md) trước khi giao việc cho agent. Skill dùng chung được lưu trong `.agents/skills/kfc-team-development`. Trước commit chạy `npm run team:check`; chỉ merge qua PR có review và CI. Chủ repo cần bật branch protection trên GitHub theo hướng dẫn; file trong repo không tự bật các quyền đó.

## Mục tiêu bàn giao 01/01/2027

Theo yêu cầu giảng viên cập nhật 09/11, bản cuối phải có **AI thật và triển khai AWS**. Xem [kế hoạch nước rút](docs/graduation/sprint-plan-2026-11-09.md) và [cấu hình, chi phí, trình tự AWS](docs/graduation/aws-readiness.md). Đã chuẩn bị Bedrock canary, Dockerfile, CloudFormation và release theo SHA256/S3 VersionId; preflight chỉ đọc đã qua. Chưa gọi AI thật, chưa build image Linux hoặc triển khai AWS.

## Bắt đầu trên Windows / PowerShell

Yêu cầu Node.js 22.13+ và npm. Đã kiểm tra bằng Node.js 26.3.0 trên Windows.

```powershell
npm ci
if (-not (Test-Path .env.local)) { Copy-Item .env.example .env.local }
npm run admin:setup
npm run dev
```

Mở http://localhost:3000. Trang chủ chuyển đến `/chat`, nơi có thực đơn, giỏ hàng và trợ lý trên cùng giao diện. Nếu đã có `.env.local`, giữ cấu hình của bạn; không ghi đè file đó.

Chạy bản production local:

```powershell
npm run build
npm start
```

Mặc định `AI_PROVIDER=mock`, `PERSISTENCE_DRIVER=local`: không gọi Bedrock hay DynamoDB. Không cần AWS credentials. Các minh hoạ món ăn là SVG local, không phụ thuộc máy chủ hình ảnh ngoài.

## Chức năng

- Sao lưu local mã hoá, kiểm tra integrity và khôi phục vào thư mục mới; không ghi đè dữ liệu đang có. Hướng dẫn PowerShell tại [docs/local-backup.md](docs/local-backup.md).

- Nhật ký catalog tại Admin → Nhật ký: xem người quản trị chung đã tạo/sửa món/danh mục, giá trị trước–sau; lọc theo loại thay đổi và tìm tên/mã. Dữ liệu và nhật ký được lưu cùng mutation local.

- Snapshot storefront theo một owner và chặn thao tác từ phiên hiển thị cũ. Admin tự đồng bộ theo thông báo/focus và mỗi 15 giây khi visible, tạm dừng lúc sửa biểu mẫu.

- Quản lý danh mục: tạo/sửa tên, mô tả, thứ tự và trạng thái; danh mục còn món không thể tắt. Menu khách đồng bộ danh mục và thứ tự mới.

- Phiếu đơn riêng tư: mở từ chi tiết đơn, in hoặc lưu PDF bằng trình duyệt; giá snapshot, nhãn demo và chưa thu tiền. Chỉ chủ đơn xem được.
- Lọc quản trị theo ngày Việt Nam, trạng thái, hình thức nhận và tìm không dấu. Danh sách, thống kê và CSV dùng chung bộ lọc trên tối đa 200 đơn gần nhất.

- Quản lý tài khoản: sửa họ tên, đổi mật khẩu với mật khẩu hiện tại và xác nhận mới. Đổi thành công vô hiệu mọi phiên cũ; đăng nhập lại vẫn giữ giỏ và lịch sử. Không thay thế email recovery.

- Tài khoản khách: đăng ký, đăng nhập, đăng xuất và thu hồi từng phiên; giữ lịch sử trên trình duyệt khác. Guest vẫn đặt được món, nhưng giỏ/lịch sử guest không tự nhập vào tài khoản.
- Quản trị tại /admin có đăng nhập riêng: xem đơn, xử lý theo trạng thái, quản lý thực đơn và thống kê. Mật khẩu ngẫu nhiên ở LOCAL_DATA_DIR/admin-bootstrap.txt, không có mật khẩu mặc định; không đưa file đó vào báo cáo/Git.
- Pickup: CONFIRMED → PREPARING → READY → COMPLETED; delivery dùng DELIVERING thay READY. Server chặn bỏ bước/quay lại và ghi lịch sử vai trò.
- Thêm/sửa/ẩn/hết món, ảnh local allowlist; giữ giá snapshot trong đơn đã đặt.
- Báo cáo tối đa 200 đơn gần nhất, biểu đồ/bảng theo ngày và CSV không tên, điện thoại hoặc địa chỉ. Giá trị completed là demo, không phải tiền thu.
- Tìm món tiếng Việt có/không dấu, lọc danh mục; ẩn món không còn bán.
- Thêm món, gộp dòng giống nhau, tăng/giảm số lượng, xoá món; giá lấy từ server. Mỗi dòng tối đa 100 phần, tối đa 50 dòng.
- Chat xem menu/giỏ và đề xuất thêm, đổi số lượng hoặc xoá món. Nhấn **Xác nhận thao tác** để thực hiện, **Bỏ qua** để huỷ đề xuất.
- Server lưu đề xuất cụ thể; tin nhắn mới hoặc chỉnh giỏ trực tiếp làm mất hiệu lực đề xuất trước. Hai yêu cầu xác nhận đồng thời trong cùng tiến trình chỉ thực hiện một lần. Mỗi đề xuất có mã riêng, thời hạn 15 phút và bản xem trước tên món/số lượng/giá. Tab cũ không thể xác nhận hoặc bỏ qua nhầm đề xuất mới.
- Checkout có tên, số điện thoại Việt Nam, địa chỉ, ghi chú; chọn nhận tại cửa hàng hoặc giao tận nơi. Phí giao demo 15.000đ, nhận tại cửa hàng miễn phí.
- Kiểm tra lại giỏ và giá tại checkout. Nếu giỏ thay đổi kể từ lúc xem lại, server từ chối để khách kiểm tra lại.
- Đơn hàng lưu đầy đủ món, giá, phí giao, thông tin khách và lịch sử trạng thái. Gửi lại cùng khoá checkout trả về cùng đơn.
- Xem lịch sử/chi tiết; khách chỉ huỷ đơn CONFIRMED. Các bước chuẩn bị/nhận/giao do quản trị thao tác nội bộ demo, không kết nối bếp hoặc tài xế thật.
- Phiên khách được ký, cookie `HttpOnly`, `SameSite=Lax`. ID người dùng do server quyết định, không tin ID từ client. Dữ liệu riêng có `Cache-Control: private, no-store`.
- Giữ phiên, giỏ, hội thoại và đơn sau khi tải lại trang hoặc restart server với cùng thư mục dữ liệu/secret.
- Đồng bộ giỏ, hội thoại và đề xuất giữa các tab cùng phiên bằng BroadcastChannel; đồng bộ lại khi quay về cửa sổ. Không ghi đè form checkout đang mở.
- Lỗi mạng, timeout và phản hồi HTML được chuyển thành thông báo tiếng Việt; có nút **Làm mới dữ liệu**. Không tự gửi lại thao tác thay đổi dữ liệu.
- Responsive desktop/mobile, hỗ trợ bàn phím, nhãn nhập liệu và native dialog quản lý focus.

Ví dụ chat:

```text
Cho mình xem thực đơn
Cho mình 2 Pepsi 1.5L
[Nhấn Xác nhận thao tác]
Đổi Pepsi thành 3
[Nhấn Xác nhận thao tác]
Xem giỏ hàng
Xoá Pepsi khỏi giỏ hàng
[Nhấn Xác nhận thao tác]
```

Bộ hiểu câu offline hỗ trợ các mẫu trên và cách nói “Cho mình 2 combo gà cay”, “Gọi 1 burger gà rán”. Dung tích 1.5L được giữ trong tên món; số lượng 0, âm hoặc thập phân bị chặn. Câu phủ định không tạo đề xuất thay đổi. Đây không phải một mô hình ngôn ngữ tổng quát. Menu hiện dùng phần tiêu chuẩn; tuỳ chọn có phụ phí chưa được hỗ trợ và bị từ chối.

## Dữ liệu và cấu hình

| Biến                  | Mặc định         | Ý nghĩa                                                           |
| --------------------- | ---------------- | ----------------------------------------------------------------- |
| `AI_PROVIDER`         | `mock`           | `mock` hoặc `bedrock`                                             |
| `PERSISTENCE_DRIVER`  | `local`          | `local`, `mock` hoặc `dynamodb`                                   |
| `LOCAL_DATA_DIR`      | `.local`         | Thư mục ghi dữ liệu local và secret phiên                         |
| `SESSION_SECRET`      | Tạo và lưu local | Chuỗi riêng tư tối thiểu 32 ký tự; cần giữ ổn định khi triển khai |
| `AWS_REGION`          | `ap-southeast-1` | Chỉ dùng khi tích hợp AWS                                         |
| `DYNAMODB_TABLE_NAME` | `KfcForceAgent`  | Bảng DynamoDB đã được chuẩn bị                                    |
| `BEDROCK_DAILY_REQUEST_LIMIT` | `25` | Trần lượt gọi thật/ngày UTC cho một tiến trình; 0 tắt inference, không phải trần USD |
| `BEDROCK_MODEL_ID`    | `mock-model`     | Phải đặt ID model thực khi chọn Bedrock                           |

`.local/store.json` chứa thông tin liên hệ demo và đơn hàng. `.local/session-secret` dùng ký cookie. Cả thư mục đã bị Git và server tracing loại trừ; đừng chia sẻ hoặc đưa vào public. Sao lưu cả thư mục nếu cần giữ dữ liệu và phiên. Thay secret sẽ làm phiên cũ hết hiệu lực.

Driver `local` dành cho **một tiến trình Node, ổ đĩa ghi được, dữ liệu nhỏ**. Các cập nhật được tuần tự hoá và ghi snapshot bằng rename; checkout lưu đơn, món và trạng thái giỏ trong cùng snapshot. Không dùng nhiều worker/process chung file. Các API riêng được tuần tự theo khách trong cùng tiến trình.

Driver `mock` chỉ lưu trong bộ nhớ và dành cho test. Driver DynamoDB đã có transaction cho checkout/huỷ đơn nhưng **chưa được xác minh trên AWS thật**. Chưa có bằng chứng sẵn sàng chạy cloud nhiều instance.

## Kiểm chứng

```powershell
npm run check
```

Lệnh này lần lượt chạy lint, TypeScript, test nghiệp vụ, backup/recovery, 3 test đóng gói/hạ tầng AWS offline, build và test HTTP trên production server tự khởi động tại cổng 3197. Cần cổng 3197 còn trống. Test HTTP dùng thư mục tạm riêng, tự đóng server, không gọi AWS và không dùng dữ liệu `.local` của bạn.

Các lệnh riêng:

```powershell
npm test
npm run lint
npm run typecheck
npm run build
npm run test:smoke
npm audit --omit=dev
```

- 101 nhóm kiểm tra service/provider/client helper: nghiệp vụ, grounding, protocol Bedrock bằng transport giả, prompt và lỗi mạng; không gọi AWS.
- 9 nhóm backup/recovery local: mã hoá, password/tamper, restore không overwrite và đọc lại bằng service thật.
- 76 nhóm HTTP: cookie/ownership, xác nhận đồng thời, checkout/retry, restart, account/session, role quản trị, workflow, race huỷ/chuẩn bị, quản lý menu và thống kê.
- Kiểm tra trình duyệt bằng Playwright CLI: tìm món, thêm trực tiếp/chat, xác nhận, giao hàng, checkout, xem/huỷ đơn và responsive. Xem ghi nhận tại `docs/verification.md`.

## Kiến trúc

```text
Giao diện → Route Handler → Phiên khách + khoá theo khách → Service → Repository
                               ↓
Chat → Provider → Đề xuất → Policy → Tool → Service
Checkout → kiểm tra giỏ/giá → commit đơn + món + sự kiện + đóng giỏ
```

- `src/components/storefront`: menu, giỏ, checkout, lịch sử và chi tiết đơn.
- `src/components/chat`: hội thoại và nhập tin.
- `src/lib/server`: phiên ký, lỗi API, kiểm tra origin, khoá xử lý.
- `src/lib/services`: nghiệp vụ chat, menu, giỏ và checkout.
- `src/lib/db/repositories`: local, mock và DynamoDB.
- `scripts`: kiểm thử offline và HTTP.

Các tài liệu `docs/phase*.md` là thiết kế các giai đoạn trước, một số ví dụ không còn khớp mã hiện tại. README và mã nguồn hiện hành mô tả hành vi mới.

## Phạm vi trước khi vận hành thật

Bản này hoàn thiện nhiều phân hệ demo local. Trước khi phục vụ thật vẫn cần email verification/recovery, nhiều nhân viên, tích hợp nhà hàng/POS, thanh toán/giao vận, cơ sở dữ liệu đa tiến trình và đánh giá LLM thực. Chưa có bằng chứng SLA/tải lớn, security certification hoặc toàn bộ WCAG. Khoá/version giỏ phân tán còn cần thiết kế. Triển khai AWS theo target và ngân sách đã duyệt; hướng dẫn pilot ở [AWS readiness](docs/graduation/aws-readiness.md).

## Hồ sơ khóa luận và bàn giao

Bổ sung API cho account/admin tại [docs/accounts-and-admin-api.md](docs/accounts-and-admin-api.md); API giỏ/chat/checkout ở [docs/api.md](docs/api.md).

Bắt đầu tại **[docs/graduation/README.md](docs/graduation/README.md)**: yêu cầu, use case, kiến trúc, sequence/ER/state diagrams, dữ liệu, ma trận test, đánh giá, kịch bản demo, nguồn tham khảo và khung chương báo cáo. Sinh viên cần hiểu, biên tập và hoàn thiện theo trường; đây không phải khóa luận đã được phê duyệt.

```powershell
npm run evaluate:report
npm run prompt:sync
python scripts/package-submission.py
```

Evaluate dùng dataset 50 câu có supported/challenge và công bố cả lỗi. Nó không đo Bedrock hoặc chất lượng người dùng thật. Prompt Markdown là bản gốc; sync tạo module runtime, test kiểm tra hai bản khớp.

Bedrock thật yêu cầu model ID cấu hình rõ; thiếu cấu hình/lỗi không biến thành mock success. Adapter body theo Anthropic Messages, chỉ kiểm thử transport giả hiện tại.

Archive source và bằng chứng ở output/submission, có manifest/SHA256; loại dữ liệu local, secret, dependencies, build và Git. Python 3 chỉ cần cho đóng gói, không bắt buộc để chạy ứng dụng.

CI Ubuntu/Windows Node 24 đã cấu hình với action pin SHA và quyền read. Chưa có kết quả GitHub runner trước khi người dùng đẩy repository và workflow chạy. Không tự deploy.

ADMIN_PASSWORD là override 12+ ký tự, ưu tiên file local; không ghi giá trị vào source. Đổi admin có chủ ý bằng npm run admin:setup -- --reset. CLI có --password-stdin. Staff session tối đa 8 giờ, bị thu hồi khi logout và mất sau restart. Customer session lưu server, có thể thu hồi, sống qua restart local.

Mật khẩu mới dùng scrypt N=32768/r=8/p=3, salt ngẫu nhiên; profile không có hash/salt. Login limit hiện toàn cục từng vai trò 10 lần/phút, chưa là limiter phân tán/per-IP. Cài/build đầu có thể cần mạng cho dependency/font; production build đã chuẩn bị không cần inference/cloud cho demo.

### Sổ địa chỉ tài khoản

Khách đăng nhập có thể lưu tối đa 5 địa chỉ, sửa/xoá và chọn một địa chỉ mặc định. Checkout giao hàng điền sẵn người nhận, điện thoại và địa chỉ; khách vẫn được sửa và phải xác nhận đơn. Sửa sổ địa chỉ không thay đổi thông tin của đơn cũ. API dùng revision để chặn ghi đè từ tab cũ. Xem docs/accounts-and-admin-api.md.

### Chạy báo cáo tiến độ

Sau khi có production build: npm run demo:start. Mở http://127.0.0.1:3100/chat và /admin. Cửa sổ khác chạy npm run demo:doctor. Các lệnh demo dùng mock/local và .local/preview, không đọc password/signing-key override từ môi trường. Nếu chưa có admin, chạy npm run demo:setup (không reset tài khoản đã có). Hướng dẫn: [checklist tối báo cáo](docs/graduation/tonight-demo.md).

### Khuyến mãi

Admin có tab Khuyến mãi để tạo/sửa/tắt mã phần trăm hoặc số tiền, thời hạn, đơn tối thiểu và trần giảm. Checkout áp mã qua báo giá server, luôn kiểm tra lại lúc đặt và giữ snapshot mã/mức giảm trên đơn, phiếu đơn. Mỗi đơn một mã, mã dùng nhiều lần, chưa có quota hoặc tích hợp voucher ngoài.

### Lịch sử và đặt lại đơn

Khách tìm/lọc lịch sử theo mã/tên người nhận và trạng thái. Mở chi tiết → Đặt lại món trong đơn này → xem giá hiện tại → xác nhận thêm vào giỏ trống. Chưa tạo đơn mới; khách vẫn phải checkout. Món hết bán, giá/giỏ thay đổi hoặc token hết hạn bị chặn. Retry cùng yêu cầu không thêm lần nữa; không sao chép voucher/contact/phí giao cũ.

### Hội thoại tiếng Việt

Parser offline hỗ trợ số viết bằng chữ và chữ số; phân biệt số phần với ml/lít. “Xoá Pepsi trong giỏ” chỉ xoá dòng Pepsi sau xác nhận; “Xoá toàn bộ giỏ hàng” mới có phạm vi toàn giỏ. Câu nhiều thao tác, nhiều số lượng hoặc tương đối chưa rõ được hỏi lại. Trong khung chat có Cách nói với trợ lý. Kết quả 49/50 trên bộ phát triển đã biết không phải độ chính xác tổng quát/LLM; baseline và hash được lưu trong hồ sơ đánh giá.

### Báo cáo món bán chạy

Admin → Báo cáo: top 10 món theo số phần từ đơn COMPLETED hợp lệ trong tối đa 200 đơn gần nhất, cùng bộ lọc ngày/trạng thái/hình thức/tìm kiếm. Có đối soát tiền món − giảm + phí = giá trị đơn, CSV có nguồn và chặn công thức spreadsheet. Chỉ là giá trị đơn demo, không phải tiền đã thu hoặc lợi nhuận.

Phạm vi bàn giao khóa luận: [bản local đã chốt và cách xác minh gói nộp](docs/graduation/local-release-scope.md).

Bảng bếp tại tab06 của /admin:4 cột vận hành, tổng phần cần chuẩn bị, lọc hình thức nhận, đồng bộ và chuyển bước. Chỉ staff trong bản local; xem FR33 trong hồ sơ yêu cầu.

Tab07 Cửa hàng: thông tin công khai/giờUTC+7, tạm ngừng/kênh nhận, fee/minimum và revision. Server kiểm tra khi checkout; đơn và receipt giữ snapshot điểm nhận. Default là dữ liệu demo chưa xác minh địa chỉ thực.

Sau đơn COMPLETED, khách đánh giá riêng1–5/nhận xét; quản trị tab08 Đánh giá lọc/trảlời. RevisionCAS và exactretry, đóng edit sau reply, source200 feedback updated gần nhất. Không công khai/không đưa nội dung vào CSV hay AI retrieval.
