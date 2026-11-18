# S1.4 — Offline Snapshot Intake & Normalization

## Baseline và phạm vi

HEAD: `a1cfeb4c093b532a48eada804031778f1b5ff55b`, branch `main`.
Đầu S1.4 đã có các thay đổi S1.2 chưa commit: package scripts, test prompt
CRLF/LF, contract doc/types/validator/test và fixture demo. Các file này được
giữ nguyên, trừ package scripts bổ sung lệnh S1.4. Báo cáo S1.3 trong hội thoại
giữ verdict CONDITIONAL: không có nguồn live hoặc dataset KFC verified được duyệt.

Pipeline chỉ đọc file local và trả object staging/quarantine/rejected; không có
HTTP client, crawler, DB adapter, migration, thao tác giỏ/đơn hàng hay publisher.
Không thay seed hoặc API. Không nạp dữ liệu vào runtime. Snapshot demo và các
biến đổi trong test là dữ liệu tổng hợp, không phải quan sát KFC hiện hành.

## Acquisition policy

Nguồn hỗ trợ:

| Source type | Yêu cầu | Nhãn dataset đầu ra |
|---|---|---|
| `demo_fixture` | Tự tạo cho test; URL null, capture local; không nhận là official | `seed_demo` |
| `manual_capture` | URL HTTPS, origin evidence, reuse evidence đã review | `unverified` |
| `provided_export` | Artifact được cung cấp, origin evidence, reuse evidence đã review | `unverified` |

Manifest không có kiểu `kfc_official` hoặc quyền nâng `kfc_verified`. `verified`
trong một trường manifest chỉ ghi nhận khẳng định review của bằng chứng đó,
không xác thực danh tính reviewer hoặc làm dataset được verified. Operator phải
kiểm tra quyền thật và tài liệu tham chiếu; schema không thể chứng thực giấy phép.
Pipeline không mở URL hoặc tự đọc các file được ghi trong evidence reference.

- Rights `denied`: reject. `unknown/unverified/not_applicable`: quarantine.
- Rights `verified`: bắt buộc có reference; đây là điều kiện staging, không phải
  cơ chế xác minh pháp lý tự động.
- Origin `unknown`, hoặc `unverified` thiếu reference: quarantine.
- Origin `not_applicable` chỉ hợp lệ với demo tự tạo; cần reason.
- `review.rejected`: reject. Review được supplied là `approved` vẫn không bỏ qua
  kiểm tra và đầu ra luôn `reviewStatus: pending`.
- Không có endpoint approve/publish. Reviewer kiểm tra staging, rights, nguồn,
  scope, unresolved và diff độc lập; xuất bản/migration là giai đoạn khác.
- Dữ liệu chứa khách hàng/đơn hàng không thuộc định dạng đầu vào. Không đưa PII,
  cookie, token hoặc credential vào snapshot/manifest. Schema strict từ chối
  trường ngoài định dạng, nhưng không phải bộ phát hiện PII trong văn bản tự do.

## Manifest và evidence

`menuAcquisitionManifestSchema` là strict schema version 1: snapshotId,
payloadPath, source (type, namespace, URL, evidence, sourceUpdatedAt nếu có),
capturedAt UTC, SHA256 exact bytes, contentType, captureMethod, httpStatus,
scope (store/region/channel/currency/description), rights và review.

Scope dùng `verified/unverified` với value; `unknown/not_applicable` với null
value và reason. Verified scope cần evidence reference. Không thay unknown bằng
not_applicable; trạng thái sau là khẳng định rõ trường không áp dụng. Currency
chỉ hỗ trợ VND theo S1.2. URL HTTPS không chứa user/password. Không tin HTTP 200
là bằng chứng menu. Thời gian source update không được sau capture; review không
được trước capture. Không kiểm tra freshness theo clock để replay deterministic.

SHA256 kiểm tra đúng bytes đã nhận, không kiểm tra nội dung đúng sự thật.
`.gitattributes` giữ nguyên bytes các fixture acquisition qua Windows/Linux;
không chuẩn hóa newline của snapshot trước khi hash.

## Luồng xử lý

```text
manifestPath + allowedRoot
  → read manifest local có giới hạn
  → validate manifest + policy
  → đọc đúng payloadPath trong root
  → size/hash/UTF-8/format checks
  → parse menu-observations JSON + đóng băng kết quả accepted
  → identity theo namespace + scope + key
  → normalize + S1.2 full-dataset validator
  → staging pending + evidence sidecar + unresolved
  → diff thuần dữ liệu (không ghi lại bản đã duyệt)
```

Reader chỉ đọc manifest và payload được chỉ định: manifest <=64 KiB, payload
<=2 MiB. Từ chối traversal, absolute/UNC/drive/device path, ADS, ký tự percent và
symlink/junction/hard-link aliases. Chỉ hỗ trợ filename ASCII tương đối, phân
cách bằng `/`. Kiểm tra realpath, file regular, size trước/sau và thông tin file
trong lúc đọc. Root phải được caller chọn hẹp, tin cậy, không có concurrent
writers độc hại. Kiểm tra path portable không thay thế sandbox filesystem và
không bảo đảm chống mọi race của ancestor directory trên mọi OS.

Hash được kiểm tra trước parse payload. HTML shell (`app-root`, root div,
`__next`) bị reject; HTML khác cũng bị reject vì S1.4 chưa có parser HTML chung.
Chỉ JSON quan sát có cấu trúc được hỗ trợ. Không thực thi JS hoặc HTML.
Accepted object được deep-freeze và đánh dấu nội bộ trong process; không thể
deserialize một object tự gán `accepted` để bỏ qua reader/hash.

## Định dạng quan sát và normalization

Xem `tests/fixtures/menu/acquisition/demo.snapshot.json`: formatVersion 1 và
các array products, combos, comboItems, variants, options, optionValues. Mỗi
record có key local rõ ràng. Không suy key từ tên, ảnh hoặc thứ tự array.

- Giá `current` và `strikethrough` tách biệt. Chỉ current được đưa vào Price;
  giá gạch ngang giữ trong sidecar, không làm giá thay thế khi current thiếu.
- Giá thiếu thành Price unknown có reason theo S1.2; không mặc định 0. VND trong
  Price unknown là denomination bắt buộc của contract, không phải quan sát mới.
- Availability thiếu thành unknown. Chỉ status được cung cấp mới được giữ;
  observation phải <=capture. Demo availability là declaration, không là live
  stock observation. Không suy đang bán từ nút Thêm hoặc sự xuất hiện của món.
- Variant/option/component chỉ tạo từ record được cung cấp. Parent bị thiếu/sai,
  key trùng, giá sai và vi phạm contract làm toàn snapshot quarantine, không xuất
  dataset một phần. Mảng rỗng không có nghĩa nguồn thật không có variant/option.
- Combo `unresolved` chuyển thành composition unknown có reason; rawText giữ
  trong sidecar. Không parse số lượng từ câu có “hoặc”, không tự hoàn chỉnh combo.
  Nếu vẫn khai báo component rows trong combo unresolved thì quarantine.
- Category, giá tham chiếu, raw composition text, manifest gốc và JSON pointers
  nằm trong evidence sidecar, không thêm field vào schema strict S1.2.
- Provenance giữ capture URL/hash/artifact locator và manifest gốc. Source kind
  non-demo luôn manual, verificationStatus unverified, verifiedAt/By null.
  createdAt/updatedAt của record staging là thời điểm tạo bản quan sát nội bộ từ
  capturedAt, không phải ngày KFC tạo hoặc sửa sản phẩm. sourceUpdatedAt thiếu
  giữ null; không lấy ngày HTTP shell làm ngày menu update.

## Identity và diff

ID `local_...` là hash namespace, URL/type nguồn, store/region/channel/currency
scope và key record có type collection. Không gán official product ID hoặc fuzzy
matching. Cùng key trong scope rõ ràng giữ ID qua rename/recapture; đổi key là
identity mới. Caller chịu trách nhiệm namespace/key ổn định và trung thực.
Scope unknown/unverified được cô lập theo snapshotId; không đoán để ghép capture.
Store/channel khác không so sánh như cùng catalog. Quy tắc scope not_applicable
phải được operator kiểm tra, không dùng nó như cách né scope unknown.

Diff deterministic, loại thời gian/provenance khỏi so sánh semantic. Phát hiện
current/reference price, tên, trạng thái availability được khai báo, thành phần,
variant attributes và option/value/price delta. Món mất trong snapshot được báo
missing_from_snapshot, không tự unavailable hoặc delete. Snapshot lỗi trả skipped;
scope khác trả scope_mismatch. Không có quyền ghi hoặc thay bản đã duyệt.

## Chạy local và xem staging

```text
npm run test:acquisition
npm run test:menu
npm run menu:stage -- tests/fixtures/menu/acquisition demo.manifest.json
```

CLI chỉ in JSON ra stdout; exit 0=staged, 2=quarantined, 1=rejected/usage error.
Người vận hành có thể redirect stdout tới file staging riêng; CLI không tự tạo
file hoặc cập nhật catalog. Lệnh `menu:stage` qua npm có banner; khi cần JSON
thuần dùng `node scripts/stage-menu-snapshot.cjs ...`.

Tests cấm network trước khi import pipeline, sử dụng thư mục temp tổng hợp và
kiểm tra không import AWS/repository/agent-core, không ghi file trong pipeline.
Các test từ chối HTML/hash/path/rights, giữ unknown/unresolved, scope isolation,
determinism và last-reviewed data đều có trong runner.

## Kiểm thử build hoàn toàn offline

Layout hiện có dùng next/font/google. Để không tải font, kiểm tra build dùng
Webpack với hook mock response có sẵn trong Next.js, không sửa layout:

```powershell
$env:NEXT_TELEMETRY_DISABLED='1'
$env:NEXT_FONT_GOOGLE_MOCKED_RESPONSES=(Resolve-Path tests/fixtures/build/offline-google-fonts.cjs).Path
$guardPath=(Resolve-Path scripts/offline-network-guard.cjs).Path.Replace('\','/')
$env:NODE_OPTIONS='--require "'+$guardPath+'"'
npm run build -- --webpack
```

Guard chặn fetch/HTTP/TCP/TLS và listen trong process Node, kế thừa sang worker.
Mock CSS chỉ dùng kiểm tra compile, không chứng thực font hiển thị production.
Không chạy HTTP smoke trong S1.4 vì giai đoạn này cấm network; chạy regression
chat/mock và S1.2 offline. Các biến môi trường trên chỉ dùng cho phiên validation,
không ghi cấu hình production. Không sửa lỗi ngoài phạm vi S1.4.

## Kết quả thực chạy S1.4

Ngày 09/11/2026, Windows, Node 24.13.0, Next.js 16.4.5:

| Kiểm tra | Kết quả |
|---|---|
| `npm run test:acquisition` | 46/46, không skip; guard cấm network |
| `npm run test:menu` với offline guard | 87/87 |
| `npm test` với offline guard | 89 nhóm chat mock pass |
| `npm run lint` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm run build -- --webpack` với mock/guard nêu trên | exit 0 |
| HTTP smoke | Không chạy vì yêu cầu không gọi network |
| `git diff --check` và kiểm tra hash baseline S1.2 | pass |

Build đầu tiên bị sandbox chặn tạo worker (`spawn EPERM`); lần chạy được phép
tạo worker vẫn giữ network guard, font mock và tắt telemetry đã pass. Không dùng
build mặc định tải Google Fonts và không sửa layout để làm build pass.

Test-first: runner/fixture được tạo trước các module, lần đầu fail do thiếu
reader. Các ca tăng cường đã fail trước khi bổ sung deep-freeze/reader identity,
quarantine origin thiếu evidence reference và kiểm tra observation time của demo.
Sau sửa, toàn bộ 46 ca pass. Không sửa regression ngoài phạm vi; test prompt
CRLF/LF có từ S1.2 được giữ nguyên byte.

Artifact review: `output/menu-acquisition/demo-staging.json` (generated, ignored
bởi Git), được redirect từ CLI và đọc kiểm tra lại. Nó có 3 product, 1 combo,
3 component, 1 variant, 1 option, 3 value; 8 availability chưa quan sát nên vẫn
unknown. Trạng thái staged/pending, classification seed_demo. Đây là demo từ
seed của project, không phải dữ liệu KFC official. CLI không tự ghi artifact này.

Không thay đổi source API/repository/service/luồng đặt món, lockfile hoặc các
types/validator/fixture S1.2 đã kiểm tra. Không migration, cập nhật menu runtime,
đơn hàng thật, commit hoặc push. Verdict PASS cho intake/normalization offline;
chưa nghiệm thu nguồn KFC live, quyền sử dụng bên ngoài hoặc production ingest.
