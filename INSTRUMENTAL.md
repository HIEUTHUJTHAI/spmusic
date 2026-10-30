# Tách nhạc nền bằng AI — SPMusic 2.4.0

- Chọn bài hát, bấm micro có ngôi sao ở góc trái thanh phát. Trong trình phát toàn màn hình, nút nằm dưới bên phải mục lyrics.
- Lần đầu tải mô hình UVR_MDXNET_KARA_2 về máy; file âm thanh được xử lý tại máy, không gửi tới dịch vụ AI bên ngoài.
- Tiến độ hiển thị cạnh nút. Chờ xử lý xong; có thể tiếp tục nghe hoặc chọn bài khác. Kết quả chỉ tự bật nếu vẫn đang chọn bài đó.
- Bấm lại để chuyển về bản gốc, giữ vị trí đang nghe. Bản gốc không bị sửa.
- Nhạc nền lưu tại thư mục dữ liệu `uploads/instrumental`, mô hình tại `uploads/models`. Những lần sử dụng sau không cần tải lại. WAV đã tạo nghe được offline.
- Giới hạn bài nguồn 15 phút, file kết quả 320 MiB. Xử lý trên CPU có thể mất nhiều phút. Mô hình karaoke giảm giọng hát chính, có thể còn bè hoặc dư âm; không đảm bảo chất lượng phòng thu.
- Phiên bản này xử lý một bài mỗi lần, chưa có nút hủy giữa chừng. Không đóng app khi đang xử lý nếu muốn giữ kết quả.

## Kiểm thử

`node --test server/test/api.test.js` kiểm tra quyền sở hữu, lưu, đọc, yêu cầu Range và file sai định dạng, cùng các chức năng cũ.

Sau `npm run build`, chạy `electron tools/test-instrumental.cjs` để chạy ONNX thật trong cửa sổ Electron ẩn với WAV im lặng tự tạo. Kiểm thử này xác nhận pipeline và độ dài đầu ra, không đánh giá chất lượng tách giọng trên bài hát thực tế.

## Thành phần

- `client/src/lib/useInstrumental.js`: tiến độ, mô hình, lưu nhạc nền.
- `client/src/lib/usePlayer.js`: chuyển nguồn âm thanh, giữ vị trí và trạng thái phát.
- `client/src/components/InstrumentalButton.jsx`: nút dùng chung cho hai giao diện.
- `server/src/instrumental.js`: cache mô hình, lưu WAV và phân quyền theo chủ bài hát.
- `client/vite.config.js`: bỏ đường dẫn CDN WASM mặc định của web-audio-separation 0.3.1, sử dụng WASM được đóng gói bởi Vite. Khi nâng thư viện cần chạy lại smoke test.

Thư viện: web-audio-separation (MIT), ONNX Runtime Web. Mô hình karaoke UVR_MDXNET_KARA_2 tải từ kho AI4future/RVC trên Hugging Face.
