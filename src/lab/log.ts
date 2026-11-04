// A pine log slice built from data: rings = years, knots = projects.
// Wood and bark are procedural (no textures), on top of MeshStandardMaterial lighting.
import * as THREE from 'three';
import { WOBBLE, outline, type Ring, type Knot } from './data';

export const MAX_RINGS = 16;
export const MAX_KNOTS = 16;
export const BARK_START = 0.972; // share of radius that is wood; the rest is bark

const NOISE = /* glsl */ `
vec3 _p3(vec3 x){ return mod(((x*34.0)+1.0)*x, 289.0); }
float snoise(vec2 v){
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz; x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = _p3(_p3(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m; m = m*m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
  vec3 g; g.x = a0.x * x0.x + h.x * x0.y; g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ s += a * snoise(p); p *= 2.03; a *= 0.5; } return s; }
`;

const SHARED = /* glsl */ `
uniform vec3 uWobble[4];
uniform float uGrow;
uniform float uTime;
uniform float uLogo;                   // 0..1: the cut turns into the 3-ring logo
varying vec3 vLocal;
float outlineF(float th){ float f = 1.0; for (int i = 0; i < 4; i++){ f += uWobble[i].y * sin(uWobble[i].x * th + uWobble[i].z); } return f; }
vec3 perturbN(vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection){
  vec3 vSigmaX = dFdx(surf_pos); vec3 vSigmaY = dFdy(surf_pos);
  vec3 R1 = cross(vSigmaY, surf_norm); vec3 R2 = cross(surf_norm, vSigmaX);
  float fDet = dot(vSigmaX, R1) * faceDirection;
  vec3 vGrad = sign(fDet) * (dHdxy.x * R1 + dHdxy.y * R2);
  return normalize(abs(fDet) * surf_norm - vGrad);
}
`;

const WOOD = /* glsl */ `
uniform float uRingR[${MAX_RINGS}];
uniform int uRingCount;
uniform vec4 uKnots[${MAX_KNOTS}];     // angle, r0, r1, side (0 client, 1 own)
uniform float uKnotHi[${MAX_KNOTS}];   // 0..1 highlight
uniform int uKnotCount;
uniform float uActiveRing;             // ring index, -1 none
uniform float uActiveAmt;
uniform vec2 uSideHi;                  // dim client / own halves
uniform float uBarkStart;
uniform float uCracks;                 // 0..1 draws radial checks
uniform float uMicro;                  // fine false rings inside a year (look only)
float wAlpha;

float wHeight; vec3 wColor; float wRough; vec3 wEmissive;

float angDiff(float a, float b){ float d = a - b; return atan(sin(d), cos(d)); }

float knotHW(float len, float t){
  float big = clamp(0.22 * len + 0.014, 0.019, 0.034);
  return big * (0.35 + 0.65 * t);
}

void woodSample(vec2 p){
  float th = atan(-p.y, p.x);          // p = (x, z); angle CCW from +x seen from above
  float rr = length(p) / outlineF(th);
  float edge = uGrow * uBarkStart;
  float px = fwidth(rr) * 1.2;          // one pixel, for anti-aliasing

  // bark rim on the cut face
  if (rr > edge) {
    float b = 0.5 + 0.5 * fbm(vec2(th * 34.0, rr * 50.0));
    vec3 barkIn = vec3(0.80, 0.62, 0.42);
    vec3 bark = mix(vec3(0.27, 0.18, 0.13), vec3(0.43, 0.27, 0.18), b);
    float cam = 1.0 - smoothstep(0.0, 0.007, rr - edge);
    wColor = mix(bark, barkIn, cam * 0.7);
    wHeight = -0.4 + 0.5 * b; wRough = 0.95; wEmissive = vec3(0.0);
    wAlpha = 1.0 - uLogo;
    return;
  }

  float w = rr / uBarkStart;
  float n1 = fbm(vec2(cos(th), sin(th)) * 1.7 + w * 1.3);
  w += 0.010 * n1 * smoothstep(0.0, 0.3, w) + 0.0015 * snoise(p * 16.0);

  // knots: rings bend outward around them
  float knotD = 9.0; int knotId = -1; float knotT = 0.0;
  for (int i = 0; i < ${MAX_KNOTS}; i++) {
    if (i >= uKnotCount) break;
    vec4 k = uKnots[i];
    float da = angDiff(th, k.x);
    float s = w * da;
    float len = k.z - k.y;
    float t = clamp((w - k.y) / max(len, 1e-3), 0.0, 1.0);
    float hw = knotHW(len, t);
    float along = w - clamp(w, k.y, k.z);
    float d = length(vec2(s, along * 1.4)) / hw;
    if (d < knotD) { knotD = d; knotId = i; knotT = t; }
  }
  if (knotId >= 0) w -= 0.010 * exp(-pow(max(knotD - 0.7, 0.0), 2.0) * 0.9);

  // which year are we in
  float prev = 0.07; float idx = -1.0; float f = 0.0; float span = 0.07;
  if (w < 0.07) { f = w / 0.07; }
  else {
    for (int i = 0; i < ${MAX_RINGS}; i++) {
      if (i >= uRingCount) break;
      float r1 = uRingR[i];
      if (w < r1 || i == uRingCount - 1) { idx = float(i); span = max(r1 - prev, 1e-4); f = clamp((w - prev) / span, 0.0, 1.0); break; }
      prev = r1;
    }
  }
  float fpx = px / span;                // pixel size in ring units

  // Scots pine: pale sapwood outside, warmer heartwood inside
  float heart = 1.0 - smoothstep(0.40, 0.56, w + 0.03 * n1);
  vec3 early = mix(vec3(0.90, 0.79, 0.60), vec3(0.85, 0.66, 0.45), heart);
  vec3 late  = mix(vec3(0.72, 0.54, 0.34), vec3(0.58, 0.36, 0.21), heart);

  // latewood: gradual darkening, sharp boundary with next year's earlywood (anti-aliased)
  float lateB = smoothstep(0.62, 0.95, f) * (1.0 - smoothstep(1.0 - max(fpx, 0.004) * 1.5, 1.0, f));
  float micro = smoothstep(0.2, 0.9, snoise(vec2(f * uMicro, th * 0.6 + idx * 7.0))) * 0.18;
  float lateMix = clamp(lateB + micro * (1.0 - lateB), 0.0, 1.0);
  vec3 col = mix(early, late, lateMix);
  float h = lateMix * 0.8;

  // pith
  if (idx < 0.0) { col = mix(vec3(0.42, 0.26, 0.15), early, smoothstep(0.3, 1.0, f)); h = 0.1; }

  // grain: fibers, rays, saw marks
  float fiber = snoise(vec2(th * 220.0, w * 6.0));
  col *= 0.96 + 0.04 * fiber;
  float rays = smoothstep(0.78, 1.0, snoise(vec2(th * 140.0, w * 2.0)));
  col = mix(col, col * 1.05, rays * 0.5);
  float saw = snoise(vec2(p.x * 2.0 + p.y * 0.3, p.y * 140.0 - p.x * 9.0));
  col *= 0.985 + 0.015 * saw;
  h += 0.06 * saw;

  float rough = mix(0.80, 0.64, lateMix);
  vec3 emi = vec3(0.0);

  // knot body: dark resinous center, darker rim, streaked along the branch
  if (knotId >= 0) {
    float d = knotD;
    float aa = fwidth(d) * 1.2;
    float body = 1.0 - smoothstep(1.0 - aa, 1.0 + aa, d);
    float rim = smoothstep(0.55, 0.95, d);
    // multiply over the wood so grain stays visible through the knot
    vec3 kc = col * mix(vec3(0.66, 0.46, 0.32), vec3(0.40, 0.26, 0.17), rim);
    kc *= 0.94 + 0.06 * sin(d * 16.0 + knotT * 24.0);
    float hi = uKnotHi[knotId];
    vec3 resin = vec3(1.0, 0.70, 0.22);
    kc = mix(kc, resin * 0.95, hi * (1.0 - rim * 0.45));
    float halo = exp(-max(d - 1.0, 0.0) * 3.0) * (1.0 - body);
    col = mix(col, col * vec3(0.92, 0.85, 0.76), halo * 0.4);            // resin stain around every knot
    col = mix(col, mix(col, resin, 0.4), halo * hi * 0.9);
    col = mix(col, kc, body);
    emi += resin * 0.5 * hi * body * (1.0 - rim * 0.5) + resin * 0.12 * hi * halo;
    h = mix(h, h * 0.5 - 0.25 * smoothstep(0.85, 1.0, d), body);
    rough = mix(rough, mix(0.45, 0.22, hi), body);
  }

  // halves: the dimmed side goes quiet
  float own = cos(th) >= 0.0 ? 0.0 : 1.0;
  float dim = own < 0.5 ? uSideHi.x : uSideHi.y;
  col = mix(col, mix(col, vec3(dot(col, vec3(0.33))), 0.75) * 0.88, dim);

  // active year ring
  if (uActiveAmt > 0.001) {
    float isA = 1.0 - step(0.5, abs(idx - uActiveRing));
    float lineA = (1.0 - smoothstep(0.0, max(0.05, fpx * 2.0), 1.0 - f)) * isA;
    col = mix(col, col * 1.07 + vec3(0.03, 0.02, 0.0), isA * uActiveAmt);
    col = mix(col, vec3(1.0, 0.70, 0.22), lineA * uActiveAmt * 0.85);
    emi += vec3(0.65, 0.40, 0.08) * lineA * uActiveAmt * 0.45;
    col = mix(col, col * 0.84, (1.0 - isA) * uActiveAmt * 0.4);
  }

  // radial checks (drying cracks) at back and front, between the halves
  if (uCracks > 0.0) {
    for (int c = 0; c < 2; c++) {
      float ca = c == 0 ? -1.5708 : 1.5708;
      float startW = c == 0 ? 0.34 : 0.55;
      float da = angDiff(th, ca + 0.012 * sin(w * 23.0) + 0.006 * snoise(vec2(w * 30.0, float(c))));
      float s = abs(da) * rr;
      float width = mix(0.0006, 0.006, smoothstep(startW, 1.0, w)) * step(startW, w);
      float crack = 1.0 - smoothstep(width - px * 0.5, width + px * 0.5, s);
      col = mix(col, vec3(0.15, 0.10, 0.06), crack * uCracks);
      h = mix(h, -1.0, crack * uCracks);
    }
  }

  // finale: only the three rings of the logo stay, in ink, everything else dissolves
  wAlpha = 1.0;
  if (uLogo > 0.0) {
    float aw = fwidth(w) * 0.8;
    float band = smoothstep(0.12 - aw, 0.12 + aw, w) * (1.0 - smoothstep(0.30 - aw, 0.30 + aw, w))
               + smoothstep(0.50 - aw, 0.50 + aw, w) * (1.0 - smoothstep(0.67 - aw, 0.67 + aw, w))
               + smoothstep(0.83 - aw, 0.83 + aw, w) * (1.0 - smoothstep(1.0 - aw, 1.0 + aw, w));
    col = mix(col, vec3(0.12, 0.17, 0.14), uLogo);
    emi *= 1.0 - uLogo;
    h *= 1.0 - uLogo;
    rough = mix(rough, 1.0, uLogo);
    wAlpha = mix(1.0, band, uLogo);
  }

  wColor = col; wHeight = h; wRough = rough; wEmissive = emi;
}
`;

const BARK = /* glsl */ `
float bHeight; vec3 bColor;
void barkSample(vec3 lp){
  float th = atan(-lp.z, lp.x);
  // long vertical plates split by fissures
  vec2 q = vec2(th * 7.0, lp.y * 2.2);
  float cells = fbm(q + 1.7);
  float fiss = smoothstep(0.02, 0.16, abs(snoise(vec2(th * 11.0 + 0.6 * cells, lp.y * 1.1))));
  float flakes = fbm(vec2(th * 60.0, lp.y * 26.0));
  vec3 copper = vec3(0.62, 0.38, 0.24);
  vec3 grey = vec3(0.45, 0.39, 0.34);
  vec3 dark = vec3(0.20, 0.14, 0.10);
  vec3 c = mix(grey, copper, smoothstep(-0.2, 0.5, cells) * 0.75);
  c *= 0.9 + 0.18 * flakes;
  c = mix(dark, c, fiss);
  bColor = c;
  bHeight = fiss * (0.7 + 0.3 * cells) + 0.25 * flakes;
}
`;

function patchVertex(shader: THREE.WebGLProgramParametersWithUniforms) {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vLocal;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLocal = position;');
}

export interface LogOptions {
  rings: Ring[];
  knots: Knot[];
  radius?: number;
  height?: number;
  segments?: number;
  micro?: number;
  cracks?: boolean;
}

export interface LogHandle {
  group: THREE.Group;
  mesh: THREE.Mesh;
  uniforms: Record<string, THREE.IUniform>;
  radius: number;
  height: number;
  setGrow(v: number): void;
  setKnotHi(i: number, v: number): void;
  setActiveRing(i: number, amt: number): void;
  setSideHi(client: number, own: number): void;
  setLogo(v: number): void;
  /** local disc point (x,z in geometry units) -> polar on the data scale */
  toPolar(local: THREE.Vector3): { theta: number; w: number };
  /** polar on the data scale -> point on the top face, in group space */
  fromPolar(theta: number, w: number): THREE.Vector3;
  pickKnot(local: THREE.Vector3): number;
  dispose(): void;
}

export function createLog(opts: LogOptions): LogHandle {
  const radius = opts.radius ?? 1;
  const height = opts.height ?? 0.28;
  const seg = opts.segments ?? 220;

  const geo = new THREE.CylinderGeometry(1, 1, height, seg, 6, false);
  // irregular trunk outline (same function as the shader and the SVG fallback)
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const r = Math.hypot(x, z);
    if (r < 1e-5) continue;
    const th = Math.atan2(-z, x);
    const f = outline(th);
    pos.setX(i, x * f); pos.setZ(i, z * f);
  }
  geo.computeVertexNormals();
  geo.scale(radius, 1, radius);

  const ringR = new Array(MAX_RINGS).fill(0);
  opts.rings.forEach((r, i) => (ringR[i] = r.r1));
  const knotV = Array.from({ length: MAX_KNOTS }, () => new THREE.Vector4());
  opts.knots.forEach((k, i) => knotV[i].set(k.angle, k.r0, k.r1, k.side === 'own' ? 1 : 0));

  const uniforms: Record<string, THREE.IUniform> = {
    uWobble: { value: WOBBLE.map(([k, a, ph]) => new THREE.Vector3(k, a, ph)) },
    uGrow: { value: 1 },
    uTime: { value: 0 },
    uRingR: { value: ringR },
    uRingCount: { value: opts.rings.length },
    uKnots: { value: knotV },
    uKnotHi: { value: new Array(MAX_KNOTS).fill(0) },
    uKnotCount: { value: opts.knots.length },
    uActiveRing: { value: -1 },
    uActiveAmt: { value: 0 },
    uSideHi: { value: new THREE.Vector2(0, 0) },
    uBarkStart: { value: BARK_START },
    uCracks: { value: opts.cracks === false ? 0 : 1 },
    uMicro: { value: opts.micro ?? 3 },
    uLogo: { value: 0 },
    uRadius: { value: radius },
  };

  const wood = new THREE.MeshStandardMaterial({ roughness: 0.75, metalness: 0 });
  wood.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    patchVertex(shader);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform float uRadius;\n${NOISE}\n${SHARED}\n${WOOD}`)
      .replace('#include <map_fragment>', `woodSample(vLocal.xz / uRadius * uGrow);\ndiffuseColor.rgb = pow(wColor, vec3(2.2));\ndiffuseColor.a *= wAlpha;`)
      .replace('#include <roughnessmap_fragment>', `float roughnessFactor = wRough;`)
      .replace('#include <normal_fragment_maps>', `
        vec2 dH = vec2(dFdx(wHeight), dFdy(wHeight));
        normal = perturbN(-vViewPosition, normal, dH * 0.012, faceDirection);`)
      .replace('#include <emissivemap_fragment>', `totalEmissiveRadiance += pow(wEmissive, vec3(2.2));`);
  };
  wood.customProgramCacheKey = () => 'wood-v1';

  const bark = new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0 });
  bark.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    patchVertex(shader);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform float uRadius;\n${NOISE}\n${SHARED}\n${BARK}`)
      .replace('#include <map_fragment>', `barkSample(vLocal / uRadius);\ndiffuseColor.rgb = pow(bColor, vec3(2.2));\ndiffuseColor.a *= 1.0 - uLogo;`)
      .replace('#include <normal_fragment_maps>', `
        vec2 dH = vec2(dFdx(bHeight), dFdy(bHeight));
        normal = perturbN(-vViewPosition, normal, dH * 0.02, faceDirection);`);
  };
  bark.customProgramCacheKey = () => 'bark-v1';
  wood.transparent = true;
  bark.transparent = true;

  // CylinderGeometry groups: 0 side, 1 top, 2 bottom
  const mesh = new THREE.Mesh(geo, [bark, wood, wood]);
  const group = new THREE.Group();
  group.add(mesh);

  const handle: LogHandle = {
    group, mesh, uniforms, radius, height,
    setGrow(v) {
      uniforms.uGrow.value = v;
      mesh.scale.set(Math.max(v, 0.001), 1, Math.max(v, 0.001));
    },
    setKnotHi(i, v) { uniforms.uKnotHi.value[i] = v; },
    setActiveRing(i, amt) { uniforms.uActiveRing.value = i; uniforms.uActiveAmt.value = amt; },
    setSideHi(c, o) { uniforms.uSideHi.value.set(c, o); },
    setLogo(v) {
      uniforms.uLogo.value = v;
      mesh.scale.y = 1 - 0.97 * v;
      wood.depthWrite = v < 0.5; bark.depthWrite = v < 0.5;
    },
    toPolar(local) {
      // local is in mesh space (geometry units, before scale)
      const x = local.x / radius * uniforms.uGrow.value;
      const z = local.z / radius * uniforms.uGrow.value;
      const theta = Math.atan2(-z, x);
      const w = Math.hypot(x, z) / outline(theta) / BARK_START;
      return { theta, w };
    },
    fromPolar(theta, w) {
      const r = w * BARK_START * outline(theta) * radius * uniforms.uGrow.value;
      return new THREE.Vector3(Math.cos(theta) * r, height / 2 + 0.001, -Math.sin(theta) * r);
    },
    pickKnot(local) {
      const { theta, w } = handle.toPolar(local);
      let best = -1, bestD = 1.6;
      opts.knots.forEach((k, i) => {
        const da = Math.atan2(Math.sin(theta - k.angle), Math.cos(theta - k.angle));
        const s = w * da;
        const along = w - Math.min(Math.max(w, k.r0), k.r1);
        const len = k.r1 - k.r0;
        const t = Math.min(1, Math.max(0, (w - k.r0) / Math.max(len, 1e-3)));
        const hw = Math.min(Math.max(0.22 * len + 0.014, 0.019), 0.034) * (0.35 + 0.65 * t);
        // generous hit area: a knot is small, a finger is not
        const d = Math.hypot(s, along * 1.4) / Math.max(hw, 0.02);
        if (d < bestD) { bestD = d; best = i; }
      });
      return best;
    },
    dispose() { geo.dispose(); wood.dispose(); bark.dispose(); },
  };
  return handle;
}

/** Soft contact shadow under an object, no shadow maps needed. */
export function blobShadow(size: number, opacity = 0.35) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(64, 64, 8, 64, 64, 64);
  grd.addColorStop(0, `rgba(20,30,24,${opacity})`);
  grd.addColorStop(0.6, `rgba(20,30,24,${opacity * 0.35})`);
  grd.addColorStop(1, 'rgba(20,30,24,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
  );
  m.rotation.x = -Math.PI / 2;
  return m;
}
