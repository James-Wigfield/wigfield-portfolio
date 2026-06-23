import { createElement } from 'react';
import { useIntersectionObserver } from '../hooks/useIntersectionObserver';

/* Lightweight scroll-reveal wrapper. Fades + moves its child in once on entry.
   - `dir` picks the entry direction: 'up' (default), 'left', or 'right'.
   - `delay` (ms) staggers siblings via transition-delay.
   - `as` picks the rendered element (div by default).
   Honours prefers-reduced-motion via CSS (.hp-reveal is reset to visible). */
export default function Reveal({ as = 'div', className = '', dir, delay, style, children, ...rest }) {
  const [ref, visible] = useIntersectionObserver();

  const cls = [
    'hp-reveal',
    dir ? `hp-reveal--${dir}` : '',
    visible ? 'is-in' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const mergedStyle = delay ? { ...style, transitionDelay: `${delay}ms` } : style;

  return createElement(as, { ref, className: cls, style: mergedStyle, ...rest }, children);
}
