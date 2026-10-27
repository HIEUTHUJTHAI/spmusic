# Ứng dụng SPMusic cho Windows

## File để tải/mở

Sau khi chạy `npm run desktop:build`, thư mục `release/` có hai lựa chọn:

- `SPMusic-1.0.1-x64.exe`: bộ cài, có lựa chọn thư mục và tạo lối tắt Start Menu/desktop.
- `SPMusic-1.0.1-Portable.exe`: bản chạy trực tiếp, không cần cài đặt.

Cả hai bản dành cho Windows 64-bit. Bản build hiện chưa ký số nên Windows SmartScreen có thể báo ứng dụng chưa xác định.

## Dữ liệu người dùng

App khởi động Express bên trong Electron trên một cổng cục bộ tự chọn, mở giao diện trong cửa sổ riêng, rồi đóng máy chủ/database khi thoát. Mỗi lần chạy chỉ mở một bản SPMusic.

Database PGlite, file nhạc, bìa, LRC, avatar và mô hình AI lưu trong:

```text
%APPDATA%\SPMusic\data\
```

Trên máy này, `%APPDATA%` thường là `C:\Users\<tên người dùng>\AppData\Roaming`. Cài hoặc build bản mới không ghi đè thư mục dữ liệu. Sao lưu thư mục này khi SPMusic đã đóng hoàn toàn.

Ứng dụng desktop dùng database riêng, độc lập với database của phiên chạy bằng `start-spmusic.cmd`. Nếu muốn chuyển thư viện web cũ sang app desktop, cần thêm quy trình xuất/nhập; không tự sao chép database đang mở.

## Sửa mã nguồn và tạo bản mới

Cần Node.js 22.12+ và npm. Ở thư mục dự án:

```powershell
npm install
npm run desktop:dev
```

Lệnh `desktop:dev` build giao diện rồi mở app từ mã nguồn. Sau khi sửa mã nguồn, tạo lại bộ cài bằng:

```powershell
npm run desktop:build
```

Kết quả mới nằm trong `release/`. Mã nguồn vẫn tách riêng ở React (`client/`), Express/database (`server/`) và cửa sổ desktop (`electron/`). Bản `.exe` đã đóng gói là chương trình biên dịch; sửa tính năng bằng mã nguồn rồi build bản mới.

Lệnh build tải và kiểm tra checksum của yt-dlp và Node.js vào `tools/vendor/`, sau đó đóng gói vào app để hỗ trợ link YouTube. Cần Internet trong lần chuẩn bị công cụ này. Khi chạy app, tải YouTube vẫn cần Internet; nghe các file đã lưu có thể thực hiện offline.

## File cấu hình desktop

- `electron/main.cjs`: tạo cửa sổ Electron, khởi động backend và đóng backend/database gọn gàng.
- `server/src/desktop-server.js`: mở Express trên loopback/cổng tự chọn và đưa dữ liệu vào hồ sơ Windows.
- `electron-builder.yml`: tên sản phẩm, file cần đóng gói, bản cài NSIS và bản portable.
- `package.json`: lệnh `desktop:dev` và `desktop:build`, Electron và electron-builder.

## Cập nhật tự động

App desktop tự kiểm tra bản mới sau khi mở. Nếu có bản mới, người dùng có thể tải và khởi động lại để cài. Trong **Cài đặt → Cập nhật SPMusic**, nút **Kiểm tra cập nhật** cho phép kiểm tra thủ công khi lần kiểm tra nền bị lỗi hoặc bị bỏ qua. Trạng thái tải và lỗi được hiển thị ngay trong hộp thoại.

Bản cập nhật lấy từ GitHub Releases của repository `HIEUTHUJTHAI/spmusic` sau khi bạn đưa mã nguồn và các bản build lên đó. Mỗi bản phát hành cần tăng `version` trong `package.json` (ví dụ `1.0.0` → `1.0.1`) và tạo lại bộ cài. Bản cập nhật dùng file cài NSIS; bản portable không tự cập nhật ổn định như bản cài.

Cập nhật không thay đổi `%APPDATA%\SPMusic\data`, nên tài khoản, playlist, avatar, nhạc, lyrics và mô hình AI được giữ lại. App vẫn có thể báo lỗi kiểm tra nếu repository chưa có Release, máy không có Internet hoặc bản build chưa được ký số.
