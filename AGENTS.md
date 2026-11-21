# 🤖 Hướng dẫn Phối hợp Đa Agent (Codex & Antigravity)

Tài liệu này thiết lập quy tắc làm việc chung giữa **Codex** và **Antigravity (Google DeepMind)** trên dự án **SPMusic (Auralis)** (`https://github.com/HIEUTHUJTHAI/spmusic.git`).

---

## 👥 Danh sách Agent tham gia
1. **Codex**: AI Assistant phát triển bởi OpenAI.
2. **Antigravity**: AI Assistant phát triển bởi Google DeepMind.

---

## 📌 Nguyên tắc cốt lõi khi làm việc

### 1. Luôn đọc `HANDOFF.md` trước khi bắt đầu
* Trước khi thực hiện bất kỳ yêu cầu nào từ người dùng, **Codex** hoặc **Antigravity** phải đọc file [`HANDOFF.md`](HANDOFF.md) để:
  * Nắm được agent trước đã làm những gì, sửa những file nào.
  * Biết trạng thái hiện tại của mã nguồn (đang chạy tốt, đang debug dở dang, hay cần làm tiếp phần nào).
  * Tránh sửa đè (overwrite) hoặc làm xung đột logic của nhau.

### 2. Luôn cập nhật `HANDOFF.md` sau khi hoàn thành task
* Khi kết thúc một phiên làm việc hoặc hoàn thành một tính năng/sửa lỗi, agent thực hiện **bắt buộc cập nhật vào `HANDOFF.md`**:
  * **Ngày/Giờ & Tên Agent** (Codex hoặc Antigravity).
  * **Nội dung đã thực hiện**: Tóm tắt thay đổi logic.
  * **Danh sách file bị tác động**: Đường dẫn tương đối từ gốc repo.
  * **Trạng thái kiểm thử**: Kết quả chạy test (`npm test`, smoke test,...).
  * **Gợi ý việc tiếp theo cho agent còn lại** (Next Steps / Action Items).

### 3. Quy ước Commit Git
Để theo dõi rõ ràng lịch sử commit trên GitHub:
* Đặt tiền tố rõ ràng theo tên agent trong commit message:
  * `feat(client): [antigravity] thêm hiệu ứng sóng nhạc trực quan`
  * `fix(server): [codex] xử lý giới hạn dung lượng upload 250MB`
* Hoặc thêm dòng `Co-authored-by`:
  ```git
  Co-authored-by: Antigravity <antigravity@google.com>
  # hoặc
  Co-authored-by: Codex <codex@openai.com>
  ```

### 4. Kiến trúc & Những điều cần lưu ý
* **Cấu trúc Monorepo**:
  * `client/`: React + Vite + Tailwind CSS (SPA, phong cách Liquid Glass).
  * `server/`: Node.js + Express 5. Lưu ý cơ sở dữ liệu mặc định là **PGlite** (Postgres WASM) lưu tại `server/data/postgres/`. Không tự tiện sửa cấu trúc dữ liệu nếu chưa chạy di chuyển hoặc kiểm tra tính tương thích ngược.
  * `electron/`: Đóng gói ứng dụng desktop Windows (`main.cjs`, `preload.cjs`).
  * `tools/`: Các script hỗ trợ chuẩn bị mô hình AI Whisper (`tools/prepare-lyrics-ai.mjs`) và công cụ phụ trợ.
* **Quy tắc Media & Streaming**:
  * Audio phát qua API `/api/media/:id/audio` có hỗ trợ `HTTP Range` để phục vụ tua nhạc.
  * File upload được lưu tại `server/data/uploads/` (chia theo `audio/`, `covers/`, `lyrics/`, `temp/`, `playback/`).

### 5. Lệnh kiểm tra nhanh
* Kiểm tra lint / test:
  ```bash
  npm test
  ```
* Khởi động server dev:
  ```bash
  npm run dev
  ```
* Chạy app desktop dev:
  ```bash
  npm run desktop:dev
  ```
