import { springFrames, SPRING_DURATION } from '../lib/springMotion';
import { Children, useLayoutEffect, useRef } from 'react';

export default function LiquidTabs({ as: Tag = 'div', children, className = '', ...props }) {
  const group = useRef(null), marker = useRef(null), animation = useRef(null), last = useRef(null);
  const items = Children.toArray(children);
  const selection = items.findIndex((item) => /(?:^|\s)(?:selected|active)(?:\s|$)/.test(item.props?.className || ''));
  useLayoutEffect(() => {
    const root = group.current, lens = marker.current;
    const target = root?.querySelector(':scope > button.selected, :scope > button.active');
    if (!target || !lens) { if (lens) lens.hidden = true; last.current = null; return; }
    const x = target.offsetLeft, y = target.offsetTop, width = target.offsetWidth, height = target.offsetHeight;
    const prior = !lens.hidden ? lens.getBoundingClientRect() : null;
    const base = root.getBoundingClientRect();
    animation.current?.cancel();
    lens.hidden = false;
    Object.assign(lens.style, { left: `${x}px`, top: `${y}px`, width: `${width}px`, height: `${height}px` });
    if (prior && last.current && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const dx = prior.left - base.left + root.scrollLeft - x, dy = prior.top - base.top + root.scrollTop - y;
      if (Math.abs(dx) + Math.abs(dy) > 1) animation.current = lens.animate(springFrames(dx, dy), { duration: SPRING_DURATION, easing: 'linear' });
    }
    last.current = { x, y };
  }, [selection, items.length]);
  useLayoutEffect(() => {
    const root = group.current, lens = marker.current;
    if (!root || !lens) return undefined;
    const observer = new ResizeObserver(() => {
      const active = root.querySelector(':scope > button.selected, :scope > button.active');
      if (!active || lens.hidden) return;
      if (lens.offsetWidth !== active.offsetWidth || lens.offsetHeight !== active.offsetHeight || lens.offsetLeft !== active.offsetLeft || lens.offsetTop !== active.offsetTop) {
        animation.current?.cancel();
        Object.assign(lens.style, { left: `${active.offsetLeft}px`, top: `${active.offsetTop}px`, width: `${active.offsetWidth}px`, height: `${active.offsetHeight}px` });
      }
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, [selection, items.length]);
  useLayoutEffect(() => () => animation.current?.cancel(), []);
  return <Tag ref={group} className={`${className} liquid-tabs`} {...props}><span ref={marker} className="liquid-lens" hidden aria-hidden="true" />{children}</Tag>;
}
