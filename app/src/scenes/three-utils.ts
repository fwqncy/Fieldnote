import * as THREE from 'three';

/** Read a theme token (CSS variable) as a THREE.Color. */
export function cssColor(name: string, fallback = '#888888') {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();
  const c = new THREE.Color();
  try {
    c.set(raw.startsWith('#') ? raw : fallback);
  } catch {
    c.set(fallback);
  }
  return c;
}

/** Procedural marble: soft noise with dark veins, drawn once to a canvas. */
export function marbleTexture(base = '#e9e4d8', vein = '#8f8a80', size = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  g.fillStyle = base;
  g.fillRect(0, 0, size, size);
  const img = g.getImageData(0, 0, size, size);
  const [vr, vg, vb] = [1, 3, 5].map((i) => parseInt(vein.slice(i, i + 2), 16));
  const noise = valueNoise(7);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = fbm(noise, x / 90, y / 90);
      const veinV = Math.abs(Math.sin((x * 0.012 + y * 0.02 + n * 5.5) * Math.PI));
      const t = Math.pow(1 - veinV, 9) * 0.75 + (n - 0.5) * 0.12;
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i] * (1 - t) + vr * t;
      img.data[i + 1] = img.data[i + 1] * (1 - t) + vg * t;
      img.data[i + 2] = img.data[i + 2] * (1 - t) + vb * t;
    }
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function valueNoise(seed: number) {
  const perm = new Uint8Array(512);
  let s = seed;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const p = Array.from({ length: 256 }, (_, i) => i).sort(() => rand() - 0.5);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const grid = (x: number, y: number) => perm[(perm[x & 255] + y) & 511] / 255;
  return (x: number, y: number) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const u = xf * xf * (3 - 2 * xf);
    const w = yf * yf * (3 - 2 * yf);
    const a = grid(xi, yi) + (grid(xi + 1, yi) - grid(xi, yi)) * u;
    const b = grid(xi, yi + 1) + (grid(xi + 1, yi + 1) - grid(xi, yi + 1)) * u;
    return a + (b - a) * w;
  };
}

function fbm(n: (x: number, y: number) => number, x: number, y: number) {
  let v = 0;
  let amp = 0.5;
  for (let o = 0; o < 4; o++) {
    v += n(x, y) * amp;
    x *= 2;
    y *= 2;
    amp /= 2;
  }
  return v;
}

/** Radial glow sprite texture. */
export function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

/** A laurel leaf: pointed ellipse with a slight curve. */
export function leafGeometry() {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.quadraticCurveTo(0.22, 0.35, 0.02, 1);
  s.quadraticCurveTo(-0.18, 0.35, 0, 0);
  const geo = new THREE.ShapeGeometry(s, 8);
  geo.translate(0, -0.5, 0);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.pow(pos.getY(i), 2) * 0.25 - Math.abs(pos.getX(i)) * 0.3);
  geo.computeVertexNormals();
  return geo;
}

export function disposeScene(scene: THREE.Object3D) {
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    m.geometry?.dispose();
    const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
    for (const mat of mats) {
      for (const val of Object.values(mat)) if (val instanceof THREE.Texture) val.dispose();
      mat.dispose();
    }
  });
}

/** Run `frame` while visible on screen and the tab is in the foreground. */
export function visibleLoop(el: HTMLElement, frame: (dt: number, t: number) => void) {
  let raf = 0;
  let onScreen = true;
  let last = performance.now();
  const start = last;
  const tick = (now: number) => {
    raf = requestAnimationFrame(tick);
    if (!onScreen || document.hidden) return void (last = now);
    frame(Math.min(0.05, (now - last) / 1000), (now - start) / 1000);
    last = now;
  };
  const io = new IntersectionObserver(([e]) => (onScreen = e.isIntersecting));
  io.observe(el);
  raf = requestAnimationFrame(tick);
  return () => {
    cancelAnimationFrame(raf);
    io.disconnect();
  };
}
