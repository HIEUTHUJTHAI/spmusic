# Ứng dụng SPMusic cho Windows

## File để tải/mở

Sau khi chạy `npm run desktop:build`, thư mục `release/` có hai lựa chọn:

- `SPMusic-2.3.1-x64.exe`: bộ cài, có lựa chọn thư mục và tạo lối tắt Start Menu/desktop.
- `SPMusic-2.3.1-Portable.exe`: bản chạy trực tiếp, không cần cài đặt khi build tại máy.

Cả hai bản dành cho Windows 64-bit. Bản build hiện chưa ký số nên Windows SmartScreen có thể báo ứng dụng chưa xác định.

## Dữ liệu người dùng

App khởi động Express bên trong Electron trên một cổng cục bộ tự chọn, mở giao diện trong cửa sổ riêng, rồi đóng máy chủ/database khi thoát. Mỗi lần chạy chỉ mở một bản SPMusic.

Database PGlite, file nhạc, bìa, LRC, avatar, ảnh nền và mô hình AI lưu trong:

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

## Tìm kiếm YouTube

Tab **Tìm kiếm → YouTube · xem thử** dùng YouTube Data API v3 để tìm video, nhúng trình phát chính thức và sao chép link. Tính năng này không tải hay chuyển đổi âm thanh YouTube. Khi chưa có API key, app sẽ báo rõ và các chức năng thư viện/tìm kiếm nguồn mở vẫn dùng được.

Để bật tìm kiếm, tạo API key trong Google Cloud Console, bật **YouTube Data API v3**, rồi:

- Khi chạy từ mã nguồn: đặt `YOUTUBE_API_KEY=...` trong `server/.env`.
- Với bản desktop: tạo file `%APPDATA%\SPMusic\data\youtube-api-key.txt`, dán riêng API key vào file đó (không thêm dấu ngoặc kép), rồi khởi động lại SPMusic.

Không đưa API key vào GitHub hay gửi file key cho người khác. Google Cloud có thể áp hạn mức truy vấn và yêu cầu phương thức thanh toán tùy tài khoản/chính sách hiện hành.

## Cập nhật tự động

App desktop tự kiểm tra bản mới sau khi mở. Nếu có bản mới, người dùng có thể tải và khởi động lại để cài. Trong **Cài đặt → Cập nhật SPMusic**, nút **Kiểm tra cập nhật** cho phép kiểm tra thủ công khi lần kiểm tra nền bị lỗi hoặc bị bỏ qua. Trạng thái tải và lỗi được hiển thị ngay trong hộp thoại.

Từ 2.0.0 beta 2, khi phát hiện bản mới app hiện thông báo ngay trên màn hình chính. **Cập nhật ngay** bắt đầu tải; tải xong chọn **Khởi động lại để cập nhật**. **Để sau** chỉ ẩn thông báo trong phiên dùng hiện tại. **Không nhắc bản này** được lưu trên thiết bị và chỉ ẩn thông báo tự động của đúng phiên bản đó; bản mới hơn vẫn được báo, và nút kiểm tra thủ công trong Cài đặt vẫn hoạt động.

Để chuyển từ bản cài trước sang **2.3.1**, mở **Cài đặt → Kiểm tra cập nhật → Tải bản 2.3.1 → Khởi động lại để cập nhật**. Ứng dụng sẽ không tự tải hoặc tự cài nếu bạn chưa bấm các nút này.

Bản cập nhật lấy từ GitHub Releases của repository `HIEUTHUJTHAI/spmusic` sau khi bạn đưa mã nguồn và các bản build lên đó. Mỗi bản phát hành cần tăng `version` trong `package.json` (ví dụ `1.0.0` → `1.0.1`) và tạo lại bộ cài. Bản cập nhật dùng file cài NSIS; bản portable không tự cập nhật ổn định như bản cài.

Cập nhật không thay đổi `%APPDATA%\SPMusic\data`, nên tài khoản, playlist, avatar, nhạc, lyrics và mô hình AI được giữ lại. App vẫn có thể báo lỗi kiểm tra nếu repository chưa có Release, máy không có Internet hoặc bản build chưa được ký số.

Từ bản 1.5.0, nút **Lùi về phiên bản trước** trong Cài đặt liệt kê các bản Windows cũ có bộ cài và `latest.yml`. App tải bộ cài, kiểm tra SHA-512 theo metadata phát hành, sau đó hỏi người dùng cài bản đã chọn. Nên sao lưu thư mục dữ liệu trước khi cài bản cũ: một phiên bản cũ có thể không đọc được dữ liệu hoặc tính năng tạo bởi bản mới. Sau khi quay về bản cũ, ứng dụng vẫn có thể đề xuất bản cập nhật mới.

AutoMix, chọn đầu ra và EQ nằm trong **Cài đặt → Chuyển tiếp và âm thanh**. AutoMix được bật mặc định sau bản cập nhật này; nếu người dùng tự tắt, lựa chọn đó vẫn được lưu. AutoMix bắt đầu chồng hai bài gần cuối và có thể bắt đầu sớm hơn khi đoạn cuối yên lặng; đây là chuyển tiếp theo mức âm lượng, chưa phân tích BPM hay đồng bộ nhịp. EQ có 5 dải, preset và giảm mức đầu vào khi tăng tần số để hạn chế méo. Các lựa chọn được lưu trong hồ sơ ứng dụng trên thiết bị.

**Đầu ra âm thanh** mở bộ chọn loa/tai nghe của hệ thống khi nền tảng hỗ trợ, áp dụng cả khi EQ hoặc AutoMix đang chạy và lưu lựa chọn trên thiết bị. Có thể chuyển về **Mặc định hệ thống** bất cứ lúc nào. Việc chọn đầu ra riêng cần quyền của trình duyệt và hỗ trợ `AudioContext.setSinkId()`; nếu thiếu hỗ trợ, SPMusic tiếp tục dùng đầu ra mặc định.
