import gsap from 'gsap';

// Only transform & opacity, short and interruptible.
export function fadeIn(el: HTMLElement | null) {
  if (el) gsap.fromTo(el, { opacity: 0, y: -8, scale: 0.98 }, { opacity: 1, y: 0, scale: 1, duration: 0.22, ease: 'power2.out', clearProps: 'transform' });
}

export function slideIn(el: HTMLElement | null) {
  if (el) gsap.fromTo(el, { opacity: 0, x: 24 }, { opacity: 1, x: 0, duration: 0.35, ease: 'power3.out', clearProps: 'transform' });
}
