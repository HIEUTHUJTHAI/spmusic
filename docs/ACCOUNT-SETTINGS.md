# SPMusic — Tài khoản và giao diện

## Dùng bản cập nhật

1. Dừng cửa sổ chạy web cũ bằng Ctrl+C.
2. Mở `start-spmusic.cmd` trong thư mục dự án. Trình khởi chạy sẽ tự tạo bản giao diện mới.
3. Tải lại trang và đăng nhập như trước.

Thư mục dự án hiện tại vẫn là `auralis` để các đường dẫn, thư viện nhạc và trình khởi chạy cũ tiếp tục hoạt động. Tên hiển thị mới là **SPMusic**. Không cần tạo lại tài khoản, xóa dữ liệu hoặc cài lại thư viện.

## Menu avatar

Bấm ảnh đại diện ở góc trên bên phải để mở **Tài khoản**, **Cài đặt**, **Đăng xuất**. Menu hỗ trợ bàn phím Tab, Escape và tự đóng khi bấm ra ngoài.

### Tài khoản

- **Ảnh đại diện:** chọn JPG, PNG hoặc WebP tối đa 5 MB, xem trước rồi bấm **Lưu ảnh**. Có thể bỏ chọn hoặc gỡ ảnh đã lưu. Ảnh hiển thị dạng tròn, cắt giữa ảnh, không chỉnh sửa file gốc trước khi tải lên.
- **Đổi mật khẩu:** nhập mật khẩu hiện tại, mật khẩu mới 8–128 ký tự và nhập lại. Mật khẩu mới phải khác mật khẩu hiện tại. Khi thành công, trình duyệt hiện tại tiếp tục đăng nhập; các phiên khác bị thu hồi.
- Ảnh và lựa chọn màu được lưu trên máy chủ theo tài khoản, vẫn giữ sau khi đóng/mở lại web.

### Cài đặt

- Mặc định **Trắng hồng**. Có thêm Trắng tím, Trắng xanh và Đêm hồng. Màu áp dụng cho trang chủ, trình phát, lyrics và các biểu mẫu.
- **Nhạc đã thêm** chỉ liệt kê nhạc của chính tài khoản đang đăng nhập.
- Tìm theo tên bài/nghệ sĩ rồi bấm thùng rác. **Giữ lại** hủy thao tác; **Xác nhận xóa** xóa file nhạc, bản phát chuyển đổi nếu có, ảnh bìa, lyrics và liên kết trong playlist/lịch sử. Nếu đang nghe bài đó, trình phát dừng. Không có thùng rác khôi phục.

### Đăng xuất

Thu hồi phiên hiện tại, dừng nhạc và đóng các bảng cá nhân. Trang trở về thư viện trống cho khách. Nhạc và tài khoản đã lưu không bị xóa.

## File và API chính

- `client/src/components/AccountModal.jsx`: avatar, xem trước/tải ảnh, đổi mật khẩu.
- `client/src/components/SettingsModal.jsx`: bảng màu và quản lý nhạc cá nhân.
- `client/src/theme.css`: các biến màu dùng chung cho mọi thành phần.
- `client/src/App.jsx`: menu avatar, cập nhật tài khoản, đăng xuất và đồng bộ thư viện khi xóa.
- `server/src/account.js`: các API tài khoản, xác thực, đổi mật khẩu và lưu ảnh.
- `server/src/schema.sql`: thêm `users.avatar_file` và `users.theme` bằng migration bổ sung; dữ liệu cũ được giữ nguyên.
- `server/data/uploads/avatars/`: file avatar riêng, chỉ được truy cập qua API đã đăng nhập. Thư mục dữ liệu thay đổi nếu đặt `DATA_DIR`.

| API | Chức năng |
| --- | --- |
| GET `/api/account/avatar` | Ảnh của tài khoản đang đăng nhập |
| PUT `/api/account/avatar` | Multipart, trường `avatar`, tối đa 5 MB |
| DELETE `/api/account/avatar` | Gỡ ảnh của chính mình |
| PATCH `/api/account/preferences` | JSON `{ "theme": "pink" }`, nhận pink/lavender/mint/dark |
| PUT `/api/account/password` | JSON currentPassword/newPassword, đổi và thu hồi phiên khác |
| DELETE `/api/tracks/:id` | API hiện có, kiểm tra chủ sở hữu trước khi xóa |
| POST `/api/auth/logout` | Thu hồi phiên hiện tại |

Cookie và khóa lịch sử/yêu thích trong trình duyệt giữ tên nội bộ cũ để bảo toàn dữ liệu khi đổi thương hiệu. Không chứa mật khẩu trong phản hồi API. Mật khẩu tiếp tục được băm bằng scrypt với salt riêng.

## Kiểm tra bản cập nhật

- 40/40 kiểm thử tự động đạt: tài khoản, avatar hợp lệ/giả/quá lớn, quyền riêng tư, lưu dữ liệu qua khởi động lại, đổi mật khẩu và thu hồi phiên; cùng các kiểm thử nhạc lossless, LRC, AI, playlist, lịch sử trước đó.
- Build frontend thành công.
- Đã kiểm tra trình duyệt bằng tài khoản và thư mục dữ liệu riêng: menu, tải/lưu avatar, lưu màu qua reload, giao diện đêm, xác nhận/hủy xóa và đăng xuất.
- Kiểm tra desktop 1440×900 và mobile 390×844; modal mobile rộng 366 px, trang không tràn ngang.
- Luồng đổi mật khẩu và xóa file thật được kiểm tra bằng API trên dữ liệu thử nghiệm. Không đổi mật khẩu hoặc xóa nhạc của người dùng để kiểm thử.
