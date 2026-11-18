# Hiểu câu tiếng Việt và bám dữ liệu thực đơn

Trạng thái: **đã tích hợp vào luồng chat, chỉ kiểm thử offline**. Chưa chạy với Bedrock thật, nên tài liệu này không có số liệu LLM.

## Tích hợp (bước 3)

| Nơi | Trước | Sau |
|---|---|---|
| `PolicyEngine.findMenuMatches` / `resolveMenuItem` | So khớp bỏ dấu, chỉ xét món còn bán | `resolveMenuQuery` mới: báo "X hiện đang tạm hết", báo "thực đơn không có: coca", không tự đổi sang combo |
| `catalogContext` | 12 món, khớp nguyên từ trong tên, không khớp thì đưa món rẻ nhất | Vẫn 12 món, thêm `matched`, `noMatch`, `unknownTerms`, `soldOut`, `budgetHint` |
| `agent-core`: đổi/xoá món trong giỏ | `matchesMenuQuery` trên tên món trong giỏ | `resolveMenuMention` trên các dòng giỏ (phân biệt lớn/lon) |
| `MenuService.searchMenuItemsForCustomer` | Khớp tiền tố | Bộ hiểu mới trước; nếu không ra kết quả thì quay về khớp tiền tố (để gợi ý khi đang gõ "bur") |
| [system-prompt.md](../src/lib/agent/prompts/system-prompt.md) | — | Quy tắc cho các trường mới, kèm 4 ví dụ (pepsi lớn, coca, món tạm hết, dưới 50k) |

Không đổi tên hàm, không đổi kiểu trả về hay schema; chỉ thêm trường vào JSON context. Món ngừng bán (`isActive=false`) được coi là không còn trong thực đơn; chỉ món có `isAvailable=false` mới được báo "tạm hết". Nếu món khách gọi chỉ còn nằm trong một combo, agent hỏi lại chứ không tự chọn combo.

## Vấn đề

Phần lớn câu trả lời sai đến từ dữ liệu đưa vào model, không phải từ model:

- `normalizeVietnamese` bỏ dấu nên "Lớn" và "Lon" cùng thành `lon`. Server hiện tại hiểu "Thêm 1 pepsi lớn" thành **Pepsi (Lon)**.
- Khi món khách gọi hết hàng, `findMenuMatches` chỉ thấy món còn bán nên có thể chọn món khác chứa cùng từ. Ví dụ "súp rong biển" khi hết → **Combo Cơm Gà Rán & Súp**.
- `catalogContext` chỉ khớp nguyên từ trong tên món. Khi không khớp gì, nó vẫn gửi 12 món rẻ nhất cho model, và không báo món khách hỏi không có trong menu.
- Không hiểu tên gọi khác ("bơ gơ", "fries", "pepsi zero"), sai chính tả ("pesi"), hay số tiền kiểu "50k", "1tr2", "năm chục đổ lại".

Ba lỗi đầu đang có trên `main` (xem mục "Lỗi tìm thấy trong code hiện tại").

## Thành phần

| File | Nhiệm vụ |
|---|---|
| [vietnamese-input.ts](../src/lib/agent/understanding/vietnamese-input.ts) | `foldText` (giữ phân biệt lớn/lon), `expandShorthand` (teencode), `parsePriceConstraint` (ngân sách) |
| [menu-resolver.ts](../src/lib/agent/understanding/menu-resolver.ts) | `resolveMenuMention` (cụm từ → SKU), `rankMenuCandidates` (chọn món đưa vào context model) |
| [natural-language.vi.json](../tests/data/understanding/natural-language.vi.json) | 127 câu có nhãn |
| [evaluate-understanding.cjs](../scripts/evaluate-understanding.cjs) | So sánh cách hiện tại và module mới |
| [test-understanding.cjs](../scripts/test-understanding.cjs) | 12 test hồi quy, có trong `npm run check` |

Nguyên tắc của bộ tra món:

- Chỉ trả về món có trong catalog được truyền vào. Không bao giờ tự tạo ID, tên hay giá.
- Có 4 kết quả. `resolved`: đúng 1 món. `ambiguous`: phải hỏi lại khách. `unavailable`: món có nhưng đang hết. `not_found`: KFC không bán.
- Hết hàng thì báo hết, không tự đổi sang combo.
- Sửa chính tả chỉ so với từ trong tên món và phải trùng chữ cái đầu. Vì vậy "pesi" → "pepsi", nhưng "cánh" không thành "bánh".
- Khách không nói "combo/deal/xô" thì ưu tiên món lẻ. Không gợi ý biến thể khách không nhắc tới, ví dụ "Không Đường".

## Chạy

```bash
npm run test:understanding          # test hồi quy
npm run evaluate:understanding      # bảng so sánh
node scripts/evaluate-understanding.cjs --failures --write   # liệt kê câu sai, lưu báo cáo vào output/evaluation/
```

## Kết quả ngày 16/11/2026 (catalog 101 món, chỉ chạy offline)

| Chỉ số | Hiện tại | Module mới |
|---|---|---|
| Hiểu đúng ngân sách | 1/13 | 12/13 |
| Đọc nhầm số trong tên món thành ngân sách | – | 0/114 |
| Tra đúng món (đúng SKU, hoặc đúng là phải hỏi lại / hết / không có) | 58/97 | 97/97 |
| **Chọn sai SKU** (lỗi nguy hiểm nhất) | **3/97** | **0/97** |
| SKU đúng nằm trong 12 món đưa cho model | 77/82 | 81/82 |
| Báo cho model biết món khách hỏi không có trong menu | 0/11 | 11/11 |
| Cảnh báo "không có trong menu" nhầm trên câu hợp lệ | – | 0/82 |
| Ý định, theo mock parser (không phải Bedrock) | 78/127 | không thay đổi |

### Cách đọc đúng các con số này

- **Đây là tập phát triển, không phải tập kiểm tra độc lập.** Module được viết trong lúc nhìn các câu cùng kiểu, nên kết quả 97/97 *không* chứng minh module sẽ đúng với câu mới. Không đưa con số này vào báo cáo như độ chính xác thật.
- Nhãn do agent soạn (`reviewStatus: draft_agent`), cần người trong nhóm review. Câu do agent viết để mô phỏng cách khách nói, không phải câu thu thập từ khách thật.
- Phần tra món dùng cụm từ chỉ món đã được gán nhãn sẵn (`mention`). Trong hệ thống thật, LLM là bước tách cụm từ đó ra khỏi câu, và bước này chưa được đo.
- 78/127 là kết quả của mock parser chạy offline. Nó **không** đo được Haiku hiểu ý khách tốt đến đâu; muốn biết phải chạy Bedrock thật, cần phê duyệt và tốn lượt trong giới hạn 25 lượt/ngày.

### Còn sai / còn thiếu

- "deal nào 99k" (khách muốn đúng mức giá 99k) chưa hiểu được.
- "món tráng miệng": danh mục này dùng chung với đồ uống, nên Bánh Trứng không lọt vào top 12.
- "2 miếng gà rán" có thể là 2 phần × "1 Miếng Gà Rán" hoặc 1 phần "2 Miếng Gà Rán". Module trả `ambiguous` để hỏi lại; câu hỏi lại cụ thể thuộc phần phản hồi.

## Lỗi trên `main` (commit 12def83) đã sửa bằng bước 3

1. `PolicyEngine.findMenuMatches("pepsi lớn")` → Pepsi (Lon), do bỏ dấu.
2. `PolicyEngine.findMenuMatches("súp rong biển")` khi Súp Rong Biển hết hàng → Combo Cơm Gà Rán & Súp.
3. `catalogContext` khi không khớp món nào vẫn đưa 12 món rẻ nhất cho model mà không báo gì.

Bảng "Kết quả" ở trên dùng một bản sao cố định của logic cũ trong `evaluate-understanding.cjs`, để vẫn so được trước/sau.

## Bước tiếp theo

1. **Review nhãn** (cả nhóm), sau đó **tạo tập kiểm tra độc lập**: người *không* đọc code module tự viết 50–100 câu mới. Đo một lần duy nhất, không chỉnh module theo tập này.
2. **Đo LLM thật end-to-end** (Haiku + prompt mới + context mới) trên khoảng 20 câu đại diện. Cần phê duyệt lượt Bedrock.
3. Người phụ trách `policy-engine`, `catalog-context` và `menu-service` review PR. Đây là code dùng chung của nhóm.
