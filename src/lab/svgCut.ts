// Static SVG of the same cut. Shown before WebGL is ready, without JS, and when WebGL is missing.
import { outline, type Ring, type Knot } from './data';
import { BARK_START } from './log';

const C = 500; // center in a 1000x1000 viewBox
const R = 470;

function ringPath(w: number, jitter = 0): string {
  const pts: string[] = [];
  const n = 180;
  for (let i = 0; i <= n; i++) {
    const th = (i / n) * Math.PI * 2;
    const wob = 1 + jitter * Math.sin(th * 9 + w * 40) * 0.004;
    const r = w * BARK_START * outline(th) * R * wob;
    pts.push(`${(C + Math.cos(th) * r).toFixed(1)},${(C - Math.sin(th) * r).toFixed(1)}`);
  }
  return `M${pts.join('L')}Z`;
}

function knotPath(k: Knot): string {
  const len = k.r1 - k.r0;
  const hw = Math.min(Math.max(0.25 * len + 0.012, 0.014), 0.026);
  const pts: [number, number][] = [];
  const steps = 16;
  // tapered capsule along the radius
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const w = k.r0 + len * t;
    const h = hw * (0.6 + 0.4 * t);
    pts.push([w, -h / Math.max(w, 0.05)]);
  }
  for (let i = 0; i <= 8; i++) {
    const a = -Math.PI / 2 + (i / 8) * Math.PI;
    const h = hw;
    pts.push([k.r1 + Math.cos(a) * h * 0.9, (Math.sin(a) * h) / Math.max(k.r1, 0.05)]);
  }
  for (let i = steps; i >= 0; i--) {
    const t = i / steps;
    const w = k.r0 + len * t;
    const h = hw * (0.6 + 0.4 * t);
    pts.push([w, h / Math.max(w, 0.05)]);
  }
  return 'M' + pts.map(([w, da]) => {
    const th = k.angle + da;
    const r = w * BARK_START * outline(th) * R;
    return `${(C + Math.cos(th) * r).toFixed(1)},${(C - Math.sin(th) * r).toFixed(1)}`;
  }).join('L') + 'Z';
}

export function svgCut(rings: Ring[], knots: Knot[]): string {
  const parts: string[] = [];
  parts.push(`<path d="${ringPath(1 / BARK_START)}" fill="#5a3a26"/>`);
  parts.push(`<path d="${ringPath(1.0)}" fill="#e3c899"/>`);
  // rings from outside in: each year is a filled area, latewood line on its edge
  for (let i = rings.length - 1; i >= 0; i--) {
    const r = rings[i];
    const heart = r.r1 < 0.55;
    parts.push(`<path d="${ringPath(r.r1)}" fill="${heart ? '#d5ab78' : '#e8d3a8'}" stroke="${heart ? '#8f5a33' : '#b48a58'}" stroke-width="5"/>`);
  }
  parts.push(`<path d="${ringPath(0.07)}" fill="#76492b"/>`);
  for (const k of knots) parts.push(`<path class="svg-knot" data-knot="${k.angle}" d="${knotPath(k)}" fill="#55301a"/>`);
  return `<svg viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Cross-section of a pine trunk. Rings from ${rings[0].year} to ${rings[rings.length - 1].year}, knots mark projects.">${parts.join('')}</svg>`;
}
