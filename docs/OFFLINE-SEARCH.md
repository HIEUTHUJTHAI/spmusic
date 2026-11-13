# SPMusic 2.18.1 — Tải offline từ kết quả tìm kiếm

- Thay nút mở YouTube bằng nút **Tải offline**, có biểu tượng tải xuống và nhãn rõ ràng.
- Cửa sổ tải tự điền link bài đã chọn; hiển thị tiến độ và cho hủy tải.
- Bài Online được chuyển thành file MP3 trên cùng mục thư viện, giữ playlist, tên/nghệ sĩ đã chỉnh, ảnh bìa riêng và lyrics.
- Bài đã có offline không tải trùng. Tải lỗi hoặc hủy giữ nguyên bài Online.
- Bộ tải sử dụng nguồn HTTPS và lưu MP3; cần Internet trong lúc tải, sau đó nghe từ file trên máy.
- Hàng nút tự xuống dòng ở cửa sổ hẹp.

Kiểm tra: build frontend; kiểm tra nâng cấp Online → offline, tải trùng và hồi quy; Electron tải thực tế, phát/tua với kết nối ngoài bị chặn; xem giao diện ở 1440 và 1024 pixel. Nguồn video bị giới hạn hoặc không còn tồn tại vẫn có thể không tải được.
