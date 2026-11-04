export const DEFAULT_GLASS_OPACITY = 0.62;
const key = 'spmusic-glass-opacity';
export function readGlassOpacity() {
  try {
    const saved = localStorage.getItem(key);
    if (saved === null) return DEFAULT_GLASS_OPACITY;
    const value = Number(saved);
    return Number.isFinite(value) ? Math.min(0.95, Math.max(0.15, value)) : DEFAULT_GLASS_OPACITY;
  } catch { return DEFAULT_GLASS_OPACITY; }
}
export function applyGlassOpacity(value, persist = true) {
  const opacity = Number.isFinite(value) ? Math.min(0.95, Math.max(0.15, value)) : DEFAULT_GLASS_OPACITY;
  document.documentElement.style.setProperty('--glass-opacity', opacity);
  try { localStorage.setItem(key, String(opacity)); } catch { /* Still allow a live preview. */ }
  if (persist) window.spmusicDesktop?.setGlassOpacity?.(opacity).catch(() => {});
  window.dispatchEvent(new CustomEvent('spmusic-glass-change', { detail: opacity }));
  return opacity;
}
