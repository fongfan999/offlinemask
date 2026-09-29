# Rà soát 12 ví dụ nhận diện

Các ví dụ dưới đây đều là dữ liệu giả lập đã được dùng trong kiểm thử. Chưa có ví dụ nào được bạn phê duyệt. Đây là rà soát kỳ vọng sản phẩm, không phải bộ kiểm định độc lập mới.

Với mỗi ví dụ, hãy ghi các đoạn cần ẩn và loại thông tin trước khi mở kết quả A/B. Nếu không có thông tin riêng tư, ghi “Không cần ẩn”. Sau đó cho biết A/B bỏ sót hoặc ẩn thừa ở đâu. Không cần gửi dữ liệu thật.

Có thể trả lời trong cuộc trò chuyện theo mẫu: **1. Cần ẩn: …; A: …; B: …**. Mục chưa trả lời vẫn chờ rà soát. A/B được giữ nhất quán giữa các ví dụ để tiện so sánh; đây không phải thử nghiệm ngẫu nhiên.

Loại kết quả: TEN = tên người; DIA_CHI = địa chỉ; TO_CHUC = tổ chức; STK = tài khoản; THE = số thẻ; MA_BAO_MAT/CVV/PIN = mã bảo mật; các mã khác giữ tên gợi nghĩa.

## 1

```text
Tôi là đỗ hoàng phúc, nhờ kiểm tra giúp lệnh chuyển tiền bị treo.
```

Cần ẩn và loại thông tin: _chờ bạn ghi_

<details>
<summary>Xem kết quả A/B sau khi tự đánh giá</summary>

**A**

Không ẩn mục nào.

**B**

Không ẩn mục nào.

</details>

## 2

```text
Khách hàng H’Hen Niê đề nghị cập nhật thông tin liên hệ.
```

Cần ẩn và loại thông tin: _chờ bạn ghi_

<details>
<summary>Xem kết quả A/B sau khi tự đánh giá</summary>

**A**

- "H" → TEN
- "’" → DIA_CHI
- "Hen" → TEN
- "Niê" → DIA_CHI

**B**

- "H’Hen Niê" → TEN

</details>

## 3

```text
YÊU CẦU TRA SOÁT GIAO DỊCH. CHƯA CÓ THÔNG TIN KHÁCH HÀNG.
```

Cần ẩn và loại thông tin: _chờ bạn ghi_

<details>
<summary>Xem kết quả A/B sau khi tự đánh giá</summary>

**A**

- "YÊU CẦU TRA SOÁT GIAO DỊCH." → TEN
- "THÔNG TIN KHÁCH HÀNG" → TEN

**B**

Không ẩn mục nào.

</details>

## 4

```text
Khách hàng Nguyễn Ngọc Hà cần hỗ trợ. STK: 007700112233.
```

Cần ẩn và loại thông tin: _chờ bạn ghi_

<details>
<summary>Xem kết quả A/B sau khi tự đánh giá</summary>

**A**

- "Nguyễn Ngọc Hà" → TEN
- "007700112233" → STK

**B**

- "Nguyễn Ngọc Hà" → TEN
- "007700112233" → STK

</details>

## 5

```text
Mã khách hàng KH847291 thuộc về Lâm Quốc Hưng, địa chỉ 15A Lê Quý Đôn, Quận 3, TP. Hồ Chí Minh.
```

Cần ẩn và loại thông tin: _chờ bạn ghi_

<details>
<summary>Xem kết quả A/B sau khi tự đánh giá</summary>

**A**

- "KH847291" → KH
- "Lâm Quốc" → TEN
- "Hưng" → TO_CHUC
- "15A Lê Quý Đôn, Quận 3, TP. Hồ Chí Minh" → DIA_CHI

**B**

- "KH847291" → KH
- "Hưng" → TEN
- "15A Lê Quý Đôn, Quận 3, TP. Hồ Chí Minh" → DIA_CHI

</details>

## 6

```text
Chuyển thư về 17/6 Nguyễn Văn Đậu, phường 5, Bình Thạnh, TP. Hồ Chí Minh.
```

Cần ẩn và loại thông tin: _chờ bạn ghi_

<details>
<summary>Xem kết quả A/B sau khi tự đánh giá</summary>

**A**

- "17/6 Nguyễn Văn Đậu, phường 5, Bình Thạnh, TP. Hồ Chí Minh" → DIA_CHI

**B**

- "17/6 Nguyễn Văn Đậu, phường 5, Bình Thạnh, TP. Hồ Chí Minh" → DIA_CHI

</details>

## 7

```text
👨‍👩‍👧‍👦 A ▁ B · ＡＢＣ · ễ · [CLS] [UNK] [SEP] · a​b
```

Cần ẩn và loại thông tin: _chờ bạn ghi_

<details>
<summary>Xem kết quả A/B sau khi tự đánh giá</summary>

**A**

- "· ễ" → TEN

**B**

Không ẩn mục nào.

</details>

## 8

```text
De nghi lap ho so chi tra cho Hop tac xa Nong san Suoi Mo. Tong so chung tu la 24, tong gia tri la 68 trieu dong.
```

Cần ẩn và loại thông tin: _chờ bạn ghi_

<details>
<summary>Xem kết quả A/B sau khi tự đánh giá</summary>

**A**

- "Nong san Suoi Mo" → DIA_CHI

**B**

- "Nong san Suoi Mo" → DIA_CHI

</details>

## 9

```text
Người liên hệ về hồ sơ này là Tạ Uyên Chi. Vui lòng kiểm tra các chứng từ đính kèm.
```

Cần ẩn và loại thông tin: _chờ bạn ghi_

<details>
<summary>Xem kết quả A/B sau khi tự đánh giá</summary>

**A**

- "Tạ Uyên Chi" → TEN

**B**

- "Tạ Uyên Chi" → TEN

</details>

## 10

```text
Thẻ thử nghiệm số 4111 1111 1111 1111, mã CVV 123. Đây là dữ liệu kiểm thử.
```

Cần ẩn và loại thông tin: _chờ bạn ghi_

<details>
<summary>Xem kết quả A/B sau khi tự đánh giá</summary>

**A**

- "4111 1111 1111 1111" → THE
- "123" → CVV

**B**

- "4111 1111 1111 1111" → THE
- "123" → CVV

</details>

## 11

```text
Tổng Hợp Hồ Sơ Chờ Xử Lý. Hướng Dẫn Kiểm Tra Chứng Từ. Quy Trình Phê Duyệt.
```

Cần ẩn và loại thông tin: _chờ bạn ghi_

<details>
<summary>Xem kết quả A/B sau khi tự đánh giá</summary>

**A**

- "Hợp Hồ Sơ" → TEN
- "Xử Lý" → TEN
- "Hướng" → TEN
- "Dẫn Kiểm Tra Chứng" → TO_CHUC
- "Quy Trình" → TEN
- "Phê Duyệt" → TEN

**B**

Không ẩn mục nào.

</details>

## 12

```text
Cư trú tại hẻm 16, số 5B Nguyễn Thị Minh Khai, Cần Thơ.
```

Cần ẩn và loại thông tin: _chờ bạn ghi_

<details>
<summary>Xem kết quả A/B sau khi tự đánh giá</summary>

**A**

- "hẻm 16, số 5B Nguyễn Thị Minh Khai, Cần Thơ" → DIA_CHI

**B**

- "hẻm 16, số 5B Nguyễn Thị Minh Khai, Cần Thơ" → DIA_CHI

</details>
