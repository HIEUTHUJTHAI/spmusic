# Tài nguyên mẫu nguyên bản

Các bản nhạc WAV, lời LRC, ảnh bìa SVG và phong cảnh SVG trong dự án đều được tạo riêng cho Auralis. Dự án không dùng bản ghi âm, lời bài hát, logo hay dữ liệu thương hiệu của bên thứ ba. Tên nghệ sĩ mẫu là tên hư cấu phục vụ minh họa.

## Nhạc và lời

Sáu đoạn nhạc dài 28 giây được tổng hợp từ sóng sin, hợp âm, âm trầm và nhịp điện tử trong `client/public/demo/generate-assets.mjs`. Không lấy mẫu bất kỳ bản ghi âm thương mại nào. Mỗi bản có sáu dòng lời tiếng Việt nguyên bản với mốc thời gian từ giây 1 đến giây 21.

Định dạng âm thanh: WAV PCM, mono, 22.050 Hz, 16 bit. Mỗi tệp khoảng 1,24 MB. Các tệp này dùng để kiểm tra phát nhạc, tua, lặp lại, bài kế tiếp và đồng bộ lời. Chúng không đại diện chất lượng của một bản nhạc được sản xuất hoàn chỉnh.

Đây là các đoạn nhạc không lời. LRC chứa lời minh họa nguyên bản để trình diễn mốc thời gian và tự cuộn, không phải bản chép lại một phần hát đã thu âm.

| Tệp / ID | Bài hát | Nghệ sĩ mẫu | Album mẫu |
| --- | --- | --- | --- |
| demo-midnight | Midnight Drive | Kairo | Nocturnal |
| demo-tides | Tides | Solène | Between Waves |
| demo-afterglow | Afterglow | Nova Lane | Golden Hours |
| demo-blue | Blue Hour | Vesper | Quiet City |
| demo-slow | Slow Motion | Luma | Soft Focus |
| demo-somewhere | Somewhere | The Paper Sky | Open Windows |

`client/public/demo/sample.lrc` là tệp lời mẫu nhỏ để thử tải lên và chỉnh sửa. Những dòng bắt đầu bằng `[ti:...]`, `[ar:...]`, `[al:...]` là siêu dữ liệu, không phải dòng hát.

## Đồ họa

Bảy SVG được dựng trực tiếp bằng hình học, đường cong và màu chuyển sắc trong cùng tệp tạo tài nguyên: sáu ảnh bìa vuông 800 × 800 và một phong cảnh 1600 × 760. Chúng không được sao chép từ ảnh bìa hoặc giao diện thương mại.

## Tạo lại tài nguyên

Từ thư mục dự án, với Node.js đã cài đặt:

```sh
node client/public/demo/generate-assets.mjs
```

Lệnh ghi lại các WAV, SVG, LRC mẫu và `server/src/data/demo.json`. Không chạy lệnh này nếu bạn đã sửa trực tiếp những tệp mẫu và muốn giữ các chỉnh sửa đó.

Bạn có thể sử dụng, chỉnh sửa và phân phối các tài nguyên nguyên bản này cùng dự án. Với tệp tự tải lên, chỉ dùng nội dung do bạn sở hữu hoặc đã được chủ sở hữu cho phép sử dụng.
