import { useEffect, useRef, useState } from 'react';

function draw(canvas, image, zoom, position) {
  const context = canvas.getContext('2d');
  const width = canvas.width, height = canvas.height;
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight) * zoom;
  const drawnWidth = image.naturalWidth * scale, drawnHeight = image.naturalHeight * scale;
  const overflowX = (drawnWidth - width) / 2, overflowY = (drawnHeight - height) / 2;
  context.clearRect(0, 0, width, height);
  context.drawImage(image, -overflowX + position.x * overflowX,
    -overflowY + position.y * overflowY, drawnWidth, drawnHeight);
  return { overflowX, overflowY };
}

export default function BackgroundCropper({ file, onApply, onCancel, square = false }) {
  const canvas = useRef(null), image = useRef(null), drag = useRef(null);
  const [ready, setReady] = useState(false), [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [error, setError] = useState('');
  useEffect(() => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { image.current = img; setReady(true); };
    img.onerror = () => setError('Không đọc được ảnh này.');
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => {
    if (ready && canvas.current) draw(canvas.current, image.current, zoom, position);
  }, [ready, zoom, position]);
  function move(event) {
    if (!drag.current || !canvas.current || !image.current) return;
    const bounds = canvas.current.getBoundingClientRect();
    const scale = canvas.current.width / bounds.width;
    const { overflowX, overflowY } = draw(canvas.current, image.current, zoom, position);
    const dx = (event.clientX - drag.current.x) * scale;
    const dy = (event.clientY - drag.current.y) * scale;
    setPosition({
      x: overflowX ? Math.max(-1, Math.min(1, drag.current.position.x + dx / overflowX)) : 0,
      y: overflowY ? Math.max(-1, Math.min(1, drag.current.position.y + dy / overflowY)) : 0,
    });
  }
  async function apply() {
    const output = document.createElement('canvas');
    output.width = square ? 1200 : 1920; output.height = square ? 1200 : 1080;
    draw(output, image.current, zoom, position);
    const blob = await new Promise((resolve) => output.toBlob(resolve, 'image/jpeg', 0.9));
    if (!blob) { setError('Không thể lưu ảnh đã cắt.'); return; }
    onApply(new File([blob], square ? 'spmusic-cover.jpg' : 'spmusic-background.jpg', { type: 'image/jpeg' }));
  }
  return <div className="background-cropper">
    <strong>{square ? 'Căn ảnh bìa' : 'Căn ảnh nền'}</strong>
    <p className="form-description">Kéo ảnh để đặt vị trí. Dùng thanh bên dưới để phóng to trước khi lưu.</p>
    <canvas ref={canvas} width={square ? 540 : 960} height="540" className={square ? 'square-crop' : ''} aria-label={square ? 'Xem trước ảnh bìa' : 'Xem trước vùng ảnh nền'}
      onPointerDown={(event) => { drag.current = { x: event.clientX, y: event.clientY, position }; event.currentTarget.setPointerCapture(event.pointerId); }}
      onPointerMove={move} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} />
    <label className="background-zoom">Phóng to <input type="range" min="1" max="3" step="0.01" value={zoom}
      onChange={(event) => setZoom(Number(event.target.value))} /> {Math.round(zoom * 100)}%</label>
    <div className="background-actions">
      <button className="form-secondary" type="button" onClick={() => { setZoom(1); setPosition({ x: 0, y: 0 }); }}>Đặt lại</button>
      <button className="form-secondary" type="button" onClick={onCancel}>Hủy</button>
      <button className="form-primary" type="button" disabled={!ready} onClick={apply}>Dùng ảnh này</button>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
  </div>;
}
