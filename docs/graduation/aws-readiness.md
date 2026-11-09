# Pilot AWS và Bedrock thật

Ngày chuẩn bị: 09/11/2026. Đây là hướng dẫn cho cấu hình đề xuất, **chưa phải biên bản triển khai thành công**. Bằng chứng preflight chỉ đọc nằm trong `output/verification/aws-preflight.json`; không có InvokeModel trong bước đó.

## Thiết kế được review

`infra/aws/stack.json` được sinh bằng `python infra/aws/build-template.py`: 21 resource, VPC/subnet public, một EC2 t3.medium Amazon Linux 2023 x86_64, EIP, EBS root 32 GiB và data 20 GiB gp3 mã hoá, S3 private/versioned, ba Secrets Manager secret, IAM/instance profile, CloudFront.

CloudFront redirect HTTPS, tắt cache và chuyển cookie/Host/query đến origin. Security group chỉ nhận HTTP từ managed prefix list CloudFront; nginx kiểm tra secret header do distribution chèn. Quản trị máy bằng SSM, không mở SSH. Người xem dùng HTTPS; đoạn CloudFront–origin dùng HTTP có giới hạn nguồn và secret, chưa có TLS xuyên suốt. Pilot một máy có thời gian gián đoạn khi thay container; không cam kết HA/SLA.

Runtime dùng `AI_PROVIDER=bedrock`, `PERSISTENCE_DRIVER=local`, `/data` trên retained EBS, một tiến trình Node. IAM InvokeModel giới hạn đúng profile Haiku 4.5 và ba regional foundation-model ARN; AWS có thể định tuyến inference đến us-east-1/us-east-2/us-west-2. Không dùng dữ liệu khách thật cho canary/đánh giá. Container chạy user node; secret chỉ được materialize vào file root 0600 và không xuất ra log.

`BEDROCK_DAILY_REQUEST_LIMIT=25` áp dụng toàn bộ ứng dụng theo ngày UTC, giữ trên EBS; 0 tắt inference. Request được giữ chỗ trước gọi, thất bại cũng tiêu một lượt; SDK không tự retry. Body tối đa 32.000 byte UTF-8, output mặc định 512 token. Đây là giới hạn lượt gọi của một tiến trình, **không phải hạn mức USD hay giới hạn đa instance**. Haiku 4.5 chỉ nhận một trong `temperature`/`top_p`; adapter đã sửa theo [tài liệu Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-anthropic-claude-messages-request-response.html).

## Chi phí cần duyệt

AWS Price List được đọc ngày 09/11, region us-west-2; snapshot các mức giá tại `output/verification/aws-price-inputs.json`. Ước tính 730 giờ/tháng:

| Thành phần | Giá đầu vào | Ước tính USD/tháng |
| --- | --- | --- |
| t3.medium Linux Shared On-Demand | 0,0416/giờ | 30,368 |
| gp3 tổng 52 GiB | 0,08/GiB-tháng | 4,160 |
| Một IPv4 public đang sử dụng | 0,005/giờ | 3,650 |
| Ba secret | 0,40/secret-tháng | 1,200 |
| Tổng cơ sở | Chưa tính mục bên dưới | **39,378** |

Cộng thêm Bedrock theo token, S3/request, CloudFront/lưu lượng, Secrets API, snapshot nếu tạo, CPU surplus credits T3 nếu áp dụng và thuế. Không giả định free tier/credit hoặc một trần tổng chi phí. Giá có thể đổi; đọc lại trước triển khai. [EC2 pricing](https://aws.amazon.com/ec2/pricing/on-demand/), [Bedrock pricing](https://aws.amazon.com/bedrock/pricing/).

EBS data, bucket/version và secret có Retain: vẫn có thể phát sinh phí sau khi xoá stack. Không tự xoá dữ liệu hoặc tài nguyên ngoài phạm vi được duyệt.

## Chuẩn bị không ghi AWS

```powershell
npm run check
npm run test:submission
npm run aws:preflight
npm run aws:plan
npm run aws:artifact
```

`aws:preflight` đọc STS, inference profile và model availability; `aws:plan` đọc STS, AMI public SSM parameter và DescribeImages, ghi báo cáo local. Account hiện thấy kết thúc 0098, region đề xuất us-west-2, chưa xác nhận làm đích triển khai. Plan ghi `proposedAmiId`; AMI phải được ghim rõ trong target, không để biến “latest” thay đổi khi execute.

Dockerfile chưa được chạy trên máy Windows hiện tại vì chưa có Docker. `npm run build` xác minh bản Next local; kiểm thử package/template không thay thế build và chạy container Linux. Base images Node 24/nginx stable là tag, chưa pin digest; source tar và S3 object version được pin, chưa thể coi image là build tái lập hoàn toàn.

## Trình tự sau khi được duyệt

Các lệnh bên dưới có thể phát sinh chi phí, chỉ chạy trong tài khoản/vùng và phạm vi đã được người dùng duyệt. Giữ target riêng tại `.local/aws-target.json`, không đặt config tài khoản/secret vào `infra` hoặc ZIP.

1. Copy `infra/aws/target.example.json` vào `.local/aws-target.json`; điền `expectedAccount` đủ 12 số và `amiId` đã review từ plan. Giữ profile/default, us-west-2, stack name, prefix list, instance và giới hạn đã duyệt. Chạy lại `aws:plan -- --config .local/aws-target.json` và đối chiếu.
2. Canary thật đúng **một** lần gọi, dữ liệu synthetic, output tối đa 512 token:

```powershell
# Điền account đã được duyệt, không copy placeholder làm giá trị thật.
$canaryId = [guid]::NewGuid().ToString()
node scripts/aws-canary.cjs --invoke --expected-account <ACCOUNT_12_DIGITS> --request-id $canaryId
```

Marker `.local/aws-canary/<UUID>.attempt.json` tạo bằng exclusive write trước gọi; không dùng lại/xoá marker hoặc retry tự động. Báo cáo ghi token usage, kiểm tra proposal chưa đổi giỏ, rồi xác nhận đúng món/số lượng trong bộ nhớ synthetic. Thất bại thì dừng và chẩn đoán; chưa có bằng chứng AI thật cho đến khi report `passed=true`.

3. Tạo CREATE Change Set (chưa tạo EC2/distribution):

```powershell
node scripts/aws-deploy.cjs prepare --config .local/aws-target.json
```

Đợi `describe-change-set` hoàn tất; xem toàn bộ Changes, template và parameters. CLI execute yêu cầu stack REVIEW_IN_PROGRESS, Change Set CREATE_COMPLETE/AVAILABLE, đúng 21 additions, template/AMI/parameters khớp bản review; không nhận Change Set update hoặc template khác.

```powershell
node scripts/aws-deploy.cjs execute --config .local/aws-target.json --change-set <EXACT_CHANGE_SET_NAME>
```

4. Theo dõi stack events đến CREATE_COMPLETE, SSM online và bootstrap mount đúng EBS. Khi lỗi thì lưu events, dừng để chẩn đoán, không tự retry hoặc xoá stack. CREATE_COMPLETE chưa chứng minh ứng dụng đã chạy.
5. `npm run aws:artifact` tạo tar.gz có manifest; dùng đúng file và SHA256 vừa review:

```powershell
node scripts/aws-deploy.cjs release-plan --config .local/aws-target.json --artifact <TAR_GZ_PATH> --sha256 <SHA256>
node scripts/aws-deploy.cjs release --config .local/aws-target.json --artifact <TAR_GZ_PATH> --sha256 <SHA256>
```

Release upload đúng key theo SHA với if-none-match, lấy VersionId, gửi một SSM command vào HostId của stack. Máy tải đúng object version và kiểm tra SHA trước giải nén/build. Không tự gọi inference. Lưu CommandId, VersionId và image ID thực tế; kiểm tra SSM command thành công, container health và HTTPS riêng. Docker build thất bại phải dừng trước thay app; rollback container không đồng nghĩa rollback schema/dữ liệu đã ghi.

## Nghiệm thu AWS phải thực hiện

- HTTPS `/api/health`, `/chat`, `/admin`; redirect HTTP; security headers; cookie Secure/HttpOnly/SameSite; ghi cùng origin và từ chối origin khác; không cache dữ liệu riêng. Test proxy local chỉ chứng minh phần ứng dụng, chưa chứng minh distribution thực tế.
- Hai danh tính synthetic: cart/history/order/feedback riêng; admin tách biệt; hoàn thành một đơn pickup và delivery, menu/CAS, quote/khuyến mãi, bếp và CSV đối soát.
- Chat **trên ứng dụng AWS** thật: proposal → chưa đổi cart → explicit confirmation → đúng cart; model/provider failure có thông báo, không mock fallback. Giới hạn các lượt gọi trả phí theo lần duyệt tiếp theo.
- Restart container giữ session/cart/order/budget; backup mã hoá, verify và restore vào thư mục mới bằng synthetic data. Không thử restore đè lên volume đang dùng.
- Ghi URL, thời gian, source/template SHA, S3 VersionId, stack/SSM status, image IDs, ca kiểm tra và chi phí thực tế. Không đưa mật khẩu/secret/contact thật vào hồ sơ.

Chỉ sau các bước này mới ghi “AWS và AI thật đã nghiệm thu”. DynamoDB, thanh toán/giao hàng/POS thật, HA và khảo sát người dùng chưa có bằng chứng trong gói chuẩn bị này.
