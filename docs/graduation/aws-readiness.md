# Pilot AWS và Bedrock thật

## Phiên bản trợ lý mua hàng mới

Ngày 15/11/2026 người dùng chốt ứng dụng phục vụ người mua KFC. Bản local mới dùng catalog TinyFish 99 món, UI lựa chọn/so sánh và chuyển sang KFC để đặt hàng. Chi tiết tại [trợ lý mua hàng](../kfc-purchase-assistant.md). Thông tin stack, URL và SHA bên dưới ghi lần phát hành AWS trước thay đổi luồng mua hàng. Phát hành phiên bản mới cần cấu hình chế độ trợ lý và dữ liệu catalog tương ứng, kiểm tra lại HTTPS sau phát hành.

## Bản AWS đã nghiệm thu ngày 15/11/2026

Ứng dụng truy cập tại https://d2qcew89gdrdgt.cloudfront.net. Người dùng đã duyệt triển khai stack 21 resource tại Singapore và 25 lượt AI/ngày UTC cho web AWS, cùng đợt đánh giá riêng 24 lượt. Chi tiết phạm vi và giá cơ sở 48,386 USD/tháng tại [hồ sơ phát hành](aws-release-approval.md). Đây là ước tính cấu hình, chi phí sử dụng thực tế cần đối chiếu billing.

| Thành phần | Giá trị đã kiểm tra |
| --- | --- |
| Stack | `kfc-graduation-pilot`, `CREATE_COMPLETE` |
| Vùng | `ap-southeast-1` |
| CloudFront | `EJDT9YNBBABA4` |
| Host | `i-0cbc1f00978f84fe0`, SSM online |
| Source SHA256 | `8ba1a652feee1802c86a98fb50ecc1e75c987bdf7e784e2c8333bc308e2d6d90` |
| Template SHA256 | `c764647e925d93b3f84ce1b682034da4db33994affcc8d06eeedeaa371cb47c6` |
| S3 VersionId | `HMSrLEbFcVSLz5W7mfiW8BfZeR9CXMhV` |
| SSM release | `dcde1859-097f-4982-8292-409206615e2e`, Success |
| Image ID | `sha256:6a845142b9023195578e48d71303db4f9f1e1b1eea7705c351159607c9a18cf9` |

Đã kiểm tra HTTPS health, `/chat`, `/admin`, chuyển HTTP sang HTTPS, security headers, cookie Secure/HttpOnly, customer SameSite=Lax và staff SameSite=Strict. API admin chặn khách, POST chat khác origin bị từ chối trước inference. Chat thật trên trình duyệt tạo đề xuất hai Pepsi, giữ giỏ trống trước xác nhận rồi cập nhật đúng hai phần sau xác nhận. Đã dùng một lượt AI của web AWS trong ngày UTC 14/11 khi nghiệm thu, tương ứng sáng 15/11 tại Việt Nam.

Hai khách giả lập hoàn tất đơn pickup và delivery qua đúng state machine. Checkout gửi lại cùng key giữ nguyên đơn và số event, khách khác bị chặn xem đơn. Đã kiểm tra phí do server tính, giỏ cũ bị từ chối, CAS danh mục, khôi phục mô tả danh mục ban đầu, đánh giá sau hoàn tất, staff trả lời và xuất CSV báo cáo qua trình duyệt. CSV được kiểm tra loại dữ liệu liên hệ giả lập.

SSM `5460a28d-5447-4efe-8635-606c6923a6ec` dừng container để tạo bản sao nhất quán, khôi phục vào thư mục mới và so sánh nội dung giống nhau, sau đó khởi động lại thành công. Archive và thư mục phục hồi được giữ trong `/srv/kfc/acceptance-backups`, quyền thư mục 0700 và archive 0600, trên EBS mã hóa. Cả root 32 GiB và data 20 GiB đều có `Encrypted=true`. Phiên khách, giỏ và các đơn hoàn tất còn sau restart. Phiên staff được thu hồi khi tiến trình dừng theo thiết kế, đăng nhập lại thành công. Bộ đếm AI vẫn là 1/25 sau restart, kiểm tra UUID mount đạt. Phép thử này phục hồi từ bản sao cùng ổ EBS, cần bổ sung bản sao độc lập để kiểm chứng tình huống mất cả volume.

Báo cáo tại `output/verification/aws-https-acceptance-20261115-resumed.json`, `aws-restart-backup-result-20261115.json`, `aws-budget-proof-20261115.json`, `aws-volumes-20261115.json`. Ảnh trình duyệt là `aws-ai-proposal-20261115.png` và `aws-admin-sales-20261115.png`. Credentials nằm trong đường dẫn private `.local`, được loại khỏi Git và artifact.

Lần phát hành đầu gặp CRLF trong shell script. Packager đã được sửa và có regression test, giữ lại artifact/log lỗi. Các lần dừng kiểm thử do fixture cookie, revision và phiên staff sau restart đã được đối chiếu mã nguồn rồi sửa fixture, giữ báo cáo trước đó. Các bằng chứng hiện tại chỉ cho các ca đã chạy. Health có trường `cloudVerified=false` cố định trong mã nguồn, trạng thái cloud được đối chiếu từ stack, SSM và các phép thử HTTPS ở trên.

Đợt LLM riêng đã hoàn tất 24 lượt. Kết quả JSON, nhóm ý định và joint đều 24/24, số lượng 6/6 câu có nhãn. Mô tả dữ liệu tổng hợp nhỏ và các giới hạn tại [kết quả đánh giá LLM](llm-evaluation-results.md). Pilot tiếp tục dùng một tiến trình JSON/EBS, thanh toán COD demo và dữ liệu giả lập. HA, kiểm thử tải, DynamoDB giao dịch, POS/giao vận thật và dùng thử với người tham gia cần thực hiện riêng.

Sau phát hành, `npm run check` đã chạy lại thành công, gồm lint, typecheck, 101 nhóm nghiệp vụ mock, 10 nhóm dữ liệu/khôi phục, năm test AWS offline, 14 test Bedrock offline, production build và 76 nhóm HTTP. Log tại `output/verification/aws-final-local-check-20261115.log`. `npm run test:submission` đạt ba test, `npm run test:team`, `npm run team:check` và `git diff --check` đạt. `npm run evaluate` cho parser phát triển đạt 49/50 intent và joint. Web local cổng 3105 đã được khởi động lại sau build và health trả 200 với provider Bedrock.

## Cấu hình Singapore ngày 15/11/2026

Vùng ứng dụng, canary và hạ tầng hiện dùng `ap-southeast-1`. Model là `global.anthropic.claude-haiku-5-5`. Cấu hình mẫu nằm trong `.env.example` và `infra/aws/target.example.json`; cấu hình máy chạy nằm trong `.env.local` và `.local/aws-target.json`. Web local đã bật `AI_PROVIDER=bedrock` với hạn mức người dùng duyệt là 25 lượt/ngày UTC cho một tiến trình.

API chỉ đọc tại Singapore ghi profile `ACTIVE`, quyền `AUTHORIZED`, entitlement và region `AVAILABLE`. Prefix list CloudFront là `pl-31a34658`. Plan đã kiểm tra AMI Amazon Linux 2023 x86_64 `ami-0c7fe98adcbb622fc` trong vùng mới. Các báo cáo preflight và plan dùng tên file có thời điểm trong `output/verification`.

Sau khi người dùng duyệt một lượt riêng tại Singapore, canary Haiku 5.5 đã thành công. Report `output/verification/aws-canary-c85d5406-8522-4680-ac47-aad0df5c9749.json` ghi `passed=true`, `inferenceCalls=1`, 1.514 input token và 160 output token. ChatService nhận câu thêm hai Pepsi 1.5L, chờ xác nhận đúng mã rồi mới cập nhật hai phần `item_pepsi_004` trong repository giả lập. Lượt canary đã sử dụng xong. Bằng chứng web AWS tiếp theo được ghi ở đầu tài liệu.

Template và generator đã đồng bộ model global. IAM tách ba quyền theo [hướng dẫn AWS](https://docs.aws.amazon.com/bedrock/latest/userguide/global-cross-region-inference.html), gồm profile theo vùng gọi, model trong vùng với đúng profile ARN, và model global với `aws:RequestedRegion=unspecified`. Global profile có thể định tuyến xử lý qua nhiều vùng theo AWS.

## Nghiệm thu web local ngày 15/11/2026

Web chạy tại `http://127.0.0.1:3105/chat`, dữ liệu riêng ở `.local/ai-web-20261115`. Cấu hình local dùng profile `default`, `AI_PROVIDER=bedrock`, `PERSISTENCE_DRIVER=local`, `BEDROCK_DAILY_REQUEST_LIMIT=25`. Lệnh khởi động sau khi có production build là `npm run start -- --hostname 127.0.0.1 --port 3105`. Lệnh `demo:start` phục vụ bộ demo mock riêng.

Playwright đã thao tác qua giao diện với ba lượt AI thật. Các trường hợp đạt gồm thêm hai Pepsi 1.5L và xác nhận đúng mã, đổi thành ba phần sau xác nhận, đề xuất xóa rồi bấm Bỏ qua. Giỏ giữ nguyên trước xác nhận và sau khi bỏ qua. Gửi lại mã xác nhận đã dùng giữ số lượng hai phần. Một phiên khách khác có giỏ trống. Sau khi khởi động lại, phiên đầu vẫn có ba Pepsi, tổng 75.000 đồng, lịch sử hội thoại và bộ đếm ba lượt. Hạn mức còn 22 lượt trong ngày UTC ghi tại thời điểm nghiệm thu.

Trong lượt đổi số lượng, Windows trả lỗi `EPERM` khi thay `store.json`, sau khi đề xuất đã được lưu. Đã bổ sung tối đa năm lần thử thay tệp cho `EPERM`, `EACCES`, `EBUSY`, chờ tổng tối đa 500 ms và giữ thao tác đồng bộ trong khóa ghi. Các lỗi khác được trả ngay. Khi vẫn lỗi, bộ nhớ được phục hồi như cơ chế trước đó. Đã kiểm tra lỗi tạm thời, lỗi kéo dài và tính nguyên vẹn của cả bộ nhớ lẫn tệp. Đề xuất lỗi trước bản sửa được phục hồi và xác nhận sau khi restart, sử dụng lại dữ liệu đã lưu.

Bằng chứng tại `output/verification/ai-web-acceptance-20261115.json`, các ảnh `ai-web-20261115-proposal.png`, `ai-web-20261115-chat-accepted.png`, `ai-web-20261115-cart-accepted.png` và log `ai-web-check-final-20261115.log`. Bộ kiểm tra đợt local này đạt 101 nhóm nghiệp vụ, 10 nhóm dữ liệu/khôi phục, bốn bài AWS offline, 13 bài Bedrock offline và 76 nhóm HTTP. Phần AWS được nghiệm thu tiếp trong đợt phát hành ghi ở đầu tài liệu.

## Phục hồi phản hồi chat và container Linux ngày 15/11/2026

Web đã bổ sung đọc lại snapshot sau lỗi mạng hoặc phản hồi chat 5xx. Khi phản hồi bị mất sau khi server tạo đề xuất hoặc thực hiện xác nhận, giao diện tải lại giỏ và đề xuất đang lưu. Trình duyệt thông báo phản hồi bị gián đoạn để khách xem dữ liệu trước khi gửi yêu cầu tiếp. Lỗi phiên và quyền tiếp tục đi qua xử lý danh tính hiện có.

Playwright đã gây lỗi sau khi server xử lý POST, gồm ngắt phản hồi mạng và trả HTTP 503 giả lập. Bốn thao tác thử dùng mock AI, mỗi thao tác có đúng một POST chat. Giỏ trống trước xác nhận đầu, sau đó có hai phần; lần đổi số lượng tiếp theo cho kết quả ba Pepsi, tổng 75.000 đồng. Báo cáo tại `output/verification/chat-recovery-browser-final-20261115.json`, ảnh tại `chat-recovery-proposal-final-20261115.png` và `chat-recovery-confirmed-final-20261115.png`. Log kiểm tra ứng dụng tại `chat-recovery-check-20261115.log`.

Docker Desktop Linux đã khởi động được. `docker build --progress=plain -t kfc-force-agent:local-20261115-recovery .` đã thành công. Image `linux/amd64` có ID `sha256:695fa87477dd5f54e5a6ded18c1f24b3b56e117ba299524f50098394e25e599b`, chạy user `node`, UID 1000. Kiểm tra HTTP trên container dùng `AI_PROVIDER=mock`, `PERSISTENCE_DRIVER=local`, volume `kfc-linux-data-20261115` và cổng loopback 3107. Các ca đạt gồm trang khách/quản trị, bảo vệ API admin, cookie guest, đề xuất và xác nhận, checkout pickup, gửi lại cùng checkout, quyền xem đơn, giữ giỏ và đơn sau restart container. Bằng chứng tại `output/verification/linux-container-acceptance-20261115.json` và `docker-build-20261115.log`.

Khi kiểm tra container bằng port mapping, đặt `HOSTNAME=0.0.0.0` trong container và bind cổng máy chủ về `127.0.0.1`. Cấu hình release EC2 hiện dùng host networking với nginx, theo `infra/aws/release.sh`. Dữ liệu Linux nghiệm thu nằm trong volume riêng, còn web AI local dùng thư mục `.local/ai-web-20261115`.

## Lịch sử kết nối AI tại Oregon ngày 15/11/2026

Adapter hỗ trợ cấu hình chỉ có model ID cho Haiku 5.5 và tự gửi `thinking.type=disabled`, output mặc định 512 token. Sampling không được gửi cho model này. Cấu hình Haiku 4.5 tiếp tục dùng một sampling parameter. Tham khảo [model card Haiku 5.5](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-anthropic-claude-haiku-5-5.html) và [cấu hình thinking](https://docs.aws.amazon.com/bedrock/latest/userguide/claude-messages-adaptive-thinking.html).

Một lượt canary đã được duyệt và thực hiện qua profile `default`, tài khoản kết thúc 0098, vùng `us-west-2`, model `global.anthropic.claude-haiku-5-5`. AWS trả lỗi model chưa khả dụng cho tài khoản. Report tại `output/verification/aws-canary-cb135cfa-89d7-4065-9697-810f574be658.json` ghi `passed=false`, `inferenceVerified=false`, một lượt thử. Ngày trong report là UTC, tương ứng ngày 15/11 tại Việt Nam. Marker của lượt này phải được giữ.

Sau khi người dùng duyệt thêm một lượt riêng cho Haiku 4.5, canary qua `us.anthropic.claude-haiku-4-5-20251001-v1:0` đã thành công. Report `output/verification/aws-canary-3b59fa10-8319-4ca4-8696-d88afe5cebe9.json` ghi `passed=true`, `inferenceCalls=1`, 1.304 input token và 165 output token. Luồng đã kiểm tra là câu thêm hai Pepsi 1.5L, giỏ chưa đổi khi mới có đề xuất, rồi xác nhận đúng mã để giỏ có hai phần của `item_pepsi_004`. Phép thử đi qua ChatService, provider Bedrock, policy và công cụ giỏ với repository giả lập trong bộ nhớ. Nghiệm thu chat qua HTTP/trình duyệt với AI thật và triển khai AWS cần làm tiếp.

Preflight của cả Haiku 5.5 và Haiku 4.5 đọc được trạng thái quyền `AUTHORIZED`, entitlement và region `AVAILABLE`, profile `ACTIVE`. Riêng Haiku 5.5 vẫn bị từ chối khi gọi runtime. Vì vậy, kết quả đọc quyền cần được đối chiếu với canary thực tế. Hai lượt đã duyệt đều đã được sử dụng. Mọi lượt tiếp theo cần phạm vi mới. Model phải được chọn rõ trước khi gọi.

Canary dùng đúng inference profile đã kiểm tra khi gọi model. Tùy chọn `--model us.anthropic.claude-haiku-4-5-20251001-v1:0` cho phép chọn rõ Haiku 4.5. Mỗi lần `--invoke` cần phạm vi được duyệt và UUID mới. Giới hạn vẫn là một lượt, đầu vào tối đa 32.000 byte UTF-8, đầu ra tối đa 512 token và dữ liệu giả lập. Báo cáo phân biệt số lần vào provider với số lượt đã giữ ngân sách trước transport, đồng thời lưu lỗi provider để chẩn đoán.

Preflight mới dùng tên file có thời điểm để lưu riêng từng kết quả. Các file bằng chứng cũ được dùng để đối chiếu lịch sử. Kiểm thử offline hiện có tại `npm run test:bedrock`.

Hướng dẫn được chuẩn bị từ 09/11/2026. Bằng chứng preflight ban đầu tại `output/verification/aws-preflight.json` chỉ ghi các API đọc. Biên bản triển khai và nghiệm thu ngày 15/11 nằm ở đầu tài liệu.

## Thiết kế được review

`infra/aws/stack.json` được sinh bằng `python infra/aws/build-template.py`: 21 resource, VPC/subnet public, một EC2 t3.medium Amazon Linux 2023 x86_64, EIP, EBS root 32 GiB và data 20 GiB gp3 mã hoá, S3 private/versioned, ba Secrets Manager secret, IAM/instance profile, CloudFront.

CloudFront redirect HTTPS, tắt cache và chuyển cookie/Host/query đến origin. Security group chỉ nhận HTTP từ managed prefix list CloudFront; nginx kiểm tra secret header do distribution chèn. Quản trị máy bằng SSM, không mở SSH. Người xem dùng HTTPS; đoạn CloudFront–origin dùng HTTP có giới hạn nguồn và secret, chưa có TLS xuyên suốt. Pilot một máy có thời gian gián đoạn khi thay container; không cam kết HA/SLA.

Runtime hiện dùng `AI_PROVIDER=bedrock`, `PERSISTENCE_DRIVER=local`, `/data` trên retained EBS, một tiến trình Node. IAM InvokeModel giới hạn đúng global profile Haiku 5.5 cùng các model ARN tương ứng, vùng gọi là Singapore. Dùng dữ liệu giả lập cho canary và đánh giá. Container chạy user node; secret chỉ được materialize vào file root 0600.

`BEDROCK_DAILY_REQUEST_LIMIT=25` áp dụng toàn bộ ứng dụng theo ngày UTC, giữ trên EBS; 0 tắt inference. Request được giữ chỗ trước gọi, thất bại cũng tiêu một lượt; SDK không tự retry. Body tối đa 32.000 byte UTF-8, output mặc định 512 token. Đây là giới hạn lượt gọi của một tiến trình, **không phải hạn mức USD hay giới hạn đa instance**. Haiku 4.5 chỉ nhận một trong `temperature`/`top_p`; adapter đã sửa theo [tài liệu Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-anthropic-claude-messages-request-response.html).

## Chi phí tham khảo tại Oregon ngày 09/11/2026

Bảng dưới giữ mức giá lịch sử tại Oregon. Giá Singapore đã được lấy lại trước triển khai, tổng cơ sở 48,386 USD/tháng tại [hồ sơ phát hành](aws-release-approval.md).

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

`aws:preflight` đọc STS, inference profile và model availability; `aws:plan` đọc STS, AMI public SSM parameter và DescribeImages, ghi báo cáo local. Account hiện thấy kết thúc 0098, region hiện dùng `ap-southeast-1`. Plan ghi `proposedAmiId`; AMI được ghim rõ trong target và cần review cùng tài khoản, chi phí trước khi triển khai.

Dockerfile đã build và chạy qua nghiệm thu Linux local ngày 15/11/2026 như mục trên. Base images Node 24/nginx stable hiện dùng tag; source tar và S3 object version được pin. Cần pin digest image nền nếu nhóm chọn yêu cầu build tái lập giữa các thời điểm khác nhau.

## Trình tự sau khi được duyệt

Các lệnh bên dưới có thể phát sinh chi phí, chỉ chạy trong tài khoản/vùng và phạm vi đã được người dùng duyệt. Giữ target riêng tại `.local/aws-target.json`, không đặt config tài khoản/secret vào `infra` hoặc ZIP.

1. Copy `infra/aws/target.example.json` vào `.local/aws-target.json` nếu chưa có; điền `expectedAccount` đủ 12 số và `amiId` đã review từ plan. Dùng profile/default, `ap-southeast-1`, prefix list `pl-31a34658`, stack name, instance và giới hạn đã duyệt. Chạy lại `aws:plan -- --config .local/aws-target.json` và đối chiếu.
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

## Danh mục nghiệm thu AWS

- HTTPS `/api/health`, `/chat`, `/admin`; redirect HTTP; security headers; cookie Secure/HttpOnly/SameSite; ghi cùng origin và từ chối origin khác; không cache dữ liệu riêng. Test proxy local chỉ chứng minh phần ứng dụng, chưa chứng minh distribution thực tế.
- Hai danh tính synthetic: cart/history/order/feedback riêng; admin tách biệt; hoàn thành một đơn pickup và delivery, menu/CAS, quote/khuyến mãi, bếp và CSV đối soát.
- Chat **trên ứng dụng AWS** thật: proposal → chưa đổi cart → explicit confirmation → đúng cart; model/provider failure có thông báo, không mock fallback. Giới hạn các lượt gọi trả phí theo lần duyệt tiếp theo.
- Restart container giữ session/cart/order/budget; backup mã hoá, verify và restore vào thư mục mới bằng synthetic data. Không thử restore đè lên volume đang dùng.
- Ghi URL, thời gian, source/template SHA, S3 VersionId, stack/SSM status, image IDs, ca kiểm tra và chi phí thực tế. Không đưa mật khẩu/secret/contact thật vào hồ sơ.

Chỉ sau các bước này mới ghi “AWS và AI thật đã nghiệm thu”. DynamoDB, thanh toán/giao hàng/POS thật, HA và khảo sát người dùng chưa có bằng chứng trong gói chuẩn bị này.
