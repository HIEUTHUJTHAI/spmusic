import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import './MixArtwork.css';
import { artworkSpring } from '../lib/springMotion';

const fallback = '/covers/fallback.svg';
const clamp = (n) => Math.max(0, Math.min(1, n));
const ease = (n) => 1 - (1 - clamp(n)) ** 3;
const coverError = (event) => {
  if (!event.currentTarget.src.endsWith(fallback)) event.currentTarget.src = fallback;
};

// Stable, irregular motes: no random popping when React renders playback time.
const motes = Array.from({ length: 130 }, (_, i) => {
  const noise = (salt) => { const n = Math.sin((i + 1) * salt) * 43758.5453; return n - Math.floor(n); };
  return { phase: noise(12.989), speed: .22 + noise(7.123) * .24,
    lane: noise(93.53) - .5, drift: noise(49.19), size: .35 + noise(33.31) ** 3 * 1.35,
    alpha: .15 + noise(83.1) * .65, warm: noise(14.13) > .55 };
});

export default function MixArtwork({ track, mix }) {
  const [scene, setScene] = useState(null);
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const stage = useRef(null), oldCover = useRef(null), newCover = useRef(null);
  const canvas = useRef(null), badge = useRef(null);
  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setReduced(query.matches);
    query.addEventListener('change', change);
    return () => query.removeEventListener('change', change);
  }, []);
  useLayoutEffect(() => {
    if (mix?.from && mix?.to) setScene(mix);
    else if (scene && track?.id !== scene.to.id) setScene(null);
  }, [mix, track?.id, scene]);

  useLayoutEffect(() => {
    if (!scene || !stage.current) return;
    if (reduced) { if (!mix) setScene(null); return; }
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) return;
    const glows = ['255,228,198', '213,230,255'].map((color) => {
      const sprite = document.createElement('canvas'); sprite.width = sprite.height = 48;
      const paint = sprite.getContext('2d');
      const glow = paint.createRadialGradient(24, 24, 0, 24, 24, 24);
      glow.addColorStop(0, `rgba(${color},.65)`);
      glow.addColorStop(.2, `rgba(${color},.18)`);
      glow.addColorStop(1, `rgba(${color},0)`);
      paint.fillStyle = glow; paint.fillRect(0, 0, 48, 48);
      return sprite;
    });
    let frame, size = 0, stopped = false;
    const started = performance.now();
    const resize = () => {
      size = stage.current.clientWidth;
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.current.width = Math.round(size * ratio);
      canvas.current.height = Math.round(size * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(stage.current);
    function draw(now) {
      if (stopped) return;
      const progress = scene.progress();
      const intro = ease(progress * scene.duration / Math.min(.7, scene.duration * .32));
      const ending = mix ? 0 : ease((now - started) / 850);
      const x = .27 * intro;
      const small = 1 - .57 * intro;
      oldCover.current.style.transform = `translate3d(${-x * 100 - ending * 8}%,0,0) scale(${small - ending * .12}) rotate(${-5 * intro - ending * 3}deg)`;
      oldCover.current.style.opacity = (1 - ending) * (1 - .18 * intro);
      const incomingScale = .28 + .15 * intro;
      const arrival = mix ? 0 : artworkSpring((now - started) / 850);
      newCover.current.style.transform = `translate3d(${(36 - 9 * intro) * (1 - arrival)}%,0,0) scale(${incomingScale + (1 - incomingScale) * arrival}) rotate(${4 * intro * (1 - arrival)}deg)`;
      newCover.current.style.opacity = intro + (1 - intro) * ending;
      badge.current.style.opacity = intro * (1 - ending);
      stage.current.style.setProperty('--mix-progress', progress);
      ctx.clearRect(0, 0, size, size);
      // Skip drawing while hidden; the next visible frame catches up to the audio clock.
      if (!document.hidden) {
        const elapsed = progress * scene.duration;
        const envelope = intro * (1 - ending);
        ctx.globalCompositeOperation = 'lighter';
        for (const mote of motes) {
          const travel = (mote.phase + elapsed * mote.speed) % 1;
          const edgeFade = Math.sin(Math.PI * travel) ** .65;
          const px = size * (.29 + .43 * travel);
          const py = size * (.5 + mote.lane * .25 +
            Math.sin(travel * Math.PI * 2 + mote.drift * 6 + elapsed * .45) * .045 * Math.sin(Math.PI * travel));
          const radius = mote.size * Math.max(.65, size / 550);
          const alpha = envelope * edgeFade * mote.alpha * (.8 + .2 * Math.sin(elapsed * 1.3 + mote.phase * 18));
          ctx.globalAlpha = alpha;
          ctx.drawImage(glows[mote.warm ? 0 : 1], px - radius * 5, py - radius * 5, radius * 10, radius * 10);
          ctx.globalAlpha = 1;
          ctx.fillStyle = mote.warm ? `rgba(255,238,218,${alpha})` : `rgba(231,240,255,${alpha})`;
          ctx.beginPath(); ctx.arc(px, py, radius * .6, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
      }
      if (ending >= 1) { setScene(null); return; }
      frame = requestAnimationFrame(draw);
    }
    frame = requestAnimationFrame(draw);
    return () => { stopped = true; cancelAnimationFrame(frame); observer.disconnect(); };
  }, [scene, mix, reduced]);

  const animated = scene && !reduced && (mix || track?.id === scene.to.id);
  // Keep the steady image distinct from the imperative animation nodes: React must not
  // reuse the faded-out outgoing image with its remaining inline opacity/transform.
  return <div className={`expanded-artwork mix-artwork ${animated ? 'is-mixing' : ''}`} ref={stage}
    data-mixing={animated ? 'true' : 'false'} aria-label={animated ? `Đang chuyển từ ${scene.from.title} sang ${scene.to.title}` : undefined}>
    {animated ? <>
      <img key={`outgoing-${scene.from.id}`} className="mix-cover mix-cover-old" ref={oldCover} src={scene.from.coverUrl || fallback} onError={coverError} alt={`Ảnh bìa ${scene.from.title}`} />
      <img key={`incoming-${scene.to.id}`} className="mix-cover mix-cover-new" ref={newCover} src={scene.to.coverUrl || fallback} onError={coverError} alt={`Ảnh bìa ${scene.to.title}`} />
      <canvas className="mix-dust" ref={canvas} aria-hidden="true" />
      <div className="mix-caption" ref={badge} aria-hidden="true">
        <span className="mix-caption-label">AUTOMIX</span>
        <span className="mix-caption-title">{scene.to.title}</span>
        <span className="mix-caption-line"><i /></span>
      </div>
    </> : <img key="steady-cover" className="mix-cover" src={track?.coverUrl || fallback} onError={coverError} alt={`Ảnh bìa ${track?.title || ''}`} />}
  </div>;
}
