// Apollo's sun crown, a fluted Ionic column in marble, and laurel leaves
// drifting through gold dust. Three.js for the scene, GSAP for choreography.

import gsap from 'gsap';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useTheme } from '../theme/ThemeProvider';
import { cssColor, disposeScene, glowTexture, leafGeometry, marbleTexture, visibleLoop } from './three-utils';

type Props = { height?: number | string; leaves?: boolean; variant?: 'hero' | 'quiet' };

export function HeroScene({ height = 420, leaves = true, variant = 'hero' }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const { tokens, reduceMotion, dark } = useTheme();
  const api = useRef<{ recolor: () => void } | null>(null);

  useEffect(() => {
    const el = host.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.domElement.setAttribute('aria-hidden', 'true');
    renderer.domElement.style.display = 'block';
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(0, 0.2, 13);
    camera.lookAt(0.6, 0, 0);

    // ── light ──
    const ambient = new THREE.AmbientLight(0xffffff, 0.35);
    const key = new THREE.DirectionalLight(0xfff1d6, 2.2);
    key.position.set(-4, 6, 6);
    const rim = new THREE.DirectionalLight(0x4466ff, 1.4);
    rim.position.set(6, 2, -4);
    const sunLight = new THREE.PointLight(0xffc040, 30, 14, 1.6);
    scene.add(ambient, key, rim, sunLight);

    // ── sun crown ──
    const crown = new THREE.Group();
    const gold = new THREE.MeshStandardMaterial({ metalness: 0.85, roughness: 0.32, emissiveIntensity: 0.35 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.07, 16, 96), gold);
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.025, 8, 96), gold);
    crown.add(ring, ring2);
    const rayGeo = new THREE.ConeGeometry(0.16, 1, 4, 1);
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const len = i % 2 ? 1.0 : 1.7;
      const ray = new THREE.Mesh(rayGeo, gold);
      ray.scale.set(1, len, 0.45);
      ray.position.set(Math.cos(a) * (1.6 + len / 2), Math.sin(a) * (1.6 + len / 2), 0);
      ray.rotation.z = a - Math.PI / 2;
      crown.add(ray);
    }
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1.26, 64), new THREE.MeshBasicMaterial());
    disc.position.z = -0.05;
    crown.add(disc);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.55 }));
    glow.scale.set(9, 9, 1);
    glow.position.z = -0.4;
    crown.add(glow);
    crown.position.set(2.7, 0.9, -2.2);
    sunLight.position.set(2.7, 0.9, 0.5);
    scene.add(crown);

    // ── Ionic column ──
    const column = new THREE.Group();
    const marble = new THREE.MeshStandardMaterial({ map: marbleTexture(dark ? '#d9d3c6' : '#efeadf', '#7d776c'), roughness: 0.55, metalness: 0.02 });
    const shaftGeo = new THREE.CylinderGeometry(0.52, 0.6, 6.2, 96, 24, false);
    const p = shaftGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i);
      const r = Math.hypot(x, z);
      if (r < 0.3) continue;
      const ang = Math.atan2(z, x);
      const flute = 1 - 0.06 * Math.pow(Math.max(0, Math.cos(ang * 24)), 2);
      p.setX(i, x * flute);
      p.setZ(i, z * flute);
    }
    shaftGeo.computeVertexNormals();
    const shaft = new THREE.Mesh(shaftGeo, marble);
    const abacus = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.18, 1.3), marble);
    abacus.position.y = 3.42;
    const echinus = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.55, 0.22, 64), marble);
    echinus.position.y = 3.2;
    for (const side of [-1, 1]) {
      const volute = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.09, 16, 48), marble);
      volute.position.set(side * 0.78, 3.12, 0.38);
      const volute2 = volute.clone();
      volute2.position.z = -0.38;
      column.add(volute, volute2);
    }
    const torus = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.1, 16, 64), marble);
    torus.rotation.x = Math.PI / 2;
    torus.position.y = -3.05;
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.26, 1.6), marble);
    plinth.position.y = -3.3;
    column.add(shaft, abacus, echinus, torus, plinth);
    column.position.set(4.2, -0.6, 0.6);
    column.rotation.y = 0.35;
    scene.add(column);

    // A fallen drum, for ruin.
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 0.9, 96, 1), marble);
    drum.rotation.z = Math.PI / 2.2;
    drum.rotation.y = 0.7;
    drum.position.set(-3.6, -3.25, 1.2);
    scene.add(drum);

    // ── leaves ──
    const leafCount = variant === 'hero' ? 70 : 34;
    const leafMat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.6, metalness: 0.05 });
    const leafMesh = new THREE.InstancedMesh(leafGeometry(), leafMat, leafCount);
    const leafState = Array.from({ length: leafCount }, () => ({
      pos: new THREE.Vector3((Math.random() - 0.5) * 18, (Math.random() - 0.5) * 9, (Math.random() - 0.5) * 6),
      rot: new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6),
      spin: new THREE.Vector3((Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 1.2),
      fall: 0.25 + Math.random() * 0.45,
      sway: Math.random() * Math.PI * 2,
      scale: 0.28 + Math.random() * 0.32,
      shade: Math.random(),
    }));
    const dummy = new THREE.Object3D();
    const leafColor = new THREE.Color();
    const placeLeaves = (dt: number, t: number) => {
      leafState.forEach((l, i) => {
        l.pos.y -= l.fall * dt;
        l.pos.x += Math.sin(t * 0.7 + l.sway) * 0.25 * dt + 0.08 * dt;
        l.rot.x += l.spin.x * dt;
        l.rot.y += l.spin.y * dt;
        l.rot.z += l.spin.z * dt;
        if (l.pos.y < -5.5) {
          l.pos.y = 5.5;
          l.pos.x = (Math.random() - 0.5) * 18;
        }
        dummy.position.copy(l.pos);
        dummy.rotation.copy(l.rot);
        dummy.scale.setScalar(l.scale);
        dummy.updateMatrix();
        leafMesh.setMatrixAt(i, dummy.matrix);
      });
      leafMesh.instanceMatrix.needsUpdate = true;
    };
    leafMesh.visible = leaves;
    scene.add(leafMesh);

    // ── gold dust ──
    const dustCount = 420;
    const dustGeo = new THREE.BufferGeometry();
    const dustPos = new Float32Array(dustCount * 3);
    // Scatter dust everywhere except across the sun's face, as seen from the camera.
    const placeDust = () => {
      const reach = 3.9 * crown.scale.x;
      for (let i = 0; i < dustCount; i++) {
        let x = 0, y = 0, z = 0;
        for (let tries = 0; tries < 30; tries++) {
          x = (Math.random() - 0.5) * 20;
          y = (Math.random() - 0.5) * 10;
          z = (Math.random() - 0.5) * 8;
          const t = (crown.position.z - camera.position.z) / (z - camera.position.z);
          const qx = camera.position.x + (x - camera.position.x) * t;
          const qy = camera.position.y + (y - camera.position.y) * t;
          if (Math.hypot(qx - crown.position.x, qy - crown.position.y) > reach) break;
        }
        dustPos.set([x, y, z], i * 3);
      }
      dustGeo.attributes.position.needsUpdate = true;
    };
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ size: 0.035, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, map: glowTexture() }));
    scene.add(dust);
    placeDust();

    // ── theme ──
    const recolor = () => {
      const accent = cssColor('accent', '#e8b224');
      const ground = cssColor('ground', '#0c1736');
      gold.color.copy(accent);
      gold.emissive.copy(accent).multiplyScalar(0.35);
      (disc.material as THREE.MeshBasicMaterial).color.copy(ground).multiplyScalar(0.5).lerp(accent, 0.28);
      glow.material.color.copy(accent);
      sunLight.color.copy(accent);
      rim.color.copy(ground).offsetHSL(0, 0.2, 0.35);
      (dust.material as THREE.PointsMaterial).color.copy(accent);
      const leafBase = cssColor('leaf', '#6f8f5e');
      for (let i = 0; i < leafCount; i++) {
        leafColor.copy(leafBase).offsetHSL((leafState[i].shade - 0.5) * 0.05, 0, (leafState[i].shade - 0.5) * 0.18);
        if (leafState[i].shade > 0.86) leafColor.copy(accent);
        leafMesh.setColorAt(i, leafColor);
      }
      if (leafMesh.instanceColor) leafMesh.instanceColor.needsUpdate = true;
      ambient.intensity = document.documentElement.dataset.theme === 'light' ? 0.9 : 0.35;
      renderer.render(scene, camera);
    };
    api.current = { recolor };

    // ── size ──
    const resize = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      camera.aspect = w / Math.max(1, h);
      // Narrow screens: pull back and centre the crown.
      const narrow = w < 640;
      camera.position.z = narrow ? 17 : 13;
      crown.position.x = narrow ? 0.6 : 2.7;
      crown.position.y = narrow ? 3.4 : 0.9;
      crown.scale.setScalar(narrow ? 0.75 : 1);
      column.position.x = narrow ? 3.4 : 4.6;
      camera.updateProjectionMatrix();
      placeDust();
      renderer.render(scene, camera);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();
    placeLeaves(0, 0);
    recolor();

    // ── motion ──
    const cleanups: (() => void)[] = [];
    if (!reduceMotion) {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      tl.from(crown.scale, { x: 0.4, y: 0.4, z: 0.4, duration: 1.6 })
        .from(crown.rotation, { z: -1.2, duration: 2.2 }, 0)
        .from(column.position, { y: -9, duration: 1.8, ease: 'power4.out' }, 0.15)
        .from(drum.position, { x: -9, duration: 1.6 }, 0.4)
        .from(camera.position, { y: 1.6, duration: 2.4, ease: 'power2.out' }, 0);
      cleanups.push(() => tl.kill());

      const toX = gsap.quickTo(camera.position, 'x', { duration: 1.2, ease: 'power3.out' });
      const toY = gsap.quickTo(camera.position, 'y', { duration: 1.4, ease: 'power3.out' });
      const onMove = (e: PointerEvent) => {
        const r = el.getBoundingClientRect();
        toX(((e.clientX - r.left) / r.width - 0.5) * 0.9);
        toY(0.2 - ((e.clientY - r.top) / r.height - 0.5) * 0.6);
      };
      el.addEventListener('pointermove', onMove);
      cleanups.push(() => el.removeEventListener('pointermove', onMove));

      cleanups.push(
        visibleLoop(el, (dt, t) => {
          crown.rotation.z += dt * 0.06;
          glow.material.opacity = 0.5 + Math.sin(t * 1.3) * 0.08;
          column.rotation.y = 0.35 + Math.sin(t * 0.15) * 0.08;
          dust.position.y = Math.sin(t * 0.3) * 0.15;
          if (leafMesh.visible) placeLeaves(dt, t);
          camera.lookAt(0.6, 0, 0);
          renderer.render(scene, camera);
        }),
      );
    } else {
      camera.lookAt(0.6, 0, 0);
      renderer.render(scene, camera);
    }

    return () => {
      cleanups.forEach((f) => f());
      ro.disconnect();
      disposeScene(scene);
      renderer.dispose();
      renderer.domElement.remove();
      api.current = null;
    };
  }, [reduceMotion, leaves, variant, dark]);

  useEffect(() => {
    api.current?.recolor();
  }, [tokens]);

  return <div ref={host} style={{ position: 'absolute', inset: 0, height, overflow: 'hidden' }} />;
}
