# SPMusic API

Node.js 22+, Express 5, PostgreSQL. Chạy từ thư mục gốc bằng các lệnh trong README chính.

API bổ sung: [Tài khoản, avatar, mật khẩu và bảng màu](../docs/ACCOUNT-SETTINGS.md) · [Tìm/tải nhạc mở, tác vụ và ghi công](../docs/OPEN-MUSIC.md). Phản hồi người dùng hiện bao gồm `avatarUrl` và `theme`.

Mặc định **PGlite** chạy PostgreSQL biên dịch WebAssembly trong Node và ghi dữ liệu bền vững vào `server/data/postgres/`; không cần cài dịch vụ cơ sở dữ liệu. Chỉ chạy **một tiến trình backend** trên cùng thư mục dữ liệu. Khi mở rộng, đặt `DATABASE_URL=postgresql://user:password@localhost:5432/auralis`; adapter `pg` dùng cùng schema và các truy vấn tham số hóa. PGlite phù hợp MVP cục bộ, không phải cụm PostgreSQL đa tiến trình. Schema tự khởi tạo lúc khởi động.

File được lưu trong ba thư mục riêng: `data/uploads/audio/`, `data/uploads/covers/`, `data/uploads/lyrics/`. Không có đường dẫn tĩnh công khai đến thư mục upload. Endpoint media kiểm tra phiên và chủ sở hữu trước khi gửi file, hỗ trợ HTTP Range để tua nhạc. Bản phát hành không kèm bài hát mẫu.

## API

Tất cả phản hồi lỗi có dạng `{ "error": "Thông báo tiếng Việt" }`. API dùng cookie `auralis_session` HttpOnly/SameSite=Lax; phiên hết hạn sau 7 ngày. Khi gọi khác origin, dùng `credentials: 'include'` và khai báo `CLIENT_ORIGIN`. Development dùng Vite proxy `/api`.

| Phương thức | Đường dẫn | Nội dung / phản hồi |
|---|---|---|
| GET | `/api/health` | `{status,database}` |
| GET | `/api/auth/me` | `{user:null}` hoặc `{user:{id,name,email}}` |
| POST | `/api/auth/register` | JSON `{name,email,password}`; 201 + cookie |
| POST | `/api/auth/login` | JSON `{email,password}`; cookie |
| POST | `/api/auth/logout` | Thu hồi phiên và xóa cookie |
| GET | `/api/tracks?q=` | `{tracks}` gồm bài của chính tài khoản; tìm tên bài/album/nghệ sĩ |
| POST | `/api/tracks` | multipart `audio`, tùy chọn `cover`,`lyrics`; text `title`,`artist`,`album`,`genre` |
| PATCH | `/api/tracks/:id` | JSON metadata; chỉ chủ sở hữu |
| DELETE | `/api/tracks/:id` | Xóa bài, file, tham chiếu playlist/lịch sử của chủ sở hữu |
| GET | `/api/media/:id/audio` hoặc `/cover` | File; hỗ trợ Range; chỉ chủ sở hữu đối với bài riêng |
| GET | `/api/tracks/:id/lyrics` | `{content}`; chuỗi rỗng nếu chưa có lyrics |
| PUT | `/api/tracks/:id/lyrics` | JSON `{content}` hoặc multipart file `lyrics` |
| DELETE | `/api/tracks/:id/lyrics` | Xóa LRC của bài thuộc tài khoản |
| GET | `/api/playlists` | `{playlists}` của tài khoản |
| POST | `/api/playlists` | JSON `{name,description?,trackIds?}` |
| PATCH | `/api/playlists/:id` | JSON `{name?,description?,trackIds?}` |
| DELETE | `/api/playlists/:id` | Xóa playlist của tài khoản |
| GET | `/api/history` | `{history:[{trackId,playedAt}]}` tối đa 50 bài gần nhất |
| POST | `/api/history` | JSON `{trackId}`; cập nhật lần nghe gần nhất |
| GET | `/api/youtube/jobs/active` | Tác vụ nhập YouTube đang chạy của tài khoản |
| POST | `/api/youtube/jobs` | JSON `{url,licensed:true}`; bắt đầu nhập MP3 từ một video công khai |
| GET | `/api/youtube/jobs/:id` | Trạng thái/tiến trình; chỉ tài khoản khởi tạo |
| DELETE | `/api/youtube/jobs/:id` | Hủy tác vụ đang chạy |

Playlist chứa tối đa 1000 bài; chỉ chấp nhận bài do chính tài khoản thêm vào. Lịch sử lưu lần nghe gần nhất của mỗi bài (không phải nhật ký từng sự kiện).

Giao diện thêm nhiều bài gửi từng file qua `POST /api/tracks`; tối đa 50 file mỗi lần chọn và kết quả lỗi được hiển thị riêng cho từng bài. Nhập YouTube dùng yt-dlp và FFmpeg, chỉ nhận link HTTPS của một video, thời lượng tối đa 3 giờ và MP3 tối đa 250 MB. Người dùng cần xác nhận quyền sử dụng nội dung.

## Giới hạn và kiểm tra

- Nhạc: MP3/WAV PCM/FLAC/ALAC (.m4a), tối đa 250 MB; FFprobe kiểm tra codec và FFmpeg giải mã toàn bộ để phát hiện dữ liệu hỏng. ALAC 16/20/24 bit được tạo bản phát FLAC lossless, giữ file gốc. Tải vào thư mục tạm trên đĩa, dọn sau xử lý/lỗi, giới hạn hai lượt đồng thời. Media vẫn kiểm tra chủ sở hữu và hỗ trợ HTTP Range.

AI cục bộ có API tác vụ riêng, phân quyền theo tài khoản và không tự ghi đè LRC. Cách dùng/API/cấu hình ở [LOCAL-AI.md](../docs/LOCAL-AI.md).
- Ảnh: JPG/PNG/WebP tối đa 5 MB; kiểm tra chữ ký file, không nhận SVG do người dùng tải lên.
- LRC: tối đa 256 KB, UTF-8, đuôi `.lrc`; cần ít nhất một dòng timestamp; hỗ trợ nhiều timestamp một dòng và metadata `[offset:...]`.
- Mật khẩu: 8–128 ký tự, scrypt với salt riêng; không trả hash ra API.
- 30 lần đăng ký/đăng nhập mỗi IP trong 10 phút. Kiểm tra Origin cho thay đổi dữ liệu. Cổng mặc định chỉ bind `127.0.0.1`.
- Audio upload và tải từ internet ghi vào thư mục tạm trên đĩa, kiểm tra trước khi chuyển vào thư viện; lỗi sẽ dọn file. Avatar dùng bộ nhớ với giới hạn 5 MB. MVP phù hợp máy cá nhân; trước triển khai đa người dùng nên thêm quota mỗi tài khoản, chống mã độc, xử lý media chuyên dụng và storage bên ngoài.

## File quan trọng

- `src/index.js`: nạp cấu hình, khởi tạo database và HTTP server.
- `src/db.js`: chọn PGlite hoặc PostgreSQL, khởi tạo schema.
- `src/schema.sql`: bảng người dùng, phiên, bài hát, playlist, lịch sử.
- `src/app.js`: API, phân quyền, session, upload, media và lỗi.
- `src/validation.js`: xác thực metadata, chữ ký audio/ảnh, cú pháp LRC.
- `src/youtube.js`: xác thực URL, quản lý tác vụ tải/huỷ, kiểm tra và lưu MP3 riêng theo tài khoản.
- `test/youtube.test.js`: URL hợp lệ, nhập trùng và quyền truy cập tác vụ.
- `test/api.test.js`: kiểm thử HTTP thực cho đăng nhập, cách ly tài khoản, upload, HTTP Range, playlist, lyrics, lịch sử và lưu dữ liệu sau khởi động lại.

Chạy kiểm thử: `npm test --workspace @auralis/server` từ thư mục gốc, hoặc `npm test` trong `server/`. Kiểm thử tạo database trong thư mục tạm riêng và tự dọn sau khi hoàn tất; không sửa dữ liệu phát triển.

Kiểm thử tự động đã chạy với PGlite lưu trên đĩa. Adapter `DATABASE_URL` dùng thư viện `pg` và cùng schema PostgreSQL, nhưng môi trường bàn giao chưa có dịch vụ PostgreSQL riêng để chạy kiểm thử tích hợp adapter đó.
