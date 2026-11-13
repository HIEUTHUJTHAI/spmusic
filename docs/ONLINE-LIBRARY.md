# SPMusic 2.18.0 — Nhạc trực tuyến

- Tìm trên YouTube trong tab Tìm kiếm; bỏ lựa chọn “Nguồn mở · tải được”.
- “Thêm thư viện” lưu thông tin video, không tải MP3. “Nghe ngay” lưu và phát.
- Bài Online dùng được trong playlist, yêu thích và lịch sử như bài trên máy.
- Phát qua nguồn âm thanh tạm thời; hỗ trợ Range để tua, thử làm mới khi nguồn hết hạn.
- Chỉ proxy HTTPS từ miền media YouTube, kiểm tra chủ sở hữu trước khi phát.
- Bài Online cần Internet. Video bị xóa/giới hạn có thể không phát được; mục thư viện vẫn giữ nguyên.
- Tách giọng và AI viết lời yêu cầu file nhạc trên máy.

Kiểm tra: build frontend, 62 kiểm tra tự động; kiểm tra nguồn YouTube thực tế trả audio/webm HTTP 206. Xem tools/test-online.cjs để kiểm tra Electron với tài khoản và dữ liệu thử riêng.

Electron thực tế: bài thử phát đến 1,24 giây, nhận thời lượng 19,021 giây; tua đến giây 10 rồi tiếp tục phát. Lưu trùng trả lại cùng bài, playlist giữ đúng ID. Ảnh kiểm tra được lưu trong .runtime/online-qa-*/library.png.
