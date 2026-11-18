# Đối chiếu thực đơn với kfcvietnam.com.vn (18/11/2026)

Mục đích: kiểm tra dữ liệu agent đang dùng (snapshot TinyFish lấy lúc 2026-11-15T07:57Z, 101 món) còn đúng với website KFC không.

## Cách làm

Mở `https://kfcvietnam.com.vn/menu` bằng trình duyệt (chỉ đọc, từ chối cookie không cần thiết), đọc từng thẻ món trong `app-product` theo 9 nhóm: tên, giá hiện tại, giá gạch, mô tả, nút "Thêm"/hết hàng. So khớp theo tên với snapshot.

## Kết quả

| Kiểm tra | Kết quả |
|---|---|
| Số món trên website | 99, 9 nhóm |
| Tên món website có trong snapshot | 99/99 |
| Giá khớp | 99/99 |
| Mô tả (thành phần combo) khớp | 99/99 (một tên trên website có hai dấu cách liền nhau, nội dung giống) |
| Món website có mà snapshot thiếu | 0 |
| Món website ghi hết hàng | 0 (trang công khai không hiện tình trạng theo nhà hàng) |
| **Món snapshot có mà website đã gỡ** | **2**: "Xô Zòn Zã 159K" (159.000 ₫), "Xô Zui Zẻ 139K" (139.000 ₫) — ưu đãi cũ, đã thay bằng "Xô Zòn Zã 179K", "Xô Zui Zẻ 159K" |

Website hiện có 19 món kèm giá gạch (giá gốc); snapshot không lưu giá gốc nên agent không nói được mức giảm.

## Xử lý

- Snapshot giữ nguyên: đó là bản ghi đúng của lần thu thập 15/11 kèm mã băm nguồn; sửa tay sẽ làm sai nguồn gốc. Cập nhật đúng là một lần thu thập mới đã review (người phụ trách catalog).
- Hai món được đánh dấu **ngừng bán** (`isActive=false`, `isAvailable=false`, không xoá — giống cách `mergeCatalog` xử lý món bị gỡ) qua `adminService.saveMenu` (có audit):
  - dữ liệu local `.local-agent-test`: đã làm 18/11/2026 (99 món đang bán);
  - bảng DynamoDB `KfcForceAgent` của AgentCore: **chưa làm**, cần duyệt (ghi AWS). Lưu ý: chạy lại `dynamodb-seed-catalog` từ snapshot sẽ bật lại hai món này.
- reply-guard phân biệt món ngừng bán ("đã ngừng bán") với món tạm hết; test 21 trong `test:tool-agent`.
- Bộ đo hội thoại khai báo hai món này trong `catalogState.retired` và có hội thoại CV-06 kiểm tra agent không gợi ý chúng.

## Giới hạn

Tình trạng còn/hết theo từng nhà hàng không có trên trang menu công khai; agent chỉ bám theo dữ liệu được cập nhật (admin hoặc luồng đồng bộ thực đơn sau này).
