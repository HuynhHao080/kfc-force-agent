# Bước 1 — LLM chat chỉ đọc

## Phạm vi và trạng thái

Baseline triển khai: branch `main`, HEAD `a1cfeb4c093b532a48eada804031778f1b5ff55b`.
Worktree đã có thay đổi từ các bước menu/NLU/adjudication; không reset, commit hoặc
push. Không sửa golden dataset, schema N2, hồ sơ duyệt, seed menu hoặc database.

Đây là đường thực thi Bedrock thật khi cấu hình bật rõ ràng, đã kiểm chứng bằng
transport giả và network guard. Chưa gọi inference thật; không có số đo chất lượng
hiểu tiếng Việt hoặc khả năng tổng quát hóa của model. Không có record nào được
human-review hoặc approve thông qua bước này.

## Luồng thực thi

`UI → /api/chat → ChatService → AgentCore → ReadOnlyAgent → BedrockService`

1. Giữ nguyên nhánh xác nhận giao dịch đã lưu, ID/TTL/signature và quyền sở hữu.
   Yêu cầu mới xóa proposal cũ theo hành vi hiện hữu.
2. LLM hiểu câu hiện tại cùng tối đa 10 lượt lịch sử đã lưu. Prompt quy định sửa
   yêu cầu hiện tại thắng yêu cầu cũ, không suy ra quyền xác nhận từ lời đồng ý.
3. Parse JSON và validate schema strict. LLM chỉ được đề xuất `LIST_MENU`,
   `SEARCH_MENU(query)`, `GET_MENU_ITEM(itemId)` hoặc `VIEW_CART`.
4. Thực thi qua `executeProposedActions → PolicyEngine → registry → tool` có sẵn,
   luôn truyền `confirmed:false`. Không có write action trong schema mới.
5. Chiếu kết quả thành bằng chứng menu/cart tối thiểu rồi gọi LLM lần hai để
   chọn answer plan. Không chuyển nguyên tool payload hoặc thông tin liên hệ vào
   prompt. Gắn `source:local_runtime_tools`, `verification:unverified`, giữ
   `updatedAt` nếu có. Không nâng nguồn thành dữ liệu KFC verified.
6. Server kiểm tra ID, thuộc tính có bằng chứng và ngân sách; dựng câu trả lời từ
   dữ liệu tool. Không chuyển văn bản tự do của model thành khẳng định giá, thanh
   toán, thêm giỏ hay đặt hàng thành công.

Clarification/conversation/unsupported hợp lệ trả lời sau một lần gọi, không bị
thay bằng câu fallback chung chỉ vì không có action. Lỗi provider không trở thành
mock success. Bộ dựng câu dùng semantic act và dữ liệu đã kiểm tra; không có bảng
tra câu người dùng, regex teencode hoặc đáp án gắn với câu mẫu.

## Contract và giới hạn

- Protocol runtime chỉ đọc nằm trong `src/lib/agent/read-only/contract.ts`.
  Tái sử dụng Zod, SDK, policy và tools; giữ nguyên contract/evaluator N2 offline.
  Đây chưa phải triển khai successor NLU contract của toàn bộ quyết định B00.
- Strict unknown-field rejection ở cả request/answer, tối đa 4 read requests có
  ID khác nhau. Tối đa 2 lần inference; không retry ở orchestrator, SDK giữ
  `maxAttempts:1` và timeout 15 giây/lần. Output cap 2048 tokens/lần.
- Input JSON tối đa 48 KB UTF-8, output JSON tối đa 64 KiB. Nếu menu quá lớn,
  fail có kiểm soát; chưa có pagination hoặc cắt menu âm thầm.
- Không lấy `system` turns từ lịch sử. Lịch sử chat vẫn là dữ liệu không đáng
  tin; chỉ tool hiện tại cung cấp sự thật menu/cart. Đã bổ sung typed state giới
  hạn cho constraints/clarification (xem phần cập nhật bên dưới); chưa có nguồn
  riêng cho từng constraint hoặc giải quyết race hội thoại cùng phiên.
- Recommendation: số đơn vị đề xuất nguyên 1–100, không phải quantity cuối của
  cart. Server tính tổng từ giá VND nguyên hiện tại; chặn ID ngoài kết quả đọc,
  ID trùng, menu inactive/unavailable và bằng chứng mâu thuẫn.
- Budget giữ `<`, `<=`, `=`, phạm vi total/per_person/per_item và cờ approximate.
  Per-person cần số người trước khi so với tổng nhóm; per-item so đơn giá từng
  món. Approximate không cấp quyền vượt mức. Tổng gợi ý chỉ là giá món, chưa gồm
  phí giao hàng/khuyến mại. Không hứa đủ khẩu phần cho số người được nêu.
- Chỉ kiểm chứng cay/không cay nếu `metadata.spicy` có boolean rõ ràng. Các thuộc
  tính, loại trừ, nguyên liệu, option khác phải giữ trong `unverified`; chưa được
  xác nhận là đáp ứng. Việc LLM có trích đúng các yêu cầu này cần đánh giá thật.
- Multi-intent chưa có composite answer protocol. Hệ thống nêu rõ cần tách yêu
  cầu; không tự bỏ một intent để tuyên bố hoàn thành. Mixed read/write trả
  unsupported theo prompt. Chưa hỗ trợ combo/options hoặc tối ưu thực đơn.
- LLM đề xuất có thể không phù hợp ngân sách: server chặn và báo chưa đạt; chưa
  có bộ tìm tổ hợp deterministic hoặc vòng sửa phương án tự động.
- Cart read tính tổng từ unitPrice và quantity do tool trả về; không ghi cart.
- `ai` trong response ghi provider/mode/số call/latency/usage và mã lỗi. Nhãn
  `provider:bedrock` là đường adapter, **không phải chứng nhận đã có inference
  live**: tests dùng service hoặc SDK transport giả. Không log secrets/prompt.

## Chạy local với Bedrock sau khi người vận hành chủ động bật

**Cập nhật bước Haiku:** model chính đã pin là Claude Haiku 4.5; `.env.local`
đã chọn `bedrock` cùng profile global, chưa gọi inference. Phần mô tả mặc định mock
bên dưới áp dụng `.env.example`/fallback provider. Hướng dẫn hiện hành và các
điều kiện chưa kiểm chứng nằm ở [claude-haiku-setup.md](./claude-haiku-setup.md).

Mặc định vẫn `AI_PROVIDER=mock`. Không có credentials nào được tự điền.

1. Người vận hành thiết lập riêng `AI_PROVIDER=bedrock`, `AWS_REGION` và
   `BEDROCK_MODEL_ID`; cấp AWS credentials/IAM quyền invoke cho model được chọn.
   Model/inference profile phải tương thích Anthropic Messages payload mà SDK
   hiện tại sử dụng, được hỗ trợ tại region và được tài khoản cho phép truy cập.
2. Dùng `PERSISTENCE_DRIVER=local` cho demo local; không cần bật DynamoDB.
3. Chạy `npm run dev` (hoặc build rồi `npm start`). Khởi động lại server sau khi
   đổi biến môi trường. **Không dùng `demo:start` để kiểm chứng LLM thật** vì
   script demo chủ động ép mock.
4. Đọc `ai.mode`, `ai.calls`, `ai.error` và usage; không suy ra live thành công
   chỉ từ nội dung câu trả lời. Thiếu model/config/credentials phải báo lỗi.

Inference tính phí AWS. Tối đa hai call mỗi request không phải hạn mức chi phí
toàn ứng dụng; chưa có quota ngày, giới hạn đồng thời hoặc rate limiter riêng cho
LLM. Cần xác minh giá model/region, thiết lập AWS budget và giới hạn truy cập trước
khi mở công khai. Bước này không truy cập bảng giá online hoặc đưa số tiền ước tính
chưa xác minh, không gọi API bên ngoài.

Bedrock chat hiện không tạo proposal thay đổi giỏ. Người dùng dùng giao diện giỏ
và thanh toán hiện hữu; các transaction gates cũ giữ nguyên. Mock vẫn đi đường cũ.
Help UI chuyển sang mô tả tư vấn chỉ đọc khi nhận response của adapter mới.

## Kiểm chứng và cổng còn lại

`npm run test:readonly-agent` kiểm tra contract, hai lượt model/tool, grounding,
budget, lỗi provider/JSON, chặn mutation, history, wiring ChatService, config và
serializer Bedrock bằng SDK giả. Network guard chặn mạng trong suite. Những test
này kiểm chứng giao thức, không đo ngôn ngữ bằng những câu trả lời được script sẵn.

Regression: chat, menu S1.2, acquisition S1.4, N2 và N3.1; lint, typecheck và build.
Build offline dùng fixture Google Fonts và webpack để tránh yêu cầu mạng/IPC của
Turbopack trong môi trường kiểm tra. Không thay font production bằng fixture.

Kết quả thực tế của lượt triển khai này:

| Lệnh | Kết quả |
| --- | --- |
| `npm run test:readonly-agent` | 22/22 PASS, transport giả, guard mạng bật |
| `npm test` | 89/89 PASS, mock |
| `npm run test:menu` | 87/87 PASS |
| `npm run test:acquisition` | 46/46 PASS |
| `node scripts/test-nlu.cjs` | 28/28 PASS |
| `node scripts/test-nlu-readiness.cjs` | 26/26 PASS |
| `npm run lint` | PASS; lint lại các file UI/module/test mới sau chỉnh sửa cũng PASS |
| `npm run typecheck` | PASS |
| `npm run build -- --webpack` | PASS với network guard, font fixture, mock và storage tạm |
| `git diff --check` | PASS |

Build lần đầu bị sandbox chặn tạo worker (`spawn EPERM`); chạy lại ngoài sandbox
với cùng network guard và cấu hình offline thành công. Không chạy browser smoke
hoặc inference live. Test-first: 18 test ban đầu fail do thiếu module; sau đó hai
integration test fail trước khi nối AgentCore/ChatService, rồi chuyển PASS.

File mới: `src/lib/agent/read-only/{contract,agent}.ts`,
`scripts/test-readonly-agent.cjs` và báo cáo này. File sửa: `agent-core.ts`,
`chat-service.ts`, `types/domain.ts`, hai component chat/storefront,
`.env.example`, `package.json` (chỉ thêm script test mới vào trạng thái có sẵn).
So hash 237 file baseline: chỉ 6 file có chủ đích trong tập đó thay đổi; các file
golden, adjudication và `scripts/test-chat.cjs` có sẵn giữ nguyên. `.env.example`
được sửa ngoài tập hash đó. HEAD/branch không đổi.

Verdict: **CONDITIONAL** — phần mã và kiểm chứng offline đạt; chưa nghiệm thu
chất lượng inference/model thật hoặc toàn bộ General-Purpose Agent MVP.

Gate nghiệm thu còn lại: chủ động cấu hình/quyền inference và ngân sách; chạy pilot
LLM thật riêng; human review dữ liệu đánh giá, giữ holdout tách khỏi prompt; đo lỗi
semantic/negation/constraint/multi-turn. Chỉ sau đó kết luận chất lượng model.
Typed state đầy đủ, tính tổ hợp recommendation và write proposal qua confirmation
vẫn là các bước tiếp theo; state clarification giới hạn được bổ sung bên dưới.

## Cập nhật: giữ ngữ cảnh clarification nhiều lượt

Ảnh do người vận hành cung cấp cho thấy Agent hỏi lặp phạm vi ngân sách sau một
lượt bổ sung thông tin; response có một call và không có `ai.error`. Đây là lỗi
quyết định clarification/tiếp tục hội thoại, không phải bằng chứng parse lỗi.
Audit code xác nhận lịch sử vẫn được truyền, nhưng trước cập nhật này chưa có
state có kiểu để giữ mục tiêu và slot đang chờ. Không có raw structured prediction
để kết luận chính xác model đã hiểu sai phần nào của câu tiếng Việt.

`dialogue-state.ts` định nghĩa state version 1: revision, constraints đã diễn giải,
read intents, pending slot và số lần hỏi. `AgentCore` lưu state ở
`context.readOnlyDialogue` của phiên hiện hữu, giữ nguyên các context fields khác;
không migration, không thay menu/cart hoặc schema N2. State cũ thiếu/hỏng bị bỏ
qua; lịch sử vẫn được sử dụng. State không được đưa vào response HTTP công khai.

State ghi rõ `llm_request_interpretation`: là diễn giải yêu cầu người dùng, không
phải sự thật menu hoặc nhãn đã human approve. Revision là thứ tự xử lý server;
chưa có provenance riêng cho từng field, không giả tạo human approval.

Quy tắc cập nhật và tiếp tục:

- Model nhận slot đang chờ và constraints đã giữ; phải đọc lượt hiện tại như một
  khả năng trả lời câu hỏi trước. Prompt nêu chính sách ngân sách cá nhân và chỉ
  hỏi khi thông tin thiếu chặn bước tiếp theo; không có câu mẫu/teencode mapping.
- Clarification có thể mang `constraints`/`intents` để không vứt thông tin đã
  biết. `budget.scope:unspecified` giữ sự chưa rõ; không đem số đó so như tổng.
- Null/empty ở lượt tiếp theo không tự xóa ngân sách, số người, polarity hoặc
  exclusions. Sửa giá trị bằng giá trị mới; rút bỏ/reset điều kiện qua
  `clearConstraints` do LLM trích xuất. Tín hiệu đó vẫn cần đánh giá semantic với
  người dùng; server không tự chứng minh nghĩa của câu. Exclusions tích lũy và
  validate giới hạn, không cắt bớt điều kiện âm thầm.
- Nếu model lại hỏi slot đã có giá trị explicit và đang có mục tiêu menu hoặc
  recommendation, server tiếp tục `LIST_MENU` qua policy rồi cho model chọn từ
  bằng chứng thật. Không tự tạo món hoặc tăng số lần inference.
- Nếu model tiếp tục hỏi cùng slot chưa giải quyết liên tiếp, trả mã
  `clarification_stalled` cùng thông báo kỹ thuật; không lặp câu hỏi vô hạn hoặc
  tự đoán thông tin. Đổi sang một slot thiếu khác vẫn được phép.
- Lượt chọn answer nhận state đã cập nhật, không nhận pending slot đã được giải
  quyết như thể vẫn còn thiếu. Các transaction gates giữ nguyên.

Kiểm chứng: focused Agent **34/34**, Haiku **11/11**, chat regression **89/89**
PASS offline; typecheck và lint các file thay đổi PASS. Test-first đã tái hiện
lỗi thiếu state, hỏi lặp và mất constraints trước implementation. Test dùng
structured outputs giả để kiểm tra giao thức; không dùng câu trong ảnh làm prompt
example hoặc đáp án hard-code. Không gọi lại inference trả phí; chưa chứng minh
chất lượng Haiku trên ca live này. Browser smoke chưa chạy.

Build cuối `npm run build -- --webpack` cũng PASS với network guard, mock, font
fixture và storage tạm, tạo đủ 34 trang. Không commit/push. Verdict cho cập nhật
này: **CONDITIONAL** — kiểm chứng kỹ thuật offline đạt, cần kiểm chứng lại hành
vi live sau khi server nạp code mới.

Giới hạn: state này chưa bao phủ entity reference/options hoặc toàn bộ quyết định
B00; cùng phiên có nhiều request chat đồng thời vẫn có thể tranh ghi context.
Đây chưa phải hệ thống dialogue state hoàn chỉnh. Nguồn menu local chưa được KFC
xác minh. Nếu không có món đáp ứng ngân sách, phải báo giới hạn từ dữ liệu thật,
không bịa món/giá để hoàn thành yêu cầu.
