# Kết quả đánh giá parser offline

Thời điểm: 2026-11-07T08:06:59.639Z. Provider: mock. Node v26.3.0, win32/x64.

| Nhóm | Số câu | Đúng intent | Đúng intent + số lượng |
|---|---:|---:|---:|
| Toàn bộ | 50 | 98.0% | 98.0% |
| Trong phạm vi hỗ trợ | 40 | 100.0% | 100.0% |
| Thử thách ngoài mẫu | 10 | 90.0% | 90.0% |

Macro F1 intent: 0.9757. Latency parser trong bộ nhớ: p50 0.051 ms, p95 0.438 ms. Đây không phải latency HTTP/Bedrock/production.

Dataset tự xây dựng, không có người tham gia khảo sát; nhóm supported theo các cấu trúc được công bố, nhóm challenge ghi nhận giới hạn thực tế. Không dùng kết quả này để kết luận chất lượng LLM hoặc tổng quát hoá cho mọi câu tiếng Việt. Phép đo không kiểm tra tìm đúng món hay thực thi policy; các phần đó được kiểm tra riêng bằng test nghiệp vụ và HTTP.

Dataset SHA256: d17e599639e6554120a44fe64e3e50abfafab2b0eee0c36ea189387843481f70

Provider SHA256: fb722f36a1df662ab6c4153863291b8f0b2c6b739de36793963360af19522e28

## Các ca chưa đạt

- VI-045: “Giảm Pepsi bớt 1” — kỳ vọng UPDATE_CART, nhận NONE.

Chạy lại: npm run evaluate. Báo cáo từng ca: output/evaluation/intent-report.json.

## Phạm vi so sánh và tái lập

Bộ 50 câu đã được xem và dùng trong quá trình phát triển; kết quả tăng không phải kiểm định độc lập hay đánh giá người dùng thật. Nhãn và subset giữ nguyên, không sửa ca lỗi tương đối để tăng điểm. Mốc trước parser v2 giữ riêng trong tests/baselines/intent-report-before-parser-v2.json và docs/graduation/evaluation-baseline-before-parser-v2.md. Bộ 61 câu language-safety là hồi quy tổng hợp, không phải holdout.

Parser aggregate SHA256: aefc5fc44e7d9af765a80bdeea59c8bf4276078c235d1ca75cd266b5c37c46d9

- src/lib/agent/providers/mock-llm-provider.ts: fb722f36a1df662ab6c4153863291b8f0b2c6b739de36793963360af19522e28
- src/lib/agent/providers/mock-message.ts: aeedfe89e79b9a91bc2379fab3cb4426005c51ca690b2f0c4540758be173f3d3
- src/lib/services/menu-service.ts: 42c41f27a14c016556c48450f65c1d58463fa3ae1de108335c454394fa97a713

Evaluator SHA256: 9315b2748858261099fbaa3184fc5871db3d300f0a1c463baab54711b3d93071
