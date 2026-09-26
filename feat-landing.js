/**
 * feat-landing.js
 * Landing page and Global Search modules.
 */

import {
  getCompounds, getReactions, getElements, getIdTests,
  navigateTo, formatEquation, formatFormula
} from './core.js';

import { createInfoCard, resultField, titleCase } from './feat-helpers.js';

// Local helpers (also defined in feat-database.js to avoid cross-module imports)
function displayReagentPlain(str, compoundsById = new Map()) {
  if (str == null) return "N/A";
  const s = String(str);
  if (s.toLowerCase() === "null" || s.trim() === "") return "N/A";
  const compound = compoundsById.get(s.toLowerCase());
  if (compound && compound.formula) return compound.formula;
  return titleCase(s);
}

function displayReagentHtml(str, compoundsById = new Map()) {
  return formatFormula(displayReagentPlain(str, compoundsById));
}

/* =====================================================================
   2. LANDING MODULE
   ===================================================================== */
export async function mountLanding(container) {
  container.innerHTML = `<div class="placeholder-note">Loading dashboard...</div>`;

  let compounds = [], reactions = [], elementsData = [];
  try {
    [compounds, reactions, elementsData] = await Promise.all([getCompounds(), getReactions(), getElements()]);
  } catch (e) { /* fall back to zero counts below rather than block the page */ }

  // Rotating quotes — a new one every session
  const quotes = [
    { text: "Nothing in life is to be feared, it is only to be understood. Now one can understand the structure of matter.", author: "Marie Curie" },
    { text: "In the field of observation, chance favors only the prepared mind.", author: "Louis Pasteur" },
    { text: "Chemistry is necessarily an experimental science: its conclusions are drawn from data, and its principles supported by evidence from facts.", author: "Michael Faraday" },
    { text: "The most exciting phrase to hear in science is not \u2018Eureka!\u2019 but \u2018That\u2019s funny...\u2019", author: "Isaac Asimov" },
  ];
  const quote = quotes[Math.floor(Math.random() * quotes.length)];

  container.innerHTML = `
    <section class="hero">
      <div class="hero-orb hero-orb--copper"></div>
      <div class="hero-orb hero-orb--lithium"></div>
      <div class="hero-orb hero-orb--potassium"></div>
      <div class="hero-orb hero-orb--sodium"></div>
      <div class="hero-orbits">
        <div class="orbit"></div>
        <div class="orbit"></div>
        <div class="orbit"></div>
        <div class="nucleus"></div>
      </div>
      <div class="hero-content">
        <p class="hero-eyebrow"><span class="version-dot"></span> Elementa &middot; v4</p>
        <h1>Chemistry, distilled into something you can actually use.</h1>
        <div class="hero-quote">
          <div class="hero-quote-text">${quote.text}</div>
          <div class="hero-quote-author">— <span>${quote.author}</span></div>
        </div>

      </div>
    </section>

    <div class="section-head"><h2>Jump back in</h2></div>
    <div class="module-grid">
      <button class="module-card" id="card-compounds" style="--mc-accent:var(--accent-copper); --mc-accent-dim:var(--accent-copper-dim);">
        <div class="icon-badge">🧪</div>
        <h3>Compounds DB</h3>
        <p>${compounds.length} compounds · 2D structures</p>
      </button>
      <button class="module-card" id="card-reactions" style="--mc-accent:var(--accent-lithium); --mc-accent-dim:var(--accent-lithium-dim);">
        <div class="icon-badge">⚗️</div>
        <h3>Reaction Mechanics</h3>
        <p>${reactions.length} reaction records</p>
      </button>
      <button class="module-card" id="card-pt" style="--mc-accent:var(--accent-potassium); --mc-accent-dim:var(--accent-potassium-dim);">
        <div class="icon-badge">🧬</div>
        <h3>Periodic Table</h3>
        <p>${elementsData.length ? elementsData.length : 118} elements · full detail</p>
      </button>
      <button class="module-card" id="card-calc" style="--mc-accent:var(--accent-sodium); --mc-accent-dim:var(--accent-sodium-dim);">
        <div class="icon-badge">🧮</div>
        <h3>Calculators</h3>
        <p>3D lookup · Ksp · Nernst · gas laws</p>
      </button>
      <button class="module-card" id="card-mo" style="--mc-accent:var(--accent-potassium); --mc-accent-dim:var(--accent-potassium-dim);">
        <div class="icon-badge">🧲</div>
        <h3>Molecular Orbitals</h3>
        <p>9 diatomics · bond order · magnetism</p>
      </button>
      <button class="module-card" id="card-vsepr" style="--mc-accent:var(--accent-potassium); --mc-accent-dim:var(--accent-potassium-dim);">
        <div class="icon-badge">🔷</div>
        <h3>VSEPR Theory</h3>
        <p>AXnEm · geometry · hybridization</p>
      </button>
      <button class="module-card" id="card-flame" style="--mc-accent:var(--accent-lithium); --mc-accent-dim:var(--accent-lithium-dim);">
        <div class="icon-badge">🔥</div>
        <h3>Flame Tests</h3>
        <p>11 metals · color visualization</p>
      </button>
    </div>
    <div class="module-grid" style="margin-top: 14px;">
      <button class="module-card" id="card-sol" style="--mc-accent:var(--accent-copper); --mc-accent-dim:var(--accent-copper-dim);">
        <div class="icon-badge">💧</div>
        <h3>Solubility Rules</h3>
        <p>Soluble / insoluble · exceptions</p>
      </button>
      <button class="module-card" id="card-unit" style="--mc-accent:var(--accent-sodium); --mc-accent-dim:var(--accent-sodium-dim);">
        <div class="icon-badge">🔄</div>
        <h3>Unit Converter</h3>
        <p>g ↔ mol ↔ L ↔ particles</p>
      </button>
      <button class="module-card" id="card-prep" style="--mc-accent:var(--accent-lithium); --mc-accent-dim:var(--accent-lithium-dim);">
        <div class="icon-badge">🏭</div>
        <h3>Synthesis Protocols</h3>
        <p>Lab & industrial methods</p>
      </button>
      <button class="module-card" id="card-idtests" style="--mc-accent:var(--accent-lithium); --mc-accent-dim:var(--accent-lithium-dim);">
        <div class="icon-badge">🔬</div>
        <h3>Identification Analysis</h3>
        <p>Dry & wet qualitative tests</p>
      </button>
      <button class="module-card" id="card-reactivity" style="--mc-accent:var(--accent-potassium); --mc-accent-dim:var(--accent-potassium-dim);">
        <div class="icon-badge">📈</div>
        <h3>Reactivity Series</h3>
        <p>Metal activity ladder</p>
      </button>
      <button class="module-card" id="card-problems" style="--mc-accent:var(--accent-sodium); --mc-accent-dim:var(--accent-sodium-dim);">
        <div class="icon-badge">🧩</div>
        <h3>Practice Problems</h3>
        <p>Infinite generated questions</p>
      </button>
    </div>
  `;

  document.getElementById("card-compounds").addEventListener("click", () => navigateTo("compounds"));
  document.getElementById("card-reactions").addEventListener("click", () => navigateTo("reactions"));
  document.getElementById("card-pt").addEventListener("click", () => navigateTo("periodictable"));
  document.getElementById("card-calc").addEventListener("click", () => navigateTo("calculators"));
  document.getElementById("card-mo").addEventListener("click", () => navigateTo("molecularorbitals"));
  document.getElementById("card-vsepr").addEventListener("click", () => navigateTo("vsepr"));
  document.getElementById("card-flame").addEventListener("click", () => navigateTo("flametests"));
  document.getElementById("card-sol").addEventListener("click", () => navigateTo("solubility"));
  document.getElementById("card-unit").addEventListener("click", () => navigateTo("unitconverter"));
  document.getElementById("card-prep").addEventListener("click", () => navigateTo("preparations"));
  document.getElementById("card-idtests").addEventListener("click", () => navigateTo("idtests"));
  document.getElementById("card-reactivity").addEventListener("click", () => navigateTo("reactivity"));
  document.getElementById("card-problems").addEventListener("click", () => navigateTo("problems"));
}
export async function mountSearch(container) {
  container.innerHTML = `<div class="placeholder-note">Loading databases for search...</div>`;
  let elements, compounds, reactions, preparations, idTests;
  try {
    [elements, compounds, reactions, preparations, idTests] = await Promise.all([ getElements(), getCompounds(), getReactions(), getPreparations(), getIdTests() ]);
  } catch (err) {
    container.innerHTML = `<div class="placeholder-note">Failed to load search data.</div>`;
    return;
  }

  const compoundsById = new Map(compounds.map(c => [String(c.id).toLowerCase(), c]));
  const displayReagentPlainFmt = (id) => displayReagentPlain(id, compoundsById);
  const displayReagentHtmlFmt = (id) => displayReagentHtml(id, compoundsById);

  container.innerHTML = `
    <div class="module-header" style="--mh-accent: var(--accent-sodium); --mh-accent-dim: var(--accent-sodium-dim);">
      <div class="mh-icon">🔍</div>
      <div class="mh-text"><h2>Global Search</h2><p>Search across all databases — elements, compounds, reactions, preparations, and tests.</p></div>
    </div>
    <div class="panel" style="position: relative; overflow: visible;">
      <div class="field" style="position: relative;">
        <input type="text" id="global-search-input" placeholder="Type a formula, name, or reaction type (e.g., 'HCl', 'Zinc', 'Redox')..." autocomplete="off" />
        <div id="search-suggestions" style="position: absolute; top: calc(100% + 8px); left: 0; right: 0; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-sm); max-height: 350px; overflow-y: auto; display: none; box-shadow: var(--shadow-hover); z-index: 100;"></div>
      </div>
    </div>
    <div id="search-results" class="search-grid"></div>
  `;

  const input = document.getElementById("global-search-input");
  const suggestionsDiv = document.getElementById("search-suggestions");
  const resultsDiv = document.getElementById("search-results");
  let currentSuggestions = [];

  const closeSuggestions = (e) => { if (e.target !== input && e.target !== suggestionsDiv) suggestionsDiv.style.display = "none"; };
  document.addEventListener("click", closeSuggestions);
  // Cleanup on re-mount to prevent listener accumulation
  if (container._cleanupSearch) { document.removeEventListener("click", container._cleanupSearch); }
  container._cleanupSearch = closeSuggestions;

  suggestionsDiv.addEventListener("click", (e) => {
    const item = e.target.closest('.suggestion-item');
    if (item) {
        const idx = item.getAttribute("data-idx");
        resultsDiv.innerHTML = currentSuggestions[idx].card;
        suggestionsDiv.style.display = "none";
        input.value = currentSuggestions[idx].plainLabel;
    }
  });

  input.addEventListener("input", (e) => {
    const q = e.target.value.toLowerCase().trim();
    if(q.length < 2) { suggestionsDiv.style.display = "none"; resultsDiv.innerHTML = ""; return; }
    currentSuggestions = [];
    
    compounds.filter(c => c.name.toLowerCase().includes(q) || c.formula.toLowerCase().includes(q)).forEach(c => currentSuggestions.push({
        plainLabel: c.name, label: `🧪 <strong>${c.name}</strong> <span class="text-muted">(${formatFormula(c.formula)})</span>`,
        card: createInfoCard({ title: c.name, badgeText: formatFormula(c.formula), badgeType: "info", rows: [`<div class="result-row">${resultField("Class", titleCase(c.class))}</div>`] }).outerHTML
    }));

    elements.filter(el => el.name.toLowerCase().includes(q) || el.symbol.toLowerCase().includes(q)).forEach(el => currentSuggestions.push({
        plainLabel: el.name, label: `⚛️ <strong>${el.name}</strong> <span class="text-muted">(${el.symbol})</span>`,
        card: createInfoCard({ title: el.name, badgeText: `Z = ${el.atomic_number}`, badgeType: "success", rows: [`<div class="result-row">${resultField("Symbol", el.symbol)}${resultField("Category", titleCase(el.category))}</div>`] }).outerHTML
    }));

    reactions.filter(r => r.reactant_id.toLowerCase().includes(q) || r.reagent_id.toLowerCase().includes(q) || r.reaction_type.toLowerCase().includes(q) || (r.balanced_equation || "").toLowerCase().includes(q)).forEach(r => currentSuggestions.push({
        plainLabel: `${titleCase(r.reactant_id)} + ${displayReagentPlainFmt(r.reagent_id)}`, label: `🔄 <strong>${titleCase(r.reactant_id)} + ${displayReagentHtmlFmt(r.reagent_id)}</strong> <span class="text-muted">(${titleCase(r.reaction_type)})</span>`,
        card: createInfoCard({ title: `${titleCase(r.reactant_id)} + ${displayReagentHtmlFmt(r.reagent_id)}`, badgeText: "Reaction", badgeType: "primary", bodyHtml: `<div class="equation-box">${formatEquation(r.balanced_equation || "No equation")}</div>` }).outerHTML
    }));

    preparations.filter(p => p.target_id.toLowerCase().includes(q) || p.method.toLowerCase().includes(q) || p.equation.toLowerCase().includes(q)).forEach(p => currentSuggestions.push({
        plainLabel: p.method, label: `🏭 <strong>${p.method}</strong> <span class="text-muted">(Prep for ${titleCase(p.target_id)})</span>`,
        card: createInfoCard({ title: p.method, badgeText: "Prep", badgeType: "warning", bodyHtml: `<div class="result-field"><div class="label">Target</div><div class="value">${titleCase(p.target_id)}</div></div>` }).outerHTML
    }));

    idTests.filter(t => t.name.toLowerCase().includes(q) || (t.dry_test && t.dry_test.result.toLowerCase().includes(q))).forEach(t => currentSuggestions.push({
        plainLabel: t.name, label: `💨 <strong>Test for ${formatFormula(t.name)}</strong>`,
        card: createInfoCard({ title: `Test for ${formatFormula(t.name)}`, badgeText: "Analysis", badgeType: "alert", bodyHtml: `<div class="result-field"><div class="label">Target Type</div><div class="value">${t.category}</div></div>` }).outerHTML
    }));

    if (currentSuggestions.length > 0) {
        suggestionsDiv.style.display = "block";
        suggestionsDiv.innerHTML = currentSuggestions.map((s, i) => `<div class="suggestion-item" data-idx="${i}" style="padding: 12px 16px; border-bottom: 1px solid var(--color-border); cursor: pointer; font-size: 0.95rem;">${s.label}</div>`).join("");
    } else {
        suggestionsDiv.style.display = "block";
        suggestionsDiv.innerHTML = `<div style="padding: 12px 16px; color: var(--color-text-muted);">No suggestions found</div>`;
    }
  });
}