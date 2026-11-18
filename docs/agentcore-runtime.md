# Agent theo chuẩn Amazon Bedrock AgentCore Runtime

Trạng thái: **đã deploy lên AgentCore Runtime ở `ap-southeast-1` và gọi thử thành công với provider mock + DynamoDB thật (17/11/2026, được người phụ trách AWS duyệt từng bước). Chưa bật Bedrock thật trên runtime, nên chưa có số liệu LLM.**

## Tài nguyên đã tạo trên AWS (17/11/2026, tài khoản <AWS_ACCOUNT_ID>, tag `Project=kfc`)

| Tài nguyên | Giá trị |
|---|---|
| Bảng DynamoDB | `KfcForceAgent` (xem [dynamodb-acceptance.md](dynamodb-acceptance.md)) |
| IAM role runtime | `arn:aws:iam::<AWS_ACCOUNT_ID>:role/KfcAgentCoreRuntime` — trust `bedrock-agentcore.amazonaws.com` giới hạn theo tài khoản/region; inline policy: logs, X-Ray, metrics, workload token, `bedrock:InvokeModel` chỉ trên model Anthropic + profile Haiku 5.5 và Haiku 4.5, DynamoDB chỉ bảng `KfcForceAgent`, S3 chỉ bucket code |
| Bucket S3 | `kfc-agentcore-code-<AWS_ACCOUNT_ID>-ap-southeast-1` (chặn public, versioning); object `kfc_agent/deployment_package.zip` |
| AgentCore Runtime | `kfc_agent`, id `kfc_agent-wi629f7jvF`, ARN `arn:aws:bedrock-agentcore:ap-southeast-1:<AWS_ACCOUNT_ID>:runtime/kfc_agent-wi629f7jvF`, runtime `NODE_22`, entry `agent.js`, HTTP, network PUBLIC, inbound auth IAM (mặc định), idle 300 s / max 1800 s |
| Biến môi trường runtime | `AI_PROVIDER=bedrock` (từ version 2), `PERSISTENCE_DRIVER=dynamodb`, `AGENTCORE_DEPLOYED=1`, `DYNAMODB_TABLE_NAME=KfcForceAgent`, `KFC_PURCHASE_ASSISTANT=1`, `BEDROCK_MODEL_ID=global.anthropic.claude-haiku-4-5-20251001-v1:0` (từ version 3), `BEDROCK_DAILY_REQUEST_LIMIT=25` |

Gọi thử (`aws bedrock-agentcore invoke-agent-runtime`, payload UTF-8 từ file): "Thêm 1 pepsi lớn" → đề xuất Pepsi (Đại) 20.000 ₫ chờ xác nhận; "Thêm 2 coca" → "thực đơn không có: coca". Cả hai HTTP 200; session và tin nhắn ghi vào bảng thật.

Cập nhật code: `npm run agentcore:build` → upload zip lên cùng key S3 → `aws bedrock-agentcore-control update-agent-runtime --agent-runtime-id kfc_agent-wi629f7jvF --cli-input-json ...` (cùng cấu trúc như lúc tạo). Bật Bedrock thật: đổi `AI_PROVIDER=bedrock` trong `environmentVariables` khi được duyệt số lượt. Trên Git Bash, đặt `MSYS_NO_PATHCONV=1` khi truyền tham số bắt đầu bằng `/` (tên log group), nếu không MSYS sẽ đổi thành đường dẫn Windows.

## Mục tiêu

Đề tài yêu cầu agent chạy trên Amazon Bedrock AgentCore. AgentCore Runtime nhận bất kỳ container nào tuân theo [HTTP protocol contract](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-http-protocol-contract.html):

| Yêu cầu | Giá trị |
|---|---|
| `GET /ping` | `200 {"status":"Healthy"}` |
| `POST /invocations` | JSON vào, JSON ra |
| Host / port | `0.0.0.0:8080` |
| Kiến trúc | **ARM64** |

Phần này bọc agent hiện có (`ChatService → agentCore → LLM → PolicyEngine → tools`) bằng đúng contract đó. **Không viết agent mới**: web local và AgentCore chạy cùng một pipeline, nên bộ đánh giá, test và prompt dùng chung. Model vẫn là Claude Haiku 5.5 qua Bedrock (`BEDROCK_MODEL_ID`), không đổi.

## Thành phần

| File | Nhiệm vụ |
|---|---|
| [src/agentcore/invocation.ts](../src/agentcore/invocation.ts) | Kiểm tra payload, gọi `ChatService.processChat`, không bao giờ ném lỗi hay lộ chi tiết nội bộ; guard bắt buộc DynamoDB khi deploy |
| [src/agentcore/server.ts](../src/agentcore/server.ts) | HTTP server `node:http` (không thêm dependency): `/ping`, `/invocations`, giới hạn body 16 KB, 405/413/415 |
| [scripts/agentcore-runtime.cjs](../scripts/agentcore-runtime.cjs) | Entry point dùng cho cả local và container |
| [Dockerfile.agentcore](../Dockerfile.agentcore) | Image ARM64, `node:22-slim`, không chứa credentials |
| [scripts/test-agentcore.cjs](../scripts/test-agentcore.cjs) | 6 test contract offline, có trong `npm run check` |

## Payload

```json
POST /invocations
{ "userId": "cus_123", "message": "cho mik 1 pepsi lớn",
  "confirm": false, "confirmationId": "…", "selectedProduct": {…}, "platform": "web" }
```

Phản hồi là `ChatResponse` của web route cộng `"status":"success"`: `reply`, `sessionId`, `actions`, `requiresConfirmation`, `pendingConfirmation`, `execution`, `products`.

**Danh tính:** `userId` do bên gọi tin cậy cung cấp (Lambda chat sau API Gateway, sau khi đã xác thực khách). Runtime phải cấu hình inbound auth **IAM (SigV4)** để chỉ Lambda đó gọi được; runtime không tự xác thực khách. Mọi thay đổi giỏ vẫn cần `confirm=true` kèm đúng `confirmationId`; chữ "ok" không thực thi.

## Model: Haiku 4.5 thay vì Haiku 5.5 (17/11/2026)

Chuẩn của nhóm (PR #10) là Haiku 5.5, nhưng tài khoản `<AWS_ACCOUNT_ID>` chưa chấp nhận thoả thuận sử dụng Haiku 5.5 (`get-foundation-model-availability` → `agreementAvailability: NOT_AVAILABLE`; Bedrock trả "anthropic.claude-haiku-5-5 is not available for this account"). Haiku 4.5 đã có thoả thuận (`AVAILABLE`), nên runtime dùng `global.anthropic.claude-haiku-4-5-20251001-v1:0` theo quyết định của người phụ trách agent. Adapter `bedrock.ts` hỗ trợ cả hai (4.5 gửi `temperature`, 5.5 gửi `thinking: disabled`), không sửa code.

- Lần đo 20 câu đầu tiên (runtime version 2, Haiku 5.5) **không hợp lệ**: cả 20 lượt bị Bedrock từ chối trước khi tới model; báo cáo đánh dấu `-INVALID` trong `output/evaluation/`. Agent trả lỗi có kiểm soát, không fallback mock, 0 đề xuất sai.
- Xác nhận Haiku 4.5 (version 3), 1 lượt: "Cho mik 1 bơ gơ tôm" → `ADD_TO_CART` với `itemId` của Burger Tôm, đề xuất "Thêm 1 × Burger Tôm: 45.000 ₫" chờ xác nhận.
- Cần báo nhóm: khác chuẩn Haiku 5.5 trong `.env.example`/docs; khi tài khoản chấp nhận thoả thuận 5.5 có thể đổi lại chỉ bằng `BEDROCK_MODEL_ID`.

## Hai cách deploy lên AgentCore Runtime

| | Direct code deployment (zip) — **chọn cách này** | Container (Dockerfile.agentcore) |
|---|---|---|
| Cần gì trên máy | Node 22 + esbuild (devDependency) | Docker Desktop + buildx ARM64 (máy 7 GB RAM không phù hợp) |
| Gói deploy | `dist/agentcore/deployment_package.zip` (~0.5 MB) → S3 | Image ARM64 → ECR |
| Tạo runtime | `agentRuntimeArtifact.codeConfiguration` với `runtime: NODE_22`, `entryPoint: ["agent.js"]` | `agentRuntimeArtifact.containerConfiguration` |
| Giới hạn | 250 MB zip / 750 MB giải nén; không module native x86 | Image phải là linux/arm64 |
| Ưu | Không Docker, build vài giây, zip nhỏ, cập nhật nhanh bằng `UpdateAgentRuntime` | Kiểm soát hoàn toàn OS/Node; cần khi có binary native |
| Nhược | Node version do AWS quản lý; mọi dependency phải gộp được bằng esbuild | Build chậm, nặng máy, cần ECR |

Cả hai cách đều chạy cùng contract `/ping` + `/invocations`, nên code agent không đổi.

```bash
npm run agentcore:build     # dist/agentcore/agent.js + deployment_package.zip + build-info.json
```

`build-agentcore.cjs` từ chối bundle nếu phát hiện module native (`.node`/`.so`) hoặc zip vượt 250 MB. Bundle chỉ đọc cấu hình từ biến môi trường, không chứa `.env`.

## Chạy local (offline, miễn phí)

```bash
npm run agentcore:dev                      # http://0.0.0.0:8080, provider theo .env.local
curl -s localhost:8080/ping
curl -s -X POST localhost:8080/invocations -H "content-type: application/json" \
     -d '{"userId":"demo","message":"cho mình xem menu"}'
npm run test:agentcore
```

Build image (cần Docker có buildx; AgentCore chỉ nhận ARM64):

```bash
docker buildx build --platform linux/arm64 -f Dockerfile.agentcore -t kfc-agent:local .
docker run --rm -p 8080:8080 -e AI_PROVIDER=mock -e PERSISTENCE_DRIVER=mock \
  -e SESSION_SECRET=<ít nhất 32 ký tự> kfc-agent:local
```

## Ràng buộc khi deploy thật

- **Dữ liệu:** mỗi session AgentCore chạy trong microVM riêng, đĩa không giữ lại. Vì vậy image đặt `AGENTCORE_DEPLOYED=1` và server **từ chối khởi động** nếu `PERSISTENCE_DRIVER` khác `dynamodb`. Adapter DynamoDB trong repo chưa được nghiệm thu thật ([aws-readiness](graduation/aws-readiness.md)); đây là việc phải làm trước khi deploy.
- **Budget Bedrock:** `invocation-budget.ts` đếm lượt bằng file JSON trong một tiến trình. Trên AgentCore nhiều session chạy song song nên bộ đếm này không còn đúng; cần chuyển sang DynamoDB (atomic counter) trước khi bật inference thật.
- **Credentials:** không đưa vào image hay env. Runtime role của AgentCore cấp quyền `bedrock:InvokeModel` và DynamoDB.
- **Model:** giữ `BEDROCK_MODEL_ID=global.anthropic.claude-haiku-5-5`, `AWS_REGION=ap-southeast-1`. AgentCore có ở Singapore.

## Kết quả kiểm thử (16/11/2026)

- `npm run test:agentcore`: 6/6 (ping contract, pipeline chat, xác nhận giỏ qua runtime, input sai → 400/405/413/415 không lộ nội bộ, guard DynamoDB).
- Smoke bằng Node (gửi UTF-8 đúng) với catalog KFC 101 món, `AI_PROVIDER=mock`, `PERSISTENCE_DRIVER=local`:
  - "Thêm 1 pepsi lớn" → đề xuất **Pepsi (Đại)** chờ xác nhận.
  - "Thêm 1 pesi lon" → đề xuất Pepsi (Lon).
  - "Thêm 2 coca" → "Không tìm thấy món… (thực đơn không có: coca)".
  - "Thêm 1 burger" → liệt kê 4 burger và yêu cầu chọn.
  - "Thêm 1 bơ gơ tôm" → chưa hiểu với **mock parser** (từ "bơ" bị lọc như "bỏ"). Haiku thật nhận nguyên cụm "bơ gơ tôm" nên không gặp hạn chế này; mock chỉ dùng cho demo/CI.
- Lỗi phát hiện và đã sửa nhờ smoke: mock parser bỏ dấu trước khi tạo `query`, nên "pepsi lớn" thành "pepsi lon" → Pepsi (Lon). Đã sửa [mock-message.ts](../src/lib/agent/providers/mock-message.ts) để giữ dấu trong cụm món (test 17 trong `test:understanding`). `npm test` 101/101 và `npm run evaluate` giữ nguyên F1 sau sửa.
- Lưu ý khi test tay: `curl -d` trên Git Bash/Windows gửi tiếng Việt sai mã hoá, cho kết quả giả. Dùng Node hoặc `--data-binary @file.json` (UTF-8).
- **Chưa làm:** build image ARM64 (Docker 29.4.3 có trên máy nhưng Docker Desktop chưa chạy nên `buildx` không kết nối được daemon), deploy lên AgentCore, chạy Haiku thật.

## Bước tiếp theo

1. Bật Docker Desktop, build image ARM64 và chạy `docker run` smoke test như trên.
2. Nghiệm thu adapter DynamoDB với bảng thật (menu, cart, session, order) và chuyển bộ đếm Bedrock sang DynamoDB.
3. Tạo ECR repo + runtime role, deploy bằng `aws bedrock-agentcore-control create-agent-runtime` ở `ap-southeast-1`, inbound auth IAM.
4. Lambda chat (sau API Gateway) gọi `InvokeAgentRuntime` với `runtimeSessionId = chat_<userId>`.
5. **Đo Haiku thật end-to-end** trên bộ câu đánh giá, sau khi được duyệt lượt gọi.
