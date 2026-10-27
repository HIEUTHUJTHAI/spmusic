# Kiểm tra SPMusic MVP

Tài liệu này mô tả lệnh kiểm tra, phạm vi tự động và kịch bản thử thủ công. Việc có kịch bản không có nghĩa mọi trình duyệt, codec hoặc thiết bị đã được kiểm chứng. Kết quả chạy thực tế cần đọc từ terminal hoặc biên bản bàn giao.

## Lệnh kiểm tra

Chạy trong thư mục `auralis` sau `npm install`:

```sh
npm test
npm run build
```

`npm test` chạy bộ kiểm thử HTTP của backend rồi bộ kiểm thử LRC của frontend. Backend test tạo database PGlite và thư mục media trong thư mục tạm riêng; không dùng tài khoản hay file của ứng dụng đang chạy. Nó mở server trên cổng khả dụng do hệ điều hành cấp và dọn tài nguyên khi hoàn tất. Không cần chạy server phát triển trước khi test.

Có thể chạy riêng backend:

```sh
npm test --workspace @auralis/server
```

Build kiểm tra khả năng đóng gói React/Tailwind bằng Vite. Build thành công chưa chứng minh giao diện hoặc giải mã audio hoạt động trên mọi trình duyệt; các mục sau cần thử trong trình duyệt.

## Phạm vi tự động

`server/test/api.test.js` kiểm tra:

- Khách thấy thư viện trống và bị chặn khi quản lý playlist, lịch sử hoặc upload.
- Đăng ký, email/mật khẩu sai, email trùng không phân biệt hoa thường, đăng nhập sai và cookie HttpOnly.
- Yêu cầu thay đổi dữ liệu từ origin không được phép bị từ chối.
- File giả MP3, sai đuôi, lyrics không có timestamp, ảnh không hợp lệ và LRC quá dung lượng bị từ chối; upload lỗi không để lại file audio.
- WAV hợp lệ được ghi vào thư mục riêng, có metadata và thời lượng.
- Hai tài khoản không thấy/sửa/xóa bài hoặc truy cập audio/lyrics của nhau.
- Audio riêng yêu cầu đăng nhập; HTTP Range trả đúng phần dữ liệu và trạng thái 206.
- Sửa metadata và tìm kiếm thư viện.
- Đọc lyrics mẫu; thêm/thay/xóa LRC; từ chối lời sai định dạng và người không có quyền.
- Playlist tạo/sửa/xóa, giữ thứ tự ID, loại trùng, chặn bài của tài khoản khác.
- Lịch sử riêng mỗi tài khoản, loại trùng theo bài và cập nhật lần nghe gần nhất.
- Xóa bài dọn file và tham chiếu trong playlist/lịch sử; đăng xuất thu hồi phiên; đăng nhập lại.
- Đóng/mở lại database vẫn giữ tài khoản đã tạo.
- FLAC/ALAC 24-bit/96-kHz giải mã thành dữ liệu PCM trùng từng byte với nguồn tổng hợp; bản phát, file gốc, HTTP Range và dọn file khi xóa; từ chối AAC trong M4A, file giả, FLAC bị cắt ngắn và file vượt 250 MB.
- API AI cho bài đã có và file chưa lưu: xác thực/chủ sở hữu của bài và tác vụ, trạng thái, hủy, dọn file tạm, không tự ghi đè lyrics hay tự lưu bài mới.

`server/test/lyrics-ai.test.js` kiểm tra ghép lời tiếng Việt, bỏ qua dấu/chữ hoa/dấu câu, điệp khúc lặp không dùng lại cùng một mốc, câu chưa ghép được để trống, không tự tạo mốc từ transcript không liên quan, giới hạn đầu vào, thời gian LRC qua ranh giới phút và tác vụ riêng theo tài khoản. Các test thường dùng worker giả để chạy nhanh và không tải mô hình. Kiểm tra mô hình thật là bước riêng, xem [VERIFICATION.md](VERIFICATION.md).

Hàm kiểm tra LRC backend được thử với timestamp, nhiều timestamp cùng dòng, offset, giây không hợp lệ, metadata không có lời, UTF-8 hỏng, ký tự NUL và vượt 256 KB. Bộ kiểm thử frontend trong `client/test/` tập trung parse LRC và chọn dòng hiện tại: timestamp/phần thập phân, thứ tự, offset, nhiều timestamp và các biên trước/sau dòng. Đọc trực tiếp các tệp test để biết tập trường hợp chính xác của phiên bản đang dùng.

Các test API dùng PGlite. Chế độ PostgreSQL qua `DATABASE_URL` cần thử tích hợp riêng với dịch vụ PostgreSQL của môi trường triển khai; bộ test mặc định không kết nối dịch vụ bên ngoài.

## Thử nhanh trong trình duyệt

Chạy `npm run dev`, mở http://127.0.0.1:5173, sau đó thực hiện:

| Luồng | Thao tác | Kết quả mong đợi |
| --- | --- | --- |
| Thư viện trống | Mở app khi chưa thêm nhạc | Hiển thị gợi ý thêm nhạc, không có bài mặc định |
| Chuyển bài | Bài sau, bài trước; thử khi bài đang qua giây thứ 3 | Chuyển hàng chờ hoặc quay về đầu theo điều khiển |
| Tua/âm lượng | Kéo thanh thời gian, đổi âm lượng, tắt tiếng | Audio và thời gian hiển thị theo giá trị chọn |
| Shuffle/repeat | Bật ngẫu nhiên; chuyển ba chế độ lặp | Trạng thái điều khiển phản ánh lựa chọn, hết bài xử lý đúng |
| Lyrics | Mở lời, để nhạc chạy qua một vài dòng, bấm một dòng | Dòng hiện tại sáng, panel tự cuộn, bấm lời tua audio |
| Tìm kiếm | Nhập một tên bài, nghệ sĩ, album; thử chuỗi không có kết quả | Lọc đúng theo tab; trạng thái rỗng rõ ràng |
| Tài khoản | Đăng ký, đăng xuất, đăng nhập lại | Tạo và phục hồi phiên; lỗi nhập liệu được hiển thị |
| Upload | Chọn WAV nguyên bản của bạn, ảnh PNG/JPG và LRC; điền metadata | Có phần trăm tải/xử lý; bài mới xuất hiện và phát được |
| Upload sai | Chọn file sai đuôi/hỏng hoặc quá giới hạn | Có thông báo lỗi, thư viện không thêm bài lỗi |
| Metadata | Sửa tên/nghệ sĩ/album/thể loại bài đã upload | Thông tin mới xuất hiện trong danh sách/tìm kiếm |
| LRC riêng | Tải, sửa, lưu và xóa lời của bài upload | Lời mới được áp dụng; xóa xong có trạng thái chưa có lyrics |
| Playlist | Tạo, chọn bài, đổi tên/mô tả, bỏ bài, xóa | Dữ liệu lưu sau tải lại; xóa playlist không xóa bài |
| Lịch sử | Nghe vài bài rồi tải lại trang | Nghe gần đây đúng tài khoản hoặc trình duyệt khách |
| Hai tài khoản | Upload bằng A, đăng xuất rồi vào B | B không thấy upload/playlist/lịch sử của A |
| Xóa bài | Xóa bài upload đang nằm trong playlist | Bài biến mất và không còn trong playlist/lịch sử |
| Dữ liệu bền vững | Dừng ứng dụng rồi chạy lại | Tài khoản, bài và playlist vẫn còn |

Dùng file âm thanh, ảnh và LRC mà bạn sở hữu hoặc được phép sử dụng để thử upload. Ảnh bìa nhận PNG/JPG/WebP; SVG không được phép tải lên.

## Responsive và khả năng sử dụng

Thử ở màn hình máy tính rộng, máy tính bảng và chiều ngang điện thoại khoảng 390 px. Kiểm tra thanh phát không che nút thao tác cuối trang, sidebar điện thoại mở/đóng được, biểu mẫu upload/playlist cuộn được và các thanh tua/âm lượng sử dụng được. Thử mở cả lyrics và hàng chờ qua nút điều khiển tương ứng.

Dùng bàn phím Tab/Shift+Tab để di chuyển, Enter/Space để kích hoạt nút và Escape để đóng modal. Nhấn Space ngoài ô nhập để phát/tạm dừng. Kiểm tra focus rõ, nhãn điều khiển dễ hiểu, lỗi form có thể đọc được và panel lyrics không cuộn toàn trang. Bật tùy chọn giảm chuyển động của hệ điều hành để kiểm tra lyrics cuộn không hiệu ứng.

Trên điện thoại, kiểm tra bằng trình duyệt thực nếu dự định sử dụng lâu dài; tùy nền tảng có thể cần chạm nút phát trước khi audio bắt đầu. Backend mặc định chỉ nhận kết nối từ máy cá nhân, nên thử trên điện thoại vật lý cần chủ động cấu hình host/mạng và origin phù hợp; không cần làm bước này để chạy MVP trên máy tính.

## Kiểm tra bản build

Dừng server phát triển rồi chạy:

```sh
npm run build
npm start
```

Mở http://localhost:3001. Kiểm tra trang tải được, `/api/health` trả trạng thái hoạt động, có thể đăng nhập, tải nhạc và mở lyrics. Kiểm tra tải lại trang sau khi điều hướng.

## Các giới hạn cần ghi nhận

- Kiểm thử tự động không nghe và đánh giá chất lượng âm thanh, không thay cho thử tương tác thật.
- Chưa có bộ kiểm tra trình duyệt tự động đầy đủ cho thao tác kéo thả, âm lượng, breakpoint và audio autoplay.
- Việc kiểm tra header không tương đương giải mã media đầy đủ; thử file hỏng nhưng có header đúng và codec đặc biệt trên trình duyệt mục tiêu.
- Chưa có kiểm thử tải đồng thời nhiều người dùng, mất điện giữa thao tác database/file hoặc phục hồi bản sao lưu production.
- Bài MP3 cũ tải trước bản hỗ trợ FFprobe có thể chưa có thời lượng trong danh sách; khi phát trình duyệt sẽ đo lại. Bài mới được đo thời lượng lúc tải lên.
