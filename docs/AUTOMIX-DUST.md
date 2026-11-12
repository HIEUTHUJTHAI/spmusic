# AutoMix Dust — SPMusic 2.15.0

## Bản vá 2.15.1

React đã tái sử dụng phần tử ảnh cũ cho ảnh hiển thị sau hiệu ứng, giữ lại `opacity: 0` và `transform` do vòng vẽ đặt trực tiếp. Đặt key riêng cho ảnh cũ, ảnh mới và ảnh tĩnh để bàn giao không mang theo trạng thái chuyển động. Kiểm thử hồi quy đã tái hiện lỗi trên 2.15.0: ảnh tải được, đúng bài nhưng độ rõ bằng 0. Bộ kiểm tra nay xác nhận ảnh tải thành công, đúng bài, opacity bằng 1, transform bằng none và kích thước đầy đủ sau từng tình huống kết thúc/hủy chuyển.

Bật AutoMix trong Cài đặt, phát ít nhất hai bài trong hàng đợi và mở trình phát toàn màn hình. Hiệu ứng xuất hiện khi AutoMix thực sự bắt đầu, kể cả chuyển tự động cuối bài hoặc bấm bài tiếp theo khi đang phát.

- Ảnh cũ thu nhỏ sang trái, ảnh mới hiện bên phải. Các hạt bụi có độ sáng, kích thước và đường trôi khác nhau, quầng sáng mềm.
- Khi hòa âm kết thúc, ảnh cũ mờ đi và ảnh mới trở về kích thước đầy đủ trong khoảng 0,85 giây.
- Nền ảnh mờ chuyển sang ảnh bìa mới trong lúc hòa âm. Tab lyrics và hàng đợi giữ nguyên bố cục.
- Tạm dừng, tua, đổi bài hoặc tắt AutoMix hủy chuyển âm hiện tại và kết thúc hình ảnh. Bài không có ảnh dùng ảnh dự phòng.
- Khi giảm chuyển động được bật, chỉ hiện ảnh bài hiện tại. Không có hạt hoặc chuyển động thu/phóng; âm thanh AutoMix vẫn hoạt động.

## Triển khai

`client/src/lib/usePlayer.js` cung cấp ảnh hai bài và tiến độ từ `AudioContext.currentTime`. Chỉ bắt đầu fade tại sự kiện `playing` của luồng mới, sau khi dữ liệu sẵn sàng. UI không điều khiển thời gian phát.

`client/src/components/MixArtwork.jsx` vẽ 130 hạt trên Canvas, dùng sprite quầng sáng đã tạo sẵn, giới hạn độ phân giải ở 1,5 lần CSS pixel. Chỉ cập nhật transform/opacity và Canvas trong khung hình, không render lại toàn ứng dụng. Dọn vòng vẽ khi đóng trình phát hoặc hiệu ứng kết thúc; bỏ vẽ hạt khi trang bị ẩn.

## Kiểm tra

Build bằng `npm run build`, sau đó chạy `npx electron tools/test-automix.cjs`. Trên PowerShell cần bỏ biến `ELECTRON_RUN_AS_NODE` nếu môi trường đã đặt biến này. Công cụ dùng tài khoản, database, WAV dạng sóng sin và ảnh bìa tự tạo riêng; không đụng thư viện cá nhân. Ảnh chụp và hồ sơ kiểm tra nằm trong `.runtime/automix-qa-*`.

Kiểm tra hai luồng âm thanh, bụi đã được vẽ, chuyển tự động/thủ công, kết thúc về một luồng, tạm dừng, tua, chuyển liên tiếp, đóng/mở trình phát, các tab lyrics/hàng đợi, giảm chuyển động và cửa sổ 900×620. Kết quả thành công in `AUTOMIX_QA_PASS`. Đo nhịp khung hình ở môi trường thử, không phải cam kết tốc độ trên mọi máy.
