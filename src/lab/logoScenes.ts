// Four 3D takes on the pine-rings logo. Each runs in its own canvas and only while visible.
import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import logoSvg from '../../public/assets/icons/ArtLogo.svg?raw';
import { createLog, blobShadow } from './log';
import type { Ring } from './data';

// ---------- logo shapes: [core, middle, outer], centered, 1 unit = radius 1 ----------
function logoShapes(): THREE.Shape[][] {
  const data = new SVGLoader().parse(logoSvg);
  const rings = data.paths
    .filter((p) => (p.userData?.style?.fill ?? '').toLowerCase() === 'black')
    .map((p) => SVGLoader.createShapes(p));
  // SVG: 36x36, y down. Normalise to radius 1, y up.
  const m = new THREE.Matrix3().set(1 / 18, 0, -1, 0, -1 / 18, 1, 0, 0, 1);
  return rings.map((shapes) =>
    shapes.map((s) => {
      const pts = s.getPoints(64).map((p) => new THREE.Vector2(p.x, p.y).applyMatrix3(m));
      const shape = new THREE.Shape(pts);
      shape.holes = s.holes.map((h) => new THREE.Path(h.getPoints(64).map((p) => new THREE.Vector2(p.x, p.y).applyMatrix3(m))));
      return shape;
    }),
  );
}

function extrude(shapes: THREE.Shape[], depth: number, bevel = 0.02) {
  const g = new THREE.ExtrudeGeometry(shapes, {
    depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 4, curveSegments: 48,
  });
  g.translate(0, 0, -depth / 2);
  g.computeVertexNormals();
  return g;
}

// ---------- shared stage ----------
interface Stage {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  pointer: THREE.Vector2; // -1..1
  progress: number; // 0..1 how far the block has scrolled through the screen
}

function makeStage(canvas: HTMLCanvasElement, fov = 30): Stage | null {
  let renderer: THREE.WebGLRenderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); } catch { return null; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 50);
  return { renderer, scene, camera, pointer: new THREE.Vector2(), progress: 0 };
}

type Variant = (st: Stage) => (t: number, dt: number) => void;

// 1. Burned into a pine slice: the logo as a brand on wood. Cursor is a raking light.
const burned: Variant = (st) => {
  const { scene, camera } = st;
  scene.environmentIntensity = 0.3;
  camera.position.set(0, 3.2, 2.3); camera.lookAt(0, 0, 0);
  scene.add(new THREE.HemisphereLight(0xe4ebe4, 0x5b4632, 0.9));
  const light = new THREE.DirectionalLight(0xfff0d8, 3.2);
  scene.add(light);
  // plain wood, 9 rings, no knots
  const rings: Ring[] = Array.from({ length: 9 }, (_, i) => ({ year: i, r0: 0.07 + (0.93 * i) / 9, r1: 0.07 + (0.93 * (i + 1)) / 9, count: 1, partial: 1 }));
  const log = createLog({ rings, knots: [], height: 0.22, cracks: false, micro: 4 });
  scene.add(log.group);
  const sh = blobShadow(3.4, 0.4); sh.position.y = -0.112; scene.add(sh);
  // burned logo
  const burn = new THREE.MeshStandardMaterial({ color: 0x3a2112, roughness: 0.95, transparent: true, opacity: 0.88 });
  const logo = new THREE.Group();
  logoShapes().forEach((sh) => {
    const m = new THREE.Mesh(new THREE.ShapeGeometry(sh, 48), burn);
    logo.add(m);
  });
  logo.rotation.x = -Math.PI / 2;
  logo.scale.setScalar(0.52);
  logo.position.y = 0.111;
  scene.add(logo);
  return () => {
    light.position.set(st.pointer.x * 3, 1.6, -st.pointer.y * 3 + 0.5);
    const r = st.progress - 0.5;
    log.group.rotation.y = r * 0.6;
    logo.rotation.z = r * 0.6;
    sh.rotation.z = r * 0.6;
  };
};

// 2. Cast in resin (живица): translucent amber, the pine's own material.
const resin: Variant = (st) => {
  const { scene, camera } = st;
  scene.environmentIntensity = 1.1;
  camera.position.set(0, 0.4, 6.2); camera.lookAt(0, 0, 0);
  const key = new THREE.DirectionalLight(0xffffff, 2.5); key.position.set(-2, 3, 3); scene.add(key);
  scene.add(new THREE.AmbientLight(0xffffff, 0.3));
  // something behind to refract: a few soft stripes like trunks in the fog
  const back = new THREE.Group();
  for (let i = -4; i <= 4; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.16 + (i % 2) * 0.08, 8), new THREE.MeshBasicMaterial({ color: 0x8e9a90, transparent: true, opacity: 0.55 }));
    m.position.set(i * 0.62 + 0.2, 0, -2.2);
    back.add(m);
  }
  scene.add(back);
  const amber = new THREE.MeshPhysicalMaterial({
    color: 0xffd08a, transmission: 1, thickness: 0.35, ior: 1.54, roughness: 0.06,
    attenuationColor: new THREE.Color(0xe08a1e), attenuationDistance: 1.4, clearcoat: 1, clearcoatRoughness: 0.05,
    specularIntensity: 1,
  });
  const logo = new THREE.Group();
  logoShapes().forEach((sh) => logo.add(new THREE.Mesh(extrude(sh, 0.32, 0.05), amber)));
  // a pine needle trapped inside the core, like an insect in amber
  const needle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.004, 0.5, 6), new THREE.MeshStandardMaterial({ color: 0x2f3d22, roughness: 0.6 }));
  needle.rotation.z = 1.1; needle.rotation.x = 0.3; needle.position.set(0.05, 0.02, 0);
  logo.add(needle);
  logo.scale.setScalar(1.0);
  scene.add(logo);
  return (t) => {
    logo.rotation.y = st.pointer.x * 0.6 + Math.sin(t * 0.0004) * 0.15;
    logo.rotation.x = -st.pointer.y * 0.35;
    back.position.x = -st.pointer.x * 0.3;
  };
};

// 3. Growth: the rings are laid down one by one, like a tree adds a ring a year. Intro/loader.
const growth: Variant = (st) => {
  const { scene, camera } = st;
  scene.environmentIntensity = 0.5;
  camera.position.set(0, 2.6, 3.6); camera.lookAt(0, -0.1, 0);
  scene.add(new THREE.HemisphereLight(0xe4ebe4, 0x5b4632, 1.2));
  const key = new THREE.DirectionalLight(0xfff1dc, 2.6); key.position.set(-2, 4, 2); scene.add(key);
  const colors = [0x9a5a2e, 0xc98f58, 0xe6c896];
  const parts = logoShapes().map((sh, i) => {
    const m = new THREE.Mesh(extrude(sh, 0.18, 0.025), new THREE.MeshStandardMaterial({ color: colors[i], roughness: 0.7 }));
    m.rotation.x = -Math.PI / 2;
    scene.add(m);
    return m;
  });
  const sh = blobShadow(3, 0.35); sh.position.y = -0.12; scene.add(sh);
  const cycle = 4200;
  return (t) => {
    const k = (t % cycle) / cycle;
    parts.forEach((m, i) => {
      const start = 0.08 + i * 0.2;
      const p = THREE.MathUtils.clamp((k - start) / 0.22, 0, 1);
      const e = 1 - Math.pow(1 - p, 3);
      const out = THREE.MathUtils.clamp((k - 0.88) / 0.1, 0, 1);
      const s = (0.86 + 0.14 * e) * (1 - out * 0.1);
      m.scale.set(s, s, Math.max(0.001, e * (1 - out)));
      m.position.y = -0.09 + 0.09 * e;
      m.visible = e > 0.001 && out < 1;
    });
    scene.rotation.y = st.pointer.x * 0.25;
  };
};

// 4. Exploded: core, ring, ring lifted apart. Shows how the mark is built; scroll drives it.
const layers: Variant = (st) => {
  const { scene, camera } = st;
  scene.environmentIntensity = 0.45;
  camera.position.set(3.2, 3.0, 3.2); camera.lookAt(0, 0.25, 0);
  scene.add(new THREE.HemisphereLight(0xe8eee8, 0x6b5640, 1.1));
  const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(-1, 5, 2); scene.add(key);
  const mats = [0x1f2b24, 0x44603e, 0x9fb59a].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55 }));
  const parts = logoShapes().map((sh, i) => {
    const m = new THREE.Mesh(extrude(sh, 0.09, 0.015), mats[i]);
    m.rotation.x = -Math.PI / 2;
    scene.add(m);
    return m;
  });
  const sh = blobShadow(3.2, 0.3); sh.position.y = -0.06; scene.add(sh);
  return () => {
    const e = THREE.MathUtils.smoothstep(st.progress, 0.25, 0.7);
    parts.forEach((m, i) => (m.position.y = (2 - i) * 0.42 * e));
    scene.rotation.y = st.pointer.x * 0.3 + e * 0.4;
  };
};

const VARIANTS: Record<string, Variant> = { burned, resin, growth, layers };

export function startLogoLab() {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll<HTMLCanvasElement>('canvas[data-variant]').forEach((canvas) => {
    const st = makeStage(canvas);
    if (!st) { canvas.closest('figure')?.classList.add('no-gl'); return; }
    const tick = VARIANTS[canvas.dataset.variant!](st);
    let on = false;
    const resize = () => {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      st.renderer.setSize(w, h, false);
      st.camera.aspect = w / h; st.camera.updateProjectionMatrix();
    };
    new ResizeObserver(resize).observe(canvas); resize();
    new IntersectionObserver(([e]) => { on = e.isIntersecting; }).observe(canvas);
    const target = new THREE.Vector2();
    canvas.addEventListener('pointermove', (e) => {
      const b = canvas.getBoundingClientRect();
      target.set(((e.clientX - b.left) / b.width) * 2 - 1, -(((e.clientY - b.top) / b.height) * 2 - 1));
    });
    canvas.addEventListener('pointerleave', () => target.set(0, 0));
    let last = performance.now();
    let frozen = false;
    const loop = (t: number) => {
      requestAnimationFrame(loop);
      if (!on) return;
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      st.pointer.lerp(target, 1 - Math.exp(-5 * dt));
      const b = canvas.getBoundingClientRect();
      st.progress = THREE.MathUtils.clamp(1 - (b.top + b.height) / (innerHeight + b.height), 0, 1);
      if (reduce && frozen) return;
      tick(reduce ? 3000 : t, dt);
      st.renderer.render(st.scene, st.camera);
      frozen = reduce;
    };
    requestAnimationFrame(loop);
  });
}
