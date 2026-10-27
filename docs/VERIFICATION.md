# Biên bản kiểm tra MVP

## Sắp xếp playlist 1.0.3 — 28/10/2026

- Thêm kéo thả bài hát trong trang playlist và phím mũi tên lên/xuống trên nút sắp xếp để dùng bằng bàn phím.
- Thứ tự mới được lưu qua API playlist hiện có; nếu trình phát đang dùng đúng playlist đó, hàng chờ cũng được đổi theo.
- Frontend production build thành công.

## Bản vá YouTube 1.0.2 — 27/10/2026

- Xác định yt-dlp và các tiến trình kiểm tra âm thanh không đọc được đường dẫn FFmpeg ảo trong `app.asar`; giờ dùng file FFmpeg/FFprobe thật trong `app.asar.unpacked`.
- Kiểm thử link được báo lỗi qua luồng nhập thực: đọc thông tin video, tải âm thanh, chuyển MP3, kiểm tra codec và lưu vào thư viện thử nghiệm thành công. File thử đã được dọn; không đưa âm thanh vào mã nguồn.
- Kiểm thử đường dẫn FFmpeg của bản đóng gói, URL hợp lệ, phân quyền và chống nhập trùng. 43 kiểm thử server và 11 kiểm thử client đạt; frontend production build thành công.

Các mục bên dưới là biên bản của các bản phát hành trước đó.

## Ứng dụng Windows — 27/10/2026

- Build Electron thành công, tạo bộ cài `SPMusic-1.0.0-x64.exe` và bản portable `SPMusic-1.0.0-Portable.exe` (Windows x64).
- Mở app đã đóng gói: tiến trình Electron còn chạy, Express/PGlite báo `/api/health` `{status:"ok",database:"pglite"}`, trang `/` trả HTTP 200. Đường dẫn database được xác nhận tại `%APPDATA%\SPMusic\data`.
- Giao diện desktop dùng Electron sandbox/context isolation; Express chỉ lắng nghe ở `127.0.0.1` trên cổng tự chọn. Đường dẫn dữ liệu không nằm trong thư mục cài app.
- Không có chứng chỉ ký số, nên SmartScreen có thể báo nhà phát hành chưa xác định. Cập nhật GitHub chưa cấu hình theo yêu cầu để ở bước sau.

## Cập nhật nhạc mở — 27/10/2026

- **51/51 kiểm thử tự động đạt**, bao gồm API, tài khoản, LRC, AI, audio và 11 kiểm thử mới cho nhạc mở. Build production thành công.
- Internet Archive và Wikimedia Commons đều trả kết quả tìm kiếm thực. Internet Archive chọn WAV gốc trước các bản chuyển đổi khi bản thu có nhiều định dạng hợp lệ.
- Tải thật thành công bản `111` của Thomas Attwood trong `jamendo-137050` (CC BY 3.0), kiểm tra âm thanh và lưu ghi công. Đây là mẫu MP3 ngắn từ nguồn, không được mô tả là lossless.
- Trên trình duyệt với database kiểm thử riêng: tìm kiếm → xem bài → thêm → hoàn tất → tìm trong thư viện → phát. Audio chạy từ 0 đến hơn 6 giây, thời lượng trình duyệt khoảng 9,08 giây, không báo lỗi. Menu nguồn/giấy phép hiển thị đúng tác giả và CC BY 3.0.
- Thêm lại cùng bản thu báo đã có trong thư viện; kết quả tìm kiếm nội bộ vẫn chỉ có một bài. Không có lỗi/warning console trong lượt kiểm tra giao diện.
- Kiểm tra desktop 1440×900 và điện thoại 390×844: trang rộng 390 px, hộp thoại 366 px, không tràn ngang. Ảnh kết quả được lưu cùng bàn giao.
- Một lượt tải thực từ Wikimedia bị nguồn giới hạn HTTP 429. Ứng dụng báo lỗi, không lưu bài/file dở dang; tải thực từ nguồn này chưa được xác nhận trong phiên kiểm tra. Không né giới hạn của nguồn.
- Kiểm thử tự động bổ sung: whitelist giấy phép/URL, chặn địa chỉ mạng riêng, chọn chất lượng, lỗi một nguồn, OGG/Opus thực, phân quyền tác vụ/media, chống trùng, file quá lớn/thiếu, hủy và đóng máy chủ, đổi giấy phép, dọn file, ghi công còn sau mở lại database.
- Toàn bộ kiểm tra dùng dữ liệu tách riêng; không xóa hoặc sửa thư viện của người dùng. Chi tiết tính năng/API/giới hạn ở [OPEN-MUSIC.md](OPEN-MUSIC.md).

**Cập nhật SPMusic / tài khoản / màu giao diện:** 40/40 kiểm thử tự động đạt và build thành công. Chi tiết phạm vi kiểm tra trình duyệt ở [ACCOUNT-SETTINGS.md](ACCOUNT-SETTINGS.md). Các số kiểm thử bên dưới là kết quả của các giai đoạn trước.

Ngày kiểm tra: 26/10/2026. Môi trường: Windows, Node.js 24.22.1, trình duyệt Chromium trong ứng dụng.

## Đã chạy thành công

- Bổ sung và thử `start-auralis.cmd` trên Windows khi cả `node` và `npm` đều không có trong PATH: tự tìm runtime Codex, build bằng Vite trực tiếp, chạy Express/PGlite trên cổng thử riêng 3003 và trả HTTP 200. Chạy launcher lần hai nhận diện ứng dụng đã mở, không mở trùng database. Cổng mặc định của launcher là 3001.

- `npm install`: cài đủ thư viện, kết quả audit tại thời điểm kiểm tra là 0 lỗ hổng được báo cáo.
- Sau bổ sung lossless và AI: **35/35 kiểm thử đạt** — 24 kiểm thử backend/API/ghép lời và 11 kiểm thử bộ phân tích LRC phía frontend.
- `npm run build`: tạo bản production React/Tailwind bằng Vite.
- Frontend phát triển trả HTTP 200 tại `http://127.0.0.1:5173/`; API hoạt động tại `http://127.0.0.1:3001/api/health`.
- Bản production đã được khởi động riêng với database mới trên cổng 3002: trang chủ HTTP 200, sáu bài mẫu, API lyrics và truyền audio theo byte hoạt động. Cổng 3002 chỉ dùng kiểm thử; cấu hình mặc định vẫn là 3001.
- Trên trình duyệt: đăng ký bằng tài khoản kiểm thử cục bộ; tạo playlist có hai bài; upload WAV kèm ảnh PNG và file LRC; bài đã upload xuất hiện trong thư viện và phát được. File WAV được trình duyệt nhận đúng thời lượng 28 giây.
- FLAC và ALAC 24-bit/96-kHz được tạo từ âm thanh tổng hợp nguyên bản, tải lên, truyền theo HTTP Range và giải mã để so sánh: dữ liệu PCM trùng từng byte với nguồn. File ALAC gốc được giữ, bản FLAC phát được tạo riêng; xóa bài dọn cả hai. AAC trong M4A, đuôi giả và FLAC bị cắt thiếu dữ liệu bị từ chối. Giới hạn 250 MB được thử bằng multipart streaming.
- Whisper base q8 đã được tải (~80 MB) và nạp trên CPU. Đã kiểm tra nạp ngoại tuyến và nhận dạng thực trên file giọng nói tổng hợp tại máy: ghép đúng 3/3 câu tiếng Anh, nhận mốc 00:00.34 / 00:02.54 / 00:05.24. Không dùng bản ghi âm/lyrics thương mại.
- Trên bản kiểm thử riêng cổng 3003: chọn file giọng nói, dán lời không timeline, chạy AI, xem/chỉnh các mốc, áp dụng, hoàn tác và áp dụng lại, lưu bài, phát và hiển thị lyrics đồng bộ thành công. Cửa sổ chỉnh lyrics của bài đã lưu có nút AI và hủy tác vụ giữ nguyên văn bản. Tài khoản/dữ liệu kiểm thử tách khỏi ứng dụng đang chạy.
- Phát/tạm dừng nhạc mẫu; tự chuyển bài; đọc LRC, làm nổi bật dòng hiện tại và bấm dòng lời để tua đến giây tương ứng.
- Đã quan sát bố cục desktop 1440 px và viewport điện thoại 390 px. Khi đo viewport 390 px, nội dung không tràn ngang và trình phát nằm cố định ở đáy màn hình.
- Khối AI/bảng chỉnh mốc đã kiểm tra ở 1440 px và 390 px. Ở 390 px, chiều rộng trang 390 px và hộp thoại 366 px, không tràn ngang; đã áp dụng và lưu lại lyrics AI cho bài đã tồn tại.
- Kiểm tra tự động bao gồm tài khoản khác không đọc/sửa/xóa media, playlist hoặc lyrics của chủ sở hữu; upload quá giới hạn; file sai; phiên hết hạn; dữ liệu còn sau đóng/mở database; và HTTP Range 206 cho tua nhạc.

## Phạm vi cần kiểm tra tiếp khi triển khai

- Chế độ `DATABASE_URL` đã có adapter/schema nhưng chưa được thử với một dịch vụ PostgreSQL riêng trong phiên này.
- Chưa thử trên thiết bị iOS/Android thật hoặc toàn bộ codec âm thanh trong mọi trình duyệt. Chưa đánh giá mô hình thực trên bài hát tiếng Việt có giọng hát; kiểm thử ghép văn bản tiếng Việt và nhận dạng giọng nói tiếng Anh không bảo đảm độ chính xác với ca hát. Xem [LOCAL-AI.md](LOCAL-AI.md).
- Không có triển khai hosting công khai; đây là bản chạy cục bộ. Checklist đầy đủ ở [TESTING.md](TESTING.md).
- Gói ZIP không chứa tài khoản, phiên, nhạc đã upload trong quá trình kiểm thử, cơ sở dữ liệu cục bộ hay `node_modules`. Chạy `npm install` rồi `npm run dev` để khởi tạo môi trường mới.
