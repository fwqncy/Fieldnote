// Constellation: the note graph as a night sky inside an armillary sphere.
// 3D force layout, stars sized by links, CSS2D labels in the UI font.

import gsap from 'gsap';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { useTheme } from '../theme/ThemeProvider';
import { cssColor, disposeScene, glowTexture, visibleLoop } from './three-utils';

export type GraphNode = { id: string; title: string; kind: 'note' | 'tag' | 'missing'; degree: number };
export type GraphLink = { source: string; target: string };

type Props = {
  nodes: GraphNode[];
  links: GraphLink[];
  focus?: string;
  highlight?: string;
  onOpen: (node: GraphNode) => void;
  onHover?: (node: GraphNode | null) => void;
  /** Small embedded preview: no wheel zoom (so the page scrolls), fewer labels. */
  compact?: boolean;
};

export function GraphScene({ nodes, links, focus, highlight, onOpen, onHover, compact }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const { tokens, reduceMotion } = useTheme();
  const api = useRef<{ recolor: () => void; setHot: (id: string | null) => void; fly: (id: string) => void } | null>(null);
  const handlers = useRef({ onOpen, onHover });
  handlers.current = { onOpen, onHover };

  useEffect(() => {
    const el = host.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.style.display = 'block';
    el.appendChild(renderer.domElement);
    const labels = new CSS2DRenderer();
    labels.domElement.style.position = 'absolute';
    labels.domElement.style.inset = '0';
    labels.domElement.style.pointerEvents = 'none';
    el.appendChild(labels.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 2000);
    camera.position.set(0, 40, 160);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enableZoom = !compact;
    controls.dampingFactor = 0.08;
    controls.autoRotate = !reduceMotion;
    controls.autoRotateSpeed = 0.35;
    controls.minDistance = 20;
    controls.maxDistance = 420;

    // ── layout ──
    const n = nodes.length;
    const idx = new Map(nodes.map((nd, i) => [nd.id, i]));
    const edges = links.map((l) => [idx.get(l.source)!, idx.get(l.target)!] as const).filter(([a, b]) => a !== undefined && b !== undefined);
    const pos = new Float32Array(n * 3);
    const vel = new Float32Array(n * 3);
    const R = 30 + Math.sqrt(n) * 9;
    nodes.forEach((_, i) => {
      // Fibonacci sphere for an even, deterministic start.
      const y = 1 - (i / Math.max(1, n - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const th = i * 2.399963;
      pos[i * 3] = Math.cos(th) * r * R;
      pos[i * 3 + 1] = y * R;
      pos[i * 3 + 2] = Math.sin(th) * r * R;
    });
    let alpha = 1;
    const step = () => {
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          let dx = pos[i * 3] - pos[j * 3];
          let dy = pos[i * 3 + 1] - pos[j * 3 + 1];
          let dz = pos[i * 3 + 2] - pos[j * 3 + 2];
          const d2 = Math.max(36, dx * dx + dy * dy + dz * dz);
          const f = (900 / d2) * alpha;
          dx *= f;
          dy *= f;
          dz *= f;
          vel[i * 3] += dx;
          vel[i * 3 + 1] += dy;
          vel[i * 3 + 2] += dz;
          vel[j * 3] -= dx;
          vel[j * 3 + 1] -= dy;
          vel[j * 3 + 2] -= dz;
        }
      }
      for (const [a, b] of edges) {
        const dx = pos[b * 3] - pos[a * 3];
        const dy = pos[b * 3 + 1] - pos[a * 3 + 1];
        const dz = pos[b * 3 + 2] - pos[a * 3 + 2];
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.01;
        const f = ((d - 22) / d) * 0.04 * alpha;
        vel[a * 3] += dx * f;
        vel[a * 3 + 1] += dy * f;
        vel[a * 3 + 2] += dz * f;
        vel[b * 3] -= dx * f;
        vel[b * 3 + 1] -= dy * f;
        vel[b * 3 + 2] -= dz * f;
      }
      for (let i = 0; i < n * 3; i++) {
        // Gravity cools with the other forces, so the settled shape holds;
        // the clamp stops near-coincident starts from flinging nodes away.
        vel[i] = Math.max(-6, Math.min(6, (vel[i] - pos[i] * 0.006 * alpha) * 0.82));
        pos[i] += vel[i];
      }
      alpha = Math.max(0, alpha * 0.985);
    };
    for (let k = 0; k < 220; k++) step();
    const dists = Array.from({ length: n }, (_, i) => Math.hypot(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2])).sort((a, b) => a - b);
    const radius = Math.max(20, dists[Math.floor(dists.length * 0.9)] ?? 20);
    // Start zoomed in on the cluster.
    camera.position.set(0, radius * 0.3, radius * 1.45 + 12);
    camera.far = Math.max(2000, radius * 20);
    camera.updateProjectionMatrix();
    controls.minDistance = Math.max(8, radius * 0.25);
    controls.maxDistance = radius * 6 + 100;

    // ── stars: one additive glow sprite per note, sized by its links ──
    const glow = glowTexture();
    const stars = new THREE.Group();
    const sprites = nodes.map((nd, i) => {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      sprite.scale.setScalar(nd.kind === 'tag' ? 6 : 8 + Math.min(16, Math.sqrt(nd.degree) * 5));
      sprite.position.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
      sprite.userData.i = i;
      stars.add(sprite);
      return sprite;
    });
    scene.add(stars);

    // ── lines ──
    const linePos = new Float32Array(edges.length * 6);
    const lineCol = new Float32Array(edges.length * 6);
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
    lineGeo.setAttribute('color', new THREE.BufferAttribute(lineCol, 3));
    const lines = new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
    scene.add(lines);
    const syncLines = () => {
      edges.forEach(([a, b], k) => {
        linePos.set(pos.subarray(a * 3, a * 3 + 3), k * 6);
        linePos.set(pos.subarray(b * 3, b * 3 + 3), k * 6 + 3);
      });
      lineGeo.attributes.position.needsUpdate = true;
      lineGeo.computeBoundingSphere();
      sprites.forEach((sp, i) => sp.position.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]));
    };
    syncLines();

    // ── armillary sphere & sky ──
    const armillary = new THREE.Group();
    const ringMat = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.22 });
    const circle = (r: number) => new THREE.BufferGeometry().setFromPoints(Array.from({ length: 129 }, (_, i) => new THREE.Vector3(Math.cos((i / 128) * Math.PI * 2) * r, 0, Math.sin((i / 128) * Math.PI * 2) * r)));
    const ringR = radius * 1.35 + 10;
    [0, Math.PI / 2, Math.PI / 2.6, -Math.PI / 5].forEach((rot, i) => {
      const loop = new THREE.LineLoop(circle(ringR), ringMat);
      if (i === 1) loop.rotation.x = rot;
      else if (i > 1) loop.rotation.set(rot, 0, rot / 2);
      armillary.add(loop);
    });
    // Zodiac ticks on the ecliptic ring.
    const ticks: THREE.Vector3[] = [];
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      const len = i % 6 === 0 ? 6 : 2.5;
      ticks.push(new THREE.Vector3(Math.cos(a) * ringR, 0, Math.sin(a) * ringR), new THREE.Vector3(Math.cos(a) * (ringR + len), 0, Math.sin(a) * (ringR + len)));
    }
    armillary.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(ticks), ringMat));
    scene.add(armillary);

    const skyCount = 1600;
    const skyPos = new Float32Array(skyCount * 3);
    for (let i = 0; i < skyCount; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(500 + Math.random() * 400);
      skyPos.set([v.x, v.y, v.z], i * 3);
    }
    const skyGeo = new THREE.BufferGeometry();
    skyGeo.setAttribute('position', new THREE.BufferAttribute(skyPos, 3));
    const sky = new THREE.Points(skyGeo, new THREE.PointsMaterial({ size: 1.4, sizeAttenuation: false, transparent: true, opacity: 0.5, depthWrite: false }));
    scene.add(sky);

    // ── labels ──
    const labelEls = nodes.map((nd, i) => {
      const div = document.createElement('div');
      div.className = 'fn-graph-label';
      div.textContent = nd.kind === 'tag' ? `#${nd.title}` : nd.title;
      if (nd.kind === 'tag') div.dataset.tag = '1';
      const obj = new CSS2DObject(div);
      obj.center.set(0.5, -0.9);
      sprites[i].add(obj);
      return { div, obj };
    });

    const neighbours = nodes.map(() => new Set<number>());
    edges.forEach(([a, b]) => (neighbours[a].add(b), neighbours[b].add(a)));

    // ── colour & highlight ──
    let hot: number | null = null;
    const recolor = () => {
      const accent = cssColor('accent', '#e8b224');
      const tagC = cssColor('ground-ink', '#7f9cf5');
      const faint = cssColor('text-faint', '#666');
      const text = cssColor('text', '#eee');
      const lineBase = cssColor('accent-ink', '#e8b224').multiplyScalar(0.35);
      const near = hot === null ? null : neighbours[hot];
      const c = new THREE.Color();
      nodes.forEach((nd, i) => {
        if (nd.kind === 'tag') c.copy(tagC);
        else if (nd.kind === 'missing') c.copy(faint);
        else c.copy(text).lerp(accent, Math.min(1, nd.degree / 5));
        if (near && i !== hot && !near.has(i)) c.multiplyScalar(0.18);
        if (i === hot) c.copy(accent).multiplyScalar(1.3);
        (sprites[i].material as THREE.SpriteMaterial).color.copy(c);
        labelEls[i].div.dataset.hot = i === hot ? '1' : '0';
        labelEls[i].div.dataset.dim = near && i !== hot && !near.has(i) ? '1' : '0';
        // Keep the sky readable: only label well-linked stars until hovered.
        labelEls[i].obj.visible = (compact ? nd.kind === 'note' && nd.degree >= 5 : n < 60 || nd.degree >= 2) || i === hot || !!near?.has(i);
      });
      edges.forEach(([a, b], k) => {
        const lit = hot !== null && (a === hot || b === hot);
        c.copy(lit ? accent : lineBase);
        if (hot !== null && !lit) c.multiplyScalar(0.25);
        lineCol.set([c.r, c.g, c.b, c.r, c.g, c.b], k * 6);
      });
      lineGeo.attributes.color.needsUpdate = true;
      ringMat.color.copy(accent);
      (sky.material as THREE.PointsMaterial).color.copy(text);
    };

    const setHot = (id: string | null) => {
      const i = id === null ? null : idx.get(id) ?? null;
      if (i === hot) return;
      hot = i;
      recolor();
      handlers.current.onHover?.(i === null ? null : nodes[i]);
    };

    const fly = (id: string) => {
      const i = idx.get(id);
      if (i === undefined) return;
      const target = new THREE.Vector3(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
      const dir = camera.position.clone().sub(controls.target).normalize();
      const dest = target.clone().add(dir.multiplyScalar(Math.max(60, radius * 0.9)));
      controls.autoRotate = false;
      const d = reduceMotion ? 0 : 1.4;
      gsap.to(controls.target, { x: target.x, y: target.y, z: target.z, duration: d, ease: 'power3.inOut' });
      gsap.to(camera.position, { x: dest.x, y: dest.y, z: dest.z, duration: d, ease: 'power3.inOut' });
      setHot(id);
    };
    api.current = { recolor, setHot, fly };

    // ── picking ──
    const ray = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const pick = (e: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(mouse, camera);
      const hit = ray.intersectObjects(sprites, false)[0];
      return hit ? (hit.object.userData.i as number) : null;
    };
    let down = { x: 0, y: 0 };
    const onMove = (e: PointerEvent) => {
      const i = pick(e);
      renderer.domElement.style.cursor = i === null ? 'grab' : 'pointer';
      setHot(i === null ? null : nodes[i].id);
    };
    const onDown = (e: PointerEvent) => (down = { x: e.clientX, y: e.clientY });
    const onUp = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
      const i = pick(e);
      if (i !== null) handlers.current.onOpen(nodes[i]);
    };
    renderer.domElement.addEventListener('pointermove', onMove);
    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointerup', onUp);
    controls.addEventListener('start', () => (controls.autoRotate = false));

    const resize = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      renderer.setSize(w, h);
      labels.setSize(w, h);
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();
    recolor();

    if (!reduceMotion) {
      gsap.from(camera.position, { z: camera.position.z * 1.25, duration: 1.4, ease: 'power3.out' });
      gsap.from(armillary.scale, { x: 0.6, y: 0.6, z: 0.6, duration: 2.2, ease: 'power3.out' });
    }

    const stop = visibleLoop(el, (dt) => {
      if (alpha > 0.002) {
        step();
        syncLines();
      }
      if (!reduceMotion) {
        armillary.rotation.y += dt * 0.03;
        armillary.children[1].rotation.z += dt * 0.05;
      }
      controls.update();
      renderer.render(scene, camera);
      labels.render(scene, camera);
    });

    return () => {
      stop();
      ro.disconnect();
      controls.dispose();
      gsap.killTweensOf([camera.position, controls.target, armillary.scale]);
      disposeScene(scene);
      renderer.dispose();
      renderer.domElement.remove();
      labels.domElement.remove();
      api.current = null;
    };
  }, [nodes, links, reduceMotion, compact]);

  useEffect(() => api.current?.recolor(), [tokens]);
  useEffect(() => {
    if (focus) {
      const t = setTimeout(() => api.current?.fly(focus), reduceMotion ? 0 : 900);
      return () => clearTimeout(t);
    }
  }, [focus, nodes]);
  useEffect(() => {
    if (highlight !== undefined) api.current?.setHot(highlight || null);
  }, [highlight]);

  return <div ref={host} role="img" aria-label={`Constellation graph of ${nodes.length} notes and tags. ${compact ? "Open the Constellation page to explore it by keyboard." : "Use the list beside it to navigate by keyboard."}`} style={{ position: 'absolute', inset: 0, overflow: 'hidden' }} />;
}
