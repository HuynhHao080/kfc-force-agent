# Claude Haiku — cấu hình Agent local

## Model và phạm vi

Model chính được chọn cho đường Bedrock hiện tại là **Claude Haiku 4.5**, pin
inference profile `global.anthropic.claude-haiku-4-5-20251001-v1:0`.
Region nguồn mặc định là `ap-southeast-1` (Singapore). Đây là cấu hình đã đối chiếu
tài liệu để giữ nguyên SDK `InvokeModel`; không phải khẳng định phiên bản Haiku
mới nhất hay model tốt nhất cho tập tiếng Việt chưa được nghiệm thu.

[AWS model card](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-anthropic-claude-haiku-4-5.html)
liệt kê profile global, Singapore hỗ trợ global inference và yêu cầu dùng profile
thay vì model ID trần trên endpoint này. **Global inference có thể xử lý dữ liệu
ngoài Singapore**; không bảo đảm lưu trú dữ liệu trong một region.

[AWS Messages API](https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-anthropic-claude-messages-request-response.html)
quy định Haiku 4.5 chỉ nhận một trong `temperature` hoặc `top_p`.
Adapter đã sửa: mặc định `temperature:0.1`, bỏ `top_p` với Haiku/Sonnet 4.5;
cấu hình truyền cả hai bị từ chối trước khi gọi AWS. Cấu hình explicit `topP:0`
hoặc `temperature:0` vẫn được bảo toàn. Không đổi payload model cũ ngoài nhóm này.

Giữ luồng tư vấn chỉ đọc ở bước 1. Haiku chọn read requests và answer plan;
PolicyEngine kiểm tra quyền, menu/cart tools đọc dữ liệu, server kiểm tra ID,
thuộc tính và tính tiền. Không thêm quyền ghi giỏ hay gửi đơn bằng LLM.

## Cấu hình đã chuẩn bị

Trong `.env.local`, chỉ thay các giá trị không nhạy cảm sau, giữ nguyên cấu hình
khác và không thêm credentials:

```dotenv
AI_PROVIDER=bedrock
AWS_REGION=ap-southeast-1
BEDROCK_MODEL_ID=global.anthropic.claude-haiku-4-5-20251001-v1:0
```

`.env.example` vẫn mặc định mock để clone/test offline không tự gọi trả phí.
Nếu không đặt model ID, container dùng profile Haiku đã pin. Nếu đặt ID trống
hoặc model placeholder thì báo lỗi, không âm thầm chuyển model. Có thể override
model/region bằng biến môi trường; việc account/profile/region cụ thể có quyền
truy cập phải xác minh tại AWS. Code không tự dò hoặc đăng ký profile khác.

## Phần người vận hành cần hoàn tất

1. Cấu hình AWS credentials riêng theo credential chain của SDK (ví dụ profile
   AWS đã đăng nhập). Không gửi secret qua chat, không commit file credentials.
2. Bảo đảm tài khoản được phép dùng Claude/model và IAM cho phép invoke profile
   cùng các tài nguyên model đích cần thiết. Chưa kiểm chứng quyền account này.
3. Xem giá hiện hành của model/region, thiết lập AWS budget và giới hạn truy cập
   trước khi mở app công khai. Không có giá ước tính chưa xác minh trong báo cáo.
4. Chạy kiểm tra local, không gọi AWS:

   ```powershell
   npm run llm:doctor
   npm run test:bedrock-haiku
   npm run test:readonly-agent
   ```

5. Khi sẵn sàng chấp nhận phí inference, khởi động lại app bằng `npm run dev`
   hoặc build rồi `npm start`. Gửi chat lúc này sẽ gọi Bedrock và có thể tính phí.
   `demo:start` cố ý ép mock, không dùng để kiểm chứng Haiku.

`llm:doctor` nạp cấu hình Next local và chỉ in provider/model/region, tính hợp lệ
cấu hình, giới hạn đã đặt. Network guard luôn bật cho lệnh này. Nó không resolve
credentials, không gọi AWS, không chứng nhận model access và không in secret hoặc
mở file AWS credentials. Nó nạp `.env` bằng loader hiện có của Next như app local.
`configValid:true` chỉ có nghĩa cấu hình local hợp lệ. Báo cáo luôn ghi
`liveInference:not_run`, `credentials:not_checked_offline`.

Sau inference thành công, response `ai` có `modelId`, `region`, số call, latency
và usage để nhận diện cấu hình đã dùng. Test bằng SDK giả cũng có các trường này;
đây không phải bằng chứng độc lập về một call live. Lỗi không biến thành mock
success hoặc thực thi mutation.

## Giới hạn và rollback

Tối đa hai call mỗi tin nhắn, 2048 output tokens/call, timeout 15 giây/call và
không retry tự động. Đây chưa phải quota tổng theo ngày hoặc rate limit nhiều
người dùng. Menu vẫn là dữ liệu local chưa được xác minh KFC. Không tự thay model
theo chi phí, không fine-tune, không đổi golden labels hoặc human approval.

Để trở về offline: đặt `AI_PROVIDER=mock` và khởi động lại app; không cần xóa model
ID hoặc sửa dữ liệu. Không có inference live trong lượt triển khai này. Kết luận
chất lượng tiếng Việt vẫn chờ pilot thật với dữ liệu đã human review và holdout
tách khỏi prompt.

## Báo cáo triển khai

Git baseline và kết thúc: branch `main`, HEAD
`a1cfeb4c093b532a48eada804031778f1b5ff55b`; worktree có thay đổi sẵn từ các bước
trước. Không reset, commit/push, sửa golden/dataset, menu hoặc đơn hàng.

Tạo mới: `src/lib/aws/bedrock-config.ts`, `scripts/llm-doctor.cjs`,
`scripts/test-bedrock-haiku.cjs`, tài liệu này. Sửa bổ sung: `src/lib/aws/bedrock.ts`,
`src/lib/agent/agent-core.ts`, `src/lib/agent/read-only/{agent,contract}.ts`,
`package.json`, `.env.example`, `.env.local` và `docs/read-only-llm-agent.md`.
Không thêm dependency/provider/framework. Runtime mock và các transaction gates
hiện hữu được giữ nguyên; runtime Bedrock vẫn chỉ có khả năng đọc.

Tests được thêm trước implementation; lần đầu fail vì thiếu module config.

| Kiểm tra thực tế | Kết quả |
| --- | --- |
| `npm run test:bedrock-haiku` | 11/11 PASS, SDK giả, guard mạng bật |
| `npm run test:readonly-agent` | 22/22 PASS, offline |
| `npm test` với network guard | 89/89 PASS, mock |
| `npm run llm:doctor` | PASS cấu hình Bedrock/Haiku/Singapore, live chưa chạy |
| ESLint các module và script thay đổi | PASS |
| `npm run typecheck` | PASS |
| `npm run build -- --webpack` | PASS, 34 trang, font fixture offline, provider mock, storage tạm |
| `git diff --check` | PASS |

Build chạy ngoài sandbox để Next tạo worker, giữ network guard bật và telemetry
tắt. Không chạy browser smoke, không gọi SDK live hoặc thay dữ liệu production.
Các test menu/acquisition/N2 không chạy lại ở lượt thay đổi adapter/config này.

**Verdict: CONDITIONAL** — cấu hình và kiểm chứng offline hoàn tất; AWS
credentials/quyền model, chi phí thực và chất lượng inference thật chưa được
nghiệm thu. Không trình bày SDK giả như kết quả model thật.

## Triage `parse_error` từ giao diện

Response do người vận hành cung cấp có `calls:1`, model/profile Haiku đã cấu hình,
token usage và `error:parse_error`, `execution:[]`. Bằng chứng này định vị lỗi
ở bước parse nội dung lượt hiểu yêu cầu, trước khi chạy tool. Không có nội dung
thô để kết luận chính xác JSON bị bọc Markdown, sai cú pháp hay dạng khác.

Bộ parse ban đầu chỉ gọi `JSON.parse` trực tiếp. Bổ sung parser có giới hạn byte
để nhận JSON thô hoặc một khối Markdown JSON hoàn chỉnh (kể cả BOM/CRLF), rồi vẫn
validate strict bằng schema cũ. Không lấy object tùy ý trong văn xuôi, ghép nhiều
object, sửa cú pháp hoặc retry inference. Đây là xử lý định dạng giao thức chung,
không phải quy tắc cho một câu tiếng Việt cụ thể.

Nếu còn lỗi parse, response có `ai.failure` với `stage`, `code`, `outputFormat`,
`outputBytes`; không log/in nội dung model, prompt hay thông tin khách hàng.
Thông báo parse trên UI chuyển sang mô tả lỗi kỹ thuật thay vì yêu cầu đổi cách
diễn đạt. Lần kiểm chứng sửa parser chỉ dùng transport giả, chưa tái hiện bằng
raw response hoặc inference live của ca người vận hành.

Test-first: bốn test mới đều FAIL trước sửa; sau sửa suite read-only 26/26 và
Haiku 11/11 PASS offline. Chưa coi việc nhận Markdown JSON là bằng chứng ca live
đã được giải quyết; cần thử lại từ giao diện sau khi server nạp code mới.
