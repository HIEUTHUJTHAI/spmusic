# Căn lời tự động bằng AI cục bộ

## Cách dùng

1. Mở **Tải nhạc lên**, chọn file nhạc, rồi dán lời vào ô **Lyrics đồng bộ**. Mỗi câu hát một dòng, gồm đầy đủ các lần lặp điệp khúc theo thứ tự trong bản thu.
2. Xác nhận quyền sử dụng nội dung. Chọn ngôn ngữ giọng hát (mặc định Tiếng Việt).
3. Bấm **AI căn thời gian**. Lần đầu máy tải mô hình Whisper khoảng 80 MB; các lần sau dùng lại dữ liệu đã lưu. Nhạc và lyrics không được gửi tới dịch vụ nhận dạng bên ngoài.
4. Xem từng câu và mốc gợi ý. Các câu thiếu mốc hoặc khớp ít từ được đánh dấu để kiểm tra. Có thể nhập/sửa thời gian trực tiếp, ví dụ `01:12.50`.
5. Bấm **Áp dụng LRC**, sau đó **Thêm vào thư viện** hoặc **Lưu lời bài hát**. Kết quả AI chỉ là bản nháp cho tới lúc bạn lưu. **Hoàn tác AI** khôi phục nội dung trước khi áp dụng.

Với bài đã tải lên, mở menu ba chấm → quản lý lyrics hoặc chỉnh sửa bài hát; nút AI nằm ngay dưới ô lời. AI dùng file nhạc gốc đã có trên máy chủ. Khi tạo bài mới, file được gửi tới máy chủ SPMusic cục bộ để phân tích trước, rồi tải lại khi bạn lưu bài.

**Hủy AI** dừng tác vụ và giữ nguyên lời đang nhập. Máy chủ chỉ xử lý một lượt AI tại một thời điểm; các lượt tải nhạc thông thường vẫn có thể hoạt động. Đóng hoặc khởi động lại máy chủ sẽ dừng tác vụ chưa hoàn thành.

## Chuẩn bị mô hình trước (tùy chọn)

Không cần Python, API key hoặc dịch vụ trả phí. Dùng Node.js đã cài thư viện của ứng dụng:

```sh
npm run ai:prepare
node tools/prepare-lyrics-ai.mjs --offline
```

Lệnh đầu tải và kiểm tra mô hình; lệnh thứ hai chỉ kiểm tra bằng dữ liệu đã lưu. Cách thông thường là chạy `start-auralis.cmd` và bấm nút AI trên web, mô hình sẽ được chuẩn bị tự động.

Mô hình đa ngôn ngữ `Xenova/whisper-base` chạy bằng Transformers.js/ONNX Runtime trên CPU, bản lượng tử hóa q8. Bộ nhớ cần dùng tùy bài và máy; nên để vài GB RAM trống. CPU tối đa bốn luồng được dùng cho nhận dạng. Máy chủ Express chạy ở tiến trình riêng với tiến trình AI để tiếp tục phục vụ nhạc trong lúc xử lý.

Mô hình mặc định lưu ở `server/data/ai-models/` (hoặc `DATA_DIR/ai-models/`). Có thể đặt `LYRICS_AI_CACHE` trong `server/.env` tới đường dẫn khác. Sau khi tải xong, đặt `LYRICS_AI_OFFLINE=true` để ngăn việc tải mô hình từ xa. File nhạc/lời không được gửi ra ngoài trong cả hai chế độ.

## Phạm vi và độ chính xác

- Tối đa 15 phút/bài, 32 KB lời, 200 dòng và 2500 từ. Tác vụ quá 20 phút sẽ dừng. Giới hạn file nhạc vẫn là 250 MB.
- Whisper nghe bản thu và trả mốc cho từng từ. Ứng dụng ghép lời bạn cung cấp với những từ đã nhận diện theo thứ tự; giữ nguyên văn bản gốc và bỏ qua khác biệt dấu câu, chữ hoa và dấu tiếng Việt khi so khớp.
- Đây là căn lời dựa trên nhận dạng giọng hát, chưa phải bộ forced alignment chuyên dụng cho ca hát. Nhạc nền lớn, bè, rap, kéo dài âm tiết, câu nằm ở ranh giới đoạn phân tích, ngôn ngữ nhận sai hoặc lời khác bản thu có thể khiến mốc lệch hoặc bỏ sót.
- Câu chưa ghép đủ sẽ để trống thời gian để người dùng chỉnh; ứng dụng không chia đều thời lượng bài để giả mốc. Điền đủ mốc hợp lệ, theo thứ tự và trong thời lượng bài trước khi áp dụng LRC.
- Đã kiểm tra mô hình thực bằng giọng nói tiếng Anh tổng hợp trên máy. Chưa dùng bản thu ca hát tiếng Việt có giấy phép để đánh giá độ chính xác thực tế; cần nghe lại các bài của bạn sau khi căn.
- Âm thanh mono 16 kHz tạm chỉ dùng cho AI; file gốc và bản phát lossless không bị thay đổi. File tạm được dọn sau xử lý, hủy hoặc lỗi thông thường. Nếu máy bị tắt đột ngột, có thể còn thư mục `uploads/temp/`; chỉ dọn thủ công khi đã dừng ứng dụng.

## Các file và API

- `server/src/lyrics-ai-worker.js`: nạp mô hình, giải mã âm thanh bằng FFmpeg, nhận dạng từ có mốc thời gian.
- `server/src/lyrics-alignment.js`: kiểm tra lời, ghép từ theo thứ tự và tạo gợi ý LRC; không tự đặt thời gian cho câu thiếu bằng chứng.
- `server/src/lyrics-ai.js`: quản lý tác vụ, giới hạn đồng thời, tiến trình, hủy, dọn file và kiểm tra chủ sở hữu.
- `client/src/components/LyricsAI.jsx`: nút AI, chọn ngôn ngữ, trạng thái, chỉnh mốc, áp dụng và hoàn tác.
- `POST /api/lyrics/align`: multipart gồm `audio`, `content`, `language` để thử lời cho file chưa lưu.
- `POST /api/tracks/:id/lyrics/align`: JSON `{content, language}` để thử lời cho bài đã có. Chỉ chủ bài được dùng.
- `GET /api/lyrics/align/:id`: trạng thái/kết quả riêng của tài khoản đã tạo tác vụ.
- `DELETE /api/lyrics/align/:id`: hủy tác vụ của tài khoản hiện tại.

Các lệnh tạo trả HTTP 202 cùng `job.id`; frontend hỏi trạng thái mỗi giây. Tác vụ và kết quả chỉ lưu trong bộ nhớ, hết hạn sau 30 phút hoặc khi máy chủ khởi động lại. LRC chỉ lưu qua API lyrics hiện có sau khi người dùng kiểm tra và bấm lưu.

Tài liệu nền tảng: [xử lý audio trong Node.js](https://huggingface.co/docs/transformers.js/guides/node-audio-processing), [mô hình Whisper base](https://huggingface.co/Xenova/whisper-base). Mã ứng dụng có giấy phép MIT; thư viện, chương trình FFmpeg và mô hình giữ giấy phép riêng của chúng.
