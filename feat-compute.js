/**
 * feat-compute.js
 * Calculators, Unit Converter, and post-mount upgrade functions.
 */

import {
  getElements, calculateMolarMass, countAtoms, calcMolarity, calcMolality, calcNormality,
  solveIdealGas, solveCombinedGas, solveAvogadros, balanceEquationAsync,
  calculateQ, calculateMolarSolubility, calculateNernst,
  getStructure, formatFormula, formatEquation, navigateTo
} from './core.js';

import { moduleHeaderHTML, activeSmilesDrawers } from './feat-helpers.js';

/* =====================================================================
   SHARED DATA LOADER
   ===================================================================== */
let halfCellsCache = null;
async function loadHalfCells() {
  if (halfCellsCache) return halfCellsCache;
  try {
    const res = await fetch('data/half_cells.json');
    if (res.ok) { halfCellsCache = await res.json(); return halfCellsCache; }
  } catch (e) { /* fall through to fallback */ }
  // Fallback minimal set in case JSON fails to load
  halfCellsCache = [
    { id: 'zn', reduction: 'Zn²⁺(aq) + 2e⁻ ⇌ Zn(s)', oxidation: 'Zn(s) ⇌ Zn²⁺(aq) + 2e⁻', e0: -0.76, n: 2, ion: 'Zn²⁺' },
    { id: 'cu', reduction: 'Cu²⁺(aq) + 2e⁻ ⇌ Cu(s)', oxidation: 'Cu(s) ⇌ Cu²⁺(aq) + 2e⁻', e0: 0.34, n: 2, ion: 'Cu²⁺' },
    { id: 'h',  reduction: '2H⁺(aq) + 2e⁻ ⇌ H₂(g)',  oxidation: 'H₂(g) ⇌ 2H⁺(aq) + 2e⁻',  e0: 0.00, n: 2, ion: 'H⁺' }
  ];
  return halfCellsCache;
}

/* =====================================================================
   10. CALCULATORS MODULE (Upgraded with Phase 3.2 Nernst Engine)
   ===================================================================== */
export async function mountCalculators(container) {
  container.innerHTML = `<div class="placeholder-note">Booting mathematical engine...</div>`;
  let elementsData = [];
  try { elementsData = await getElements(); } catch (e) {}

  activeSmilesDrawers.length = 0;

  container.innerHTML = `
    <div class="module-header" style="--mh-accent: var(--accent-sodium); --mh-accent-dim: var(--accent-sodium-dim);">
      <div class="mh-icon">🧮</div>
      <div class="mh-text"><h2>Calculators</h2><p>Thermodynamic, stoichiometric, and topological models.</p></div>
    </div>
    
    <div class="calc-nav" style="margin-bottom: 20px; max-width: 360px; margin-left: auto; margin-right: auto;">
      <div class="field" style="margin-bottom: 0;">
        <label style="font-weight: 600; margin-bottom: 4px; display: block; text-align: center;">Calculator</label>
        <select id="calc-tab-select" style="font-size: 0.95rem; padding: 10px 14px; text-align: center;">
          <option value="3dviewer">🔬 3D Viewer</option>
          <option value="balancer">⚖️ Balancer</option>
          <option value="stoich">📐 Stoichiometry & Solutions</option>
          <option value="gaslaws">🌡️ Gas Laws</option>
          <option value="ph">📊 pH</option>
          <option value="ksp">💧 Ksp</option>
          <option value="electro">⚡ Electrochem</option>
        </select>
      </div>
    </div>

    <div id="calc-3dviewer" class="calc-panel">
      <h3 style="color: var(--color-primary); margin-bottom: 4px;"><span class="calc-icon">🔬</span> 3D Structure Lookup</h3>
      <p class="calc-subtitle">Type a formula or name to visualize molecular geometry with WebGL.</p>
      <div class="field" style="margin-bottom: 8px; display:flex; gap: 10px;">
        <input type="text" id="structure-query-input" placeholder="e.g. Benzene, H2O, CH4..." autocomplete="off" style="flex:1;" />
        <button class="btn-primary" id="btn-structure-lookup" style="width: auto; padding: 0 24px;">Look Up</button>
      </div>
      <div id="structure-lookup-status" class="text-muted" style="font-size: 0.85rem; margin-bottom: 16px; min-height: 1.2em;"></div>
      <div style="width: 100%; height: 400px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); overflow: hidden; position: relative; background: var(--color-surface-alt);">
          <div id="glcontainer" style="width: 100%; height: 100%; position: absolute; top:0; left:0;"></div>
      </div>
      <p class="text-muted" style="font-size: 0.75rem; margin-top: 10px;">Orbital shape overlays (s/p/d/f) are planned for a future update on top of this viewer.</p>
    </div>

    <div id="calc-balancer" class="calc-panel hidden">
      <h3 style="color: var(--color-primary); margin-bottom: 4px;"><span class="calc-icon">⚖️</span> Heuristic Equation Balancer</h3>
      <p class="calc-subtitle">Enter an unbalanced equation and the matrix solver computes coefficients.</p>
      <div class="field" style="margin-bottom: 16px;">
        <input type="text" id="balancer-input" placeholder="e.g. C4H10 + O2 = CO2 + H2O" autocomplete="off" />
      </div>
      <button class="btn-primary" id="btn-balance">Compute State via Worker</button>
      <div id="balancer-result" style="margin-top: 24px;"></div>
    </div>

    <div id="calc-stoich" class="calc-panel hidden">
      <h3 style="color: var(--color-primary); margin-bottom: 4px;"><span class="calc-icon">📐</span> Stoichiometry & Solutions Calculator</h3>
      <p class="calc-subtitle">Molar mass, mole conversions, molarity, molality, and normality — all from a compound formula.</p>

      <!-- Molar Mass Section -->
      <div style="margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid var(--color-border);">
        <h4 style="color: var(--color-text); margin-bottom: 8px;">Molar Mass & Mole Conversion</h4>
        <div class="form-grid">
          <div class="field"><label>Compound Formula</label><input type="text" id="calc-formula" placeholder="e.g. Fe2(SO4)3" autocomplete="off" /><p class="text-muted" style="font-size:0.75rem; margin-top:4px;">Enter the compound formula only — no leading coefficients (e.g. H2O, not 2H2O).</p></div>
          <div class="field"><label>Mass (g)</label><input type="number" id="calc-mass" placeholder="e.g. 50" min="0" step="any" /></div>
        </div>
        <div id="stoich-result" style="margin-top: 12px;"></div>
      </div>

      <!-- Molarity / Molality / Normality Section -->
      <div>
        <h4 style="color: var(--color-text); margin-bottom: 8px;">Solution Concentration</h4>
        <div class="form-grid" style="grid-template-columns: 1fr 1fr;">
          <div class="field"><label>Mass of Solute (g)</label><input type="number" id="stoich-sol-mass" min="0" step="any" placeholder="e.g. 49" /></div>
          <div class="field"><label>Volume of Solution (L)</label><input type="number" id="stoich-sol-vol" min="0" step="any" placeholder="e.g. 1" /></div>
          <div class="field"><label>Solution Density (g/mL)</label><input type="number" id="stoich-sol-density" value="1.00" min="0" step="any" /></div>
          <div class="field"><label>n-factor (Equivalents)</label><input type="number" id="stoich-sol-nfactor" min="1" step="any" value="1" /></div>
        </div>
        <div id="stoich-derived-info" class="explanation-box" style="margin-top: 12px; font-size: 0.9rem;"></div>
        <div id="stoich-conc-result" style="margin-top: 12px;">
          <div class="result-row" style="background: var(--color-surface-alt); padding: 16px; border-radius: var(--radius-sm); border: 1px solid var(--color-border);">
            <div class="result-field"><div class="label">Molarity (M)</div><div class="value" id="stoich-res-molarity" style="font-size: 1.2rem; font-weight: 600;">0.000 M</div></div>
            <div class="result-field"><div class="label">Molality (m)</div><div class="value" id="stoich-res-molality" style="font-size: 1.2rem; font-weight: 600;">0.000 m</div></div>
            <div class="result-field"><div class="label">Normality (N)</div><div class="value" id="stoich-res-normality" style="font-size: 1.2rem; font-weight: 600;">0.000 N</div></div>
          </div>
        </div>
      </div>
    </div>

    <div id="calc-gaslaws" class="calc-panel hidden">
      <h3 style="color: var(--color-primary); margin-bottom: 4px;"><span class="calc-icon">🌡️</span> Universal Gas State Matrix</h3>
      <p class="calc-subtitle">Solve for P, V, n, or T using ideal gas, combined gas, or Avogadro's law.</p>
      <div class="form-grid" style="grid-template-columns: 1fr 1fr; margin-bottom: 16px;">
        <div class="field"><label>Gas Formula</label><input type="text" id="gas-formula" placeholder="e.g. CO2 (Auto-calculates n₁)" autocomplete="off" /></div>
        <div class="field"><label>Total Mass (g)</label><input type="number" id="gas-mass" placeholder="e.g. 44.01" step="any" /></div>
      </div>
      <div style="display: flex; gap: 20px; flex-wrap: wrap;">
        <div style="flex: 1; min-width: 200px; background: var(--color-surface-alt); padding: 16px; border-radius: var(--radius-sm); border: 1px solid var(--color-border);">
          <h4 style="margin-bottom: 12px; color: var(--color-primary);">State 1 (Initial)</h4>
          <div class="field"><label>P₁ (atm)</label><input type="number" id="gas-p1" step="any" /></div>
          <div class="field"><label>V₁ (L)</label><input type="number" id="gas-v1" step="any" /></div>
          <div class="field"><label>n₁ (mol)</label><input type="number" id="gas-n1" step="any" /></div>
          <div class="field"><label>T₁ (K)</label><input type="number" id="gas-t1" step="any" /></div>
        </div>
        <div style="flex: 1; min-width: 200px; background: var(--color-surface-alt); padding: 16px; border-radius: var(--radius-sm); border: 1px solid var(--color-border);">
          <h4 style="margin-bottom: 12px; color: var(--color-primary);">State 2 (Final)</h4>
          <div class="field"><label>P₂ (atm)</label><input type="number" id="gas-p2" step="any" /></div>
          <div class="field"><label>V₂ (L)</label><input type="number" id="gas-v2" step="any" /></div>
          <div class="field"><label>n₂ (mol)</label><input type="number" id="gas-n2" step="any" /></div>
          <div class="field"><label>T₂ (K)</label><input type="number" id="gas-t2" step="any" /></div>
        </div>
      </div>
      <button class="btn-primary" id="btn-solve-ideal" style="margin-top:20px; width: 100%;">Solve State Matrix</button>
      <div id="gas-ideal-result" style="margin-top: 24px;"></div>
    </div>
    


    <div id="calc-ph" class="calc-panel hidden">
      <h3 style="color: var(--color-primary); margin-bottom: 4px;"><span class="calc-icon">📊</span> Thermodynamic Dissociation Assessor</h3>
      <p class="calc-subtitle">Compute pH and pOH for strong and weak acids/bases at equilibrium.</p>
      <div class="field" style="margin-bottom: 16px;">
        <label>Electrolyte Strength</label>
        <select id="ph-strength"><option value="strong">Strong Acid / Base</option><option value="weak">Weak Acid / Base (Equilibrium)</option></select>
      </div>
      <div class="field hidden" id="ph-k-field" style="margin-bottom: 16px;">
        <label>Dissociation Constant (K<sub>a</sub> or K<sub>b</sub>)</label>
        <input type="number" id="calc-k-val" step="any" placeholder="e.g. 1.8e-5 for Acetic Acid" />
      </div>
      <div class="form-grid" style="grid-template-columns: 1fr 1fr;">
        <div class="field"><label>Initial Acid Conc (M)</label><input type="number" id="calc-hplus" step="any" /></div>
        <div class="field"><label>Initial Base Conc (M)</label><input type="number" id="calc-ohminus" step="any" /></div>
        <div class="field"><label>pH Output</label><input type="number" id="calc-ph-val" step="any" readonly style="background: var(--color-surface-alt);" /></div>
        <div class="field"><label>pOH Output</label><input type="number" id="calc-poh-val" step="any" readonly style="background: var(--color-surface-alt);" /></div>
      </div>
      <div id="ph-result-text" class="explanation-box" style="display:none; font-weight:bold; text-align:center;"></div>
      <div class="ph-scale"><div class="ph-indicator" id="ph-indicator" style="left: 50%;"></div></div>
      <div class="ph-labels"><span>0 (Acidic)</span><span>7 (Neutral)</span><span>14 (Basic)</span></div>
    </div>
    
    <div id="calc-ksp" class="calc-panel hidden">
      <h3 style="color: var(--color-primary); margin-bottom: 4px;"><span class="calc-icon">💧</span> Solubility Product (K<sub>sp</sub>) Evaluator</h3>
      <p class="calc-subtitle">Predict precipitation and calculate molar solubility from Ksp.</p>
      <div class="form-grid" style="grid-template-columns: 1fr 1fr; margin-bottom: 16px;">
         <div class="field"><label>Cation Stoichiometry (x)</label><input type="number" id="ksp-x" value="1" min="1" step="1"/></div>
         <div class="field"><label>Anion Stoichiometry (y)</label><input type="number" id="ksp-y" value="1" min="1" step="1"/></div>
      </div>
      <div style="display: flex; gap: 20px; flex-wrap: wrap;">
         <div style="flex: 1; min-width: 250px; background: var(--color-surface-alt); padding: 16px; border-radius: var(--radius-sm); border: 1px solid var(--color-border);">
             <h4 style="margin-bottom: 12px; color: var(--color-primary);">Molar Solubility</h4>
             <div class="field"><label>K<sub>sp</sub> Value</label><input type="number" id="ksp-val-input" placeholder="e.g. 1.8e-10" step="any"/></div>
             <div id="ksp-s-result" style="margin-top: 12px; font-size: 1.2rem; font-weight: bold; color: var(--color-primary);">s = 0.000 M</div>
         </div>
         <div style="flex: 1; min-width: 250px; background: var(--color-surface-alt); padding: 16px; border-radius: var(--radius-sm); border: 1px solid var(--color-border);">
             <h4 style="margin-bottom: 12px; color: var(--color-primary);">Precipitation Predictor (Q)</h4>
             <div class="field"><label>[A<sup>y+</sup>] Concentration (M)</label><input type="number" id="ksp-a-conc" step="any"/></div>
             <div class="field"><label>[B<sup>x-</sup>] Concentration (M)</label><input type="number" id="ksp-b-conc" step="any"/></div>
             <div id="ksp-q-result" style="margin-top: 12px; font-size: 1.2rem; font-weight: bold; color: var(--color-info);">Q = 0.000</div>
             <div id="ksp-prediction" class="explanation-box" style="display:none; margin-top: 12px;"></div>
         </div>
      </div>
    </div>

    <div id="calc-electro" class="calc-panel hidden">
      <h3 style="color: var(--color-primary); margin-bottom: 4px;"><span class="calc-icon">⚡</span> Galvanic Cell Simulator (Nernst Equation)</h3>
      <p class="calc-subtitle">Configure half-cells to compute cell voltage under standard and non-standard conditions.</p>

      <div style="display: flex; gap: 20px; flex-wrap: wrap; margin-bottom: 16px;">
         <div style="flex: 1; min-width: 250px; background: var(--color-surface-alt); padding: 16px; border-radius: var(--radius-sm); border: 1px solid var(--color-border);">
             <h4 style="margin-bottom: 12px; color: var(--color-primary);">Anode (Oxidation)</h4>
             <div class="field">
                 <label>Half-Cell</label>
                 <select id="electro-anode"></select>
             </div>
             <div class="field">
                 <label>Aqueous Ion Concentration (M)</label>
                 <input type="number" id="electro-anode-conc" value="1.0" step="any" min="1e-10"/>
             </div>
         </div>
         
         <div style="flex: 1; min-width: 250px; background: var(--color-surface-alt); padding: 16px; border-radius: var(--radius-sm); border: 1px solid var(--color-border);">
             <h4 style="margin-bottom: 12px; color: var(--color-primary);">Cathode (Reduction)</h4>
             <div class="field">
                 <label>Half-Cell</label>
                 <select id="electro-cathode"></select>
             </div>
             <div class="field">
                 <label>Aqueous Ion Concentration (M)</label>
                 <input type="number" id="electro-cathode-conc" value="1.0" step="any" min="1e-10"/>
             </div>
         </div>
      </div>

      <div class="form-grid" style="grid-template-columns: 1fr 1fr; align-items: end;">
          <div class="field" style="margin-bottom: 0;">
            <label>System Temperature (K)</label>
            <input type="number" id="electro-temp" value="298.15" step="any" min="1"/>
          </div>
          <div style="margin-bottom: 0;">
             <div id="electro-q-display" style="font-family: var(--font-mono); font-size: 0.95rem; color: var(--color-text-muted); text-align: right;"></div>
          </div>
      </div>

      <div id="electro-result" style="margin-top: 24px;"></div>
    </div>
  `;

  // Tab switching execution logic (dropdown-driven)
  const tabs = ["3dviewer", "balancer", "stoich", "gaslaws", "ph", "ksp", "electro"];
  const tabSelect = document.getElementById('calc-tab-select');
  let glviewer = null;
  const switchTab = (tabId) => {
    tabs.forEach(t => {
      const pnl = document.getElementById(`calc-${t}`);
      if (pnl) pnl.classList.add('hidden');
    });
    const activePnl = document.getElementById(`calc-${tabId}`);
    if (activePnl) activePnl.classList.remove('hidden');
    if (tabId === '3dviewer') {
      setTimeout(() => {
        if (!glviewer && typeof $3Dmol !== 'undefined') {
          glviewer = $3Dmol.createViewer('glcontainer', { defaultcolors: $3Dmol.rasmolElementColors });
          const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
          glviewer.setBackgroundColor(isDark ? '#121212' : '#ffffff');
          glviewer.render();
        }
      }, 150);
    }
  };
  tabSelect.addEventListener('change', () => switchTab(tabSelect.value));

  // --- PHASE 2.3: 3D STRUCTURE LOOKUP (Hybrid: local cache -> IndexedDB -> PubChem) ---

  const renderWebGL = (data, format) => {
      if (typeof $3Dmol === 'undefined') return;
      if (!glviewer) {
          glviewer = $3Dmol.createViewer("glcontainer", { defaultcolors: $3Dmol.rasmolElementColors });
          const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
          glviewer.setBackgroundColor(isDark ? '#121212' : '#ffffff');
      }
      glviewer.clear();
      glviewer.addModel(data, format);
      glviewer.setStyle({}, {stick:{radius: 0.15}, sphere:{scale: 0.3}});
      glviewer.zoomTo();
      glviewer.render();
  };

  const structureInput = document.getElementById("structure-query-input");
  const structureStatus = document.getElementById("structure-lookup-status");
  const structureBtn = document.getElementById("btn-structure-lookup");

  const setStatus = (msg, isError = false) => {
      structureStatus.textContent = msg;
      structureStatus.style.color = isError ? "var(--color-danger)" : "var(--color-text-muted)";
  };

  const runLookup = async () => {
      const query = structureInput.value.trim();
      if (!query) { setStatus("Enter a formula or compound name first.", true); return; }
      structureBtn.disabled = true;
      setStatus("Searching offline dataset...");
      try {
          const result = await getStructure(query);
          if (result.error === 'not_found') {
              setStatus(`No structure found for "${query}" (checked local dataset + PubChem).`, true);
          } else if (result.error === 'offline') {
              setStatus(`Not in the offline dataset, and you're currently offline to reach PubChem.`, true);
          } else if (result.error) {
              setStatus(`Lookup failed: ${result.error}`, true);
          } else {
              renderWebGL(result.data, result.format);
              const sourceLabel = result.source === 'local' ? 'bundled offline dataset'
                  : result.source === 'indexeddb' ? 'cached (previously fetched)'
                  : 'PubChem (live, now cached for offline use)';
              setStatus(`Showing ${result.name || query} — source: ${sourceLabel}.`);
          }
      } catch (e) {
          setStatus(`Lookup failed: ${e.message}`, true);
      } finally {
          structureBtn.disabled = false;
      }
  };

  structureBtn.addEventListener("click", runLookup);
  structureInput.addEventListener("keydown", (e) => { if (e.key === "Enter") runLookup(); });

  window.addEventListener('themeChanged', (e) => {
      if (glviewer) {
          glviewer.setBackgroundColor(e.detail.theme === 'dark' ? '#121212' : '#ffffff');
          glviewer.render();
      }
  });

  // --- Matrix Balancer Logic ---
  document.getElementById("btn-balance").addEventListener("click", async () => {
    const inputStr = document.getElementById("balancer-input").value.trim();
    const resDiv = document.getElementById("balancer-result"); 
    if (!inputStr) return;
    resDiv.innerHTML = `<div class="explanation-box" style="text-align: center; border-color: var(--color-primary);"><span style="display:inline-block; animation: spin 1s linear infinite; margin-right: 8px;">⚙️</span><strong>Routing matrix to background thread...</strong></div>`;
    try {
      const balanced = await balanceEquationAsync(inputStr);
      resDiv.innerHTML = `<div class="equation-box" style="border-color: var(--color-success); background: var(--badge-success-bg); padding: 16px; border-radius: 8px; border: 1px solid var(--color-success); font-size: 1.2rem; font-weight: bold; text-align: center;">${formatEquation(balanced)}</div>`;
    } catch (e) {
      resDiv.innerHTML = `<div class="misconception-box" style="color: red; border: 1px solid red; padding: 12px;"><strong>Algorithmic Halt:</strong> ${e.message}</div>`;
    }
  });

  // Stoichiometry Evaluator
  const formStoich = document.getElementById("calc-formula");
  const massStoich = document.getElementById("calc-mass");
  const resStoich = document.getElementById("stoich-result");
  const updateStoich = () => {
    const formula = formStoich.value.trim();
    const mass = parseFloat(massStoich.value);
    if (!formula) { resStoich.innerHTML = ""; updateStoichConc(); return; }
    try {
      const molarMass = calculateMolarMass(formula, elementsData);
      let html = `<div class="result-row" style="background: var(--color-surface-alt); padding: 16px; border-radius: var(--radius-sm); border: 1px solid var(--color-border);"><div class="result-field"><div class="label">Parsed Topology</div><div class="value">${formatFormula(formula)}</div></div><div class="result-field"><div class="label">Molar Mass</div><div class="value" style="color: var(--color-success); font-weight: 600;">${molarMass.toFixed(3)} g/mol</div></div>`;
      if (!isNaN(mass) && mass > 0) html += `<div class="result-field"><div class="label">Derived Moles</div><div class="value" style="color: var(--color-primary); font-weight: 600;">${(mass / molarMass).toFixed(4)} mol</div></div>`;
      html += `</div>`;
      resStoich.innerHTML = html;
    } catch (e) {
      resStoich.innerHTML = `<div class="misconception-box" style="margin-top:0;"><strong>Parsing Error:</strong> ${e.message}</div>`;
    }
    updateStoichConc();
  };
  formStoich.addEventListener("input", updateStoich);
  massStoich.addEventListener("input", updateStoich);

  // Stoichiometry Concentration (Molarity / Molality / Normality)
  const stoichSolMass = document.getElementById("stoich-sol-mass");
  const stoichSolVol = document.getElementById("stoich-sol-vol");
  const stoichSolDensity = document.getElementById("stoich-sol-density");
  const stoichSolNFactor = document.getElementById("stoich-sol-nfactor");

  const stoichDerivedInfo = document.getElementById("stoich-derived-info");

  const updateStoichConc = () => {
    const formula = formStoich.value.trim();
    const mass = parseFloat(stoichSolMass.value) || 0;
    const vol = parseFloat(stoichSolVol.value) || 0;
    const density = parseFloat(stoichSolDensity.value) || 1.0;
    const nFactor = parseFloat(stoichSolNFactor.value) || 1;

    let moles = 0, molarMass = 0, kgSolvent = 0, errorMsg = '';
    if (formula) {
      try {
        molarMass = calculateMolarMass(formula, elementsData);
        if (mass > 0 && molarMass > 0) moles = mass / molarMass;
        if (vol > 0) {
          const totalMassGrams = (vol * 1000) * density;
          const solventGrams = totalMassGrams - mass;
          kgSolvent = solventGrams > 0 ? solventGrams / 1000 : 0;
        }
      } catch (e) {
        errorMsg = e.message;
      }
    }

    // Show derived info (molar mass, solvent mass)
    if (stoichDerivedInfo) {
      if (molarMass > 0) {
        stoichDerivedInfo.innerHTML = `<strong>Molar Mass:</strong> ${molarMass.toFixed(3)} g/mol | <strong>Derived Moles:</strong> ${moles.toFixed(4)} mol | <strong>Solvent Mass:</strong> ${kgSolvent.toFixed(4)} kg`;
      } else if (!formula) {
        stoichDerivedInfo.innerHTML = 'Enter a compound formula above to calculate solution concentrations.';
      } else if (errorMsg) {
        stoichDerivedInfo.innerHTML = `<span style="color: var(--color-danger);"><strong>Error:</strong> ${errorMsg}</span>`;
      }
    }

    const molarity = calcMolarity(moles, vol);
    const molality = calcMolality(moles, kgSolvent);
    const normality = calcNormality(molarity, nFactor);

    document.getElementById("stoich-res-molarity").textContent = molarity > 0 ? molarity.toFixed(3) + " M" : "0.000 M";
    document.getElementById("stoich-res-molality").textContent = molality > 0 ? molality.toFixed(3) + " m" : "0.000 m";
    document.getElementById("stoich-res-normality").textContent = normality > 0 ? normality.toFixed(3) + " N" : "0.000 N";
  };
  [stoichSolMass, stoichSolVol, stoichSolDensity, stoichSolNFactor].forEach(el => el.addEventListener("input", updateStoichConc));
  formStoich.addEventListener("input", updateStoichConc);

  // Universal Gas Assessor Matrix
  const gasFormulaInput = document.getElementById("gas-formula");
  const gasMassInput = document.getElementById("gas-mass");
  const gasN1Input = document.getElementById("gas-n1");

  const updateGasMoles = () => {
    const formula = gasFormulaInput.value.trim();
    const mass = parseFloat(gasMassInput.value);
    if (formula && mass > 0) {
      try {
        const mm = calculateMolarMass(formula, elementsData);
        if (mm > 0) gasN1Input.value = (mass / mm).toFixed(4);
      } catch (e) { }
    }
  };
  gasFormulaInput.addEventListener("input", updateGasMoles);
  gasMassInput.addEventListener("input", updateGasMoles);

  document.getElementById("btn-solve-ideal").addEventListener("click", () => {
    const getV = (id) => { const v = document.getElementById(id).value; return v === "" ? null : parseFloat(v); };
    let p1 = getV('gas-p1'), v1 = getV('gas-v1'), n1 = getV('gas-n1'), t1 = getV('gas-t1');
    let p2 = getV('gas-p2'), v2 = getV('gas-v2'), n2 = getV('gas-n2'), t2 = getV('gas-t2');

    let result = null, lawUsed = "";
    const c1Count = [p1, v1, t1].filter(x => x === null).length;
    const c2Count = [p2, v2, t2].filter(x => x === null).length;
    const av1Count = [v1, n1].filter(x => x === null).length;
    const av2Count = [v2, n2].filter(x => x === null).length;

    const p1Null = p1 === null, v1Null = v1 === null, n1Null = n1 === null, t1Null = t1 === null;
    const p2Null = p2 === null, v2Null = v2 === null, n2Null = n2 === null, t2Null = t2 === null;

    if ((c1Count + c2Count) === 1 && n1Null && n2Null) { result = solveCombinedGas(p1, v1, t1, p2, v2, t2); lawUsed = "Combined Gas Law"; }
    else if ((av1Count + av2Count) === 1 && p1Null && t1Null && p2Null && t2Null) { result = solveAvogadros(v1, n1, v2, n2); lawUsed = "Avogadro's Law"; }
    else if ([p1, v1, n1, t1].filter(x => x === null).length === 1 && p2Null && v2Null && n2Null && t2Null) { result = solveIdealGas(p1, v1, n1, t1); lawUsed = "Ideal Gas Law (State 1)"; }
    else if ([p2, v2, n2, t2].filter(x => x === null).length === 1 && p1Null && v1Null && n1Null && t1Null) { result = solveIdealGas(p2, v2, n2, t2); lawUsed = "Ideal Gas Law (State 2)"; }

    const resDiv = document.getElementById("gas-ideal-result");
    if (result) {
      let html = `<div class="result-row" style="background: var(--color-surface-alt); padding: 16px; border-radius: var(--radius-sm); border: 1px solid var(--color-primary); margin-bottom: 12px;"><div class="result-field"><div class="label">Governing Law</div><div class="value" style="font-weight: 600;">${lawUsed}</div></div><div class="result-field"><div class="label">Derived ${result.var}</div><div class="value" style="font-size: 1.5rem; font-weight: bold; color: var(--color-primary);">${result.val.toFixed(4)}</div></div></div>`;
      
      const varMapping = { "P1": "gas-p1", "V1": "gas-v1", "T1": "gas-t1", "P2": "gas-p2", "V2": "gas-v2", "T2": "gas-t2", "V1 (L)": "gas-v1", "n1 (mol)": "gas-n1", "V2 (L)": "gas-v2", "n2 (mol)": "gas-n2", "P (atm)": lawUsed.includes("State 2") ? "gas-p2" : "gas-p1", "V (L)": lawUsed.includes("State 2") ? "gas-v2" : "gas-v1", "n (mol)": lawUsed.includes("State 2") ? "gas-n2" : "gas-n1", "T (K)": lawUsed.includes("State 2") ? "gas-t2" : "gas-t1" };
      if (varMapping[result.var]) {
          document.getElementById(varMapping[result.var]).value = result.val.toFixed(4);
          if (varMapping[result.var] === "gas-n1") n1 = result.val;
          if (varMapping[result.var] === "gas-n2") n2 = result.val;
      }
      
      const activeMoles = n1 !== null ? n1 : (n2 !== null ? n2 : null);
      const formula = gasFormulaInput.value.trim();
      if (activeMoles !== null && activeMoles > 0 && formula) {
          try {
              const atomsPerMolecule = countAtoms(formula);
              const molecules = activeMoles * 6.02214076e23;
              const totalParticles = molecules * atomsPerMolecule;
              html += `<div class="result-row" style="background: var(--color-surface); padding: 16px; border-radius: var(--radius-sm); border: 1px solid var(--color-info);"><div class="result-field"><div class="label">Total Molecules</div><div class="value" style="font-weight: 600; color: var(--color-info);">${molecules.toExponential(4)}</div></div><div class="result-field"><div class="label">Total Atoms</div><div class="value" style="font-weight: 600; color: var(--color-alert);">${totalParticles.toExponential(4)}</div></div></div>`;
          } catch (e) { }
      }
      resDiv.innerHTML = html;
    } else {
      resDiv.innerHTML = `<div class="misconception-box"><strong>Indeterminate Matrix:</strong> Ensure you nullify EXACTLY ONE variable for a specific condition.</div>`;
    }
  });

  // Thermodynamic pH Logic
  const phBox = document.getElementById("ph-result-text");
  const strengthSelect = document.getElementById("ph-strength");
  const kField = document.getElementById("ph-k-field");
  
  strengthSelect.addEventListener("change", (e) => {
    kField.classList.toggle("hidden", e.target.value === "strong");
    updatePH(); // Recalculate
  });

  const updatePH = (source = null) => {
    let ph, poh, h, oh;
    const Kw = 1e-14;
    const isWeak = strengthSelect.value === "weak";
    const K_val = parseFloat(document.getElementById("calc-k-val").value) || 0;

    try {
      let acidConc = parseFloat(document.getElementById("calc-hplus").value);
      let baseConc = parseFloat(document.getElementById("calc-ohminus").value);

      if (source === 'h' && !isNaN(acidConc) && acidConc > 0) {
        if (isWeak && K_val > 0) {
          h = (-K_val + Math.sqrt(K_val * K_val + 4 * K_val * acidConc)) / 2;
        } else {
          h = (acidConc + Math.sqrt(acidConc * acidConc + 4 * Kw)) / 2;
        }
        ph = -Math.log10(h); poh = 14 - ph; oh = Kw / h;
      } 
      else if (source === 'oh' && !isNaN(baseConc) && baseConc > 0) {
        if (isWeak && K_val > 0) {
          oh = (-K_val + Math.sqrt(K_val * K_val + 4 * K_val * baseConc)) / 2;
        } else {
          oh = (baseConc + Math.sqrt(baseConc * baseConc + 4 * Kw)) / 2;
        }
        poh = -Math.log10(oh); ph = 14 - poh; h = Kw / oh;
      } 
      else {
        return resetPH();
      }

      document.getElementById("calc-ph-val").value = ph.toFixed(3);
      document.getElementById("calc-poh-val").value = poh.toFixed(3);

      phBox.style.display = "block";
      const phIndicator = document.getElementById("ph-indicator");
      if (phIndicator) phIndicator.style.left = Math.max(0, Math.min(100, (ph / 14) * 100)) + "%";
      if (ph < 7) { phBox.innerHTML = "Acidic Medium Detected"; phBox.style.borderLeftColor = "var(--color-alert)"; }
      else if (ph > 7) { phBox.innerHTML = "Alkaline Medium Detected"; phBox.style.borderLeftColor = "var(--color-info)"; }
      else { phBox.innerHTML = "Equilibrium / Neutral"; phBox.style.borderLeftColor = "var(--color-success)"; }
    } catch(e) { resetPH(); }
  };

  const resetPH = () => { phBox.style.display = "none"; document.getElementById("calc-ph-val").value = ""; document.getElementById("calc-poh-val").value = ""; };
  
  document.getElementById("calc-hplus").addEventListener("input", () => updatePH('h'));
  document.getElementById("calc-ohminus").addEventListener("input", () => updatePH('oh'));
  document.getElementById("calc-k-val").addEventListener("input", () => {
     if (document.getElementById("calc-hplus").value) updatePH('h');
     else if (document.getElementById("calc-ohminus").value) updatePH('oh');
  });

  // --- PHASE 3.1: KSP SOLUBILITY PREDICTIVE ENGINE ---
  const kspX = document.getElementById("ksp-x");
  const kspY = document.getElementById("ksp-y");
  const kspVal = document.getElementById("ksp-val-input");
  const kspAConc = document.getElementById("ksp-a-conc");
  const kspBConc = document.getElementById("ksp-b-conc");
  const resS = document.getElementById("ksp-s-result");
  const resQ = document.getElementById("ksp-q-result");
  const resPred = document.getElementById("ksp-prediction");

  const updateKsp = () => {
      const x = parseInt(kspX.value) || 1;
      const y = parseInt(kspY.value) || 1;
      const ksp = parseFloat(kspVal.value);
      const aConc = parseFloat(kspAConc.value);
      const bConc = parseFloat(kspBConc.value);

      if (!isNaN(ksp) && ksp > 0) {
          const s = calculateMolarSolubility(ksp, x, y);
          resS.innerHTML = `s = ${s.toExponential(4)} M`;
      } else { resS.innerHTML = `s = 0.000 M`; }

      if (!isNaN(aConc) && !isNaN(bConc) && aConc >= 0 && bConc >= 0) {
          const q = calculateQ(aConc, bConc, x, y);
          resQ.innerHTML = `Q = ${q.toExponential(4)}`;

          if (!isNaN(ksp) && ksp > 0) {
              resPred.style.display = "block";
              const ratio = q / ksp;
              if (ratio > 1.02) {
                  resPred.innerHTML = "<strong>Q > K<sub>sp</sub></strong>:<br>State is Supersaturated. <strong>Precipitate will form.</strong>";
                  resPred.style.borderLeftColor = "var(--color-danger)";
              } else if (ratio < 0.98) {
                  resPred.innerHTML = "<strong>Q < K<sub>sp</sub></strong>:<br>State is Unsaturated. <strong>No precipitate forms.</strong>";
                  resPred.style.borderLeftColor = "var(--color-success)";
              } else {
                  resPred.innerHTML = "<strong>Q ≈ K<sub>sp</sub></strong>:<br>State is Saturated. <strong>Dynamic equilibrium reached.</strong>";
                  resPred.style.borderLeftColor = "var(--color-warning)";
              }
          } else { resPred.style.display = "none"; }
      } else {
          resQ.innerHTML = `Q = 0.000`;
          resPred.style.display = "none";
      }
  };
  [kspX, kspY, kspVal, kspAConc, kspBConc].forEach(el => el.addEventListener("input", updateKsp));

  // --- PHASE 3.2: ELECTROCHEMICAL NERNST ENGINE ---
  
  const halfCells = await loadHalfCells();

  const anodeSelect = document.getElementById("electro-anode");
  const cathodeSelect = document.getElementById("electro-cathode");
  const anodeConc = document.getElementById("electro-anode-conc");
  const cathodeConc = document.getElementById("electro-cathode-conc");
  const tempK = document.getElementById("electro-temp");
  const eResultDiv = document.getElementById("electro-result");
  const qDisplay = document.getElementById("electro-q-display");

  // Populate UI Dropdowns (both show standard reduction potentials)
  let optionsHtml = "";
  halfCells.forEach(hc => {
      optionsHtml += `<option value="${hc.id}">${hc.reduction} (E° = ${hc.e0 > 0 ? '+':''}${hc.e0.toFixed(2)}V)</option>`;
  });
  anodeSelect.innerHTML = optionsHtml;
  cathodeSelect.innerHTML = optionsHtml;
  
  // Set Defaults: Classic Zinc-Copper Daniell Cell
  anodeSelect.value = "zn";
  cathodeSelect.value = "cu";

  const updateElectro = () => {
      const anRef = halfCells.find(h => h.id === anodeSelect.value);
      const catRef = halfCells.find(h => h.id === cathodeSelect.value);
      
      const cAn = parseFloat(anodeConc.value) || 1.0;
      const cCat = parseFloat(cathodeConc.value) || 1.0;
      const t = parseFloat(tempK.value) || 298.15;

      if (!anRef || !catRef) return;

      if (t <= 0) {
          eResultDiv.innerHTML = `<div class="misconception-box" style="border-color: var(--color-danger); color: var(--color-danger);"><strong>Physics Error:</strong> Absolute temperature must be strictly greater than 0 Kelvin.</div>`;
          return;
      }

      // Execute Nernst Mathematical Engine
      const res = calculateNernst(catRef.e0, anRef.e0, catRef.n, anRef.n, cCat, cAn, t);

      if (res.error) {
          eResultDiv.innerHTML = `<div class="misconception-box" style="border-color: var(--color-danger); color: var(--color-danger);"><strong>Input Error:</strong> ${res.error}</div>`;
          return;
      }

      // Render Reaction Quotient Logic
      qDisplay.innerHTML = `Q = <span style="color: var(--color-primary);">[${anRef.ion}]</span><sup>${res.nTotal/anRef.n}</sup> / <span style="color: var(--color-info);">[${catRef.ion}]</span><sup>${res.nTotal/catRef.n}</sup> = ${res.q.toExponential(4)}`;

      // Build half-reaction display strings
      const anodeDisplay = anRef.oxidation || anRef.reduction;
      const cathodeDisplay = catRef.reduction;

      // UX Triage for Spontaneity
      let badgeType = "success";
      let cellStatus = "Spontaneous Cell (Galvanic)";
      let explanation = `Anode (oxidation): ${anodeDisplay}<br>Cathode (reduction): ${cathodeDisplay}<br>The cell is actively producing voltage. Electrons are flowing from the anode to the cathode.`;

      if (res.eCell < 0) {
          badgeType = "danger";
          cellStatus = "Non-Spontaneous Cell (Electrolytic)";
          explanation = `Anode (oxidation): ${anodeDisplay}<br>Cathode (reduction): ${cathodeDisplay}<br>This configuration represents a dead battery. Voltage must be externally applied to drive this reaction backwards.`;
      } else if (res.eCell === 0) {
          badgeType = "warning";
          cellStatus = "Equilibrium Reached";
          explanation = `Anode (oxidation): ${anodeDisplay}<br>Cathode (reduction): ${cathodeDisplay}<br>The battery is completely depleted. The reaction quotient Q has grown large enough to offset the standard potential completely.`;
      }

      eResultDiv.innerHTML = `
          <div class="result-row" style="background: var(--color-surface); border-radius: var(--radius-sm); border: 2px solid var(--color-${badgeType}); padding: 16px; margin-bottom: 12px; position: relative; overflow: hidden;">
              <div style="position: absolute; top:0; left:0; right:0; background: var(--color-${badgeType}); color: #fff; text-align: center; font-size: 0.8rem; font-weight: bold; padding: 4px; text-transform: uppercase; letter-spacing: 1px;">
                  ${cellStatus}
              </div>
              <div style="display: flex; width: 100%; margin-top: 20px; justify-content: space-around; text-align: center;">
                  <div>
                      <div class="label">Standard Potential (E°<sub>cell</sub>)</div>
                      <div class="value" style="font-size: 1.3rem;">${res.e0Cell > 0 ? '+':''}${res.e0Cell.toFixed(3)} V</div>
                  </div>
                  <div>
                      <div class="label">Dynamic Voltage (E<sub>cell</sub>)</div>
                      <div class="value" style="font-size: 1.8rem; font-weight: 800; color: var(--color-${badgeType});">${res.eCell > 0 ? '+':''}${res.eCell.toFixed(3)} V</div>
                  </div>
              </div>
          </div>
          <div class="explanation-box" style="margin-top: 0;">
              <strong>Thermodynamic State:</strong> ${explanation}<br>
              <em>Total electrons transferred in balanced equation: n = ${res.nTotal}</em>
          </div>
      `;
  };

  [anodeSelect, cathodeSelect, anodeConc, cathodeConc, tempK].forEach(el => el.addEventListener("input", updateElectro));
  
  // Initial Boot Render
  updateElectro();

  // Post-mount upgrades (called directly, not via MutationObserver)
  upgradeCalculators();
  addCommonIonEffect();
  addElectrochemicalSeries();
  upgradeLayout();
}

/* =====================================================================
   5. UNIT CONVERTER
   ===================================================================== */

/**
 * Converts between grams, moles, liters (STP), particles, and molecules
 * for a given compound formula. All cards auto-calculate from any input.
 */
export async function mountUnitConverter(container) {
  container.innerHTML = `<div class="placeholder-note">Loading unit converter...</div>`;

  // Load elements data from IndexedDB / elements.json (same source as calculators)
  const elementsData = await getElements();

  const AVOGADRO = 6.02214076e23;
  const MOLAR_VOLUME_STP = 22.414; // L/mol at STP

  container.innerHTML = `
    ${moduleHeaderHTML('🔄', 'Unit Converter', 'Convert between grams, moles, liters (at STP), particles, and molecules for any compound. Enter a value in any field to auto-calculate all others.', '--accent-sodium')}
    <div class="card" style="margin-bottom: 16px;">
      <div class="field">
        <label>Compound Formula</label>
        <input type="text" id="uc-formula" placeholder="e.g. H2O, Fe2(SO4)3, C6H12O6" style="font-family: var(--font-mono); font-size: 1.1rem;" />
      </div>
      <div id="uc-molar-mass-display" style="font-size: 0.9rem; color: var(--color-text-muted); margin-top: 4px;"></div>
    </div>
    <div class="unit-converter-grid">
      <div class="card" style="padding: 16px;">
        <div class="card-title">⚖️ Grams (g)</div>
        <input type="number" id="uc-grams" step="any" placeholder="0" style="font-size: 1.1rem; width: 100%; margin-top: 8px;" />
      </div>
      <div class="card" style="padding: 16px;">
        <div class="card-title">🧪 Moles (mol)</div>
        <input type="number" id="uc-moles" step="any" placeholder="0" style="font-size: 1.1rem; width: 100%; margin-top: 8px;" />
      </div>
      <div class="card" style="padding: 16px;">
        <div class="card-title">🎈 Liters at STP (L)</div>
        <input type="number" id="uc-liters" step="any" placeholder="0" style="font-size: 1.1rem; width: 100%; margin-top: 8px;" />
      </div>
      <div class="card" style="padding: 16px;">
        <div class="card-title">🔴 Particles</div>
        <input type="text" id="uc-particles" placeholder="0" style="font-size: 1.1rem; width: 100%; margin-top: 8px; font-family: var(--font-mono);" readonly />
      </div>
      <div class="card" style="padding: 16px;">
        <div class="card-title">🔷 Molecules</div>
        <input type="text" id="uc-molecules" placeholder="0" style="font-size: 1.1rem; width: 100%; margin-top: 8px; font-family: var(--font-mono);" readonly />
      </div>
    </div>
    <div class="unit-chain" id="uc-chain" style="margin-top: 16px;"></div>
  `;

  const formulaInput = document.getElementById('uc-formula');
  const gramsInput = document.getElementById('uc-grams');
  const molesInput = document.getElementById('uc-moles');
  const litersInput = document.getElementById('uc-liters');
  const particlesInput = document.getElementById('uc-particles');
  const moleculesInput = document.getElementById('uc-molecules');
  const mmDisplay = document.getElementById('uc-molar-mass-display');
  const chainDiv = document.getElementById('uc-chain');

  let currentMM = 0; // current molar mass
  let lastSource = null; // which input was last edited

  /** Format large numbers in scientific notation */
  function fmtSci(n) {
    if (n === 0) return '0';
    if (Math.abs(n) >= 1e6 || (Math.abs(n) < 0.001 && n !== 0)) {
      return n.toExponential(4);
    }
    // Show up to 6 significant digits
    return parseFloat(n.toPrecision(6)).toString();
  }

  /** Update molar mass display and recalculate */
  function updateMM() {
    const formula = formulaInput.value.trim();
    if (!formula) {
      mmDisplay.textContent = '';
      currentMM = 0;
      return;
    }
    try {
      currentMM = calculateMolarMass(formula, elementsData);
      mmDisplay.innerHTML = `Molar mass: <strong>${currentMM.toFixed(3)} g/mol</strong>`;
    } catch (e) {
      mmDisplay.innerHTML = `<span style="color: var(--color-danger);">Error: ${e.message}</span>`;
      currentMM = 0;
    }
    recalculate();
  }

  /** Recalculate all fields based on the last-edited source */
  function recalculate() {
    if (!currentMM || currentMM <= 0) return;

    let moles = null;
    let sourceLabel = '';

    if (lastSource === 'grams') {
      const g = parseFloat(gramsInput.value);
      if (isNaN(g) || g <= 0) { clearOutputs(); return; }
      moles = g / currentMM;
      sourceLabel = `Grams → Moles: ${fmtSci(g)} g ÷ ${currentMM.toFixed(3)} g/mol`;
    } else if (lastSource === 'moles') {
      const m = parseFloat(molesInput.value);
      if (isNaN(m) || m <= 0) { clearOutputs(); return; }
      moles = m;
      sourceLabel = `Direct moles input: ${fmtSci(m)} mol`;
    } else if (lastSource === 'liters') {
      const l = parseFloat(litersInput.value);
      if (isNaN(l) || l <= 0) { clearOutputs(); return; }
      moles = l / MOLAR_VOLUME_STP;
      sourceLabel = `Liters → Moles: ${fmtSci(l)} L ÷ ${MOLAR_VOLUME_STP} L/mol (STP)`;
    } else {
      clearOutputs();
      return;
    }

    const grams = moles * currentMM;
    const liters = moles * MOLAR_VOLUME_STP;
    const particles = moles * AVOGADRO;

    // Only update non-source fields to avoid cursor jump
    if (lastSource !== 'grams') gramsInput.value = fmtSci(grams);
    if (lastSource !== 'moles') molesInput.value = fmtSci(moles);
    if (lastSource !== 'liters') litersInput.value = fmtSci(liters);
    particlesInput.value = fmtSci(particles);
    moleculesInput.value = fmtSci(particles);

    // Show conversion chain
    chainDiv.innerHTML = `
      <div class="card" style="padding: 12px 16px; background: var(--color-surface-alt);">
        <div style="font-size: 0.85rem; font-weight: 600; color: var(--color-primary); margin-bottom: 6px;">Conversion Chain</div>
        <div style="font-family: var(--font-mono); font-size: 0.85rem; color: var(--color-text-muted); line-height: 1.8;">
          ${sourceLabel}<br>
          → Particles: ${fmtSci(moles)} mol × ${AVOGADRO.toExponential(2)} = ${fmtSci(particles)}<br>
          → Volume (STP): ${fmtSci(moles)} mol × ${MOLAR_VOLUME_STP} L/mol = ${fmtSci(liters)} L
        </div>
      </div>
    `;
  }

  function clearOutputs() {
    if (lastSource !== 'grams') gramsInput.value = '';
    if (lastSource !== 'moles') molesInput.value = '';
    if (lastSource !== 'liters') litersInput.value = '';
    particlesInput.value = '';
    moleculesInput.value = '';
    chainDiv.innerHTML = '';
  }

  // ── Wire event listeners ─────────────────────────────────────────────
  gramsInput.addEventListener('input', () => { lastSource = 'grams'; recalculate(); });
  molesInput.addEventListener('input', () => { lastSource = 'moles'; recalculate(); });
  litersInput.addEventListener('input', () => { lastSource = 'liters'; recalculate(); });
  formulaInput.addEventListener('input', updateMM);
}

/* =====================================================================
   6. UPGRADE CALCULATORS
   ===================================================================== */

/**
 * Patches the existing calculator tab UI to add icons and subtitle text.
 * Should be called AFTER mountCalculators has rendered.
 */
export function upgradeCalculators() {
  // Tab buttons replaced by dropdown select — no button upgrades needed.

  // ── 6b. Wrap each calc panel in a .calc-panel with h3 + subtitle ────
  const panelUpgrades = {
    'calc-3dviewer': { title: '3D Structure Lookup',    subtitle: 'Type a formula or compound name to visualize its 3D molecular structure' },
    'calc-balancer':  { title: 'Equation Balancer',      subtitle: 'Enter an unbalanced chemical equation and get the balanced result' },
    'calc-stoich':    { title: 'Stoichiometry & Solutions', subtitle: 'Molar mass, molarity, molality, and normality from a compound formula' },
    'calc-gaslaws':   { title: 'Gas Laws Calculator',    subtitle: 'Solve ideal gas law, combined gas law, or Avogadro problems' },
    'calc-ph':        { title: 'Thermodynamic pH',       subtitle: 'Calculate pH and pOH from acid or base concentration' },
    'calc-ksp':       { title: 'Solubility Product (Ksp)', subtitle: 'Compute molar solubility and predict precipitation' },
    'calc-electro':   { title: 'Electrochemistry (Nernst)', subtitle: 'Simulate galvanic cells with non-standard conditions' },
  };

  for (const [panelId, cfg] of Object.entries(panelUpgrades)) {
    const panelEl = document.getElementById(panelId);
    if (!panelEl) continue;

    // Wrap existing content in a calc-panel div
    const wrapper = document.createElement('div');
    wrapper.className = 'calc-panel';

    // Create header
    const header = document.createElement('div');
    header.style.cssText = 'margin-bottom: 16px;';
    header.innerHTML = `
      <h3 style="color: var(--color-primary); margin-bottom: 4px;">${cfg.title}</h3>
      <p class="calc-subtitle" style="font-size: 0.85rem; color: var(--color-text-muted); margin: 0;">${cfg.subtitle}</p>
    `;

    // Move existing children into wrapper
    while (panelEl.firstChild) {
      wrapper.appendChild(panelEl.firstChild);
    }

    // Insert header at the top of the wrapper
    wrapper.insertBefore(header, wrapper.firstChild);
    panelEl.appendChild(wrapper);
  }

  // ── 6c. Add pH scale bar after the pH output fields ──────────────────
  const phPanel = document.getElementById('calc-ph');
  if (phPanel) {
    const phScaleHtml = `
      <div class="ph-scale" style="position: relative; height: 32px; border-radius: var(--radius-sm); overflow: hidden; margin: 16px 0; background: linear-gradient(to right, #ff0000, #ff6600, #ffcc00, #99cc00, #00cc00, #00cccc, #0066ff, #3300cc, #660099);">
        <div class="ph-indicator" id="ph-indicator" style="position: absolute; top: 0; width: 4px; height: 100%; background: #fff; box-shadow: 0 0 6px rgba(0,0,0,0.6); transition: left 0.3s ease; left: 50%;"></div>
        <div class="ph-labels" style="position: absolute; bottom: -20px; left: 0; right: 0; display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--color-text-muted);">
          <span>0</span>
          <span>7</span>
          <span>14</span>
        </div>
      </div>
      <div style="height: 24px;"></div>
    `;

    // Insert after the pH output fields
    const phValInput = document.getElementById('calc-ph-val');
    if (phValInput && phValInput.parentElement) {
      phValInput.parentElement.insertAdjacentHTML('afterend', phScaleHtml);
    }

    // Wire the pH indicator to move based on calculated pH
    const phValField = document.getElementById('calc-ph-val');
    const phIndicator = document.getElementById('ph-indicator');
    if (phValField && phIndicator) {
      // Observe changes to the pH value field
      const observer = new MutationObserver(() => {
        const ph = parseFloat(phValField.value);
        if (!isNaN(ph) && ph >= 0 && ph <= 14) {
          phIndicator.style.left = `${(ph / 14) * 100}%`;
        }
      });
      observer.observe(phValField, { attributes: true, attributeFilter: ['value'] });

      // Also listen for input events
      phValField.addEventListener('input', () => {
        const ph = parseFloat(phValField.value);
        if (!isNaN(ph) && ph >= 0 && ph <= 14) {
          phIndicator.style.left = `${(ph / 14) * 100}%`;
        }
      });
    }
  }
}

/* =====================================================================
   7. UPGRADE LAYOUT
   ===================================================================== */

/**
 * Patches the existing Preparations and ID Tests modules to use stacked layout,
 * and adds module-header banners to several sections.
 */
export function upgradeLayout() {
  // ── 7a. Change preps-grid from search-grid to stacked-cards ──────────
  const prepsGrid = document.getElementById('preps-grid');
  if (prepsGrid) {
    prepsGrid.className = 'stacked-cards';
  }

  // ── 7b. Change idtests-grid from search-grid to stacked-cards ────────
  const idtestsGrid = document.getElementById('idtests-grid');
  if (idtestsGrid) {
    idtestsGrid.className = 'stacked-cards';
  }

  // ── 7c. Add module-header banners to various sections ────────────────
  const banners = [
    { id: 'compounds-view',   icon: '🧪', title: 'Compounds Database',           desc: 'Browse, search, and explore chemical compounds with 2D structure rendering, molar mass, and properties.', accent: '--accent-copper' },
    { id: 'reactions-view',   icon: '⚗️', title: 'Reaction Mechanics',           desc: 'Explore chemical reactions with balanced equations, conditions, observations, and underlying mechanisms.', accent: '--accent-lithium' },
    { id: 'preps-view',       icon: '🏭', title: 'Synthesis Protocols',          desc: 'Step-by-step preparation methods for common laboratory compounds with detailed procedures and safety notes.', accent: '--accent-lithium' },
    { id: 'idtests-view',     icon: '🔬', title: 'Identification Analysis',      desc: 'Systematic qualitative analysis procedures for identifying cations, anions, and gases through confirmatory tests.', accent: '--accent-lithium' },
    { id: 'calculators-view', icon: '🧮', title: 'Calculators & Tools',          desc: 'Thermodynamic, stoichiometric, and topological models. 3D structure lookup, Nernst equation, gas laws, and more.', accent: '--accent-sodium' },
    { id: 'search-view',      icon: '🔍', title: 'Global Search',                desc: 'Search across the entire offline database — compounds, reactions, preparations, elements, and identification tests.', accent: '--accent-sodium' },
  ];

  banners.forEach(banner => {
    const viewEl = document.getElementById(banner.id);
    if (!viewEl) return;

    // Check if a module-header already exists
    if (viewEl.querySelector('.module-header')) return;

    // Prepend the module header banner
    const headerHtml = `
      <div class="module-header" style="--mh-accent:var(${banner.accent}); margin-bottom: 16px;">
        <div class="mh-icon">${banner.icon}</div>
        <div>
          <h2 class="mh-title">${banner.title}</h2>
          <p class="mh-desc">${banner.desc}</p>
        </div>
      </div>
    `;
    viewEl.insertAdjacentHTML('afterbegin', headerHtml);
  });
}

/* =====================================================================
   8. COMMON ION EFFECT EXTENSION
   ===================================================================== */

/**
 * Adds a Common Ion Effect sub-panel to the Ksp calculator.
 * Shows how adding a common ion suppresses solubility compared to pure water.
 */
export function addCommonIonEffect() {
  const kspPanel = document.getElementById('calc-ksp');
  if (!kspPanel) return;

  const cieHtml = `
    <div style="margin-top: 24px; border-top: 2px solid var(--color-border); padding-top: 20px;">
      <h4 style="color: var(--color-primary); margin-bottom: 12px;">Common Ion Effect Calculator</h4>
      <p class="text-muted" style="font-size: 0.85rem; margin-bottom: 16px;">
        Adding a common ion to a saturated solution shifts the equilibrium left (Le Chatelier\'s principle),
        decreasing the molar solubility. Enter the concentrations of the common ions present in solution.
      </p>
      <div class="form-grid" style="grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
        <div class="field">
          <label>Concentration of Common Ion [A<sup>y+</sup>] (M)</label>
          <input type="number" id="cie-conc-a" step="any" min="0" placeholder="0 (pure water)" />
        </div>
        <div class="field">
          <label>Concentration of Common Ion [B<sup>x-</sup>] (M)</label>
          <input type="number" id="cie-conc-b" step="any" min="0" placeholder="0 (pure water)" />
        </div>
      </div>
      <button class="btn-primary" id="cie-calculate" style="margin-bottom: 16px;">Calculate with Common Ion</button>
      <div id="cie-results"></div>
    </div>
  `;

  kspPanel.insertAdjacentHTML('beforeend', cieHtml);

  // Wire the calculate button
  document.getElementById('cie-calculate').addEventListener('click', () => {
    const x = parseInt(document.getElementById('ksp-x')?.value) || 1;
    const y = parseInt(document.getElementById('ksp-y')?.value) || 1;
    const ksp = parseFloat(document.getElementById('ksp-val-input')?.value);
    const concA = parseFloat(document.getElementById('cie-conc-a').value) || 0;
    const concB = parseFloat(document.getElementById('cie-conc-b').value) || 0;
    const resultsDiv = document.getElementById('cie-results');

    if (isNaN(ksp) || ksp <= 0) {
      resultsDiv.innerHTML = `<div class="misconception-box" style="border-color: var(--color-warning);">Please enter a valid K<sub>sp</sub> value in the main Ksp calculator above.</div>`;
      return;
    }

    if (concA <= 0 && concB <= 0) {
      resultsDiv.innerHTML = `<div class="misconception-box" style="border-color: var(--color-warning);">Enter at least one common ion concentration to see the effect.</div>`;
      return;
    }

    // Calculate molar solubility WITHOUT common ion (pure water)
    const sPure = calculateMolarSolubility(ksp, x, y);

    // Calculate molar solubility WITH common ion
    // For AxBy: Ksp = (xs + concA)^x * (ys + concB)^y where s is new solubility
    // Simplified approach: if concA > 0, then [A] ≈ concA (dominant), solve Ksp = concA^x * (ys)^y → s = (Ksp / concA^x)^(1/y)
    // If concB > 0, then [B] ≈ concB, solve Ksp = (xs)^x * concB^y → s = (Ksp / concB^y)^(1/x)
    // If both > 0, take the minimum (more conservative / dominant common ion)
    let sCommon = sPure; // fallback

    if (concA > 0 && concB > 0) {
      // Both common ions present — use iterative approach
      // Ksp = (x*s + concA)^x * (y*s + concB)^y
      // Newton's method to solve for s
      let s = sPure * 0.1; // initial guess (lower than pure)
      for (let iter = 0; iter < 100; iter++) {
        const aConc = x * s + concA;
        const bConc = y * s + concB;
        const f = Math.pow(aConc, x) * Math.pow(bConc, y) - ksp;
        // df/ds = x * x * (aConc)^(x-1) * (bConc)^y + y * y * (aConc)^x * (bConc)^(y-1)
        const dfds = x * x * Math.pow(Math.max(aConc, 1e-30), x - 1) * Math.pow(Math.max(bConc, 1e-30), y)
                   + y * y * Math.pow(Math.max(aConc, 1e-30), x) * Math.pow(Math.max(bConc, 1e-30), y - 1);
        if (Math.abs(dfds) < 1e-50) break;
        const ds = f / dfds;
        s = Math.max(s - ds, 0);
        if (Math.abs(ds) < 1e-20) break;
      }
      sCommon = Math.max(s, 0);
    } else if (concA > 0) {
      // s = (Ksp / concA^x)^(1/y)
      sCommon = Math.pow(ksp / Math.pow(concA, x), 1 / y);
    } else if (concB > 0) {
      // s = (Ksp / concB^y)^(1/x)
      sCommon = Math.pow(ksp / Math.pow(concB, y), 1 / x);
    }

    const suppression = ((1 - sCommon / sPure) * 100);
    const maxBarWidth = 100;
    const pureBarWidth = maxBarWidth;
    const commonBarWidth = Math.max((sCommon / sPure) * maxBarWidth, 1);

    resultsDiv.innerHTML = `
      <div class="cie-comparison">
        <h5 style="margin-bottom: 12px; color: var(--color-primary);">Solubility Comparison</h5>
        <div style="margin-bottom: 12px;">
          <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 4px;">
            <span>Pure Water</span>
            <strong>${sPure.toExponential(4)} M</strong>
          </div>
          <div class="cie-bar" style="width: 100%; height: 24px; background: var(--color-surface-alt); border-radius: var(--radius-sm); overflow: hidden; border: 1px solid var(--color-border);">
            <div class="cie-bar-fill" style="width: ${pureBarWidth}%; height: 100%; background: var(--color-info); border-radius: var(--radius-sm); transition: width 0.5s ease;"></div>
          </div>
        </div>
        <div style="margin-bottom: 12px;">
          <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 4px;">
            <span>With Common Ion</span>
            <strong style="color: var(--color-warning);">${sCommon.toExponential(4)} M</strong>
          </div>
          <div class="cie-bar" style="width: 100%; height: 24px; background: var(--color-surface-alt); border-radius: var(--radius-sm); overflow: hidden; border: 1px solid var(--color-border);">
            <div class="cie-bar-fill cie-bar-shift" style="width: ${commonBarWidth}%; height: 100%; background: var(--color-warning); border-radius: var(--radius-sm); transition: width 0.5s ease;"></div>
          </div>
        </div>
        <div class="explanation-box" style="margin-top: 12px;">
          <strong>Common Ion Effect:</strong> The presence of common ion(s) suppresses solubility by <strong style="color: var(--color-warning);">${suppression.toFixed(1)}%</strong>.<br>
          <em>Le Chatelier\'s Principle: Adding product ions shifts the dissolution equilibrium toward the solid (left), reducing solubility.</em>
        </div>
      </div>
    `;
  });
}

/* =====================================================================
   9. ELECTROCHEMICAL SERIES PANEL
   ===================================================================== */

/**
 * Adds a visual electrochemical series panel inside the electro tab.
 * Shows all half-cells sorted by E° value. Clicking a bar selects it
 * as anode or cathode and updates the dropdowns.
 */
export async function addElectrochemicalSeries() {
  const electroPanel = document.getElementById('calc-electro');
  if (!electroPanel) return;

  const halfCells = await loadHalfCells();

  // Sort ascending by E° (most negative at top)
  const sorted = [...halfCells].sort((a, b) => a.e0 - b.e0);
  const minE = sorted[0].e0;
  const maxE = sorted[sorted.length - 1].e0;
  const range = maxE - minE;

  // Build the series HTML
  const barsHtml = sorted.map(hc => {
    // Calculate bar position (percentage from left)
    const pct = ((hc.e0 - minE) / range) * 100;
    const isNegative = hc.e0 < 0;
    const barColor = isNegative ? 'var(--color-danger)' : 'var(--color-success)';

    return `
      <div class="ec-bar" data-id="${hc.id}" title="${hc.reduction} — E° = ${hc.e0 > 0 ? '+' : ''}${hc.e0.toFixed(2)} V"
           style="position: relative; margin: 3px 0; cursor: pointer; border-radius: 4px; overflow: hidden;">
        <div style="display: flex; align-items: center; gap: 8px; padding: 6px 10px; background: var(--color-surface-alt); border: 1px solid var(--color-border); border-radius: 4px; transition: all 0.15s ease;"
             onmouseenter="this.style.borderColor='${barColor}'; this.style.boxShadow='0 0 8px ${isNegative ? 'rgba(220,38,38,0.2)' : 'rgba(22,163,74,0.2)'}'"
             onmouseleave="this.style.borderColor='var(--color-border)'; this.style.boxShadow='none'">
          <div class="ec-e0" style="min-width: 60px; text-align: right; font-family: var(--font-mono); font-weight: 700; font-size: 0.85rem; color: ${barColor};">
            ${hc.e0 > 0 ? '+' : ''}${hc.e0.toFixed(2)} V
          </div>
          <div style="flex: 1; height: 4px; background: var(--color-border); border-radius: 2px; position: relative;">
            <div style="position: absolute; left: ${pct}%; top: -1px; width: 6px; height: 6px; background: ${barColor}; border-radius: 50%; transform: translateX(-50%);"></div>
          </div>
          <div class="ec-half-cell" style="font-size: 0.82rem; color: var(--color-text-muted); min-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${hc.reduction}
          </div>
        </div>
      </div>
    `;
  }).join('');

  const seriesHtml = `
    <div style="margin-top: 24px; border-top: 2px solid var(--color-border); padding-top: 20px;">
      <h4 style="color: var(--color-primary); margin-bottom: 4px;">Electrochemical Series</h4>
      <p class="text-muted" style="font-size: 0.82rem; margin-bottom: 12px;">Click any half-cell to set it as <strong style="color: var(--color-danger);">anode</strong> (left-click) or <strong style="color: var(--color-success);">cathode</strong> (right-click / long-press). Bars colored by E° sign.</p>
      <div style="display: flex; justify-content: space-between; font-size: 0.75rem; font-weight: 600; margin-bottom: 8px; padding: 0 10px;">
        <span style="color: var(--color-danger);">⬆ Strong Reducing Agents (easily oxidized)</span>
        <span style="color: var(--color-success);">Strong Oxidizing Agents (easily reduced) ⬇</span>
      </div>
      <div class="ec-series" style="max-height: 400px; overflow-y: auto;">
        ${barsHtml}
      </div>
    </div>
  `;

  electroPanel.insertAdjacentHTML('beforeend', seriesHtml);

  // ── Wire click handlers to update dropdowns ──────────────────────────
  const anodeSelect = document.getElementById('electro-anode');
  const cathodeSelect = document.getElementById('electro-cathode');

  document.querySelectorAll('.ec-bar').forEach(bar => {
    // Left click → set as anode
    bar.addEventListener('click', (e) => {
      e.preventDefault();
      const id = bar.dataset.id;
      if (anodeSelect) {
        anodeSelect.value = id;
        anodeSelect.dispatchEvent(new Event('change'));
      }
      // Visual feedback: briefly highlight
      bar.style.outline = '2px solid var(--color-danger)';
      setTimeout(() => { bar.style.outline = 'none'; }, 800);
    });

    // Right click → set as cathode
    bar.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const id = bar.dataset.id;
      if (cathodeSelect) {
        cathodeSelect.value = id;
        cathodeSelect.dispatchEvent(new Event('change'));
      }
      // Visual feedback
      bar.style.outline = '2px solid var(--color-success)';
      setTimeout(() => { bar.style.outline = 'none'; }, 800);
    });

    // Long press (touch) → set as cathode
    let pressTimer = null;
    bar.addEventListener('touchstart', (e) => {
      pressTimer = setTimeout(() => {
        const id = bar.dataset.id;
        if (cathodeSelect) {
          cathodeSelect.value = id;
          cathodeSelect.dispatchEvent(new Event('change'));
        }
        bar.style.outline = '2px solid var(--color-success)';
        setTimeout(() => { bar.style.outline = 'none'; }, 800);
        pressTimer = null;
      }, 500);
    }, { passive: true });
    bar.addEventListener('touchend', () => {
      if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
    });
  });
}