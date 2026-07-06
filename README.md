# Chitresh Jadhav — 3D Scroll-Story Portfolio

A single continuous camera flight through ten chapters of a career, built with
Vite + Three.js + GSAP ScrollTrigger. Neon-anime aesthetic, no frameworks.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build → dist/
npm run preview    # serve the production build locally
```

## How it's built

- **Three boot modes** (`src/app/capabilities.js`): `static` (reduced motion /
  no WebGL / save-data / low-end — a complete readable resume, three.js never
  downloads), `lite` (reduced particle counts and DPR), `full`. The nav's
  **Motion: On/Off** toggle overrides detection and persists.
- **Pinning is pure CSS** (`position: sticky`); GSAP ScrollTrigger only maps
  scroll progress → camera pose + overlay timelines. Native scroll everywhere.
- **One canvas, one scene.** Chapters are lazy-loaded Groups at stations along
  −Z (`src/app/registry.js` holds the camera pose table — every chapter's exit
  pose equals the next one's entry pose). Rendering is demand-driven and
  pauses when the tab is hidden.

## Drop-in video clips

Every `<figure class="media-frame" data-slot="...">` upgrades itself to a
video if a matching clip exists:

1. Generate a clip using the prompts in [media-prompts/PROMPTS.md](media-prompts/PROMPTS.md).
2. Save it as `public/media/clips/<slot-id>.mp4` (a `.webm` sibling is tried first).
3. Redeploy. No code changes — missing clips simply keep their poster art.

Slot ids: `ep01-datastream`, `ep02-warehouse`, `ep03-constellation`,
`ep04-commanddeck`, `builds-circuit`, `afterhours-headspin`, `afterhours-parkour`.

## Deploy (Vercel)

```bash
npm i -g vercel
vercel           # first run: link the project (framework: Vite, auto-detected)
vercel --prod
```

Or push the repo to GitHub and import it at vercel.com — every push gets a
preview URL. `vercel.json` sets caching (immutable hashed assets, 1-hour SWR
for media so replaced clips show up quickly) and security headers.

Live at `https://chitreshjadhav.vercel.app`. If the production domain changes,
update the canonical/OG URLs in `index.html` to match.
