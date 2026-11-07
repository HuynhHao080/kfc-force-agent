# Sao lưu và khôi phục dữ liệu local

Công cụ chạy offline bằng Node, không gọi AWS. Dùng cho driver local và một tiến trình, không phải backup DynamoDB hoặc giải pháp disaster recovery production.

## Nội dung bản sao

- store.json: tài khoản, phiên, hội thoại, giỏ, đơn, catalog và nhật ký.
- session-secret: khoá ký phiên đang có hiệu lực; nếu SESSION_SECRET được cấu hình thì lấy giá trị môi trường vào payload mã hoá thay vì file bị override.
- admin-credentials.json nếu có: hash/salt/KDF local, không phải mật khẩu gốc.

Không chép admin-bootstrap.txt, file tạm, .env, AWS credentials, dependencies hoặc thư mục con. ADMIN_PASSWORD override không được chép; cần giữ cấu hình đó riêng hoặc thiết lập admin mới sau khôi phục.

Archive .kfcbackup dùng AES-256-GCM với IV/salt ngẫu nhiên và khoá dẫn xuất bằng scrypt. Header định dạng/thời điểm/KDF được xác thực cùng ciphertext. Payload chứa manifest tên file/byte/SHA256. Sai mật khẩu hoặc file bị sửa bị từ chối. Không đưa archive riêng tư vào gói source nộp trường.

## Cách dùng trên PowerShell

Dừng server trước khi sao lưu để lấy trạng thái có phối hợp. Công cụ phát hiện file thay đổi trong quá trình thu thập và dừng, nhưng không thay thế khoá đa tiến trình. Không sao lưu trực tiếp trên dữ liệu đang có nhiều worker ghi.

Hàm dưới hỏi mật khẩu bằng SecureString, chỉ chuyển nó vào stdin của Node, không đặt trong command argument hoặc file. Dùng cùng mật khẩu cho backup/verify/restore; mật khẩu 12–128 ký tự. Giữ mật khẩu ngoài archive, mất mật khẩu thì không có chức năng khôi phục nó.

~~~powershell
function Invoke-KfcLocalData {
    param([string[]]$Arguments)
    $taskSecurePassword = Read-Host 'Mat khau ban sao luu' -AsSecureString
    $taskPasswordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($taskSecurePassword)
    $taskPreviousOutputEncoding = $OutputEncoding
    try {
        $OutputEncoding = New-Object System.Text.UTF8Encoding($false)
        [Runtime.InteropServices.Marshal]::PtrToStringBSTR($taskPasswordPointer) |
            & node scripts/local-data.cjs @Arguments --password-stdin
        if ($LASTEXITCODE -ne 0) { throw 'Local data operation failed' }
    } finally {
        $OutputEncoding = $taskPreviousOutputEncoding
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($taskPasswordPointer)
        $taskSecurePassword.Dispose()
    }
}

# Dùng đúng LOCAL_DATA_DIR của server. Preview đang dùng .local/preview.
Invoke-KfcLocalData -Arguments @(
    'backup', '--from', '.local/preview',
    '--out', '.local/backups/demo.kfcbackup'
)
Invoke-KfcLocalData -Arguments @(
    'verify', '--file', '.local/backups/demo.kfcbackup'
)
Invoke-KfcLocalData -Arguments @(
    'restore', '--file', '.local/backups/demo.kfcbackup',
    '--to', '.local/recovered-demo'
)
~~~

Chạy trong thư mục project. Các npm script data:backup/data:verify/data:restore tương đương ba subcommand nhưng cũng cần --password-stdin. Backup mặc định lấy LOCAL_DATA_DIR hoặc .local và tự tạo tên mới trong thư mục backups bên trong source data. Dùng --out để có tên cố định; không ghi đè archive đã tồn tại.

CLI nạp .env theo project hiện tại. Môi trường phải tương ứng với server đang được sao lưu; --from chỉ chọn thư mục, không thể đọc biến môi trường của một server khác. Hàm PowerShell tạm đặt UTF-8 cho stdin để giữ mật khẩu Unicode, rồi khôi phục encoding cũ.

Khôi phục chỉ chấp nhận đích **chưa tồn tại**, kể cả thư mục rỗng đã tồn tại cũng bị từ chối. Công cụ giải mã/kiểm tra trước, ghi vào thư mục staging riêng cạnh đích, kiểm tra byte/hash và đổi tên staging sang đích. Không xoá hoặc thay thư mục nguồn. Không dùng đích bên trong src/public/docs/scripts/tests; giữ dữ liệu dưới .local hoặc thư mục dữ liệu riêng.

Tên file được allowlist; archive không thể chỉ định ../ hoặc đường dẫn tuỳ ý. Snapshot được kiểm tra cấu trúc repository/Map, không phải một bộ kiểm chứng mọi ràng buộc nghiệp vụ. Giới hạn 20 MiB mỗi file, 64 MiB archive. Các phiên bản định dạng khác bị từ chối.

## Chạy bản đã khôi phục

~~~powershell
$env:PERSISTENCE_DRIVER = 'local'
$env:LOCAL_DATA_DIR = '.local/recovered-demo'
npm start
~~~

Cần production build đã tạo trước. Không cho hai tiến trình cùng ghi một thư mục JSON. Nếu SESSION_SECRET hiện tại khác khoá trong backup, restore bị từ chối; bỏ override không phù hợp hoặc dùng đúng cấu hình của bản sao. Không in khoá ra console. File local có mode 600 khi hệ điều hành hỗ trợ; Windows vẫn cần quyền truy cập thư mục phù hợp.

Khôi phục một bản cũ cũng khôi phục hash mật khẩu và record phiên tại thời điểm đó. Với khoá ký giữ nguyên, cookie cũ chưa hết hạn có thể có hiệu lực trở lại. Nếu cần vô hiệu các cookie đó, cấu hình một SESSION_SECRET mới, riêng tư, tối thiểu 32 ký tự; guest có thể mất quyền xem lịch sử phiên cũ, admin vẫn đọc được dữ liệu đơn. Phiên staff trong bộ nhớ luôn mất khi restart.

Không tạo admin-bootstrap mới từ hash. Dùng mật khẩu admin đã có hoặc chạy admin:setup -- --reset có chủ ý trên **thư mục đã khôi phục** nếu cần credential mới. Giỏ/đơn giữ nguyên.

## Kiểm chứng

~~~powershell
npm run test:data
npm run check
~~~

8 nhóm kiểm tra dùng thư mục tạm và dữ liệu giả: mã hoá/allowlist, password/tamper, byte-identical restore, không overwrite, traversal, đọc lại bằng service thật trong process mới, source đổi khi đang backup, cấu trúc sai và env signing key. Không dùng hoặc sao lưu dữ liệu preview thật trong các test. Mức kiểm tra này chưa chứng minh chịu được mất điện, hỏng ổ đĩa hoặc restore trên mọi phiên bản tương lai.

Sổ địa chỉ tài khoản nằm trong addresses Map của store.json và được mã hoá cùng snapshot. Kiểm tra recovery dùng AddressService thật sau restore trong tiến trình mới; chưa có sao lưu/khôi phục cloud cho chức năng này.

Map menuRepository.promotions được sao lưu cùng snapshot. Backup cũ thiếu map này vẫn được validator chấp nhận; app khởi tạo map rỗng khi mở dữ liệu cũ. Bản backup mới kiểm tra đọc lại mã bằng PromotionService sau restore.

Đặt lại lưu sourceOrderId/reorderOperationId trên Cart, không có map hoặc file riêng. Backup integration tạo cart qua ReorderService và restore ký key gốc, retry token còn hạn chỉ đọc lại cart hiện tại, không thêm quantity lần nữa. Token hết 15 phút thì tạo preview mới sau khi kiểm tra giỏ; không dùng token cũ để khôi phục thao tác.

Shop settings FR34: map shopSettings được mã hoá/restore cùng store; là optional để nhận archive cũ. Process recovery test đọc đúng địa chỉ/phí cấu hình. Order.store snapshot nằm trong orders map; restore không thay snapshot bằng cấu hình hiện tại.

FR35 feedback/reply nằm trong order record, không map mới. Recovery test hoàn tất một đơn, lưu rating4vàreply, sau restoreprocessmới đọc lại đúng cùng ownership; không tạo đánh giá giả cho các đơn cũ thiếu trường feedback.

## Revision giỏ và phục hồi ghi lỗi — FR36

Cart.revision optional cho file cũ; không thêm Map hoặc sửa backup schema. Giỏ legacy nâng cấp revision khi có commit mới. test:data dùng thư mục tạm riêng, chặn đường dẫn store.json.tmp bằng một directory rỗng để tạo lỗi ghi, rồi so sánh metadata/dòng giỏ và bytes store.json. Bảy ca gồm lần thêm đầu, thêm/gộp, thêm SKU khác, sửa số lượng, xoá dòng, xoá giỏ và reprice. Mỗi ca dọn đúng directory rỗng do test tạo trong finally; sau nhả chặn, reprice thành công và khớp tổng tiền. Không đụng dữ liệu preview, không mô phỏng mọi dạng mất điện hoặc lỗi filesystem.
