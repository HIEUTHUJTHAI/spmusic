// Underdamped spring response sampled for compositor-only Web Animations.
export const SPRING_DURATION = 680;
export function artworkSpring(progress) {
  if (progress <= 0) return 0;
  if (progress >= 1) return 1;
  const seconds = progress * .85;
  return 1 - Math.exp(-14 * seconds) * (Math.cos(12 * seconds) + 14 / 12 * Math.sin(12 * seconds));
}
export function springFrames(dx = 0, dy = 0) {
  return Array.from({ length: 49 }, (_, i) => {
    const t = i / 48, seconds = t * SPRING_DURATION / 1000;
    const residual = i === 48 ? 0 : Math.exp(-10 * seconds) * (Math.cos(15 * seconds) + 10 / 15 * Math.sin(15 * seconds));
    const stretch = Math.sin(Math.PI * t) * Math.exp(-5 * t) * .22;
    const horizontal = Math.abs(dx) > Math.abs(dy);
    return { offset: t, transform: `translate(${dx * residual}px, ${dy * residual}px) scale(${1 + (horizontal ? stretch : -stretch * .35)}, ${1 + (horizontal ? -stretch * .35 : stretch)})` };
  });
}
