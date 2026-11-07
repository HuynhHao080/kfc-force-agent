# Mốc trước parser v2

Bản đo trước khi mở rộng parser. Giữ để đối chiếu; không phải đánh giá độc lập.

# Kết quả đánh giá parser offline

Thời điểm: 2026-11-07T05:56:23.603Z. Provider: mock. Node v26.3.0, win32/x64.

| Nhóm | Số câu | Đúng intent | Đúng intent + số lượng |
|---|---:|---:|---:|
| Toàn bộ | 50 | 84.0% | 80.0% |
| Trong phạm vi hỗ trợ | 40 | 100.0% | 100.0% |
| Thử thách ngoài mẫu | 10 | 20.0% | 0.0% |

Macro F1 intent: 0.8166. Latency parser trong bộ nhớ: p50 0.031 ms, p95 0.114 ms. Đây không phải latency HTTP/Bedrock/production.

Dataset tự xây dựng, không có người tham gia khảo sát; nhóm supported theo các cấu trúc được công bố, nhóm challenge ghi nhận giới hạn thực tế. Không dùng kết quả này để kết luận chất lượng LLM hoặc tổng quát hoá cho mọi câu tiếng Việt. Phép đo không kiểm tra tìm đúng món hay thực thi policy; các phần đó được kiểm tra riêng bằng test nghiệp vụ và HTTP.

Dataset SHA256: d17e599639e6554120a44fe64e3e50abfafab2b0eee0c36ea189387843481f70

Provider SHA256: 72a41318944e32be56a438988d4dd7b53648b86e139b541ed2b5417b2280339e

## Các ca chưa đạt

- VI-041: “Tôi cần 2 Pepsi” — kỳ vọng ADD_TO_CART (2), nhận SEARCH_MENU.
- VI-042: “Cho mình hai Pepsi” — kỳ vọng ADD_TO_CART (2), nhận ADD_TO_CART (1).
- VI-043: “Mình lấy 1 combo gà cay” — kỳ vọng ADD_TO_CART (1), nhận SEARCH_MENU.
- VI-044: “Đổi Pepsi thành hai phần” — kỳ vọng UPDATE_CART (2), nhận NONE.
- VI-045: “Giảm Pepsi bớt 1” — kỳ vọng UPDATE_CART, nhận NONE.
- VI-046: “Mua giúp tôi hai burger gà rán” — kỳ vọng ADD_TO_CART (2), nhận ADD_TO_CART (1).
- VI-047: “Kiểm tra tiền trong giỏ” — kỳ vọng VIEW_CART, nhận NONE.
- VI-048: “Làm rỗng giỏ” — kỳ vọng CLEAR_CART, nhận NONE.
- VI-049: “Bạn ơi huỷ món Pepsi trong giỏ hàng” — kỳ vọng REMOVE_FROM_CART, nhận VIEW_CART.
- VI-050: “Hãy bỏ toàn bộ món trong giỏ” — kỳ vọng CLEAR_CART, nhận SEARCH_MENU.

Chạy lại: npm run evaluate. Báo cáo từng ca: output/evaluation/intent-report.json.
