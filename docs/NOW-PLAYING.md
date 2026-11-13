# SPMusic 2.16.0

## Cách dùng

- Phát một bài, bấm biểu tượng bảng **Đang phát** bên phải thanh nhạc, cạnh nút lyrics.
- Bảng bên phải có ảnh bìa, tên/nghệ sĩ, yêu thích, tua, âm lượng, điều khiển và lời bài hát xem trước. Cuộn xuống để xem bài tiếp theo và ba chế độ trình phát/lyrics/hàng đợi.
- Bấm phóng lớn ở góc phải bảng để sang toàn màn hình; thu nhỏ trở về bảng. Mở/đóng không thay đổi luồng âm thanh.
- AutoMix trong bảng có đủ hai bìa, bụi sáng và nền chuyển màu. Sau chuyển bài, bìa mới trở về kích thước đầy đủ với độ nảy nhẹ.
- Khi tải file, chọn tên ở **Hoặc chọn nghệ sĩ đã có**. Tên lấy từ thư viện hiện tại; có thể sửa lại ô Nghệ sĩ hoặc nhập tên mới. Với nhiều file, thông tin nghệ sĩ vẫn áp dụng chung theo chức năng tải hàng loạt hiện có.

## Chuyển động

Sidebar và các tab dùng cùng mô hình lò xo giảm chấn, kết thúc đúng vị trí tab đã chọn. Nút, bảng Đang phát và cửa sổ cài đặt nảy nhẹ. Trang giữ hiệu ứng fade; chữ và thanh tua không nảy. Khi hệ thống bật giảm chuyển động, phần nảy và bụi được tắt.

Trên cửa sổ rộng, nội dung giữa chừa chỗ cho bảng bên phải. Ở cửa sổ nhỏ, bảng nổi bên trên nội dung, có nút đóng và cuộn riêng. Không cần mở cửa sổ Windows thứ hai.

## Kiểm tra

- Build frontend và các kiểm thử `client/test/*.test.mjs`, gồm biên độ lò xo và vị trí kết thúc.
- `tools/test-automix.cjs`: bảng Đang phát, chuyển sang/ra toàn màn hình, AutoMix với hai luồng WAV thật, ảnh vẫn hiện sau chuyển, lyrics/hàng đợi, chọn nghệ sĩ cũ và nhập mới, cửa sổ 1024×768, các trường hợp hủy chuyển và giảm chuyển động.
- `tools/test-glass.cjs`: tab/sidebar, chuyển nhanh, độ trong suốt, sáng/tối, bố cục nhỏ và giảm chuyển động.

Các bài kiểm tra dùng tài khoản, âm thanh và ảnh tự tạo. Không sửa dữ liệu cá nhân. Ảnh chụp nằm trong `.runtime`; kết quả là kiểm tra trong môi trường này, không bảo đảm tốc độ giống nhau trên mọi máy.
