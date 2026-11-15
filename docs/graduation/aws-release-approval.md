# Phạm vi phát hành AWS đã được duyệt

Cập nhật ngày 15/11/2026. Người dùng đã duyệt triển khai AWS và đợt đánh giá riêng 24 lượt trong phiên làm việc. Phạm vi tài khoản, vùng, tài nguyên và hạn mức dưới đây đã được sử dụng để phát hành.

## Đích triển khai

- Profile `default`, tài khoản kết thúc `0098`, vùng `ap-southeast-1`.
- Stack mới `kfc-graduation-pilot`, 21 resource trong `infra/aws/stack.json`.
- Một EC2 `t3.medium`, Amazon Linux 2023 x86_64, AMI `ami-0c7fe98adcbb622fc`.
- EBS mã hóa gồm 32 GiB root và 20 GiB data, một IPv4 public, S3 versioned, ba secret và CloudFront.
- Model `global.anthropic.claude-haiku-5-5`, 25 lượt/ngày UTC cho một tiến trình AWS, đầu vào tối đa 32.000 byte, đầu ra mặc định 512 token/lượt. Các lượt nghiệm thu AWS nằm trong hạn mức này.

Source artifact là `output/aws/kfc-77226bb3204773597c824ba9a0a72398166128ce1885da97b9f126c282f7359c.tar.gz`. SHA256 là `77226bb3204773597c824ba9a0a72398166128ce1885da97b9f126c282f7359c`. Template SHA256 là `c764647e925d93b3f84ce1b682034da4db33994affcc8d06eeedeaa371cb47c6`.

Phạm vi hành động gồm tạo CREATE Change Set, đối chiếu toàn bộ thay đổi với template và target đã duyệt, thực thi Change Set, upload đúng source artifact, chạy SSM release, theo dõi bootstrap và nghiệm thu HTTPS. Dữ liệu thử là dữ liệu giả lập. EBS data, bucket và secret có chính sách Retain để phục vụ khôi phục và có chi phí lưu giữ tương ứng.

## Giá cơ sở tại Singapore

AWS Price List đã được đọc lại, lưu tại `output/verification/aws-singapore-price-inputs-20261115.json`. Giả định máy và IPv4 sử dụng 730 giờ mỗi tháng.

| Thành phần | Đơn giá USD | Ước tính USD/tháng |
| --- | ---: | ---: |
| EC2 t3.medium Linux | 0,0528/giờ | 38,544 |
| EBS gp3 52 GiB | 0,096/GiB-tháng | 4,992 |
| IPv4 public | 0,005/giờ | 3,650 |
| Ba secret | 0,40/secret-tháng | 1,200 |
| Tổng cơ sở | | 48,386 |

Chi phí thực tế cộng thêm inference, S3/request, CloudFront/lưu lượng, Secrets API, CPU surplus credit nếu phát sinh và thuế. Tài nguyên tiếp tục tính phí trong thời gian được duy trì. Mức 48,386 USD là ước tính cơ sở cho cấu hình trên. Giá theo [EC2](https://aws.amazon.com/ec2/pricing/on-demand/), [EBS](https://aws.amazon.com/ebs/pricing/), [VPC](https://aws.amazon.com/vpc/pricing/) và [Secrets Manager](https://aws.amazon.com/secrets-manager/pricing/).

## Đợt đánh giá LLM riêng

Tập `tests/data/llm-evaluation.vi.json` có 24 câu mới, tách khỏi tập phát triển 50 câu. Nhãn do công cụ hỗ trợ soạn và cần nhóm review trong hồ sơ học thuật. Tập này dùng dữ liệu tổng hợp, đo đầu ra JSON hợp lệ, nhóm ý định và số lượng. Các hành động đọc thực đơn được gộp vào nhóm SEARCH_MENU. Phần tìm đúng món, policy và thực thi giỏ có phép kiểm tra riêng.

`node scripts/evaluate-llm.cjs` tạo kế hoạch offline và hash tập câu, prompt, adapter, schema, evaluator. Người dùng đã duyệt riêng 24 lượt, mỗi lượt tối đa 32.000 byte đầu vào và 512 token đầu ra. Đợt này có bộ đếm riêng với web. Lỗi provider dừng đợt chạy, còn lỗi cấu trúc đầu ra được tính sai. Đợt đã hoàn tất đủ 24 lượt. Kết quả và giới hạn tại [báo cáo đánh giá](llm-evaluation-results.md).

## Kết quả phát hành và sửa đóng gói

Stack `kfc-graduation-pilot` đã đạt `CREATE_COMPLETE` sau khi review đủ 21 additions. Change Set `kfc-create-1794680780168`. URL HTTPS là https://d2qcew89gdrdgt.cloudfront.net.

Lần release đầu dừng vì `release.sh` chứa CRLF. Đã sửa packager để chuẩn hóa shell script sang LF và thêm regression test. So sánh hai archive cho thấy chỉ `infra/aws/release.sh` cùng manifest thay đổi. Archive lỗi, S3 version và SSM log cũ được giữ để truy vết. Lần khắc phục tiếp tục trong phạm vi tài nguyên và ngân sách đã duyệt.

Source hiện chạy có SHA256 `8ba1a652feee1802c86a98fb50ecc1e75c987bdf7e784e2c8333bc308e2d6d90`, S3 VersionId `HMSrLEbFcVSLz5W7mfiW8BfZeR9CXMhV`. SSM release `dcde1859-097f-4982-8292-409206615e2e` thành công. Image ID `sha256:6a845142b9023195578e48d71303db4f9f1e1b1eea7705c351159607c9a18cf9`, user `node`.

Đã kiểm tra HTTPS, một lượt AI thật trên web AWS, xác nhận giỏ, hai kiểu đơn, phân quyền, catalog CAS, phản hồi, CSV và restart. Bản sao dữ liệu được khôi phục vào thư mục mới và so sánh giống nhau trên EBS mã hóa. Bằng chứng chi tiết tại [AWS readiness](aws-readiness.md).
