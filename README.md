# Elementa — Offline-First Virtual Chemistry Suite

Interactive inorganic chemistry web app for students: periodic table, reaction mechanics, compound/element databases, identification tests, synthesis protocols, and a full calculator suite (stoichiometry, gas laws, pH, Ksp, Nernst equation, 3D structure lookup).

Built as a client-side Progressive Web App — no backend, no build step, fully offline-capable after first load.

---

## Tech Stack

- **Language:** Vanilla JavaScript (ES Modules) — no framework, no bundler
- **Storage:** IndexedDB (`ElementaDB`, v3) for offline data persistence; Web Worker for equation balancing (`compute.worker.js`)
- **Styling:** Plain CSS with CSS custom properties (dark/light theming)
- **PWA:** `manifest.json` + `service-worker.js` (cache-first offline strategy, stale-while-revalidate for data/CDN assets)
- **Third-party CDN libs:**
  - [SmilesDrawer](https://cdn.jsdelivr.net/npm/smiles-drawer@1.0.10) — 2D compound structure rendering
  - [3Dmol.js](https://3Dmol.org/build/3Dmol-min.js) — WebGL 3D molecular viewer
  - Google Fonts (IBM Plex Sans / Mono)
- **External API (optional, online only):** PubChem PUG REST API — fallback for 3D structure lookups not in the bundled/cached dataset

## Project Structure

```
index.html              Entry point / app shell
theme-boot.js            Pre-paint theme flash prevention
shell.js                 Header/sidebar chrome, theme toggle, PWA registration
core.js                  IndexedDB engine, router, math/formula engines, PubChem fetch
features.js               Registers all modules with the router, boots the app
feat-helpers.js           Shared UI component helpers (cards, SMILES rendering)
feat-landing.js           Home dashboard + global search
feat-database.js          Compounds / Reactions / Preparations / ID Tests modules
feat-theory.js            Periodic Table / Reactivity / MO Theory / VSEPR / Flame Tests / Solubility Rules
feat-compute.js           Calculators (stoich, gas laws, pH, Ksp, Nernst) + Unit Converter
compute.worker.js         Background-thread chemical equation balancer
styles.css                All styling
manifest.json              PWA manifest
service-worker.js          Offline caching strategy
data/
  ├── elements.json
  ├── compounds.json
  ├── reactions.json
  ├── preparations.json
  ├── identification_test.json
  ├── misconceptions.json
  ├── reactivity.json
  ├── structures.json
  └── half_cells.json
```

## Requirements

- Any modern evergreen browser (Chrome, Edge, Firefox, Safari) with support for:
  - ES Modules
  - IndexedDB
  - Web Workers
  - Service Workers (required for offline mode; app still runs without it, just without caching)
- **A local HTTP server.** This app CANNOT be opened directly via `file://` — ES modules, the Service Worker, and IndexedDB `fetch()` calls to `data/*.json` will all fail or be blocked under the `file://` origin.
- No Node.js, npm, or build tooling required to *run* the app — it's static files served as-is.

## How to Run Locally

Pick any static file server. From the project root:

**Python 3:**
```bash
python -m http.server 8000
```

**Node (no install, via npx):**
```bash
npx serve .
```

**VS Code:** use the "Live Server" extension and click "Go Live".

Then open:
```
http://localhost:8000
```

On first load, the service worker precaches the app shell and all `data/*.json` files, so subsequent loads work fully offline (including a hard refresh with no network).

> **Note:** If you change any file listed in `APP_SHELL_FILES` or `SAME_ORIGIN_DATA` inside `service-worker.js`, bump `CACHE_NAME` (e.g. `elementa-engine-v17`) so the old cache is purged and clients pick up the new build on next load.

## How to Test

No automated test suite currently exists. Manual verification checklist:

1. **Offline mode:** Load the app once online, then disable network (DevTools → Network → Offline) and reload — all modules should still work.
2. **Data integrity:** Open DevTools → Application → IndexedDB → `ElementaDB` and confirm all 7 object stores (`elements`, `compounds`, `reactions`, `preparations`, `identification_test`, `misconceptions`, `reactivity`) plus `structures` are populated.
3. **Equation balancer:** Test in Calculators → Balancer with known equations (e.g. `C4H10 + O2 = CO2 + H2O`) and edge cases (already balanced, impossible equations) to confirm the Web Worker responds and errors are caught gracefully.
4. **Reaction cascading dropdowns:** In Reactions module, verify selecting a reactant correctly filters reagent/concentration/temperature options and vice versa.
5. **3D structure lookup:** Test a bundled compound (e.g. "benzene"), a cache-miss compound requiring PubChem (online only), and an invalid query (should show `not_found` gracefully), then test the same PubChem query again offline (should now resolve from IndexedDB cache).
6. **Theme toggle:** Switch light/dark and confirm SMILES canvases and 3Dmol viewer backgrounds update via the `themeChanged` event.
7. **Responsive layout:** Check mobile drawer nav (<899px) and tablet collapsed rail (900–1180px).

## Known Issues

- Cosmetic: `titleCase("n/a")` display formatting issue outstanding (see project bug-fix notes).

---

## Roadmap — Planned Features

The following are confirmed as the next major features to design and build, in no particular priority order yet:

1. **Kinetics Grapher** — Interactive rate-law / reaction-order visualizer (concentration vs. time, rate vs. concentration plots, half-life calculations).
2. **Orbital Visualization** — Visual/3D rendering of atomic orbital shapes (s/p/d/f), extending the electron configuration data already shown in the Periodic Table module.
3. **Qualitative Analysis State Machine** — A guided, branching decision-tree simulator for cation/anion qualitative analysis procedures (builds on `identification_test.json`).
4. **Titration Simulator** — Interactive acid-base titration curve plotter with indicator selection and equivalence point detection.
5. **Infinite Problem Generation** — Procedurally generated practice problems (stoichiometry, equation balancing, pH, etc.) for self-testing, likely paired with the on-the-horizon AI explanation integration.

These are not yet scoped or architected — each will need a design discussion before implementation begins.
