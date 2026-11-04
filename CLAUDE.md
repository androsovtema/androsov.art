# CLAUDE.md — Art Androsov Portfolio

## 0. Read CONTEXT.md and docs/HANDOFF.md first

**Before any conversational work, copywriting, or recommendation about positioning, read `CONTEXT.md` (repo root; local copy at `/Users/prosto/Desktop/01_Projects/artandrosov/CONTEXT.md`) and `docs/HANDOFF.md` (current status and next steps).**

CONTEXT.md is a living document about Art (the human): identity, goals, working principles, current clients, what he can/can't defend in interview, what NOT to claim, and the list of open site-work threads. Update it whenever a new fact, correction, or principle emerges from conversation — append to the relevant section, keep it current. Never duplicate its contents into chat unless Art asks.

This CLAUDE.md handles the **technical migration plan** (Astro structure, URL mapping, etc.). CONTEXT.md handles **who Art is and what he wants the site to say**. Both are required for high-quality work on this project.

---

## 1. Project Overview

Personal portfolio site for Artem Androsov — UX/product designer.
Hosted at `androsov.art`. Currently plain HTML/CSS, being migrated to Astro
for clean URLs, component reuse, and maintainability.

---

## 2. Current Tech Stack (pre-migration)

- HTML5, vanilla CSS, zero JavaScript
- No build tools, no frameworks, no dependencies
- Hosted on GitHub Pages with custom domain via CNAME

---

## 3. Migration Target

**Framework:** Astro (static output, no SSR needed)
**Hosting:** GitHub Pages (static export via `output: 'static'`)
**Goal:** Clean URLs (`/about`, `/projects/viril`), shared layout components,
no duplication of nav/footer across files.

---

## 4. Astro Project Structure (target)

src/
  layouts/
    BaseLayout.astro       ← html, head, meta, loads CSS
    ProjectLayout.astro    ← extends Base, includes sidebar + footer
  components/
    Sidebar.astro          ← logo + nav links, active state via props
    Footer.astro           ← logo + Telegram + YouTube links
    ProjectHero.astro      ← section label, h1, description, meta row
    ConceptGrid.astro      ← Why / What / How 3-column block
    Gallery.astro          ← image grid component
    MetricsGrid.astro      ← 4-card metrics block
    NextProject.astro      ← next project navigation
    CTASection.astro       ← Telegram CTA block
  pages/
    index.astro            ← /  (projects grid)
    about.astro            ← /about
    projects/
      viril.astro          ← /projects/viril
      talent.astro         ← /projects/talent
      ourwall.astro        ← /projects/ourwall
      gabarshop.astro      ← /projects/gabarshop
      emtech-invest-davos-2026.astro  ← /projects/emtech-invest-davos-2026
      loyobondar.astro     ← /projects/loyobondar
      eazyenergy.astro     ← /projects/eazy-energy
      scoville.astro       ← /projects/scoville
public/
  assets/
    css/                   ← перенести как есть
    icons/                 ← перенести как есть
    images/                ← перенести как есть
  manifest.json            ← сохранить для PWA
  CNAME                    ← сохранить для GitHub Pages

---

## 5. URL Mapping (old → new)

| Old URL                        | New URL                  |
|-------------------------------|--------------------------|
| /index.html                   | /                        |
| /about.html                   | /about                   |
| /projects/viril.html          | /projects/viril          |
| /projects/talent.html         | /projects/talent         |
| /projects/wall.html           | /projects/ourwall        |
| /projects/gabarshop.html      | /projects/gabarshop      |
| /projects/wef2025.html        | /projects/emtech-invest-davos-2026 |
| /projects/loyobondar.html     | /projects/loyobondar     |
| /projects/eazyenergy.html     | /projects/eazy-energy    |
| /projects/scoville.html       | /projects/scoville       |

---

## 6. CSS Strategy

Keep all existing CSS files unchanged. Load them via BaseLayout.astro.
Do not rewrite CSS during migration — visual output must be identical.

---

## 7. Known Issues to Fix During Migration

- `talent.html` references gallery images that don't exist:
  talent-1.jpg through talent-N.jpg — remove broken <img> tags or
  replace with a placeholder
- `ourwall.astro` same issue with ourwall-1.jpg etc.

---

## 8. Sidebar Active State

Pass `activePage` prop to Sidebar.astro.
Values: "projects" | "about"
Index page and all project pages → "projects"
About page → "about"

---

## 9. Next Project Sequence (for NextProject.astro)

viril → talent → ourwall → gabarshop → emtech-invest-davos-2026 → loyobondar → eazyenergy → scoville → viril

---

## 10. External Links

Telegram: https://t.me/androsovart
YouTube: (as in current footer)

---

## 11. Constraints

- No JavaScript unless strictly necessary
- Static output only (`output: 'static'` in astro.config.mjs)
- GitHub Pages deploy via GitHub Actions (astro.yml workflow)
- Visual result must match current site exactly — this is a tech migration,
  not a redesign
---

## 12. Redesign 2026 (planned, not started)

Migration above is done. A full redesign is planned — see `docs/redesign-plan.md`
(IA, 3D concepts, stack, AI-findability) and `docs/positioning-2026.md` (new copy).
During the redesign the "visual must match" and "no JS" constraints from §11 are
lifted for the 3D layer only; all content must still render as static HTML.
