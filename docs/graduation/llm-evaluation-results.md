# Kết quả đánh giá LLM ngày 15/11/2026

Đã thực hiện 24 lượt Bedrock Haiku 5.5 theo ngân sách riêng được người dùng duyệt. Model `global.anthropic.claude-haiku-5-5`, vùng gọi `ap-southeast-1`, profile `default`. Mỗi lượt giới hạn đầu vào 32.000 byte và đầu ra 512 token. Đợt chạy hoàn tất, không có lỗi provider.

## Dữ liệu và phương pháp

Tập `tests/data/llm-evaluation.vi.json` gồm 24 câu tiếng Việt mới, khác tập phát triển 50 câu. Tập câu và hash prompt, adapter, schema, evaluator được lưu trước khi gọi thật. Tập có bảy nhóm ý định. SEARCH_MENU, VIEW_CART, ADD_TO_CART, UPDATE_CART, REMOVE_FROM_CART và CLEAR_CART có ba câu mỗi nhóm, UNKNOWN có sáu câu. LIST_MENU và GET_MENU_ITEM được gộp vào SEARCH_MENU theo kế hoạch đã đóng băng.

Chỉ sáu câu có nhãn số lượng. Chỉ số joint yêu cầu đúng nhóm ý định và đúng số lượng nếu câu đó có nhãn. Đầu ra phải là JSON hợp lệ theo schema nghiêm ngặt. Độ trễ được đo quanh lời gọi provider, p95 dùng nearest-rank trên 24 giá trị.

## Kết quả

| Chỉ số | Kết quả |
| --- | --- |
| Số lượt thực hiện | 24/24 |
| JSON hợp lệ | 24/24 |
| Nhóm ý định đúng | 24/24 |
| Joint đúng | 24/24 |
| Số lượng đúng trong các câu có nhãn | 6/6 |
| Macro F1 trên bảy nhóm | 1,0 |
| Độ trễ p50 | 1.681,63 ms |
| Độ trễ p95 | 1.806,03 ms |
| Input token | 36.594 |
| Output token | 3.686 |
| Lượt có số liệu token | 24/24 |

Số token là usage do provider trả về. Chi phí thanh toán thực tế cần đối chiếu billing và đơn giá áp dụng cho tài khoản. Độ trễ ở bảng đo lời gọi model, còn thời gian toàn luồng giao diện và xác nhận giỏ cần phép đo riêng.

## Bằng chứng tái kiểm tra

- Run ID `4ac1e5d0-e13a-47b7-bc1a-7f6f82d06019`.
- Dataset SHA256 `ff7cca1296c5349e52501b336044dbaaf436e74859d0fce0893cfe15d0e80321`.
- Evaluator SHA256 `edd36bdb9aee9b97a0ac41bc23b86c82982f98cb02b11a73da88e77db16bf350`.
- Kế hoạch trước chạy tại `output/verification/llm-evaluation-frozen-plan-20261115.log`.
- Kết quả từng câu tại `output/evaluation/llm-result-4ac1e5d0-e13a-47b7-bc1a-7f6f82d06019.json`.
- Tổng hợp tại `output/evaluation/llm-summary-20261115.json`.

Lệnh `node scripts/evaluate-llm.cjs` chỉ chuẩn bị kế hoạch offline. Lượt chạy thật cần phê duyệt mới khi mở rộng ngân sách. Marker và kết quả của đợt này được giữ lại.

## Giới hạn khi đưa vào khóa luận

Tập câu nhỏ, dùng dữ liệu tổng hợp và được soạn với sự hỗ trợ của agent sau giai đoạn phát triển. Nhóm cần review nhãn và mô tả cách xây dựng tập trước khi đưa vào báo cáo học thuật. Kết quả chỉ áp dụng cho 24 câu đã lưu. Các phép thử tìm đúng SKU, policy, xác nhận giỏ, hành vi người dùng, lỗi mạng và tải đồng thời có phạm vi riêng. Cần bổ sung dùng thử với người tham gia và sự đồng ý của họ để đánh giá tính dễ sử dụng.
