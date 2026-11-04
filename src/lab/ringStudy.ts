// Hand-drawn style rings for the "how many rings" study. Pure SVG, rendered at real pixel sizes.
function contour(r: number, seed: number): string {
  const pts: string[] = [];
  const n = 72;
  for (let i = 0; i <= n; i++) {
    const th = (i / n) * Math.PI * 2;
    const k = 1 + 0.035 * Math.sin(3 * th + seed) + 0.02 * Math.sin(5 * th + seed * 1.7) + 0.012 * Math.sin(9 * th + seed * 0.3);
    pts.push(`${(18 + Math.cos(th) * r * k).toFixed(2)},${(18 - Math.sin(th) * r * k).toFixed(2)}`);
  }
  return `M${pts.join('L')}Z`;
}

/** n = number of rings including the core. n = 3 is the current logo. */
export function ringsSvg(n: number): string {
  const P = 17.6 / n;
  const stroke = P * 0.5;
  const d: string[] = [];
  for (let k = 1; k <= n; k++) {
    const outer = k * P;
    const inner = k === 1 ? P * 0.4 : outer - stroke;
    d.push(contour(outer, k * 1.3) + contour(inner, k * 1.3 + 0.4));
  }
  return `<svg viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" fill="currentColor" d="${d.join('')}"/></svg>`;
}
