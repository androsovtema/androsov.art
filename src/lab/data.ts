// Data for the "Cut" (srez) concept.
// One ring = one year. Projects are knots: a knot starts at the ring of its start date
// and runs outward to its end date, like a real branch seen in a trunk cross-section.
// Descriptions are copied as-is from the current home page (texts are not edited here).

export type Side = 'client' | 'own';

export interface Project {
  slug: string;
  title: string;
  href: string | null;
  side: Side;
  start: number; // fractional year: 2024.75 = October 2024
  end: number | null; // null = still going
  dateLabel: string;
  tags: string[];
  description: string | null; // null = no case text yet
}

export const FIRST_YEAR = 2020;

// Build-time "now": the outer ring grows with the current year.
const now = new Date();
export const NOW = now.getFullYear() + now.getMonth() / 12 + now.getDate() / 365;
export const CURRENT_YEAR = now.getFullYear();

const m = (year: number, month: number) => year + (month - 1) / 12;

export const projects: Project[] = [
  {
    slug: 'gabarshop', title: 'Gabarshop', href: '/projects/gabarshop', side: 'client',
    start: m(2020, 3), end: null, dateLabel: '2020 — present',
    tags: ['Product', 'E-commerce', 'Art Direction'],
    description: 'A creator merch store I built, ran, and never fully left. Four years inside the team — from packing boxes to redesigning the full product experience.',
  },
  {
    slug: 'eazy-energy', title: 'Eazy Energy', href: '/projects/eazy-energy', side: 'client',
    start: m(2023, 4), end: m(2025, 6), dateLabel: '2023–2025',
    tags: ['Product', 'Branding', 'Art Direction'],
    description: "An energy drink launched on top of an existing factory and two creators' audiences. Creative direction across packaging, a 7-city tour, and racing sponsorships — 2 years from launch to national distribution.",
  },
  {
    slug: 'viril', title: 'Viril', href: '/projects/viril', side: 'client',
    start: m(2024, 9), end: m(2024, 10.5), dateLabel: 'October 2024',
    tags: ['UX/UI', 'Product', 'Branding'],
    description: "A men's health brand built from a blank page — naming, brand strategy, and 64 UX/UI screens across four versions. Five weeks, one person, zero restarts.",
  },
  {
    slug: 'talent', title: 'Talent', href: '/projects/talent', side: 'own',
    start: m(2024, 11), end: m(2024, 12.5), dateLabel: 'December 2024',
    tags: ['UX/UI', 'Product', 'Self-initiated'],
    description: 'A licensing platform for creators — images, video, audio, and scripts under one roof. Designed for a market that lost access to every major international service overnight.',
  },
  {
    slug: 'wedesignerz', title: 'We Designerz', href: 'https://wedesignerz.com', side: 'own',
    start: m(2025, 4), end: null, dateLabel: '2025 — present',
    tags: ['Product', 'Self-initiated'],
    description: null,
  },
  {
    slug: 'ourwall', title: 'Our Wall', href: '/projects/ourwall', side: 'own',
    start: m(2025, 8), end: m(2025, 9.5), dateLabel: 'September 2025',
    tags: ['Product', 'UX', 'Self-initiated'],
    description: 'An anonymous social network where thoughts appear and disappear. Built, attacked, rebuilt, and live — with 1,132 users who found it from a single YouTube video.',
  },
  {
    slug: 'loyobondar', title: 'LOYO & BONDAR', href: '/projects/loyobondar', side: 'client',
    start: m(2025, 12), end: m(2026, 3.5), dateLabel: 'December 2025 — March 2026',
    tags: ['Product', 'Art Direction'],
    description: 'A premium Bali developer with multiple stakeholders and competing priorities. I stepped in to systematize incoming requests, keeping design execution on track at 100+ slides per week.',
  },
  {
    slug: 'emtech-invest-davos-2026', title: 'EmTech Invest × Davos', href: '/projects/emtech-invest-davos-2026', side: 'client',
    start: m(2025, 12), end: m(2026, 1.6), dateLabel: 'January 2026',
    tags: ['Product', 'Art Direction'],
    description: 'A closed-door investment event held during Davos / WEF week 2026 — no brand guidelines, 66 participants with individual demands. I turned ambiguity into a system that held under pressure.',
  },
  {
    slug: 'scoville', title: 'Scoville', href: '/projects/scoville', side: 'client',
    start: m(2026, 1.6), end: m(2026, 2.6), dateLabel: 'February 2026',
    tags: ['Packaging', 'Branding'],
    description: 'A spicy ice cream designed twice — the initial concept was rejected due to external partnership constraints. The pivot shipped in a week and is live on Samokat today.',
  },
  {
    slug: 'androsov-art', title: 'androsov.art', href: null, side: 'own',
    start: m(2026, 10.5), end: null, dateLabel: '2026 — present',
    tags: ['Product', 'Self-initiated'],
    description: null,
  },
];

export interface Ring {
  year: number;
  r0: number; // inner radius, 0..1
  r1: number; // outer radius, 0..1
  count: number; // projects active in this year
  partial: number; // 0..1, share of the year already grown (only the current year < 1)
}

const PITH = 0.07;

// Ring width = base + share for every project active that year.
export function buildRings(): Ring[] {
  const years: number[] = [];
  for (let y = FIRST_YEAR; y <= CURRENT_YEAR; y++) years.push(y);
  const raw = years.map((y) => {
    const count = projects.filter((p) => p.start < y + 1 && (p.end ?? NOW) >= y).length;
    const partial = y === CURRENT_YEAR ? Math.min(1, NOW - y) : 1;
    return { year: y, count, partial, w: (0.7 + 0.9 * count) * partial };
  });
  const total = raw.reduce((s, r) => s + r.w, 0);
  let r = PITH;
  return raw.map((x) => {
    const w = (x.w / total) * (1 - PITH);
    const ring = { year: x.year, r0: r, r1: r + w, count: x.count, partial: x.partial };
    r += w;
    return ring;
  });
}

// Fractional year -> radius on the disc (0..1).
export function yearToRadius(rings: Ring[], t: number): number {
  for (const ring of rings) {
    const span = ring.partial;
    if (t < ring.year + span || ring === rings[rings.length - 1]) {
      const f = Math.min(1, Math.max(0, (t - ring.year) / span));
      return ring.r0 + (ring.r1 - ring.r0) * f;
    }
  }
  return 1;
}

export interface Knot {
  slug: string;
  angle: number; // radians, 0 = +x (right), counter-clockwise when seen from above
  r0: number;
  r1: number;
  side: Side;
}

// Client work on the right half, own projects on the left half.
// Angles spread evenly inside each half so knots never overlap.
export function buildKnots(rings: Ring[]): Knot[] {
  const out: Knot[] = [];
  (['client', 'own'] as Side[]).forEach((side) => {
    const list = projects.filter((p) => p.side === side).sort((a, b) => a.start - b.start);
    const n = list.length;
    list.forEach((p, i) => {
      // client: from -70deg to +70deg; own: from 110deg to 250deg
      const f = n === 1 ? 0.5 : i / (n - 1);
      const base = side === 'client' ? -70 + 140 * f : 110 + 140 * (1 - f);
      const angle = (base * Math.PI) / 180;
      const r0 = yearToRadius(rings, p.start);
      let r1 = yearToRadius(rings, p.end ?? NOW);
      r1 = Math.min(r1, 0.97);
      const r0c = Math.min(r0, r1 - 0.04); // short projects still read as a knot
      out.push({ slug: p.slug, angle, r0: r0c, r1: Math.max(r1, r0c + 0.04), side });
    });
  });
  return out;
}

// Irregular trunk outline, shared by JS (geometry, SVG fallback) and GLSL.
export const WOBBLE: [number, number, number][] = [
  // [k, amplitude, phase]
  [2, 0.018, 0.7],
  [3, 0.014, 2.1],
  [5, 0.008, 4.0],
  [7, 0.005, 1.3],
];
export function outline(theta: number): number {
  let f = 1;
  for (const [k, a, ph] of WOBBLE) f += a * Math.sin(k * theta + ph);
  return f;
}
