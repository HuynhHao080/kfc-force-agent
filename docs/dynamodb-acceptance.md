# Nghiệm thu DynamoDB cho agent trên AgentCore

Trạng thái: **đã nghiệm thu trên DynamoDB Local (7/7, 2 lần) và trên bảng thật AWS `KfcForceAgent` ở `ap-southeast-1` (7/7, 17/11/2026, được duyệt bởi người phụ trách AWS). Chưa deploy AgentCore.**

## Bảng thật trên AWS (17/11/2026)

- Tài khoản `<AWS_ACCOUNT_ID>`, user IAM `vino-dev` (profile CLI `kfc-dev`), region `ap-southeast-1`.
- Bảng `KfcForceAgent`: PK/SK, on-demand, tag `Project=kfc`, **deletion protection bật**. Tạo bằng `npm run dynamodb:table create -- --approve-aws <AWS_ACCOUNT_ID>`; nạp 101 món bằng `npm run dynamodb:seed -- --approve-aws <AWS_ACCOUNT_ID>`.
- `npm run test:dynamodb -- --approve-aws <AWS_ACCOUNT_ID>`: 7/7 pass (test 04 mất ~8 s do độ trễ mạng thật, so với ~1,5 s trên Local).
- Bảng cũ `kfc-force-agent-dev` (tạo 22/09/2026, 11 bản ghi smoke-test với schema khác) **không được đụng tới**; không có tham chiếu trong repo.
- Bản ghi test tạo trên bảng thật: user `ddb-*` (giỏ, session, tin nhắn, đơn hàng giả) và các dòng `BEDROCK_BUDGET` ngày 2099. Có thể xoá bằng tay; không ảnh hưởng catalog.

## Kết quả 17/11/2026 (DynamoDB Local 2.x, `-inMemory`, bảng `KfcForceAgentTest`)

| # | Test | Kết quả |
|---|---|---|
| 1 | Bảng có 101 món đã nạp | ✅ |
| 2 | Chat "Thêm 1 pepsi lớn" → đề xuất Pepsi (Đại) 20.000 ₫ → xác nhận → giỏ, tin nhắn, context trong DynamoDB; đề xuất đã dùng không chạy lại | ✅ |
| 3 | 10 lượt thêm cùng món song song: số lượng cuối = số lượt được chấp nhận | ✅ |
| 4 | Đổi số lượng và xoá dòng qua chat | ✅ |
| 5 | Checkout idempotent, snapshot giá, giỏ cũ đóng | ✅ (không bị bỏ qua vì giờ cửa hàng) |
| 6 | Bộ đếm Bedrock: 25 lượt song song, giới hạn 10 → đúng 10 qua, 15 từ chối, số thứ tự 1..10; ngày mới đếm lại từ 1 | ✅ (xác nhận bằng cách đọc lại các dòng `BEDROCK_BUDGET`: mọi ngày test đều `used=10`) |
| 7 | Client thứ hai đọc đúng dữ liệu | ✅ |

Lỗi gặp trong lúc viết test đều ở phía test (truyền ID thay vì object món vào `addMenuItem`; ký tự no-break space trong định dạng tiền), không phát hiện lỗi nào trong adapter DynamoDB.

## Vì sao cần

AgentCore Runtime chạy mỗi session trong microVM riêng, không giữ đĩa. Nên:
- giỏ hàng, hội thoại, đơn hàng phải nằm trong DynamoDB (`PERSISTENCE_DRIVER=dynamodb`, guard trong `src/agentcore/invocation.ts`);
- giới hạn 25 lượt Bedrock/ngày phải là bộ đếm nguyên tử trong DynamoDB, vì nhiều session chạy song song.

Adapter `dynamodb-repository.ts` (1.262 dòng, 8 `TransactWrite`) đã có từ trước nhưng tài liệu nhóm ghi "chưa nghiệm thu". Phần này bổ sung công cụ để nghiệm thu offline bằng **DynamoDB Local** (engine DynamoDB thật chạy bằng Java, miễn phí, không cần AWS).

## Thành phần

| File | Nhiệm vụ |
|---|---|
| [src/lib/aws/dynamodb.ts](../src/lib/aws/dynamodb.ts) | Thêm `DYNAMODB_ENDPOINT` để trỏ vào DynamoDB Local (credentials giả, không dùng key thật) |
| [src/lib/aws/invocation-budget.ts](../src/lib/aws/invocation-budget.ts) | `reserveBedrockInvocationDynamoDB`: `UpdateItem ADD used 1` với `ConditionExpression used < limit` (PK `BEDROCK_BUDGET`, SK ngày UTC); `reserveInvocation()` chọn file hay DynamoDB theo `PERSISTENCE_DRIVER`/`BEDROCK_BUDGET_STORE` |
| [src/lib/aws/bedrock.ts](../src/lib/aws/bedrock.ts) | Gọi `await reserveInvocation()` trước mỗi lượt |
| [scripts/dynamodb-table.cjs](../scripts/dynamodb-table.cjs) | `create / describe / delete` bảng PK+SK, on-demand, tag `Project=kfc`, bật deletion protection trên AWS. Ghi lên AWS thật chỉ khi có `--approve-aws <account id>` và credentials đúng tài khoản đó |
| [scripts/dynamodb-seed-catalog.cjs](../scripts/dynamodb-seed-catalog.cjs) | Nạp 101 món từ snapshot qua `DynamoDBMenuRepository` (idempotent) |
| [scripts/test-dynamodb.cjs](../scripts/test-dynamodb.cjs) | 7 test nghiệm thu chạy qua `ServiceContainer` thật với driver DynamoDB |

## Cách chạy offline (DynamoDB Local)

Cần Java (máy đã có Java 25). Tải `dynamodb_local_latest.zip` từ AWS, giải nén, rồi:

```bash
# cửa sổ 1 — trong thư mục đã giải nén
java -Djava.library.path=./DynamoDBLocal_lib -jar DynamoDBLocal.jar -inMemory -port 8000

# cửa sổ 2 — trong repo
export DYNAMODB_ENDPOINT=http://127.0.0.1:8000 DYNAMODB_TABLE_NAME=KfcForceAgentTest
npm run dynamodb:table create
npm run dynamodb:seed
npm run test:dynamodb
```

`-inMemory` nghĩa là dữ liệu mất khi tắt Java; đúng ý cho test.

## Các test nghiệm thu

1. Bảng có catalog đã nạp (≥100 món, có Pepsi (Đại)).
2. Chat → đề xuất → xác nhận: giỏ, tin nhắn, context đều lưu trong DynamoDB; giá lấy từ catalog; đề xuất đã dùng không chạy lại.
3. 10 lần thêm cùng món song song: số lượng cuối đúng bằng số lần được chấp nhận (không mất cập nhật).
4. Đổi số lượng và xoá dòng qua chat.
5. Checkout idempotent (cùng `idempotencyKey` → cùng đơn), snapshot giá, giỏ cũ bị đóng. Bỏ qua có ghi chú nếu cửa hàng ngoài giờ.
6. Bộ đếm Bedrock: 25 lượt song song với giới hạn 10 → đúng 10 thành công, 15 bị từ chối, số thứ tự 1..10 không trùng; ngày mới bắt đầu lại.
7. Client thứ hai đọc được đúng dữ liệu (không có trạng thái trong tiến trình).

## Giới hạn

- DynamoDB Local tái hiện ngữ nghĩa điều kiện/giao dịch nhưng không tái hiện độ trễ, throttling hay eventual consistency của AWS. Nghiệm thu cuối cùng cần chạy lại bộ test này trên bảng thật (`--approve-aws`), tốn gần như 0 đồng với on-demand ở lưu lượng test.
- `dynamodb-table.cjs` kiểm tra tài khoản qua STS; package `@aws-sdk/client-sts` chưa có trong repo nên khi dùng với AWS thật cần cài thêm (devDependency) hoặc bỏ kiểm tra.
- Chưa có migration từ `store.json` local lên DynamoDB; chỉ nạp catalog. Tài khoản/giỏ demo local không chuyển.
