/**
 * feat-database.js
 * Compounds, Reactions, Preparations, and Identification Tests modules.
 */

import {
  getReactions, getMisconceptions, getCompounds, getPreparations, getIdTests,
  formatEquation, formatMultiEquation, formatFormula, navigateTo
} from './core.js';

import { createInfoCard, resultField, drawSmiles, titleCase, activeSmilesDrawers } from './feat-helpers.js';

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
export async function mountReactions(container) {
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
}

export async function mountCompounds(container) {
  container.innerHTML = `<div class="placeholder-note">Loading compounds...</div>`;
  let compounds, misconceptions;
  try { compounds = await getCompounds(); } catch (e) { container.innerHTML = `<div class="placeholder-note">Failed to load compounds.</div>`; return; }
  try { misconceptions = await getMisconceptions(); } catch (e) { misconceptions = []; }
  
  activeSmilesDrawers.length = 0;

  const fallbackSmiles = {
      "water": "O", "sulfuric_acid": "OS(=O)(=O)O",
      "ammonia": "N", "methane": "C", "carbon_dioxide": "O=C=O", "acetic_acid": "CC(=O)O",
      "benzene": "C1=CC=CC=C1", "ethanol": "CCO"
  };

  const renderCards = (filterId) => {
    let html = "";
    let targetsToDraw = [];
    const filtered = filterId === "all" ? compounds : compounds.filter(c => c.id === filterId);
    
    for(let comp of filtered) {
      let bodyHtml = "";
      const mis = misconceptions.find(m => m.target_id === comp.id);
      if (mis) bodyHtml += `<div class="misconception-box"><strong>⚠️ Misconception Alert:</strong> <s>${mis.misconception}</s><br><em>Fact:</em> ${mis.correction}</div>`;

      const smilesString = comp.smiles || fallbackSmiles[comp.id.toLowerCase()];

      if (smilesString) {
          const canvasId = `smiles-comp-${comp.id}`;
          bodyHtml += `
            <div style="text-align: center; background: var(--color-surface); border: 1px solid var(--color-border); padding: 10px; border-radius: 8px; margin-top: 16px;">
                <p class="text-muted" style="font-size: 0.8rem; margin-bottom: 6px;">2D Topology (SMILES: ${smilesString})</p>
                <canvas id="${canvasId}" width="250" height="200" style="width: 250px; height: 200px; max-width: 100%;"></canvas>
            </div>
          `;
          targetsToDraw.push({ id: canvasId, smiles: smilesString });
      }

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
    return { html, targetsToDraw };
  };

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
    <div class="search-grid" id="compounds-grid"></div>
  `;

  const injectAndDraw = (filterId) => {
      const grid = document.getElementById("compounds-grid");
      const result = renderCards(filterId);
      grid.innerHTML = result.html;
      setTimeout(() => {
          result.targetsToDraw.forEach(target => { drawSmiles(target.smiles, target.id, 250, 200); });
      }, 150);
  };

  document.getElementById("compound-filter").addEventListener("change", (e) => injectAndDraw(e.target.value));
  injectAndDraw("all");
}

/* =====================================================================
   4. SYNTHESIS PROTOCOLS MODULE
   ===================================================================== */

// target_ids that are formulas but aren't full entries in compounds.json
// (elemental gases, bare metals, and mixtures). Keys are the raw target_id
// (lowercase); values are the correctly-cased formula (or, for non-formula
// names, the display text directly).
const PREP_TARGET_FORMULA_OVERRIDES = {
  h2: "H2",
  o2: "O2",
  n2: "N2",
  co2: "CO2",
  na: "Na",
  h2s: "H2S",
};
const PREP_TARGET_NAME_OVERRIDES = {
  aqua_regia: "Aqua Regia",
};
// preparations.json has a stray "pbno3" target_id that doesn't match the
// "pbno32" id used for the same compound in compounds.json — remap for lookup only.
const PREP_TARGET_ID_ALIASES = {
  pbno3: "pbno32",
};

/**
 * Renders a preparation's target_id (e.g. "fe", "cao", "h2") as a properly
 * cased chemical formula/name — never a naive uppercase/titlecase guess.
 * Prefers the compounds.json entry (source of truth for casing), falls back
 * to a small explicit override table for ids that aren't in compounds.json,
 * and only falls back to titleCase as a last resort for unknown ids.
 */
function formatPrepTarget(rawId, compoundsById = new Map()) {
  const key = String(rawId).toLowerCase();
  const lookupKey = PREP_TARGET_ID_ALIASES[key] || key;

  const compound = compoundsById.get(lookupKey);
  if (compound && compound.formula) return formatFormula(compound.formula);

  if (PREP_TARGET_FORMULA_OVERRIDES[lookupKey]) return formatFormula(PREP_TARGET_FORMULA_OVERRIDES[lookupKey]);
  if (PREP_TARGET_NAME_OVERRIDES[lookupKey]) return PREP_TARGET_NAME_OVERRIDES[lookupKey];

  return titleCase(rawId);
}

export async function mountPreparations(container) {
  container.innerHTML = `<div class="placeholder-note">Loading preparations...</div>`;
  let preps, compounds;
  try { preps = await getPreparations(); } catch (e) {
    container.innerHTML = `<div class="placeholder-note">Failed to load preparations.</div>`;
    return;
  }
  try { compounds = await getCompounds(); } catch (e) { compounds = []; }

  const compoundsById = new Map(compounds.map(c => [String(c.id).toLowerCase(), c]));
  const formatTarget = (t) => formatPrepTarget(t, compoundsById);

  const uniqueTargets = [...new Set(preps.map(p => p.target_id))].sort();

  const renderCards = (filterId) => {
    let html = "";
    // NOTE: previously `filtered = preps` (same reference) when filterId === "all",
    // then `.sort()` mutated the shared `preps` array in place on every render.
    // Copy it instead so re-renders don't silently reorder the source data.
    let filtered = filterId === "all" ? preps.slice() : preps.filter(p => p.target_id === filterId);

    filtered = filtered.sort((a, b) => {
      const aIsLab = a.method.toLowerCase().includes('lab');
      const bIsLab = b.method.toLowerCase().includes('lab');
      return aIsLab && !bIsLab ? -1 : (!aIsLab && bIsLab ? 1 : 0);
    });

    for(let prep of filtered) {
      let bodyHtml = `<div class="result-field" style="margin-bottom: 8px;"><div class="label">Reactants</div><div class="value">${prep.reactants.join(", ")}</div></div>`;
      bodyHtml += formatMultiEquation(prep.equation);
      if (prep.notes) bodyHtml += `<div class="explanation-box"><strong>Notes:</strong> ${prep.notes}</div>`;

      const card = createInfoCard({
        title: prep.method, badgeText: titleCase(prep.type) + " Prep", badgeType: "primary",
        rows: [`<div class="result-row">${resultField("Target", formatTarget(prep.target_id))}${resultField("Category", titleCase(prep.type))}${resultField("Collection", prep.collection)}</div>`],
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
        <select id="prep-filter"><option value="all">Show All Preparations</option>${uniqueTargets.map(t => `<option value="${t}">Preparation of ${formatTarget(t)}</option>`).join("")}</select>
      </div>
    </div>
    <div class="stacked-cards" id="preps-grid">${renderCards("all")}</div>
  `;
  document.getElementById("prep-filter").addEventListener("change", (e) => { document.getElementById("preps-grid").innerHTML = renderCards(e.target.value); });
}

export async function mountIdentificationTests(container) {
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
      return createInfoCard({ title: test.name, badgeText: test.category, badgeType: "alert", bodyHtml: bodyHtml }).outerHTML;
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
  document.getElementById("idtest-filter").addEventListener("change", (e) => { document.getElementById("idtests-grid").innerHTML = renderCards(e.target.value); });
}