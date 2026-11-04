import { useEffect } from 'react';

const selector = '.sidebar .nav-item, .topbar .history-button, .topbar .user-avatar, .topbar .upload-top, .player button, .expanded-tabs button';

// Pointer events schedule one frame; there is no animation loop while the mouse is idle.
export function useGlassProximity() {
  useEffect(() => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const fine = matchMedia('(hover: hover) and (pointer: fine)');
    let frame = 0, point = null, dirty = true, controls = [];
    const reset = () => {
      controls.forEach((element) => {
        element.style.removeProperty('--proximity-scale');
        element.style.removeProperty('--proximity-lift');
      });
    };
    const enabled = () => !reduced.matches && fine.matches;
    const paint = () => {
      frame = 0;
      if (!enabled() || !point) { reset(); return; }
      if (dirty) {
        const next = [...document.querySelectorAll(selector)];
        controls.filter((element) => !next.includes(element)).forEach((element) => {
          element.classList.remove('glass-proximity');
          element.style.removeProperty('--proximity-scale');
          element.style.removeProperty('--proximity-lift');
        });
        controls = next;
        controls.forEach((element) => element.classList.add('glass-proximity'));
        dirty = false;
      }
      const values = controls.map((element) => {
        const rect = element.getBoundingClientRect();
        const distance = Math.hypot(point.x - (rect.left + rect.width / 2), point.y - (rect.top + rect.height / 2));
        const strength = Math.max(0, 1 - distance / (element.classList.contains('nav-item') ? 145 : 100));
        const weight = strength * strength * (3 - 2 * strength);
        const active = !element.disabled && rect.width > 0 && rect.height > 0;
        return { element, scale: active ? 1 + weight * (element.classList.contains('nav-item') ? 0.065 : 0.32) : 1,
          lift: active && element.closest('.player') ? -weight * 5 : 0 };
      });
      values.forEach(({ element, scale, lift }) => {
        element.style.setProperty('--proximity-scale', scale.toFixed(3));
        element.style.setProperty('--proximity-lift', `${lift.toFixed(2)}px`);
      });
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(paint); };
    const move = (event) => {
      if (event.pointerType === 'touch' || !enabled()) return;
      point = { x: event.clientX, y: event.clientY }; schedule();
    };
    const leave = () => { point = null; schedule(); };
    const invalidate = () => { dirty = true; schedule(); };
    const observer = new MutationObserver(invalidate);
    observer.observe(document.getElementById('root'), { childList: true, subtree: true });
    document.addEventListener('pointermove', move, { passive: true });
    document.documentElement.addEventListener('pointerleave', leave);
    window.addEventListener('blur', leave);
    window.addEventListener('resize', invalidate);
    document.addEventListener('scroll', invalidate, { passive: true, capture: true });
    reduced.addEventListener('change', leave);
    fine.addEventListener('change', leave);
    return () => {
      cancelAnimationFrame(frame); observer.disconnect(); reset();
      controls.forEach((element) => element.classList.remove('glass-proximity'));
      document.removeEventListener('pointermove', move);
      document.documentElement.removeEventListener('pointerleave', leave);
      window.removeEventListener('blur', leave);
      window.removeEventListener('resize', invalidate);
      document.removeEventListener('scroll', invalidate, true);
      reduced.removeEventListener('change', leave);
      fine.removeEventListener('change', leave);
    };
  }, []);
}
