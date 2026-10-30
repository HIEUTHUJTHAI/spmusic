# SPMusic — không gian nghe nhạc của bạn

Bản cập nhật: giao diện **trắng–hồng**, menu avatar có **Tài khoản / Cài đặt / Đăng xuất**, đổi ảnh đại diện và mật khẩu, chọn màu và xóa nhạc cá nhân. Mở **`start-spmusic.cmd`** để chạy (trình khởi chạy cũ vẫn dùng được). Xem [hướng dẫn tài khoản và cài đặt](docs/ACCOUNT-SETTINGS.md).

**Bàn giao MVP:** [biên bản kiểm tra](docs/VERIFICATION.md) · [kiến trúc và file quan trọng](docs/ARCHITECTURE.md) · [kiểm thử](docs/TESTING.md) · [tài nguyên nguyên bản](docs/ASSETS.md).

**Ứng dụng Windows:** [cách cài/chạy, lưu dữ liệu và tạo bản mới](docs/DESKTOP-APP.md). File `.exe` đã build nằm trong thư mục `release/`.

MVP ứng dụng nghe nhạc chạy trên máy cá nhân, dùng **React + Tailwind CSS**, **Node.js + Express** và **PostgreSQL/PGlite**. Giao diện trắng–hồng mặc định, có bốn bảng màu cơ bản cùng chế độ tự chọn, thư viện cá nhân, playlist và lời bài hát đồng bộ LRC. Bản 1.0.2 không kèm bài hát hoặc lời mẫu; thư viện ban đầu trống. Ứng dụng không sử dụng dữ liệu hay nhận diện thương hiệu Spotify.

**Bản 1.0.3:** Có thể sắp xếp bài hát trong playlist bằng cách kéo thả hoặc dùng phím mũi tên lên/xuống. Thứ tự được lưu và dùng khi phát playlist. Tính năng chọn nhiều file, thư viện không nhạc mẫu và nhập MP3 từ link YouTube của các bản trước vẫn được giữ.

**Bản 1.0.4:** Có thể thay hoặc xóa ảnh bìa cho mọi bài hát trong thư viện, kể cả bài nhập từ YouTube hay nguồn nhạc mở ở bản cũ. Playlist có ảnh bìa riêng, có thể thay hoặc xóa trong cửa sổ sửa playlist. Cài đặt thêm chế độ Tự chọn để lưu màu nhấn, nền trang, bề mặt và màu chữ theo tài khoản.

**Bản 1.5.0:** Cài đặt có AutoMix bật/tắt, chuyển bài chồng âm với thời lượng thích nghi theo đoạn cuối yên lặng; EQ 5 dải và preset mở trong bảng nhỏ, lưu trên thiết bị. Bản Windows có thể tải bộ cài phiên bản cũ từ GitHub Releases, kiểm tra SHA-512 và mở bộ cài sau khi người dùng chọn cài.

**Bản 2.0.0 beta 1:** Giao diện kính mờ trên điều hướng, thẻ nội dung, cửa sổ cài đặt và trình phát. Trong Cài đặt → Ảnh nền ứng dụng, mỗi tài khoản có thể tải lên ảnh JPG/PNG/WebP tối đa 10 MB, xem trước, thay hoặc xóa ảnh. Ảnh lưu cục bộ cùng dữ liệu ứng dụng; giao diện vẫn giữ hiệu ứng kính mờ khi đổi chủ đề màu.

**Bản 2.0.0 beta 2:** Khi mở bản cài Windows, app tự kiểm tra cập nhật và hiện thông báo nếu có bản mới; người dùng chọn cập nhật, để sau hoặc không nhắc lại riêng bản đó. Gỡ mục tìm/tải nhạc mở từ internet; bài đã lưu trước đây vẫn phát và giữ ghi công. Hiệu ứng kính mờ và chuyển động được tinh giản để cuộn và thao tác nhẹ hơn.

**Bản chính thức 2.0.0:** Dùng logo SPMusic mới do chủ ứng dụng cung cấp. Thư viện chặn thêm lại cùng file âm thanh dù đổi tên file và chặn tên bài hát đã có trong cùng tài khoản, kể cả khi nhập từ YouTube. Những bài có sẵn không bị xóa.

**Bản 2.0.1:** Sửa sidebar để playlist không đè lên nút tải nhạc; thêm dòng “by HIEUTHUJTHAI” dưới logo; làm thanh tìm kiếm liền với thanh công cụ; bỏ bảng giới thiệu “Thả mình vào những giai điệu” trên trang chủ.

**Bản 2.0.2:** Căn lại tên thương hiệu để dấu chấm nằm cùng hàng với “SPMusic”.

**Bản 2.1.0:** Nút mở trình phát toàn màn hình ở góc dưới bên trái. Màn hình mới có ảnh bìa lớn trên nền màu lấy từ ảnh bìa, điều khiển phát nhạc, lời bài hát đồng bộ và danh sách bài tiếp theo. Bấm mũi tên xuống hoặc Esc để thu nhỏ.

**Bản 2.1.1:** Sửa bố cục trình phát toàn màn hình khi mở danh sách phát dài: ảnh bìa và tiêu đề luôn nằm trong màn hình, danh sách cuộn trong vùng riêng. Nền ảnh mờ chuyển động vòng tròn chậm và dừng khi hệ thống bật giảm chuyển động.

**Bản 2.2.0:** Tab Tìm kiếm có thêm kết quả nhạc mở từ Internet Archive Netlabels. Có thể nghe thử, xem nguồn và giấy phép Creative Commons, rồi tải bản đã chọn vào thư viện cá nhân (giới hạn 50 MB). Trình phát toàn màn hình bỏ dòng “Thư viện của bạn” và ba tab chỉ còn biểu tượng. Tìm nhạc trực tuyến cần Internet; thư viện đã lưu vẫn dùng offline.

**Bản 2.3.0:** Tab Tìm kiếm có thêm nguồn YouTube để tìm video, xem thử bằng trình phát nhúng chính thức và sao chép nhanh link. SPMusic không tải âm thanh YouTube; tải offline vẫn chỉ dùng luồng hiện có dành cho nguồn cho phép tải. Tìm kiếm YouTube cần cấu hình YouTube Data API v3 key theo mục “Tìm kiếm YouTube” trong `docs/DESKTOP-APP.md`. Cài đặt âm thanh có chọn đầu ra; AutoMix được bật mặc định sau khi nâng cấp, người dùng vẫn có thể tắt.

**Bản vá 2.3.1:** Sửa chọn đầu ra âm thanh trong Electron bằng cách cấp quyền chọn loa/tai nghe và bổ sung danh sách đầu ra có sẵn khi hộp chọn hệ thống không được hỗ trợ.

**Cập nhật lên bản 2.0.0:** Bản beta 2 sẽ tự báo khi có cập nhật; các bản cũ có thể dùng **Cài đặt → Kiểm tra cập nhật** rồi tải và khởi động lại để cài.

## Ứng dụng Windows

SPMusic có thể chạy như ứng dụng desktop: cài Node.js 22+ và npm, cài thư viện bằng `npm install`, sau đó chạy `npm run desktop:build`. File cài đặt `.exe` và bản chạy không cần cài sẽ nằm trong `release/`. Chạy thử app desktop từ mã nguồn bằng `npm run desktop:dev`.

App mở trong cửa sổ riêng, tự khởi động backend Express trên cổng cục bộ tự chọn và lưu database, nhạc, ảnh, avatar vào %APPDATA%\SPMusic\data. Gỡ/cài lại chương trình không chủ động xóa thư viện. Sửa mã nguồn xong, build lại để tạo bản app mới. Bản build hiện chưa ký số; Windows có thể hiện cảnh báo nhà phát hành chưa xác định. Bản cài đặt kiểm tra cập nhật qua GitHub Releases khi mở và có nút kiểm tra thủ công trong Cài đặt.

## Chạy nhanh

### Windows: mở ứng dụng bằng một file

Nhấp đúp **`start-spmusic.cmd`**, hoặc mở PowerShell trong thư mục `auralis` và chạy:

```powershell
.\start-spmusic.cmd
```

File này tự tìm Node.js đã cài hoặc Node.js đi kèm Codex, chuẩn bị giao diện và mở **http://127.0.0.1:3001**. Không cần `npm` có sẵn trong PATH. Giữ cửa sổ chạy ứng dụng mở; nhấn **Ctrl+C** để dừng. Nếu thiếu thư viện, lần chạy đầu tự cài bằng npm/corepack có sẵn và cần Internet. Nếu máy không có cả Node.js lẫn runtime Codex, cài Node.js 22.12 trở lên rồi mở lại file.

`tools/start-local.mjs` thực hiện việc chuẩn bị và chạy Express trong cùng tiến trình để đóng cơ sở dữ liệu đúng cách khi dừng. Bộ nhớ đệm cài đặt, nếu cần, nằm trong `.runtime/`; không sửa PATH hệ thống.

### Dùng các lệnh npm thông thường

Cài **Node.js 22.12 trở lên** cùng npm. Mở terminal trong thư mục `auralis` chứa tệp README này:

```sh
npm install
npm run dev
```

Mở **http://127.0.0.1:5173**. Frontend chạy ở cổng **5173**, backend ở **3001**. Lần khởi động đầu tiên tạo cơ sở dữ liệu và thư mục lưu file tự động. Không cần Docker hoặc tài khoản dịch vụ bên ngoài. Cần kết nối Internet khi cài các gói npm lần đầu. Thư viện ban đầu trống.

Chưa cần tạo tệp `.env` nếu sử dụng thiết lập mặc định. Không có tài khoản hay mật khẩu mẫu: bạn tự đăng ký trong ứng dụng. Dùng **Ctrl+C** để dừng các tiến trình.

### Chạy frontend và backend riêng

Mở hai terminal trong cùng thư mục dự án:

```sh
# Terminal 1
npm run dev:server
```

```sh
# Terminal 2
npm run dev:client
```

Trong chế độ phát triển, Vite chuyển tiếp `/api` đến Express. Địa chỉ kiểm tra máy chủ: **http://127.0.0.1:3001/api/health**. Chỉ khởi động một backend trên cùng thư mục dữ liệu PGlite.

### Chạy bản build trên máy cá nhân

```sh
npm run build
npm start
```

Mở **http://localhost:3001** hoặc **http://127.0.0.1:3001**. Sau khi build, Express phục vụ cả frontend từ `client/dist` và các API, nên không cần giữ Vite chạy. Nếu đã mở `npm run dev`, dừng nó trước để giải phóng cổng 3001.

## Thử ứng dụng

1. **Khám phá và phát nhạc:** tạo tài khoản và thêm nhạc của bạn. Khi có bài hát, bạn có thể mở album/nghệ sĩ, tìm kiếm và xem lời đồng bộ. Thanh phát cố định có phát/tạm dừng, bài trước/sau, tua, âm lượng, phát ngẫu nhiên và lặp lại. Nút lặp luân phiên tắt → toàn bộ → một bài. Nhấn phím Space khi không nhập liệu để phát/tạm dừng.
2. **Tạo tài khoản:** chọn **Đăng nhập → Tạo tài khoản**, nhập tên, email và mật khẩu 8–128 ký tự. Đây là tài khoản cục bộ, không gửi email xác minh. Nhấn ảnh đại diện để xem tài khoản hoặc đăng xuất.
3. **Thêm nhạc:** chọn **Tải nhạc lên**, kéo thả/chọn MP3, WAV, FLAC hoặc ALAC (.m4a), thêm ảnh bìa nếu muốn. Có thể chọn tối đa 50 file cùng lúc; tên bài lấy từ tên file, còn nghệ sĩ/album/thể loại/ảnh bìa dùng chung. Các file được xử lý lần lượt; nếu có file lỗi, bạn có thể thử lại riêng các file đó. Với một file, bạn có thể nhập thông tin và LRC riêng. Xác nhận bạn sở hữu hoặc được phép sử dụng nội dung trước khi lưu.
4. **Quản lý thư viện:** mở **Thư viện của bạn**, chọn **Nhạc tải lên**. Menu ba chấm cạnh bài của bạn cho phép sửa thông tin, quản lý LRC và xóa bài. Biểu mẫu chỉnh sửa cập nhật metadata và lyrics, không thay file âm thanh/ảnh bìa.
5. **Tạo và sắp xếp playlist:** chọn dấu **+** ở Bộ sưu tập hoặc **Tạo playlist đầu tiên**; đặt tên, mô tả và chọn bài. Menu của bài hát có **Thêm vào playlist**. Trong playlist, kéo biểu tượng nắm bên trái bài hát để đổi thứ tự; dùng phím ↑/↓ khi biểu tượng được chọn để di chuyển bằng bàn phím. Thứ tự được lưu tự động và áp dụng cho lần phát tiếp theo. **Sửa playlist** đổi tên/mô tả, thêm hoặc bỏ chọn bài; biểu tượng thùng rác xóa playlist mà không xóa nhạc.
6. **Tìm và nghe lại:** nhập tên bài, album hoặc nghệ sĩ trong ô tìm kiếm; chuyển giữa các tab Bài hát/Album/Nghệ sĩ. **Nghe gần đây** hiển thị lần nghe gần nhất của từng bài, tối đa 50 bài. Biểu tượng tim lưu bài yêu thích.
7. **Xem lời:** mở biểu tượng lyrics trong thanh phát. Dòng hiện tại được làm nổi bật và cuộn theo nhạc; bấm một dòng để tua tới câu đó. Bài không có LRC hiển thị thông báo phù hợp. Với bài do bạn tải lên, chọn chỉnh sửa lyrics để tải file, sửa nội dung hoặc xóa LRC.
8. **AI căn lời cục bộ:** dán lời chưa có thời gian, mỗi câu một dòng; chọn ngôn ngữ và bấm **AI căn thời gian**. Xem/chỉnh mốc, bấm **Áp dụng LRC**, rồi lưu. Lần đầu tải mô hình khoảng 80 MB, các lần sau dùng lại trên máy. Xem [hướng dẫn AI cục bộ](docs/LOCAL-AI.md) để biết giới hạn, cách dùng ngoại tuyến và độ chính xác.
9. **Nhạc từ YouTube:** chọn **Nhạc từ link YouTube**, dán link của một video công khai, xác nhận quyền sử dụng rồi bấm tải. App dùng yt-dlp và FFmpeg để trích âm thanh thành MP3. Chỉ hỗ trợ một video mỗi lượt, tối đa 3 giờ/250 MB; không tải playlist, video riêng tư hoặc livestream. Cần Internet và YouTube có thể thay đổi khiến một số video không tải được.

### Dữ liệu khách và dữ liệu tài khoản

| Dữ liệu | Khi chưa đăng nhập | Khi đã đăng nhập |
| --- | --- | --- |
| Thư viện ban đầu | Trống | Trống cho đến khi bạn thêm nhạc |
| Nhạc tự tải, ảnh và LRC | Cần đăng nhập | Chỉ tài khoản sở hữu truy cập và quản lý |
| Playlist | Cần đăng nhập | Lưu trong cơ sở dữ liệu, riêng từng tài khoản |
| Nghe gần đây | Lưu trong trình duyệt | Lưu trong cơ sở dữ liệu theo tài khoản |
| Yêu thích | Lưu trong trình duyệt | Vẫn lưu tại trình duyệt, tách theo ID tài khoản |

Lịch sử khách không tự nhập vào lịch sử tài khoản. Yêu thích chưa đồng bộ giữa thiết bị; xóa dữ liệu trình duyệt sẽ xóa mục yêu thích và lịch sử khách tại đó.

## File LRC

LRC là tệp văn bản **UTF-8**, đuôi `.lrc`, chứa ít nhất một dòng có mốc thời gian:

```text
[ti:Bình yên bên hiên]
[ar:Tác giả của bạn]
[offset:0]
[00:01.00] Một ngày mới đang mở ra
[00:05.50] Ánh nắng chạm bên hiên nhà
[00:10.00][00:20.00] Ta cùng nghe tiếng gió hát
[00:15.250] Và giữ bình yên trong ta
```

Hỗ trợ `[phút:giây]`, phần thập phân 1–3 chữ số, nhiều timestamp trên cùng một dòng, và `[offset:...]` tính bằng mili giây. Trong ứng dụng, offset được **cộng vào timestamp**: `[offset:500]` làm lời xuất hiện chậm hơn 0,5 giây; `-500` làm xuất hiện sớm hơn. Metadata như `[ti:...]`, `[ar:...]` không được hiển thị như lời hát. Các dòng được sắp xếp theo thời gian. Giây phải từ 00 đến 59; đồng bộ ở mức dòng, chưa có karaoke từng từ.

Bạn có thể nhập hoặc sửa nội dung LRC trực tiếp trong ứng dụng, hoặc tải lên file LRC của mình.

## Dung lượng và quyền truy cập

| Loại tệp | Định dạng | Dung lượng tối đa |
| --- | --- | --- |
| Nhạc | `.mp3`, `.wav`, `.flac`, ALAC trong `.m4a`, `.ogg`, `.oga`, `.opus` | 250 MB |
| Ảnh bìa | `.jpg`, `.jpeg`, `.png`, `.webp` | 5 MB |
| Lyrics | `.lrc`, UTF-8 | 256 KB |

Giới hạn dung lượng dùng 1 MB = 1024² byte và 1 KB = 1024 byte. Backend dùng FFprobe/FFmpeg kiểm tra codec và giải mã toàn bộ dữ liệu; đổi tên file không làm nó trở thành file hợp lệ. WAV cần chứa PCM. M4A cần chứa ALAC 16/20/24 bit; M4A chứa AAC không thuộc nhóm hỗ trợ hiện tại. FLAC được phát nguyên bản; ALAC giữ file gốc và tạo thêm bản FLAC không nén mất dữ liệu, giữ tần số lấy mẫu và số kênh. Dung lượng bản giải mã ALAC tối đa 1 GB. Audio hỗ trợ 8–192 kHz, 1–8 kênh, tối đa 3 giờ; AI giới hạn 15 phút. Trình phát hiển thị nhãn Lossless cho những bài lossless mới tải lên.

Tệp tải được ghi vào thư mục tạm trên đĩa, dọn khi lỗi hoặc hoàn tất; tối đa hai lượt nhận/xử lý file đồng thời. FFmpeg đi kèm thư viện npm, không cần cài riêng vào PATH. Lần cài đầu cần Internet để tải các thư viện/chương trình này. SVG do người dùng tải lên không được chấp nhận. Trình duyệt và thiết bị đầu ra vẫn quyết định cách giải mã/tái lấy mẫu; ứng dụng không cam kết đầu ra loa/DAC bit-perfect. Cơ chế chọn FLAC dựa trên [khả năng hỗ trợ codec trình duyệt](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Audio_codecs).

Quyền sở hữu được kiểm tra ở API cho metadata, file nhạc/ảnh, lyrics, playlist và lịch sử. Thư mục upload không được phục vụ tĩnh công khai. Mật khẩu được băm bằng scrypt; phiên đăng nhập dùng cookie HttpOnly/SameSite=Lax, hết hạn sau 7 ngày. API có giới hạn số lần đăng nhập và kiểm tra nguồn yêu cầu. Đây là MVP chạy cục bộ; xem phạm vi bên dưới trước khi mở ứng dụng ra mạng ngoài.

## Cơ sở dữ liệu và cấu hình

Mặc định dùng **PGlite**, bản PostgreSQL biên dịch WebAssembly chạy trong Node.js và lưu bền vững vào `server/data/postgres/`. Đây không phải tệp JSON giả lập database. Nó giúp chạy thử ngay mà không cần cài dịch vụ PostgreSQL. Schema SQL tự khởi tạo khi backend bắt đầu.

Để tùy chỉnh, sao chép `server/.env.example` thành `server/.env`. Trong PowerShell:

```powershell
Copy-Item server/.env.example server/.env
```

| Biến | Mặc định / ý nghĩa |
| --- | --- |
| `PORT` | `3001` — cổng backend |
| `HOST` | `127.0.0.1` — chỉ lắng nghe trên máy cá nhân |
| `DATA_DIR` | `./data` — tính từ thư mục `server`, chứa database và upload |
| `DATABASE_URL` | Để trống để dùng PGlite; có giá trị để dùng PostgreSQL qua `pg` |
| `CLIENT_ORIGIN` | Các origin frontend được phép, ngăn cách bằng dấu phẩy |
| `COOKIE_SECURE` | `false` cho HTTP cục bộ; chỉ bật khi phục vụ qua HTTPS |
| `NODE_ENV` | `development` khi phát triển |

Nếu tự cấu hình `CLIENT_ORIGIN`, khai báo đầy đủ các địa chỉ dùng thực tế, ví dụ:

```dotenv
CLIENT_ORIGIN=http://localhost:5173,http://127.0.0.1:5173,http://localhost:3001,http://127.0.0.1:3001
```

### Dùng PostgreSQL cài riêng

Tạo một database rỗng và tài khoản có quyền tạo bảng, sau đó cấu hình `server/.env`:

```dotenv
DATABASE_URL=postgresql://your_user:your_password@localhost:5432/auralis
```

Khởi động lại backend. Cùng schema/truy vấn sẽ chạy qua adapter `pg`; audio, ảnh và LRC vẫn nằm trong `DATA_DIR/uploads`. Chuyển adapter không tự chuyển dữ liệu từ PGlite sang PostgreSQL: hãy xuất/nhập dữ liệu nếu cần giữ tài khoản và thư viện cũ. Không đưa `.env`, mật khẩu hoặc dữ liệu cá nhân vào kho mã nguồn.

## Cấu trúc mã nguồn

```text
auralis/
├── package.json                  # npm workspaces và lệnh chạy chung
├── package-lock.json             # Khóa phiên bản dependency
├── README.md
├── client/
│   ├── package.json
│   ├── vite.config.js            # React, Tailwind, proxy API
│   ├── index.html
│   ├── public/
│   │   └── covers/               # Ảnh dự phòng cho bài chưa có bìa
│   ├── src/
│   │   ├── main.jsx              # Điểm khởi động React
│   │   ├── App.jsx               # Trang khám phá/thư viện, tìm kiếm, playlist
│   │   ├── components/           # Player, auth, upload, lyrics, modal
│   │   └── lib/
│   │       ├── api.js            # JSON API và upload có tiến trình
│   │       ├── usePlayer.js      # Audio, hàng chờ, shuffle, repeat, seek
│   │       └── lrc.js            # Parse LRC và tìm dòng hiện tại
│   └── test/                     # Kiểm thử xử lý LRC
├── server/
│   ├── package.json
│   ├── .env.example
│   ├── README.md                 # Danh sách endpoint và hợp đồng API
│   ├── src/
│   │   ├── index.js              # Cấu hình, database và HTTP server
│   │   ├── app.js                # API, phiên, phân quyền, media và lỗi
│   │   ├── db.js                 # Adapter PGlite/PostgreSQL
│   │   ├── schema.sql            # Users, sessions, tracks, playlists, history
│   │   ├── validation.js         # Metadata và kiểm tra file
│   │   └── youtube.js            # Xác thực link, tải và lưu MP3
│   ├── test/api.test.js          # Kiểm thử API và cách ly tài khoản
│   └── data/                     # Tự tạo, không nằm trong mã nguồn bàn giao
│       ├── postgres/             # Database PGlite
│       └── uploads/
│           ├── audio/
│           ├── covers/
│           └── lyrics/
└── docs/
    ├── ARCHITECTURE.md
    ├── TESTING.md
    └── ASSETS.md
```

`client/dist/` được tạo khi build; `node_modules/`, `.env`, database và file người dùng được loại khỏi mã nguồn qua `.gitignore`. Sao lưu cả database và `server/data/uploads` nếu muốn giữ đầy đủ thư viện. Với PGlite, dừng backend trước khi sao chép thư mục dữ liệu để có bản sao nhất quán.

## Sáu giai đoạn của MVP

| Giai đoạn | Nội dung hiện có |
| --- | --- |
| 1. Giao diện và phát nhạc | Trang khám phá responsive, sidebar, album/nghệ sĩ, thanh phát và hàng chờ |
| 2. Tài khoản | Đăng ký, đăng nhập, đăng xuất, cookie phiên và cách ly dữ liệu |
| 3. Upload/quản lý | MP3/WAV/FLAC/ALAC, ảnh, metadata, tiến trình, lỗi file và xóa bài kèm file |
| 4. Playlist/tìm kiếm | Tạo/sửa/xóa playlist, thêm/bỏ bài, tìm tên bài/album/nghệ sĩ, lịch sử |
| 5. Lyrics | Tải/sửa/xóa LRC, parse timestamp/offset, làm nổi dòng và tự cuộn |
| 6. Kiểm tra | Bộ kiểm thử API/LRC, quy trình kiểm tra build và checklist giao diện trong `docs/TESTING.md` |

## Kiểm tra và xử lý lỗi

```sh
npm test
npm run build
```

Chi tiết phạm vi kiểm thử và các bước thử thủ công nằm trong [docs/TESTING.md](docs/TESTING.md). Tài liệu kiến trúc: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Nguồn gốc tài nguyên: [docs/ASSETS.md](docs/ASSETS.md).

| Hiện tượng | Cách xử lý |
| --- | --- |
| Không nhận lệnh `node`/`npm` | Cài Node.js đúng phiên bản, đóng và mở lại terminal |
| PowerShell chặn `npm.ps1` | Dùng `npm.cmd` thay cho `npm`, hoặc chạy trong Command Prompt |
| Không kết nối máy chủ | Kiểm tra backend đang chạy và mở `/api/health` |
| Cổng đã được dùng | Dừng phiên chạy cũ; nếu đổi cổng backend, cập nhật proxy trong `client/vite.config.js` |
| Không phát được nhạc | Nhấn phát để có tương tác người dùng; kiểm tra âm lượng, định dạng/codec và file không hỏng |
| Không đăng nhập hoặc tải file được | Dùng cùng hostname ổn định; kiểm tra cookie được cho phép, `COOKIE_SECURE=false` ở HTTP và `CLIENT_ORIGIN` đúng |
| Không thấy bài của tài khoản khác | Đây là quyền riêng tư dự kiến; mỗi tài khoản chỉ xem/quản lý upload của chính mình |
| Không mở được database | Dừng backend trùng lặp và kiểm tra quyền ghi `DATA_DIR`; tránh hai tiến trình cùng dùng PGlite |

## Phạm vi của bản đầu tiên

- Chạy cục bộ; chưa triển khai hosting hoặc cấu hình hệ thống production.
- Chưa có quên mật khẩu, email xác minh, OAuth, quản trị viên, chia sẻ thư viện hay playlist cộng tác.
- File nằm trên ổ đĩa một máy chủ; chưa có object storage, CDN, chuyển mã audio, quét mã độc hoặc quota tổng dung lượng từng tài khoản.
- Thư viện mới trống; cần tự thêm file hoặc nhạc có quyền sử dụng.
- Lyrics đồng bộ theo dòng; có AI cục bộ hỗ trợ căn thời gian cho lời bạn dán, cần xem lại kết quả. Không tự lấy lời từ Internet.
- Yêu thích chỉ lưu trong trình duyệt. PGlite mặc định dành cho một tiến trình backend; có thể đổi sang PostgreSQL khi mở rộng.

Chỉ tải lên nhạc, ảnh và lyrics do bạn sở hữu hoặc được cấp phép. Ứng dụng yêu cầu xác nhận quyền sử dụng khi thêm nội dung, nhưng không thể tự xác minh giấy phép của một file.

