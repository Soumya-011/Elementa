/**
 * feat-database.js
 * Compounds, Reactions, Preparations, and Identification Tests modules.
 */

import {
  getReactions, getMisconceptions, getCompounds, getPreparations, getIdTests,
  formatEquation, formatMultiEquation, formatFormula, navigateTo
} from './core.js';

import { createInfoCard, resultField, titleCase, activeSmilesDrawers, jumpButtonHTML } from './feat-helpers.js';
import { ACIDS, BASES } from './feat-titration.js';

// Phase 9: shared id normaliser — reactions.json uses "acetic acid" while
// compounds.json / titration use "acetic_acid".
const normId = (v) => String(v ?? '').trim().toLowerCase().replace(/\s+/g, '_');
const titratableId = (id) => {
  const n = normId(id);
  return ACIDS.some(a => a.id === n) || BASES.some(b => b.id === n) ? n : null;
};
const jumpRow = (buttons) => buttons.length ? `<div class="jump-row">${buttons.join('')}</div>` : '';

/* =====================================================================
   3. REACTIONS MODULE
   ===================================================================== */
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

function uniqueSorted(values) {
  return [...new Set(values.map(v => String(v)))].sort();
}
export async function mountReactions(container, params = null) {
  container.innerHTML = `<div class="placeholder-note">Loading reaction database...</div>`;
  let reactions, misconceptions, compounds;
  try { reactions = await getReactions(); } catch (err) { container.innerHTML = `<div class="placeholder-note">Error: ${err.message}</div>`; return; }
  try { misconceptions = await getMisconceptions(); } catch (err) { misconceptions = []; }
  try { compounds = await getCompounds(); } catch (err) { compounds = []; }

  const compoundsById = new Map(compounds.map(c => [String(c.id).toLowerCase(), c]));
  const displayReagentPlainFmt = (id) => displayReagentPlain(id, compoundsById);
  const displayReagentHtmlFmt = (id) => displayReagentHtml(id, compoundsById);
  const getMisconception = (id) => misconceptions.find(m => m.target_id === id);

  container.innerHTML = "";
  const intro = document.createElement("div");
  intro.className = "module-header";
  intro.style.cssText = "--mh-accent: var(--accent-lithium); --mh-accent-dim: var(--accent-lithium-dim);";
  intro.innerHTML = '<div class="mh-icon">⚗️</div><div class="mh-text"><h2>Reaction Mechanics</h2><p>Pick a reactant or a reagent first — dropdowns cascade dynamically.</p></div>';
  container.appendChild(intro);

  const allReactants = uniqueSorted(reactions.map((r) => r.reactant_id));
  const allReagents = uniqueSorted(reactions.map((r) => r.reagent_id));

  const panel = document.createElement("div");
  panel.className = "panel";
  const grid = document.createElement("div");
  grid.className = "form-grid";

  function buildField(id, labelText) {
    const wrapper = document.createElement("div");
    wrapper.className = "field";
    const label = document.createElement("label");
    label.textContent = labelText;
    label.setAttribute("for", id);
    const select = document.createElement("select");
    select.id = id;
    wrapper.appendChild(label);
    wrapper.appendChild(select);
    grid.appendChild(wrapper);
    return select;
  }

  const reactantSelect = buildField("rx-reactant", "Reactant (Metal / Element)");
  const reagentSelect = buildField("rx-reagent", "Acid / Base (Reagent)");
  const concentrationSelect = buildField("rx-concentration", "Concentration");
  const temperatureSelect = buildField("rx-temperature", "Temperature");

  const button = document.createElement("button");
  button.className = "btn-primary";
  button.textContent = "Check Reaction";

  panel.appendChild(grid);
  panel.appendChild(button);
  container.appendChild(panel);

  const resultContainer = document.createElement("div");
  resultContainer.id = "rx-result";
  container.appendChild(resultContainer);

  function filterReactions({ reactant, reagent, concentration, temperature }) {
    return reactions.filter(r =>
        (reactant == null || String(r.reactant_id) === String(reactant)) &&
        (reagent == null || String(r.reagent_id) === String(reagent)) &&
        (concentration == null || String(r.concentration) === String(concentration)) &&
        (temperature == null || String(r.temperature) === String(temperature))
    );
  }

  function populate(select, rawValues, displayFn) {
    const previous = select.value;
    select.innerHTML = "";
    for (const raw of rawValues) {
      const opt = document.createElement("option");
      opt.value = String(raw);
      opt.textContent = displayFn ? displayFn(raw) : String(raw);
      select.appendChild(opt);
    }
    const strValues = rawValues.map(v => String(v));
    select.value = strValues.includes(String(previous)) ? String(previous) : (strValues[0] ?? "");
  }

  const refreshReagent = () => populate(reagentSelect, reactantSelect.value ? uniqueSorted(filterReactions({ reactant: reactantSelect.value }).map(r => r.reagent_id)) : allReagents, id => displayReagentPlain(id, compoundsById));
  const refreshConc = () => populate(concentrationSelect, uniqueSorted(filterReactions({ reactant: reactantSelect.value, reagent: reagentSelect.value }).map(r => r.concentration)), titleCase);
  const refreshTemp = () => populate(temperatureSelect, uniqueSorted(filterReactions({ reactant: reactantSelect.value, reagent: reagentSelect.value, concentration: concentrationSelect.value }).map(r => r.temperature)), titleCase);

  populate(reactantSelect, allReactants, titleCase);
  refreshReagent(); refreshConc(); refreshTemp();

  reactantSelect.addEventListener("change", () => { refreshReagent(); refreshConc(); refreshTemp(); });
  reagentSelect.addEventListener("change", () => {
    populate(reactantSelect, reagentSelect.value ? uniqueSorted(filterReactions({reagent: reagentSelect.value}).map(r=>r.reactant_id)) : allReactants, titleCase);
    refreshConc(); refreshTemp();
  });
  concentrationSelect.addEventListener("change", () => refreshTemp());

  button.addEventListener("click", () => {
    resultContainer.innerHTML = "";
    try {
      const match = reactions.find(r =>
          String(r.reactant_id).trim().toLowerCase() === String(reactantSelect.value).trim().toLowerCase() &&
          String(r.reagent_id).trim().toLowerCase() === String(reagentSelect.value).trim().toLowerCase() &&
          String(r.concentration).trim().toLowerCase() === String(concentrationSelect.value).trim().toLowerCase() &&
          String(r.temperature).trim().toLowerCase() === String(temperatureSelect.value).trim().toLowerCase()
      );

      if (!match) {
        resultContainer.appendChild(createInfoCard({
          title: "No matching entry", badgeText: "Not in database", badgeType: "warning",
          bodyHtml: `<p class="text-muted" style="margin-top:10px;">No reaction record exists for that exact combination yet.</p>`,
        }));
        return;
      }

      const isReaction = match.result === "reaction";
      let bodyHtml = "";

      if (match.balanced_equation) {
        try { bodyHtml += `<div class="equation-box">${formatEquation(match.balanced_equation)}</div>`; }
        catch (eqErr) { bodyHtml += `<div class="equation-box">${match.balanced_equation}</div>`; }
      }

      bodyHtml += `<div class="result-row">${resultField("Main product", formatFormula(match.main_product))}${resultField("Reaction type", titleCase(match.reaction_type))}</div>`;

      if (match.byproducts && match.byproducts.length > 0) {
        bodyHtml += `<div class="result-field" style="margin-top:8px;"><div class="label">Byproducts</div><div class="chip-list">${match.byproducts.map((b) => `<span class="chip">${formatFormula(b)}</span>`).join("")}</div></div>`;
      }

      if (match.explanation) bodyHtml += `<div class="explanation-box${isReaction ? "" : " warning"}"><strong>Why:</strong> ${match.explanation}</div>`;

      try {
        const mis = getMisconception(match.reactant_id) || getMisconception(match.reagent_id);
        if (mis) bodyHtml += `<div class="misconception-box"><strong>⚠️ Misconception Alert:</strong> <s>${mis.misconception}</s><br><em>Fact:</em> ${mis.correction}</div>`;
      } catch (misErr) {}

      // Phase 9: cross-links — reagent's compound entry, and titration for acids/bases.
      {
        const btns = [];
        const rid = normId(match.reagent_id);
        if (compoundsById.has(rid)) btns.push(jumpButtonHTML(`${displayReagentPlainFmt(match.reagent_id)} in Compounds`, 'compounds', rid, '🧪', { compoundId: rid }));
        const tid = titratableId(match.reagent_id);
        if (tid) btns.push(jumpButtonHTML('Try titrating this', 'titration', tid, '⚗️', { analyte: tid }));
        if (btns.length) bodyHtml += jumpRow(btns);
      }

      if (!isReaction && match.explanation && match.explanation.toLowerCase().includes("reactivity")) {
          bodyHtml += `<button class="btn-primary" id="btn-see-reactivity" style="margin-top: 14px; background: var(--color-surface-alt); color: var(--color-text); border: 1px solid var(--color-border); box-shadow: none;">See Why on Reactivity Series</button>`;
      }

      resultContainer.appendChild(createInfoCard({
        title: `${titleCase(match.reactant_id)} + ${displayReagentHtmlFmt(match.reagent_id)}`,
        subtitle: `${titleCase(match.concentration)}, ${titleCase(match.temperature)}`,
        badgeText: isReaction ? "Reaction occurs" : "No reaction / caution",
        badgeType: isReaction ? "success" : "danger",
        rows: [`<div class="result-row">${resultField("Reactant", titleCase(match.reactant_id))}${resultField("Reagent", displayReagentHtmlFmt(match.reagent_id))}</div>`],
        bodyHtml: bodyHtml
      }));

      const seeBtn = document.getElementById("btn-see-reactivity");
      if (seeBtn) {
          seeBtn.addEventListener("click", () => {
              const targetRef = (match.reagent_id.includes("hcl") || match.reagent_id.includes("h2so4") || match.reagent_id.includes("h2o") || match.reagent_id.includes("hno3")) ? "hydrogen" : "copper";
              navigateTo("reactivity", { highlight: [match.reactant_id, targetRef] });
          });
      }
    } catch (err) {
      resultContainer.innerHTML = `<div class="misconception-box"><strong>UI Error:</strong> ${err.message}</div>`;
    }
  });
  // Phase 9: Compounds DB deep link — params.reagent (or params.reactant) is an
  // id; pre-select it, cascade the dependent dropdowns, and show the first match.
  // Unknown ids are ignored (dropdowns keep their defaults).
  if (params?.reagent) {
    const raw = allReagents.find(r => normId(r) === normId(params.reagent));
    if (raw) { reagentSelect.value = raw; reagentSelect.dispatchEvent(new Event("change")); button.click(); }
  } else if (params?.reactant) {
    const raw = allReactants.find(r => normId(r) === normId(params.reactant));
    if (raw) { reactantSelect.value = raw; reactantSelect.dispatchEvent(new Event("change")); button.click(); }
  }
}

export async function mountCompounds(container, params = null) {
  container.innerHTML = `<div class="placeholder-note">Loading compounds...</div>`;
  let compounds, misconceptions;
  try { compounds = await getCompounds(); } catch (e) { container.innerHTML = `<div class="placeholder-note">Failed to load compounds.</div>`; return; }
  try { misconceptions = await getMisconceptions(); } catch (e) { misconceptions = []; }
  // Phase 9: reverse-link sources (best-effort; a failed load just hides that link).
  let preps = [], rxns = [], idTests = [];
  try { preps = await getPreparations(); } catch (e) {}
  try { rxns = await getReactions(); } catch (e) {}
  try { idTests = await getIdTests(); } catch (e) {}
  const compoundLinkRow = (comp) => {
    const id = normId(comp.id);
    const btns = [];
    if (preps.some(p => normId(p.target_id) === id)) btns.push(jumpButtonHTML('Synthesis', 'preparations', id, '🏭'));
    if (rxns.some(r => normId(r.reagent_id) === id)) btns.push(jumpButtonHTML('Reactions', 'reactions', id, '⚗️', { reagent: id }));
    if (idTests.some(t => normId(t.id) === id)) btns.push(jumpButtonHTML('Identification', 'idtests', id, '🔬'));
    const tid = titratableId(id);
    if (tid) btns.push(jumpButtonHTML('Titrate', 'titration', tid, '🧪', { analyte: tid }));
    return jumpRow(btns);
  };

  activeSmilesDrawers.length = 0;

  const renderCards = (filterId) => {
    let html = "";
    const filtered = filterId === "all" ? compounds : compounds.filter(c => c.id === filterId);

    for(let comp of filtered) {
      let bodyHtml = "";
      const mis = misconceptions.find(m => m.target_id === comp.id);
      if (mis) bodyHtml += `<div class="misconception-box"><strong>⚠️ Misconception Alert:</strong> <s>${mis.misconception}</s><br><em>Fact:</em> ${mis.correction}</div>`;

      bodyHtml += compoundLinkRow(comp);
      const card = createInfoCard({
        title: comp.name,
        badgeText: formatFormula(comp.formula),
        badgeType: "info",
        rows: [`<div class="result-row">
          ${resultField("Class", titleCase(comp.class))}
          ${resultField("Molar Mass", `${comp.molar_mass_g_mol} g/mol`)}
          ${resultField("State at RTP", titleCase(comp.state_at_rtp))}
          ${resultField("Melting Pt", `${comp.melting_point_c}&deg;C`)}
        </div>`],
        bodyHtml: bodyHtml
      });
      html += card.outerHTML;
    }
    return { html };
  };

  // Phase 8e: filter compounds by element symbol (periodic table deep link).
  // Matches the symbol as a standalone element token in the formula —
  // e.g. "Fe" matches Fe2(SO4)3 but not a hypothetical "Fer..." token —
  // using the same capital-letter-starts-a-new-element rule core.js's own
  // formula parsers (calculateMolarMass/countAtoms) rely on.
  function compoundsContainingElement(symbol) {
    const re = new RegExp(`${symbol}(?![a-z])`);
    return compounds.filter(c => c.formula && re.test(c.formula));
  }

  container.innerHTML = `
    <div class="module-header" style="--mh-accent: var(--accent-copper); --mh-accent-dim: var(--accent-copper-dim);">
      <div class="mh-icon">🧪</div>
      <div class="mh-text"><h2>Compounds DB</h2><p>Explore detailed properties and automatically generated 2D structures for all compounds.</p></div>
    </div>
    <div class="panel">
      <div class="field" style="margin-bottom: 0;">
        <label>Select Compound to View</label>
        <select id="compound-filter">
          <option value="all">Show All Compounds</option>
          ${compounds.map(c => `<option value="${c.id}">${c.name} (${formatFormula(c.formula)})</option>`).join("")}
        </select>
      </div>
    </div>
    <div id="compounds-element-banner"></div>
    <div class="search-grid" id="compounds-grid"></div>
  `;

  const bannerEl = document.getElementById("compounds-element-banner");
  const filterSelect = document.getElementById("compound-filter");

  const injectAndDraw = (filterId) => {
      const grid = document.getElementById("compounds-grid");
      const result = renderCards(filterId);
      grid.innerHTML = result.html;
  };

  const injectElementFiltered = (symbol) => {
      const grid = document.getElementById("compounds-grid");
      const matches = compoundsContainingElement(symbol);
      bannerEl.innerHTML = `
        <div class="panel" style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
          <span>Showing ${matches.length} compound${matches.length === 1 ? '' : 's'} containing <strong>${symbol}</strong></span>
          <button type="button" class="btn-primary" id="compounds-clear-filter" style="width:auto; padding:6px 16px; background: var(--color-surface-alt); color: var(--color-text); border: 1px solid var(--color-border); box-shadow:none;">Show All Compounds</button>
        </div>`;
      document.getElementById('compounds-clear-filter').addEventListener('click', () => {
        bannerEl.innerHTML = '';
        filterSelect.value = 'all';
        injectAndDraw('all');
      });
      if (matches.length === 0) {
        grid.innerHTML = `<div class="placeholder-note">No compounds in the database contain ${symbol}.</div>`;
        return;
      }
      grid.innerHTML = matches.map(comp => {
        const mis = misconceptions.find(m => m.target_id === comp.id);
        let bodyHtml = mis ? `<div class="misconception-box"><strong>⚠️ Misconception Alert:</strong> <s>${mis.misconception}</s><br><em>Fact:</em> ${mis.correction}</div>` : "";
        bodyHtml += compoundLinkRow(comp);
        return createInfoCard({
          title: comp.name, badgeText: formatFormula(comp.formula), badgeType: "info",
          rows: [`<div class="result-row">${resultField("Class", titleCase(comp.class))}${resultField("Molar Mass", `${comp.molar_mass_g_mol} g/mol`)}${resultField("State at RTP", titleCase(comp.state_at_rtp))}${resultField("Melting Pt", `${comp.melting_point_c}&deg;C`)}</div>`],
          bodyHtml
        }).outerHTML;
      }).join("");
  };

  filterSelect.addEventListener("change", (e) => { bannerEl.innerHTML = ''; injectAndDraw(e.target.value); });

  // Phase 8e: a periodic-table jump button passes params.focus = an element
  // symbol (e.g. 'Fe') — open straight into the element-filtered view instead
  // of "Show All Compounds". (This wiring was missing before Phase 8 — the
  // filter machinery above existed but nothing ever called it.)
  // Phase 9: params.compoundId opens a single compound (select + filter).
  if (params?.compoundId && compounds.some(c => c.id === params.compoundId)) {
    filterSelect.value = params.compoundId;
    injectAndDraw(params.compoundId);
  } else if (params?.focus && !params?.tab) {
    injectElementFiltered(params.focus);
  } else {
    injectAndDraw("all");
  }
}
export async function mountPreparations(container, params = null) {
  container.innerHTML = `<div class="placeholder-note">Loading preparations...</div>`;
  let preps;
  try { preps = await getPreparations(); } catch (e) {
    container.innerHTML = `<div class="placeholder-note">Failed to load preparations.</div>`;
    return;
  }

  let compoundIds = new Set();
  try { compoundIds = new Set((await getCompounds()).map(c => normId(c.id))); } catch (e) {}
  // Readable target label: compound formula when known, else a few explicit labels,
  // else "Br2"/"He"/"P4"-style element forms, else the old behaviour.
  let compoundFormulas = new Map();
  try { compoundFormulas = new Map((await getCompounds()).map(c => [normId(c.id), c.formula])); } catch (e) {}
  const TARGET_LABELS = { co2: 'CO2', h2s: 'H2S', aqua_regia: 'Aqua Regia', pbno3: 'Pb(NO3)2', h2: 'H2', o2: 'O2', n2: 'N2' };
  const formatPrepTarget = (t) => {
    const n = normId(t);
    if (TARGET_LABELS[n]) return TARGET_LABELS[n];
    if (compoundFormulas.has(n)) return compoundFormulas.get(n);
    if (/^[a-z]{1,2}\d?$/.test(n)) return n.charAt(0).toUpperCase() + n.slice(1);
    return n.length <= 5 ? n.toUpperCase() : titleCase(t);
  };
  const uniqueTargets = [...new Set(preps.map(p => p.target_id))].sort();

  const renderCards = (filterId) => {
    let html = "";
    let filtered = filterId === "all" ? preps : preps.filter(p => p.target_id === filterId);

    filtered = filtered.sort((a, b) => {
      const aIsLab = a.method.toLowerCase().includes('lab');
      const bIsLab = b.method.toLowerCase().includes('lab');
      return aIsLab && !bIsLab ? -1 : (!aIsLab && bIsLab ? 1 : 0);
    });

    for(let prep of filtered) {
      let bodyHtml = `<div class="result-field" style="margin-bottom: 8px;"><div class="label">Reactants</div><div class="value">${prep.reactants.join(", ")}</div></div>`;
      bodyHtml += formatMultiEquation(prep.equation);
      if (prep.notes) bodyHtml += `<div class="explanation-box"><strong>Notes:</strong> ${prep.notes}</div>`;

      if (compoundIds.has(normId(prep.target_id))) bodyHtml += jumpRow([jumpButtonHTML(`${formatPrepTarget(prep.target_id)} in Compounds`, 'compounds', prep.target_id, '🧪', { compoundId: normId(prep.target_id) })]);
      const card = createInfoCard({
        title: prep.method, badgeText: titleCase(prep.type) + " Prep", badgeType: "primary",
        rows: [`<div class="result-row">${resultField("Target", formatPrepTarget(prep.target_id))}${resultField("Category", titleCase(prep.type))}${resultField("Collection", prep.collection)}</div>`],
        bodyHtml: bodyHtml
      });
      html += card.outerHTML;
    }
    return html;
  };

  container.innerHTML = `
    <div class="module-header" style="--mh-accent: var(--accent-lithium); --mh-accent-dim: var(--accent-lithium-dim);">
      <div class="mh-icon">🏭</div>
      <div class="mh-text"><h2>Synthesis Protocols</h2><p>Explore Lab and Industrial preparation methods for gases, acids, and bases.</p></div>
    </div>
    <div class="panel">
      <div class="field" style="margin-bottom: 0;">
        <label>Select Preparation to View</label>
        <select id="prep-filter"><option value="all">Show All Preparations</option>${uniqueTargets.map(t => `<option value="${t}">Preparation of ${formatPrepTarget(t)}</option>`).join("")}</select>
      </div>
    </div>
    <div class="stacked-cards" id="preps-grid">${renderCards("all")}</div>
  `;
  const prepFilter = document.getElementById("prep-filter");
  prepFilter.addEventListener("change", (e) => { document.getElementById("preps-grid").innerHTML = renderCards(e.target.value); });
  // Phase 9: params.focus = a target_id; ignored if there are no preparations for it.
  if (params?.focus) {
    const t = uniqueTargets.find(x => normId(x) === normId(params.focus));
    if (t) { prepFilter.value = t; document.getElementById("preps-grid").innerHTML = renderCards(t); }
  }
}

export async function mountIdentificationTests(container, params = null) {
  container.innerHTML = `<div class="placeholder-note">Compiling qualitative matrices...</div>`;
  let tests;
  try { tests = await getIdTests(); } catch (e) {
    container.innerHTML = `<div class="placeholder-note">Failed to load identification tests. Try refreshing.</div>`;
    return;
  }
  if (!tests || tests.length === 0) {
    container.innerHTML = `<div class="placeholder-note">No identification test data available.</div>`;
    return;
  }

  let compoundIds = new Set();
  try { compoundIds = new Set((await getCompounds()).map(c => normId(c.id))); } catch (e) {}
  const renderCards = (filterCategory) => {
    const list = filterCategory === "all" ? tests : tests.filter(t => String(t.category).toLowerCase() === String(filterCategory).toLowerCase());
    if(list.length === 0) return `<div class="placeholder-note">No analytical data matches.</div>`;

    return list.map(test => {
      let bodyHtml = "";
      if (test.dry_test) {
        bodyHtml += `<div class="result-row protocol-box">
            <div class="protocol-box-header"><strong style="color: var(--color-primary); font-size: 0.85rem; text-transform: uppercase;">Preliminary Protocol</strong></div>
            ${resultField("Procedure", test.dry_test.procedure)}${resultField("Observation", `<span style="color: var(--color-success); font-weight: 600;">${test.dry_test.result}</span>`)}
          </div>`;
      }
      if (test.wet_test) {
        bodyHtml += `<div class="result-row protocol-box">
            <div class="protocol-box-header"><strong style="color: var(--color-info); font-size: 0.85rem; text-transform: uppercase;">Confirmatory Protocol</strong></div>
            ${resultField("Procedure", test.wet_test.procedure)}${resultField("Observation", `<span style="color: var(--color-success); font-weight: 600;">${test.wet_test.result}</span>`)}
            ${test.wet_test.equation ? `<div class="protocol-box-header" style="margin-top: 12px;">${formatMultiEquation(test.wet_test.equation)}</div>` : ""}
          </div>`;
      }
      if (test.notes) bodyHtml += `<div class="explanation-box" style="margin-top: 0;"><strong>Mechanistic Note:</strong> ${test.notes}</div>`;
      if (compoundIds.has(normId(test.id))) bodyHtml += jumpRow([jumpButtonHTML(`${titleCase(test.name)} in Compounds`, 'compounds', test.id, '🧪', { compoundId: normId(test.id) })]);
      return `<div data-idtest-id="${test.id}">` + createInfoCard({ title: test.name, badgeText: test.category, badgeType: "alert", bodyHtml: bodyHtml }).outerHTML + `</div>`;
    }).join("");
  };

  container.innerHTML = `
    <div class="module-header" style="--mh-accent: var(--accent-lithium); --mh-accent-dim: var(--accent-lithium-dim);">
      <div class="mh-icon">🔬</div>
      <div class="mh-text"><h2>Identification Analysis</h2><p>Standard chemical qualitative analysis protocols — dry and wet tests.</p></div>
    </div>
    <div class="panel">
      <div class="field" style="margin-bottom: 0;">
        <label>Filter Target Variable</label>
        <select id="idtest-filter"><option value="all">Universal View</option><option value="gas">Gaseous State</option><option value="anion">Anionic Species</option><option value="cation">Cationic Species</option></select>
      </div>
    </div>
    <div class="stacked-cards" id="idtests-grid">${renderCards("all")}</div>
  `;
  const idFilter = document.getElementById("idtest-filter");
  idFilter.addEventListener("change", (e) => { document.getElementById("idtests-grid").innerHTML = renderCards(e.target.value); });
  // Phase 9: params.focus = a test id (from Qual Analysis / Compounds). Switch the
  // category filter to the test's own category, then highlight + scroll to its card.
  if (params?.focus) {
    const target = tests.find(t => normId(t.id) === normId(params.focus));
    if (target) {
      const cat = String(target.category).toLowerCase();
      if ([...idFilter.options].some(o => o.value === cat)) idFilter.value = cat;
      document.getElementById("idtests-grid").innerHTML = renderCards(idFilter.value);
      const el = document.querySelector(`[data-idtest-id="${CSS.escape(String(target.id))}"]`);
      if (el) {
        el.classList.add("flame-card-highlight");
        setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
      }
    }
  }
}