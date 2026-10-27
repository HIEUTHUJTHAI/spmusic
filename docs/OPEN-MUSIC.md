# Nhạc mở từ internet

SPMusic tìm và tải bản thu có giấy phép mở từ **Internet Archive** và **Wikimedia Commons**. Cần Internet để tìm/tải; nhạc đã lưu nghe được khi mất mạng. Không cần tài khoản ở nguồn hoặc API key.

## Cách dùng

1. Nếu ứng dụng đang chạy bản cũ, nhấn Ctrl+C trong cửa sổ chạy ứng dụng rồi mở `start-spmusic.cmd`. Tải lại trang.
2. Đăng nhập tài khoản SPMusic, chọn **Nhạc mở từ internet** trên thanh bên (điện thoại: mở menu trước).
3. Nhập tên bài, nghệ sĩ hoặc thể loại, chọn một nguồn hoặc **Tất cả nguồn**, bấm **Tìm nhạc**.
4. Chọn một kết quả để xem các bản thu. Bấm **Thêm** ở bài muốn tải.
5. Theo dõi tải và xử lý. Có thể đóng hộp thoại trong khi app tiếp tục tải; giữ backend đang chạy. Khi hoàn tất, bài nằm trong thư viện của tài khoản.
6. Menu ba chấm của bài → **Nguồn và giấy phép** để xem ghi công và liên kết nguồn. Xóa bài trong Cài đặt hoặc thư viện như nhạc tự upload.

## Chọn chất lượng

App so sánh các file thuộc **cùng bản thu đã chọn** theo quan hệ file gốc/bản chuyển đổi do nguồn khai báo. Ưu tiên FLAC, WAV PCM hoặc ALAC lossless trước các bản nén mất dữ liệu. Nếu có thông tin, so sánh độ sâu bit/tần số lấy mẫu cho lossless và bitrate cho bản nén; ưu tiên file gốc khi phù hợp. Trường hợp tương đương ưu tiên FLAC để tiết kiệm dung lượng.

Đây không phải công cụ tìm kiếm mọi bản master trên toàn internet: app không tự khẳng định hai bài trùng tên ở hai nguồn là cùng bản thu. Không nâng cấp MP3 thành chất lượng lossless bằng đổi đuôi hoặc tăng tần số lấy mẫu. Nếu chỉ có MP3/OGG/Opus, bài được giữ và ghi nhãn đúng định dạng đó. Các file vượt giới hạn bị loại trước khi chọn. Thông số do nguồn thiếu hoặc sai có thể ảnh hưởng lựa chọn; âm thanh tải về được kiểm tra lại bằng FFmpeg.

## Giấy phép và dữ liệu

- Chấp nhận giấy phép nguồn khai báo thuộc CC0, CC BY, CC BY-SA hoặc Public Domain. Không nhận bản thiếu giấy phép hoặc chỉ có điều khoản NC/ND.
- Giữ tác giả/ghi công, trang nguồn, giấy phép, file đã chọn và thời điểm tải trong cơ sở dữ liệu. Giấy phép được đọc lại ngay trước khi tải.
- Việc lọc dựa trên thông tin nguồn công bố; không phải xác minh quyền sở hữu độc lập. Nếu chia sẻ lại, cần tuân thủ giấy phép của bản thu, bao gồm ghi công khi được yêu cầu.
- Nhạc và metadata nhập về thuộc thư viện riêng của tài khoản, không tự chia sẻ cho tài khoản khác. Không tự tải lyrics hay ảnh bìa từ nguồn.
- Mã nguồn bàn giao không kèm các bản thu tải thử. Chỉ có tài nguyên demo nguyên bản của dự án.

## Giới hạn và xử lý lỗi

- Tối đa **250 MB/bài**, 3 giờ âm thanh, 8–192 kHz, 1–8 kênh; hỗ trợ MP3, WAV PCM, FLAC, ALAC (.m4a), OGG/OGA (Vorbis/Opus) và Opus.
- Một lượt nhập internet đang chạy trên mỗi backend; thời hạn tổng 10 phút. Tải streaming xuống đĩa, không giữ cả file trong RAM.
- Có thể hủy trước giai đoạn lưu hoàn tất. Khi đang giải mã, việc hủy có thể chờ bước kiểm tra dừng rồi dọn file.
- Lỗi, hủy hoặc file không hợp lệ được dọn khỏi thư mục tạm. Thêm lại cùng bản thu trong tài khoản trả về bài đã tồn tại.
- Nguồn có thể chậm, ngừng dịch vụ hoặc giới hạn HTTP 429. App báo lỗi, không lưu file dở dang; thử lại sau hoặc chọn nguồn khác.
- Không tự nối tiếp tác vụ sau khi backend tắt. Khởi động lại rồi thêm lại bài; các bài đã hoàn tất vẫn được giữ.
- Không hỗ trợ dán URL tùy ý, trích nhạc từ YouTube hoặc dịch vụ streaming thương mại.

## File quan trọng và API

| File | Vai trò |
| --- | --- |
| `client/src/components/OpenMusicModal.jsx` | Tìm nguồn, chọn bài, tiến trình/hủy, hiển thị ghi công |
| `client/src/components/open-music.css` | Bố cục máy tính/điện thoại theo màu đã chọn |
| `server/src/open-music-sources.js` | Adapter hai nguồn, chuẩn hóa metadata, lọc giấy phép, chọn chất lượng |
| `server/src/open-music-network.js` | HTTPS, danh sách miền/đường dẫn cho phép, kiểm tra IP và chuyển hướng |
| `server/src/open-music.js` | Tác vụ tải, giới hạn dung lượng, phân quyền, lưu bài và dọn lỗi |
| `server/src/audio.js` | Kiểm tra/giải mã âm thanh, giữ ALAC gốc và tạo FLAC để phát |
| `server/src/schema.sql` | Bổ sung `source_key`, `source_info` và chỉ mục chống trùng theo chủ sở hữu |
| `server/test/open-music.test.js` | Kiểm thử nguồn, chất lượng, phân quyền, lỗi/hủy và lưu bền vững |

Tất cả endpoint yêu cầu đăng nhập:

| Phương thức | Endpoint | Chức năng |
| --- | --- | --- |
| GET | `/api/open-music/search?q=...&source=all&page=1` | Tìm kiếm (`all`, `archive`, `commons`) |
| GET | `/api/open-music/tracks?source=archive&id=...` | Danh sách bài/file ưu tiên trong kết quả |
| POST | `/api/open-music/jobs` | Tạo lượt tải với `{source, itemId, key}` |
| GET | `/api/open-music/jobs/active` | Lượt tải đang chạy của tài khoản |
| GET | `/api/open-music/jobs/:id` | Tiến trình/kết quả của chủ sở hữu |
| DELETE | `/api/open-music/jobs/:id` | Hủy lượt tải của chủ sở hữu |

Tìm kiếm/đọc danh sách giới hạn 30 yêu cầu/phút/tài khoản. Tác vụ trong bộ nhớ có thời hạn lưu; kết quả nhạc và ghi công nằm bền vững trong database. URL tải luôn do adapter tạo, kiểm tra lại miền, đường dẫn, DNS/IP và mỗi chuyển hướng; không nhận URL tải do client đưa vào.

Tài liệu nguồn: [Internet Archive Metadata API](https://archive.org/developers/md-read.html), [Wikimedia Commons API](https://commons.wikimedia.org/wiki/Commons:API/MediaWiki), [MediaWiki Imageinfo](https://www.mediawiki.org/wiki/API:Imageinfo).
