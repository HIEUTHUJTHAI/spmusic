# 📋 Sổ tay bàn giao (Agent Handoff Log)

Tài liệu này ghi lại tiến độ, trạng thái hiện tại và các lưu ý bàn giao giữa **Antigravity** và **Codex**.  
*Mọi thay đổi lớn cần được bổ sung vào đầu danh sách (mục "Lịch sử bàn giao gần nhất").*

---

## ⚡ Trạng thái dự án hiện tại
* **Tên dự án**: SPMusic (Auralis)
* **Phiên bản hiện tại**: `2.22.0`
* **Nhánh Git**: `main` (Remote: `https://github.com/HIEUTHUJTHAI/spmusic.git`)
* **Tình trạng tổng thể**: 
  * Codebase ổn định với đầy đủ tính năng: Liquid Glass UI, AutoMix Dust, Sync Lyrics LRC, Local AI Whisper, Desktop Electron Builder.
  * Đã kích hoạt giao thức cộng tác song song giữa **Codex** và **Antigravity**.

---

## 📝 Việc cần làm tiếp theo (Pending Tasks / Backlog)
*(Ghi chú các công việc người dùng đang yêu cầu hoặc cần agent tiếp theo thực hiện)*

- [ ] Chờ chỉ định công việc cụ thể tiếp theo từ người dùng (User requirements).
- [ ] Tích hợp / kiểm tra tính năng mới hoặc build bản cập nhật tiếp theo theo kế hoạch.

---

## 📜 Lịch sử bàn giao gần nhất

### 2026-11-25 — Codex | Playlist 2.22.0
* App.jsx, PlaylistEditor.jsx, PlaylistShelf.jsx, playlist.css và playlistDrag.js: tách thông tin và thêm bài, hoàn tác, gỡ từ menu bài, kéo thả nhường chỗ và hỗ trợ bàn phím.
* Vite build và Electron tools/test-shell.cjs đạt, đã kiểm tra thêm/gỡ/hoàn tác và kéo chuột trong playlist thật với dữ liệu thử.
* Đồng bộ package.json gốc/client/server và package-lock.json. [Windows 2.22.0](https://github.com/HIEUTHUJTHAI/spmusic/releases/tag/v2.22.0).

### 2026-11-22 — Codex | Mở toàn màn hình từ tâm
* client/src/components/ExpandedPlayer.css: player mở từ tâm, scale 24% → 100% trong 520ms.
* Build Vite đạt; kiểm thử Electron tools/test-mini-roundtrip.cjs đạt. Bản Windows [v2.21.9](https://github.com/HIEUTHUJTHAI/spmusic/releases/tag/v2.21.9).

### 2026-11-21 — Codex | Khôi phục giao diện mini
* electron/main.cjs theo dõi trạng thái mini trước khi rời fullscreen; client/src/components/ExpandedPlayer.jsx chỉ yêu cầu kích thước mini một lần mỗi lần đổi chế độ. client/src/App.jsx đóng mini trực tiếp.
* Build Vite đạt. tools/test-mini-roundtrip.cjs chạy qua ứng dụng Electron thật với thư viện riêng: phát bài, fullscreen → mini, mở lyrics, phóng lại fullscreen, về mini và đóng về cửa sổ chính (MINI_ROUNDTRIP_PASS).
* Kênh phát hành Windows: [v2.21.8](https://github.com/HIEUTHUJTHAI/spmusic/releases/tag/v2.21.8). Phiên bản đồng bộ ở package.json gốc, client, server và package-lock.json.

### 🕒 2026-11-21 23:45 — Antigravity | Phát hành v2.21.7: Vá lỗi nút phóng to toàn màn hình từ Mini Player
* **Vấn đề đã khắc phục**: Trong chế độ Mini Player, nút phóng to về toàn màn hình (`.cinema-mini-toggle`) không bấm được do:
  1. **Xung đột vùng kéo cửa sổ (Window Drag Region)**: `.cinema-meta` có thuộc tính `-webkit-app-region: drag` bị tràn `margin-right: 0`, che phủ hơn 60% diện tích của nút bấm ở góc trên phải. Hệ điều hành Windows bắt nhầm thành thao tác kéo cửa sổ (`HTCAPTION`), khiến trình duyệt không nhận được sự kiện `click`.
  2. **Thứ tự DOM & z-index**: Đã chuyển các nút điều khiển (`.cinema-mini-toggle`, `.cinema-close`) ra sau `.cinema-deck` trong DOM, đặt `z-index: 100`, bổ sung `-webkit-app-region: no-drag !important` và `pointer-events: auto !important`.
  3. **Độ căn lề**: Cập nhật `.cinema.mini .cinema-meta` có `margin: 0 96px 0 94px; min-width: 0;`, xóa `padding-top: 34px` thừa, đảm bảo vùng tên bài hát căn giữa gọn gàng cạnh ảnh bìa mà không bao giờ va chạm vào cụm nút điều khiển.
  4. **Logic khôi phục kích thước cửa sổ Electron**: Trong `electron/main.cjs`, tách rõ logic chuyển sang toàn màn hình (`enabled === true`) và thoát toàn màn hình (`enabled === false`). Khi phóng to từ mini mode về fullscreen, lưu giữ `miniRestore` gốc để khi người dùng nhấn ESC/đóng player sau này, kích thước cửa sổ ban đầu của người dùng được phục hồi chính xác.
  5. **Bổ sung Unit Test**: Tạo test suite `electron/mini-player.test.cjs` kiểm chứng toàn bộ quy trình chuyển đổi trạng thái giữa Normal -> Fullscreen -> Mini -> Fullscreen -> Normal.
* Toàn bộ 64/64 automated tests pass 100%, Vite build client hoàn tất thành công.
* **File thay đổi**: `client/package.json`, `client/src/components/ExpandedPlayer.css`, `client/src/components/ExpandedPlayer.jsx`, `electron/main.cjs`, `electron/mini-player.test.cjs`, `package-lock.json`, `package.json`, `server/package.json`, `HANDOFF.md`.

### 🕒 2026-11-21 23:14 — Antigravity | Phát hành v2.21.6: Hiệu ứng Fullscreen macOS & Vá Test Suite
* Nâng phiên bản toàn dự án lên **`v2.21.6`** (`package.json`, `client`, `server`, `package-lock.json`).
* Thay animation mở ExpandedPlayer sang **macOS-style zoom**: scale 0.42→1.0, bo góc 18px→0, brightness tăng dần (540ms spring easing).
* Thêm **animation đóng (close)**: player thu nhỏ mượt về vị trí cũ (440ms) thay vì biến mất tức thì.
* Sửa lỗi hardcode đường dẫn trong `server/test/offline.test.js` để test chạy độc lập ở bất kỳ CWD nào.
* Thiết lập giao thức đa agent (`AGENTS.md`) và sổ bàn giao (`HANDOFF.md`) giữa Codex và Antigravity.
* Build Vite đạt, toàn bộ 63/63 automated tests pass 100%.
* Đã phát hành Windows [v2.21.6](https://github.com/HIEUTHUJTHAI/spmusic/releases/tag/v2.21.6), commit `3615427`. Workflow 44923403741 thành công, đã đăng tải `SPMusic-2.21.6-x64.exe` (256.78 MB).
* **File thay đổi**: `client/package.json`, `client/src/App.jsx`, `client/src/components/ExpandedPlayer.css`, `docs/KNOWN-ISSUES.md`, `package-lock.json`, `package.json`, `server/package.json`, `server/test/offline.test.js`, `AGENTS.md`, `HANDOFF.md`.

### 2026-11-21 22:36 — Codex | Vá menu tùy chọn mini player
* Đã sửa client/src/components/ExpandedPlayer.css: hai hàng lệnh dùng toàn chiều rộng, menu neo phía trên nút ba chấm và có hiệu ứng mở.
* Build đạt, 21/21 test client/Electron đạt. Kiểm tra bố cục menu bằng Electron ở 420×212 và 420×600 đạt.
* Đã phát hành Windows [v2.21.5](https://github.com/HIEUTHUJTHAI/spmusic/releases/tag/v2.21.5), commit `ad450ac`. Workflow 44920210196 thành công và GitHub xác nhận đây là bản latest.

### 2026-11-21 — Codex
* Thiết kế lại 8 menu chọn bằng CSS base-select, hỗ trợ theme và giảm chuyển động.
* File: client/src/choices.css, client/src/main.jsx, package.json (gốc/client/server), package-lock.json.
* Build thành công, 21 test client/Electron và 42 test server đạt trên workspace.
* Đã thử mở menu trong Electron và đổi lựa chọn bằng phím mũi tên + Enter.
* Đã phát hành [v2.21.4](https://github.com/HIEUTHUJTHAI/spmusic/releases/tag/v2.21.4) từ commit `7fad71c`. GitHub đã đăng bộ cài Windows x64, blockmap và latest.yml.
* Lần kiểm tra giao diện kế tiếp: thử menu loa với nhiều thiết bị thật và theme tùy chỉnh.

### 🕒 [2026-11-21] - Kiểm tra Known Issues & Fix lỗi đường dẫn test suite
* **Thực hiện bởi**: **Antigravity (Google DeepMind)**
* **Nội dung công việc**:
  * Kiểm tra tài liệu [`docs/KNOWN-ISSUES.md`](docs/KNOWN-ISSUES.md) liên quan đến lỗi hở khoảng trống phía trên của bảng *Now Playing* khi cuộn trang (từ bản 2.16.1).
  * Chạy kịch bản kiểm thử giao diện `tools/test-shell.cjs` bằng Electron -> Kết quả: `SHELL_QA_PASS` (lỗi này đã được Studio Shell 2.17.0+ xử lý triệt để, không còn bị tái hiện).
  * Chạy test suite toàn diện và phát hiện bug trong `server/test/offline.test.js`: Đường dẫn tạm thời `mkdtemp('server/test-offline-')` và file fixture `silence.mp3` bị hardcoded tương đối, khiến test crash khi thực thi từ thư mục `server/`.
  * **Fix**: Cập nhật `offline.test.js` dùng `fileURLToPath(import.meta.url)` và `path.join(serverRoot, ...)`.
  * Toàn bộ 63/63 automated tests (`server`: 42, `client` & `electron`: 21) và Vite build hiện đều **PASS 100%**.
* **Các file tác động**:
  * `outputs/auralis/server/test/offline.test.js`
  * `outputs/auralis/HANDOFF.md`

### 🕒 [2026-11-21] - Khởi tạo quy trình cộng tác Đa Agent
* **Thực hiện bởi**: **Antigravity (Google DeepMind)**
* **Nội dung công việc**:
  * Đọc hiểu toàn bộ cấu trúc dự án `SPMusic` (`auralis` v2.21.3), phân tích `client`, `server`, `electron`, `tools`, `docs`.
  * Tạo file [`AGENTS.md`](AGENTS.md) để thiết lập quy tắc làm việc chung, quy ước commit và kiến trúc cho Codex & Antigravity.
  * Khởi tạo sổ tay bàn giao [`HANDOFF.md`](HANDOFF.md) làm cầu nối thông tin giữa 2 AI.
* **Các file tác động**:
  * `outputs/auralis/AGENTS.md` (Tạo mới)
  * `outputs/auralis/HANDOFF.md` (Tạo mới)
* **Lời nhắn gửi Codex**:
  > *"Chào Codex! Mình là Antigravity từ Google DeepMind. Mình đã khảo sát toàn bộ codebase SPMusic của bạn và anh em. Mình đã tạo AGENTS.md và file bàn giao này. Khi bạn nhận task tiếp theo từ bro HIEUTHUJTHAI, hãy đọc mục 'Việc cần làm tiếp theo' phía trên, và sau khi hoàn thành task thì cập nhật lại file này để mình nắm được nhé!"*
