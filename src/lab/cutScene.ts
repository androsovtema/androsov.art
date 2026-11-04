// Client side of /lab/srez: the 3D cut, linked with the HTML list.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createLog, blobShadow, type LogHandle } from './log';
import type { Ring, Knot, Side } from './data';

interface Payload {
  rings: Ring[];
  knots: Knot[];
  projects: { slug: string; title: string; href: string | null; dateLabel: string; side: Side }[];
}

const ease = (t: number) => 1 - Math.pow(1 - t, 3);

export function startCut() {
  const stage = document.getElementById('stage') as HTMLDivElement;
  const canvas = document.getElementById('disc') as HTMLCanvasElement;
  const labelsEl = document.getElementById('labels') as HTMLDivElement;
  const tip = document.getElementById('tip') as HTMLDivElement;
  const data: Payload = JSON.parse(document.getElementById('cut-data')!.textContent!);
  const params = new URLSearchParams(location.search);
  const showFps = params.has('fps');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobile = matchMedia('(max-width: 820px)').matches;

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch {
    return; // SVG stays
  }
  if (!renderer.getContext()) return;

  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.35;

  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 50);

  scene.add(new THREE.HemisphereLight(0xe4ebe4, 0x5b4632, 1.3));
  const key = new THREE.DirectionalLight(0xfff1dc, 2.6);
  key.position.set(-2.2, 4.0, 2.4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xd6e4ff, 0.6);
  rim.position.set(3, 1.5, -2);
  scene.add(rim);

  const engraving = params.get('style') === 'engraving';
  const log: LogHandle = createLog({ rings: data.rings, knots: data.knots, segments: mobile ? 140 : 240, style: engraving ? 'engraving' : 'wood' });
  const pivot = new THREE.Group();
  pivot.add(log.group);
  scene.add(pivot);
  const shadow = blobShadow(2.6, 0.5);
  shadow.position.y = -log.height / 2 - 0.002;
  pivot.add(shadow);

  // ---------- state with eased targets (render on demand) ----------
  const knotHi = data.knots.map(() => ({ v: 0, t: 0 }));
  const active = { v: 0, t: 0, ring: -1 };
  const side = { c: 0, ct: 0, o: 0, ot: 0 };
  const tilt = { x: 0, y: 0, tx: 0, ty: 0 };
  let grow = reduce ? 1 : 0.08;
  let growStart = -1;
  let needs = true;
  let hot = -1;

  // ---------- labels projected from 3D ----------
  const yearLabels = data.rings.map((r) => {
    const s = document.createElement('span');
    s.textContent = String(r.year);
    labelsEl.appendChild(s);
    return s;
  });
  const sideLabels = (['Client work', 'Self-initiated'] as const).map((t) => {
    const s = document.createElement('span');
    s.className = 'side';
    s.textContent = t;
    labelsEl.appendChild(s);
    return s;
  });

  const v3 = new THREE.Vector3();
  function project(p: THREE.Vector3) {
    v3.copy(p);
    log.group.localToWorld(v3);
    v3.project(camera);
    return { x: (v3.x * 0.5 + 0.5) * stage.clientWidth, y: (-v3.y * 0.5 + 0.5) * stage.clientHeight };
  }

  function placeLabels() {
    const front = -Math.PI / 2 - 0.05; // just to the left of the front crack
    let lastY = -1e9;
    // from the bark inwards, so the recent years win when space is tight
    for (let i = data.rings.length - 1; i >= 0; i--) {
      const r = data.rings[i];
      const w = (r.r0 + r.r1) / 2;
      const el = yearLabels[i];
      const p = project(log.fromPolar(front, Math.min(w, grow * 0.98)));
      const isActive = i === active.ring && active.t > 0;
      const fits = Math.abs(p.y - lastY) > 19;
      const show = r.r0 < grow && (fits || isActive);
      el.style.opacity = show ? '1' : '0';
      if (show) lastY = p.y;
      el.style.transform = `translate(calc(${p.x - 6}px - 100%), ${p.y - 8}px)`;
      el.classList.toggle('is-active', isActive);
    }
    const W = stage.clientWidth;
    const pr = project(log.fromPolar(0, 1.04));
    const rw = sideLabels[0].offsetWidth, lw = sideLabels[1].offsetWidth;
    sideLabels[0].style.transform = `translate(${Math.min(pr.x + 10, W - rw - 10)}px, ${pr.y - 9}px)`;
    const pl = project(log.fromPolar(Math.PI, 1.04));
    sideLabels[1].style.transform = `translate(${Math.max(pl.x - 10 - lw, 10)}px, ${pl.y - 9}px)`;
    sideLabels.forEach((s) => (s.style.opacity = grow > 0.98 && !mobile ? '1' : '0'));
  }

  // ---------- layout ----------
  let baseDist = 6;
  const logoMix = { v: 0, t: 0 };
  function placeCamera() {
    const L = THREE.MathUtils.smootherstep(logoMix.v, 0, 1);
    const elev = THREE.MathUtils.degToRad(THREE.MathUtils.lerp(mobile ? 50 : 46, 89.5, L));
    const dist = baseDist * (1 + 0.9 * L);
    camera.position.set(0, Math.sin(elev) * dist, Math.cos(elev) * dist);
    camera.lookAt(0, (mobile ? -0.05 : 0.02) * (1 - L), 0);
  }

  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // fit the disc (radius ~1.05) into the stage with some air
    const fitH = 1.05 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const fitW = fitH / Math.min(1, camera.aspect);
    const dist = Math.max(fitH * (mobile ? 1.12 : 1.3), fitW * (mobile ? 0.98 : 1.32));
    baseDist = dist;
    placeCamera();
    camera.updateProjectionMatrix();
    needs = true;
  }
  new ResizeObserver(resize).observe(stage);
  resize();

  // ---------- interaction ----------
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const items = new Map<string, HTMLElement>();
  document.querySelectorAll<HTMLElement>('[data-knot]').forEach((el) => items.set(el.dataset.knot!, el));

  function setHot(i: number, from: 'disc' | 'list', clientX?: number, clientY?: number) {
    if (i !== hot) {
      if (hot >= 0) {
        knotHi[hot].t = 0;
        items.get(data.knots[hot].slug)?.classList.remove('is-hot');
      }
      hot = i;
      if (i >= 0) {
        knotHi[i].t = 1;
        items.get(data.knots[i].slug)?.classList.add('is-hot');
      }
      stage.classList.toggle('is-hot', i >= 0 && from === 'disc');
      needs = true;
    }
    void clientX; void clientY;
    placeTip();
  }

  const leader = document.getElementById('leader') as unknown as SVGSVGElement;
  const leaderLine = leader.querySelector('line')!;
  function placeTip() {
    if (hot < 0) { tip.classList.remove('is-on'); leader.classList.remove('is-on'); return; }
    const k = data.knots[hot];
    const p = data.projects.find((x) => x.slug === k.slug)!;
    tip.innerHTML = `${p.title}<small>${p.dateLabel}</small>`;
    // from the knot tip, outwards from the center of the cut
    const end = project(log.fromPolar(k.angle, k.r1));
    const c = project(log.fromPolar(0, 0));
    let dx = end.x - c.x, dy = end.y - c.y;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;
    const W = stage.clientWidth, H = stage.clientHeight;
    // anchor outside the rim, so the label never sits on the wood or the bark
    // the silhouette edge along this direction: top rim or bottom rim, whichever sticks out more
    const topP = log.fromPolar(k.angle, 1.06);
    const botP = topP.clone(); botP.y = -log.height / 2;
    const a = project(topP), b = project(botP);
    const da = (a.x - c.x) * dx + (a.y - c.y) * dy, db = (b.x - c.x) * dx + (b.y - c.y) * dy;
    const edge = Math.max(da, db);
    const reach = mobile ? 12 : 22;
    let ax = c.x + dx * (edge + reach), ay = c.y + dy * (edge + reach);
    const right = dx >= 0;
    const tw = tip.offsetWidth || 140;
    ax = right ? Math.min(ax, W - tw - 8) : Math.max(ax, tw + 8);
    ay = Math.min(Math.max(ay, 30), H - 60);
    tip.style.transform = `translate(${right ? ax + 6 : ax - 6}px, ${ay - 12}px) translateX(${right ? '0' : '-100%'})`;
    tip.style.textAlign = right ? 'left' : 'right';
    leaderLine.setAttribute('x1', String(end.x)); leaderLine.setAttribute('y1', String(end.y));
    leaderLine.setAttribute('x2', String(ax)); leaderLine.setAttribute('y2', String(ay));
    tip.classList.add('is-on'); leader.classList.add('is-on');
  }

  function pickAt(clientX: number, clientY: number) {
    const b = canvas.getBoundingClientRect();
    ndc.set(((clientX - b.left) / b.width) * 2 - 1, -((clientY - b.top) / b.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObject(log.mesh, false)[0];
    if (!hit || hit.face?.materialIndex !== 1) return -1;
    const local = log.mesh.worldToLocal(hit.point.clone());
    return log.pickKnot(local);
  }

  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse') {
      const b = canvas.getBoundingClientRect();
      tilt.tx = ((e.clientY - b.top) / b.height - 0.5) * 0.08;
      tilt.ty = ((e.clientX - b.left) / b.width - 0.5) * 0.12;
      needs = true;
      setHot(pickAt(e.clientX, e.clientY), 'disc', e.clientX, e.clientY);
    }
  });
  canvas.addEventListener('pointerleave', () => { tilt.tx = tilt.ty = 0; setHot(-1, 'disc'); needs = true; });
  canvas.addEventListener('click', (e) => {
    const i = pickAt(e.clientX, e.clientY);
    if (i < 0) { setHot(-1, 'disc'); return; }
    const p = data.projects.find((x) => x.slug === data.knots[i].slug)!;
    // touch: first tap shows, second tap opens
    if (e.pointerType !== 'mouse' && hot !== i) {
      setHot(i, 'disc');
      const li = items.get(p.slug);
      if (li) window.scrollTo({ top: li.getBoundingClientRect().top + scrollY - stage.clientHeight - 40, behavior: reduce ? 'auto' : 'smooth' });
      return;
    }
    if (p.href) {
      if (p.href.startsWith('http')) window.open(p.href, '_blank', 'noopener');
      else location.href = p.href;
    } else {
      items.get(p.slug)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    }
  });

  items.forEach((el, slug) => {
    const i = data.knots.findIndex((k) => k.slug === slug);
    const on = () => setHot(i, 'list');
    const off = () => { if (hot === i) setHot(-1, 'list'); };
    el.addEventListener('pointerenter', on);
    el.addEventListener('pointerleave', off);
    el.addEventListener('focusin', on);
    el.addEventListener('focusout', off);
  });

  // halves
  const sidesEl = document.querySelector('.sides') as HTMLElement;
  const sideBtns = document.querySelectorAll<HTMLButtonElement>('.sides button');
  let sideSel: Side | null = null;
  sideBtns.forEach((b) => {
    b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', () => {
      const s = b.dataset.side as Side;
      sideSel = sideSel === s ? null : s;
      sideBtns.forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.side === sideSel)));
      side.ct = sideSel === 'own' ? 1 : 0; // dim client half
      side.ot = sideSel === 'client' ? 1 : 0; // dim own half
      document.querySelectorAll<HTMLElement>('.year li').forEach((li) => {
        li.style.opacity = sideSel && li.dataset.side !== sideSel ? '0.35' : '';
      });
      needs = true;
    });
  });

  // scroll: the year section in the middle of the screen lights its ring
  const sections = [...document.querySelectorAll<HTMLElement>('.year')];
  const io = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        const ring = Number((en.target as HTMLElement).dataset.ring);
        sections.forEach((s) => s.classList.toggle('is-active', s === en.target));
        active.ring = ring;
        active.t = 1;
        log.setActiveRing(ring, active.v);
        needs = true;
      }
    },
    { rootMargin: mobile ? '-55% 0px -35% 0px' : '-45% 0px -45% 0px' },
  );
  sections.forEach((s) => io.observe(s));
  // back at the top: no active ring
  const intro = document.querySelector('.intro')!;
  new IntersectionObserver(([en]) => {
    if (en.isIntersecting) { active.t = 0; sections.forEach((s) => s.classList.remove('is-active')); needs = true; }
  }, { rootMargin: '-40% 0px -40% 0px' }).observe(intro);

  // finale: as the contacts come up, the cut turns into the logo
  const foot = document.querySelector('.foot') as HTMLElement;
  const onScroll = () => {
    const top = foot.getBoundingClientRect().top;
    logoMix.t = THREE.MathUtils.clamp((innerHeight - top) / (innerHeight * 0.55), 0, 1);
    if (Math.abs(logoMix.t - logoMix.v) > 0.001) needs = true;
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // recording hook (?rec): screen position of a knot, for scripted demos
  if (params.has('rec')) {
    (window as any).__knotAt = (slug: string) => {
      const k = data.knots.find((x) => x.slug === slug)!;
      const pt = project(log.fromPolar(k.angle, (k.r0 + k.r1) / 2));
      const b = stage.getBoundingClientRect();
      return { x: pt.x + b.left, y: pt.y + b.top };
    };
  }

  // ---------- loop ----------
  const fpsEl = document.getElementById('fps')!;
  if (showFps) fpsEl.hidden = false;
  let frames = 0, fpsT = performance.now();
  let last = performance.now();
  let visible = true;
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) needs = true; }).observe(stage);

  function approach(cur: number, target: number, dt: number, speed = 10) {
    const k = 1 - Math.exp(-speed * dt);
    return cur + (target - cur) * k;
  }

  function frame(t: number) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    if (!visible) return;

    let moving = showFps;
    if (grow < 1) {
      if (growStart < 0) growStart = t;
      const p = Math.min(1, (t - growStart) / 2600);
      grow = 0.08 + 0.92 * ease(p);
      moving = true;
    }
    log.setGrow(grow);

    knotHi.forEach((k, i) => {
      if (Math.abs(k.t - k.v) > 0.002) { k.v = approach(k.v, k.t, dt, 12); moving = true; } else k.v = k.t;
      log.setKnotHi(i, k.v);
    });
    if (Math.abs(active.t - active.v) > 0.002) { active.v = approach(active.v, active.t, dt, 8); moving = true; } else active.v = active.t;
    log.setActiveRing(active.ring, active.v);
    for (const [a, b] of [['c', 'ct'], ['o', 'ot']] as const) {
      if (Math.abs(side[b] - side[a]) > 0.002) { side[a] = approach(side[a], side[b], dt, 8); moving = true; } else side[a] = side[b];
    }
    log.setSideHi(side.c, side.o);
    if (Math.abs(logoMix.t - logoMix.v) > 0.001) { logoMix.v = reduce ? logoMix.t : approach(logoMix.v, logoMix.t, dt, 6); moving = true; } else logoMix.v = logoMix.t;
    log.setLogo(THREE.MathUtils.smootherstep(logoMix.v, 0, 1));
    (shadow.material as THREE.MeshBasicMaterial).opacity = 1 - logoMix.v;
    labelsEl.style.opacity = String(1 - Math.min(1, logoMix.v * 2));
    sidesEl.style.opacity = String(1 - Math.min(1, logoMix.v * 2));
    sidesEl.style.visibility = logoMix.v > 0.5 ? 'hidden' : '';
    placeCamera();
    if (!reduce) {
      if (Math.abs(tilt.tx - tilt.x) + Math.abs(tilt.ty - tilt.y) > 0.0005) {
        tilt.x = approach(tilt.x, tilt.tx, dt, 4); tilt.y = approach(tilt.y, tilt.ty, dt, 4); moving = true;
      }
      pivot.rotation.x = tilt.x;
      pivot.rotation.z = -tilt.y * 0.4;
      pivot.rotation.y = tilt.y * 0.5;
    }

    if (moving || needs) {
      renderer.render(scene, camera);
      placeLabels();
      if (hot >= 0) placeTip();
      needs = false;
      if (!stage.classList.contains('is-3d')) stage.classList.add('is-3d');
    }

    if (showFps) {
      frames++;
      if (t - fpsT > 1000) {
        fpsEl.textContent = `${Math.round((frames * 1000) / (t - fpsT))} fps, dpr ${renderer.getPixelRatio()}`;
        frames = 0; fpsT = t;
      }
    }
  }

  // start growing only after fonts and first paint, so the HTML is the first thing people see
  const begin = () => requestAnimationFrame(frame);
  if (document.readyState === 'complete') begin();
  else addEventListener('load', begin, { once: true });
}
