# Đo agent thật trên AgentCore (Haiku 4.5) — 17/11/2026

Trạng thái: **đã chạy 20 lượt Haiku 4.5 thật qua runtime `kfc_agent-wi629f7jvF` (version 3), được người phụ trách AWS duyệt.** Kết quả dưới đây đã được đọc tay từng câu; số liệu tự động trong báo cáo JSON chỉ để tham khảo.

- Script: [scripts/evaluate-agentcore-live.cjs](../scripts/evaluate-agentcore-live.cjs) (20 câu cố định từ [natural-language.vi.json](../tests/data/understanding/natural-language.vi.json), mỗi câu một khách mới, giỏ trống).
- Báo cáo gốc: `output/evaluation/agentcore-live-2026-11-17T08-58-39-697Z.json` (không có trong git).
- Lần chạy trước đó với Haiku 5.5 không hợp lệ (tài khoản chưa có thoả thuận model), xem [agentcore-runtime.md](agentcore-runtime.md).
- Độ trễ trung vị 5,7 s/lượt (một ca 14,6 s). Bộ đếm Bedrock ngày 2026-11-17 dừng đúng ở 20.

## Kết quả đọc tay

| Nhóm | Câu | Kết quả | Ghi chú |
|---|---|---|---|
| Thêm món, cách nói tự nhiên | "Cho mik 1 bơ gơ tôm", "lấy 3 ly pesi vừa", "add 1 fries size L", câu dài dòng "…2 phần khoai tây chiên cỡ vừa…" | ✅ 4/4 | Đúng SKU (Burger Tôm, Pepsi (Vừa), Khoai Tây Chiên (Lớn), Khoai Tây Chiên (Vừa)), đúng số lượng, giá từ server, chờ xác nhận |
| | "anh ơi lấy giùm em 3 lon pepsi" | ❌ | Trả câu cố định "chưa hiểu" |
| Tìm theo ngân sách | "Có món gà nào dưới 50k", "từ 40k đến 60k", "mình có 60 nghìn" | ✅ tham số 3/3 | `maxPrice`/`minPrice` đúng. "60 nghìn" ra 6 món rẻ nhất (cơm trắng, nước) — đúng giá nhưng gợi ý kém. "burger 40k–60k" lẫn Cơm/Mì Ý — **lỗi bộ tìm kiếm của module mới, đã sửa offline** (test 18) |
| Món mơ hồ | "Cho mình 1 pepsi", "thêm 2 burger" | ⚠️ an toàn nhưng chung chung | Không tự chọn món (đúng), nhưng chỉ nói "chưa hiểu" thay vì hỏi cỡ/loại |
| | "cho mình 1 egg tart" | ⚠️ | Chọn "1 Bánh Trứng" × 1 — hợp lý; nhãn "phải hỏi lại" có lẽ quá chặt |
| Món không có | coca, trà sữa, cánh gà | ⚠️ an toàn nhưng không nói rõ | Không đề xuất món sai (đúng), nhưng không báo "KFC không bán Coca" |
| Giỏ hàng | "giỏ hàng của mình có gì" | ✅ | VIEW_CART |
| | "Đổi pepsi lon thành 3" | ✅ hiểu đúng | Đúng ID Pepsi (Lon); bị chặn vì giỏ trống — giới hạn của cách test (khách mới) |
| | "Bỏ pepsi lon…", "xoá hết giỏ hàng" | ❓ | Câu cố định; giỏ trống nên không rõ model định làm gì |
| Hội thoại | "đừng thêm pepsi nha", "kfc mở cửa mấy giờ" | ⚠️ | Không làm gì sai, nhưng trả lời chung chung |

**Đề xuất sai món: 0** (trường hợp "egg tart" là cách hiểu hợp lý). Không có câu nào tự nhận đã đặt hàng hay thanh toán.

## Nguyên nhân chính của các câu "chưa hiểu"

[bedrock-llm-provider.ts](../src/lib/agent/providers/bedrock-llm-provider.ts) (dòng 41–48): khi model không đề xuất hành động nào, server **bỏ toàn bộ câu trả lời của model** và thay bằng câu cố định. Thiết kế này của nhóm chặn model tự tuyên bố kết quả, nhưng cũng chặn luôn các câu hỏi lại và lời báo "không có món". 9/20 câu rơi vào trường hợp này, nên chưa biết Haiku thực sự đã trả lời gì ở những câu đó.

## Lần đo 2 — sau khi deploy bản sửa (runtime version 5, 17/11/2026)

Cùng 20 câu, Haiku 4.5, báo cáo `output/evaluation/agentcore-live-2026-11-17T09-30-53-982Z.json`. 19 lượt gọi model (câu giờ mở cửa được trả lời từ nguồn chính thức, không gọi model). Trung vị 5,5 s.

| Nhóm | Lần 1 | Lần 2 (đọc tay) |
|---|---|---|
| Thêm món nói tự nhiên (5 câu) | 4/5, 1 "chưa hiểu" | 4 đề xuất đúng + "3 lon pepsi" → hỏi lại đúng Pepsi (Lon) |
| Món mơ hồ (pepsi, burger, egg tart) | "chưa hiểu" ×2 | Liệt kê lựa chọn kèm giá; egg tart → 1 Bánh Trứng (hợp lý) |
| Món không có (coca, trà sữa, cánh gà) | "chưa hiểu" ×3 | Nói rõ không có; coca → gợi ý Pepsi/7Up/Lipton |
| Ngân sách (3 câu) | tham số đúng, "burger 40–60k" lẫn món khác | Tham số đúng; "burger 40–60k" chỉ còn 3 burger |
| Giỏ hàng / phủ định / giờ mở cửa | "chưa hiểu" ×4 | "Giỏ đang trống", "giữ nguyên giỏ", link giờ mở cửa chính thức |
| Đề xuất sai món | 0 | 0 |

Còn yếu: "mình có 60 nghìn, ăn gì được" trả 6 món rẻ nhất (cơm trắng, nước) — đúng ngân sách nhưng không phải gợi ý bữa ăn.

**Giới hạn của số liệu:** 20 câu lấy từ bộ dữ liệu mình tự soạn và module được chỉnh trên chính các câu cùng kiểu, nên đây là kiểm tra phát triển, không phải đánh giá độc lập. Mỗi câu là một khách mới, giỏ trống, một lượt; chưa đo hội thoại nhiều lượt và luồng xác nhận đặt hàng với model thật.

## Lần đo 3 — luồng nhiều lượt (version 5, 17/11/2026)

Script [evaluate-agentcore-flow.cjs](../scripts/evaluate-agentcore-flow.cjs): một khách, một session, 11 lượt (6 lượt gọi model; xác nhận và "ok" do server xử lý). Sau mỗi lượt đọc giỏ thật trong DynamoDB để so với kỳ vọng. Báo cáo `output/evaluation/agentcore-flow-2026-11-17T10-06-21-256Z.json`.

| # | Khách | Kết quả |
|---|---|---|
| 1–4 | "cho mik 2 pepsi lớn" → xác nhận → "thêm 1 bơ gơ tôm nha" → xác nhận | ✅ giỏ Pepsi (Đại) ×2 + Burger Tôm, 85.000 ₫ |
| 5 | "đổi pepsi đại thành 3" | ✅ model đề xuất đúng "Đổi Pepsi (Đại) thành 3 phần" |
| 6 | xác nhận | ❌ "Không tìm thấy món trong giỏ hàng" — **lỗi server** |
| 7 | "giỏ mình giờ bao nhiêu tiền" | ✅ xem giỏ đúng trạng thái thật (85.000 ₫); fail theo kỳ vọng vì bước 6 |
| 8 | "bỏ burger tôm ra" | ✅ đề xuất đúng "Xoá Burger Tôm" |
| 9 | "ok" | ✅ không thực thi, nhắc bấm nút xác nhận |
| 10 | xác nhận | ❌ cùng lỗi bước 6 |
| 11 | "giỏ còn gì" | ✅ phản ánh đúng giỏ thật |

**Nguyên nhân (lỗi có sẵn trên `main`, mock không lộ ra):** `catalogContext` đưa cho model các dòng giỏ với `itemId` = ID món trong catalog; model dùng đúng ID đó cho `UPDATE_CART`/`REMOVE_FROM_CART`; `PolicyEngine` chấp nhận cả hai loại ID, nhưng `CartService.requireItem` chỉ nhận ID dòng giỏ. **Đã sửa offline**: `executeProposedActions` đổi ID món catalog sang ID dòng giỏ của chính khách khi khớp đúng một dòng; không khớp thì vẫn thất bại an toàn. Test 21 trong `test:understanding`. Chưa deploy, chưa đo lại (bộ đếm ngày đã hết 25/25).

## Lần đo 4 — luồng nhiều lượt sau khi deploy bản sửa (version 6, 17/11/2026)

Báo cáo `output/evaluation/agentcore-flow-2026-11-17T10-14-52-084Z.json`. **10/11 bước đúng**, đọc giỏ thật sau mỗi bước:
- Đổi Pepsi (Đại) lên 3 và xoá Burger Tôm giờ **thực thi đúng** sau xác nhận (giỏ cuối: Pepsi (Đại) ×3 = 60.000 ₫).
- "ok" vẫn không thực thi.
- Bước 11 "giỏ còn gì": Haiku lần này không trả `VIEW_CART` (lần đo 3 thì có) → câu chung "chưa hiểu". Model không ổn định ở câu ngắn này. **Đã sửa offline (chưa deploy)**: câu hỏi về giỏ khi giỏ có món được trả lời bằng chính dữ liệu giỏ đã lưu (test 22).

## Đã sửa offline (17/11/2026, deploy ở version 5)

- [grounded-reply.ts](../src/lib/agent/understanding/grounded-reply.ts): khi model không đề xuất hành động (intent `UNKNOWN`), `agentCore` trả lời bằng dữ liệu catalog: liệt kê lựa chọn kèm giá (món mơ hồ), báo "không có" và gợi ý Pepsi/7Up/Lipton (Coca…), báo "tạm hết", "giỏ đang trống", "giữ nguyên giỏ" (câu phủ định). Không soạn được thì giữ câu chung. Chữ của model **không bao giờ** được hiển thị, kể cả khi provider lỡ chuyển lên (lớp phòng thủ trong `agent-core.ts`).
- [official-answer.ts](../src/lib/agent/official-answer.ts): câu hỏi giờ mở cửa → trang hệ thống nhà hàng KFC.
- Test 19–20 trong `test:understanding` (giá trích dẫn phải có trong catalog; chữ "Đã đặt hàng thành công" của model giả lập không lọt ra).
- Mô phỏng trên 9 câu "chưa hiểu" của lượt đo: 8 câu có câu trả lời cụ thể; "không lấy pepsi nữa" để model xử lý (là yêu cầu xoá, không phải câu hỏi menu).

## Hướng sửa ban đầu (đã thực hiện như mục trên)

Không cho chữ của model đi thẳng tới khách. Thay vào đó, server tự soạn câu trả lời từ dữ liệu đã kiểm chứng khi model không đề xuất hành động:
- `unknownTerms` → "Thực đơn KFC hiện không có: coca. Bạn có muốn xem Pepsi, 7Up không?"
- nhiều ứng viên `matched` → "Bạn muốn loại nào: Pepsi (Tiêu Chuẩn), (Vừa), (Đại), (Lon)?"
- món `soldOut` → "Burger Tôm đang tạm hết."
- ngoài phạm vi (giờ mở cửa, dị ứng) → đường dẫn chính thức đã có trong `official-answer.ts`.

Sau khi sửa: build zip, cập nhật runtime và đo lại cùng 20 câu (cần duyệt thêm 20 lượt).

## Lượt 5 — runtime v7, chế độ tools (18/11/2026)

Deploy: zip mới, `KFC_AGENT_MODE=tools`, `BEDROCK_DAILY_REQUEST_LIMIT=100`, Haiku 4.5, DynamoDB `KfcForceAgent`. 20 câu, 43 lượt gọi model (1–4 lượt/câu), trung vị 6,6 s. Báo cáo: `output/evaluation/agentcore-live-2026-11-18T07-54-59-620Z.json`.

Điểm tự động (intent 5/20) **không dùng được**: script chấm trường `action` của luồng cũ, còn ở chế độ tools model thường hỏi lại hoặc trả lời trước khi đề xuất. Đọc tay từng câu:

- Đúng và tự nhiên (16/20): hỏi lại cỡ/loại khi mơ hồ (pepsi, burger, fries L, bơ gơ tôm), đề xuất đúng món + giá khi đủ rõ (3 ly pepsi vừa, 2 khoai tây chiên vừa), lọc giá đúng (gà dưới 50k, burger 40–60k), giỏ trống trả lời từ `view_cart`, "đừng thêm pepsi" không đề xuất gì, giờ mở cửa qua `official_info` với link chính thức. Không có câu "đã thêm".
- **Bịa món (3/20)** — lỗi nghiêm trọng: NL-064 "coca" → gợi ý "Pepsi Zero, Nước cam, Nước chanh"; NL-065 "trà sữa" → "Pepsi Zero, Nước cam, Cà phê"; NL-099 "60 nghìn" → "Combo gà rán + cơm + nước (khoảng 45–55k)". KFC VN không bán các món này. Nguyên nhân: `search_menu` trả rỗng, model lấp chỗ trống bằng kiến thức chung (mô tả tool còn ví dụ "pepsi zero").
- Chưa tối ưu: NL-076 "đổi pepsi lon thành 3" với giỏ trống → đề xuất thêm thay vì nói giỏ chưa có; NL-043/NL-060 hỏi lại dù chỉ một món khớp; mở đầu "Xong!" trước khi khách xác nhận.

Đã sửa (offline, **chưa deploy, chưa đo lại**):
- `search_menu` có tham số `category`; khi không khớp trả về danh sách nhóm món thật và ghi chú "KFC không bán món này"; bỏ ví dụ "pepsi zero" khỏi mô tả tool.
- Prompt: chỉ nhắc món bằng đúng tên trong kết quả công cụ; gợi ý thay thế phải tra lại theo nhóm; một món khớp rõ thì đề xuất luôn; đổi/bỏ món phải `view_cart` trước; không mở đầu "Xong".
- reply-guard: dòng gạch đầu dòng giới thiệu món mà có từ không xuất hiện trong tên món hay tên nhóm nào của catalog thì bị chặn. Phát lại 20 câu trả lời thật: chặn đúng 3 câu bịa, 17 câu còn lại qua; 40 câu trả lời của lượt 2–3 không câu nào bị chặn nhầm.
- Test 17–18 trong `test:tool-agent` (16/16); tắt kiểm tra mới → 2 test fail.

Dọn dữ liệu sau lượt đo: xoá 128 item của user `live-*` (gồm giỏ của `live-flow-bad653cf` còn từ 17/11); bảng còn 110 item menu + 2 bộ đếm.

## Lượt 6 — runtime v8, bản sửa chống bịa món (18/11/2026)

Cùng 20 câu, 40 lượt gọi model, trung vị 5,9 s, guard không phải chặn lần nào. Báo cáo: `output/evaluation/agentcore-live-2026-11-18T08-07-43-978Z.json`. Đọc tay:

- **Đã hết bịa ở dạng liệt kê**: "coca" → "KFC không bán Coca", hỏi khách có muốn xem đồ uống khác; "cánh gà" → chỉ đúng nhóm thật "Gà Rán - Gà Quay".
- **Đã sửa**: "đổi pepsi lon thành 3" và "bỏ pepsi lon" với giỏ trống → xem giỏ trước, nói giỏ chưa có và hỏi có muốn thêm không. "1 egg tart" → đề xuất ngay 1 Bánh Trứng (bộ dữ liệu ghi "ambiguous" nên điểm tự động tính là sai; đây vẫn chỉ là đề xuất chờ bấm xác nhận).
- **Còn lỗi**:
  - NL-065 "trà sữa": văn xuôi nhắc "cà phê, trà" (không có trong thực đơn) — guard chỉ kiểm dòng liệt kê.
  - NL-099 "60 nghìn": các dòng "Gà rán… giá từ 25–50 nghìn", "Combo… khoảng 40–55 nghìn" — khoảng giá bịa gắn với nhóm món (tên nhóm có thật nên qua guard).
  - NL-043 "3 lon pepsi": không đưa ra Pepsi (Lon) dù có bán; NL-050 "thêm 2 burger": hỏi lại mà không liệt kê lựa chọn.
  - NL-088 vẫn mở đầu "Xong rồi!" trước khi khách xác nhận.

Dọn dữ liệu: xoá 100 item của user `live-*`; bảng còn 110 item menu + 2 bộ đếm. Bộ đếm hôm nay: 83/100.

### Sửa sau lượt 6 (offline, chưa deploy, chưa đo lại)

reply-guard thêm 3 kiểm tra:
- **Liệt kê trong câu văn**: câu có từ 3 phần trở lên, phần nào cũng ngắn ("có nước ngọt, cà phê, trà hay…") được coi là danh sách món; từ không có trong tên món/nhóm thật → chặn. Phần đầu chỉ xét từ cuối (bỏ câu dẫn "Bạn thích…").
- **Số tiền không gắn với món**: dòng gạch đầu dòng có số tiền nhưng không có tên món thật và không phải dòng tổng/còn dư/ngân sách → chặn ("Gà rán – từ 25–50 nghìn"). Đọc thêm dạng "50 nghìn".
- **Mở đầu "Xong"** → chặn.

`search_menu` trả tối đa 8 món (trước 6) để không cắt mất Pepsi (Lon); prompt: ưu tiên đúng cỡ/loại khách nói, `totalMatches` lớn hơn số món nhận được thì tra lại cụ thể hơn.

Phát lại 80 câu trả lời thật (lượt 2, 3, 5, 6): chặn 9 câu, cả 9 đều đúng là lỗi (bịa món, bịa khoảng giá, "Xong"); 0 chặn nhầm. Lưu ý: bộ 80 câu này cũng là dữ liệu mình dùng để chỉnh luật (đã sửa 3 lỗi chặn nhầm trong lúc chỉnh: "13.000" bị cắt câu, "tìm địa chỉ và liên hệ", "Bạn thích gà rán, combo hay burger"), nên đây chưa phải đánh giá độc lập. Test 19 trong `test:tool-agent` (17/17) dùng đúng các câu thật trên; tắt từng luật mới → test fail.
