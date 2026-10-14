import gsap from 'gsap';
import { useLayoutEffect, useRef } from 'react';
import { useTheme } from '../theme/ThemeProvider';

/** Big condensed title whose letters rise into place, as on the Apollo poster. */
export function PosterTitle({ text, size = 'clamp(56px, 11vw, 132px)', dotted }: { text: string; size?: string; dotted?: boolean }) {
  const ref = useRef<HTMLHeadingElement>(null);
  const { reduceMotion } = useTheme();
  const letters = dotted ? text.split('').join('·').split('') : text.split('');

  useLayoutEffect(() => {
    if (reduceMotion || !ref.current) return;
    const ctx = gsap.context(() => {
      gsap.from('.fn-letter', { yPercent: 110, rotate: 4, duration: 1.1, ease: 'power4.out', stagger: 0.045, delay: 0.15 });
      gsap.from('.fn-rule', { scaleX: 0, transformOrigin: 'left center', duration: 1.4, ease: 'power3.inOut', delay: 0.4 });
    }, ref);
    return () => ctx.revert();
  }, [text, reduceMotion]);

  return (
    <h1 ref={ref} aria-label={text} style={{ margin: 0 }}>
      <span aria-hidden style={{ display: 'flex', overflow: 'hidden', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: size, lineHeight: 0.86, letterSpacing: '0.02em', textTransform: 'uppercase', color: 'var(--focus)', paddingBottom: '0.04em' }}>
        {letters.map((l, i) => (
          <span key={i} className="fn-letter" style={{ display: 'inline-block', color: l === '·' ? 'var(--text-faint)' : undefined, willChange: 'transform' }}>
            {l}
          </span>
        ))}
      </span>
      <span aria-hidden className="fn-rule" style={{ display: 'block', height: 3, marginTop: 10, width: 'min(420px, 70%)', background: 'var(--focus)' }} />
    </h1>
  );
}
