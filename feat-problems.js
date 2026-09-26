/**
 * feat-problems.js
 * "Practice Problems" module — Phase 1 of the feature roadmap (Infinite Problem
 * Generation). Every problem category is generated and graded using the SAME
 * calculation engines already exported by core.js (calculateMolarMass,
 * calcMolarity, solveIdealGas, calculateMolarSolubility, balanceEquationAsync)
 * — no parallel/duplicate chemistry math is introduced here.
 */

import {
  getCompounds, getElements, calculateMolarMass, calcMolarity,
  solveIdealGas, calculateMolarSolubility, balanceEquationAsync,
  formatFormula, formatEquation
} from './core.js';

import { moduleHeaderHTML } from './feat-helpers.js';

/* =====================================================================
   PROBLEM TEMPLATE CONFIG LOADER
   Mirrors the loadHalfCells() pattern already used in feat-compute.js:
   small supplementary config data is fetched directly (bypassing core.js's
   IndexedDB record-store pipeline, which is built for arrays of records,
   not a single config blob), with an in-memory cache and a hardcoded
   fallback so the module still works even before the service worker has
   precached data/problem-templates.json.
   ===================================================================== */
let problemTemplatesCache = null;
async function loadProblemTemplates() {
  if (problemTemplatesCache) return problemTemplatesCache;
  try {
    const res = await fetch('data/problem-templates.json');
    if (res.ok) { problemTemplatesCache = await res.json(); return problemTemplatesCache; }
  } catch (e) { /* fall through to fallback */ }
  problemTemplatesCache = {
    molar_mass: { label: 'Molar Mass', compound_ids: ['h2o', 'nacl', 'hcl', 'naoh'] },
    mole_conversion: { label: 'Mole \u2194 Gram Conversion', compound_ids: ['h2o', 'nacl'], mass_range_g: [1, 100] },
    molarity: { label: 'Solution Molarity', compound_ids: ['nacl', 'naoh'], mass_range_g: [1, 40], volume_range_l: [0.1, 2] },
    gas_law: { label: 'Ideal Gas Law', moles_range_mol: [0.1, 5], volume_range_l: [1, 20], temperature_range_k: [250, 400] },
    ph_strong: { label: 'pH of Strong Acids/Bases', conc_exponent_range: [-4, 0] },
    ksp: { label: 'Ksp \u2192 Molar Solubility', ksp_exponent_range: [-12, -3], stoich_options: [[1, 1], [1, 2]] },
    equation_balancing: { label: 'Equation Balancing', equations: ['Fe + O2 = Fe2O3', 'N2 + H2 = NH3', 'Zn + HCl = ZnCl2 + H2'] },
  };
  return problemTemplatesCache;
}

/* =====================================================================
   RANDOM HELPERS
   ===================================================================== */
function randFloat(min, max, decimals = 2) {
  const v = Math.random() * (max - min) + min;
  return parseFloat(v.toFixed(decimals));
}
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Grades a free-text numeric answer against the correct value.
 * pct: relative tolerance (%). abs: absolute tolerance (overrides pct when set;
 * used for things like pH where relative tolerance makes no sense near zero).
 */
function numericCheck(raw, correct, { pct = 2, abs = null } = {}) {
  const val = parseFloat(raw);
  if (raw == null || raw.toString().trim() === '' || isNaN(val)) {
    return { correct: false, error: 'Enter a number.' };
  }
  const tol = abs != null ? abs : Math.max(Math.abs(correct) * (pct / 100), 1e-9);
  return { correct: Math.abs(val - correct) <= tol, correctAnswerDisplay: correct };
}

/* =====================================================================
   EQUATION-BALANCING VALIDATION
   Deliberately does NOT string-compare against the worker's canonical
   answer — any correctly balanced multiple should be accepted, and exact
   coefficient/formatting matching would unfairly reject valid answers.
   Instead this parses both sides into per-element atom counts (reusing the
   same bracket-aware parsing approach core.js/compute.worker.js already use)
   and checks the equation is (a) actually balanced and (b) uses exactly the
   same reactant/product species as the original unbalanced equation.
   ===================================================================== */
function parseFormulaCounts(formula) {
  const stack = [{}];
  let i = 0;
  while (i < formula.length) {
    const ch = formula[i];
    if (ch === '(' || ch === '[') { stack.push({}); i++; }
    else if (ch === ')' || ch === ']') {
      const top = stack.pop();
      i++;
      let numStr = '';
      while (i < formula.length && /[0-9]/.test(formula[i])) { numStr += formula[i]; i++; }
      const mult = numStr ? parseInt(numStr, 10) : 1;
      const parent = stack[stack.length - 1];
      for (const el in top) parent[el] = (parent[el] || 0) + top[el] * mult;
    } else if (/[A-Z]/.test(ch)) {
      let el = ch; i++;
      if (i < formula.length && /[a-z]/.test(formula[i])) { el += formula[i]; i++; }
      let numStr = '';
      while (i < formula.length && /[0-9]/.test(formula[i])) { numStr += formula[i]; i++; }
      const mult = numStr ? parseInt(numStr, 10) : 1;
      const top = stack[stack.length - 1];
      top[el] = (top[el] || 0) + mult;
    } else { i++; }
  }
  return stack[0];
}

function parseEquationSide(sideStr) {
  const terms = sideStr.split('+').map(t => t.trim()).filter(Boolean);
  if (terms.length === 0) return null;
  const termFormulas = [];
  const elementTotals = {};
  for (const term of terms) {
    const m = term.match(/^(\d*)\s*([A-Za-z0-9()[\]]+)$/);
    if (!m) return null;
    const coeff = m[1] ? parseInt(m[1], 10) : 1;
    const formula = m[2];
    const counts = parseFormulaCounts(formula);
    if (Object.keys(counts).length === 0) return null;
    termFormulas.push(formula);
    for (const el in counts) elementTotals[el] = (elementTotals[el] || 0) + counts[el] * coeff;
  }
  return { terms: termFormulas, elementTotals };
}

function sameFormulaSet(a, b) {
  const norm = arr => [...arr].map(f => f.trim()).sort().join('|');
  return norm(a) === norm(b);
}

function sameElementTotals(a, b) {
  const keysA = Object.keys(a), keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every(k => a[k] === b[k]);
}

function checkBalancedEquation(raw, originalEquation) {
  const userInput = (raw || '').trim();
  if (!userInput.includes('=')) {
    return { correct: false, error: "Use the format 'reactants = products', e.g. 2H2 + O2 = 2H2O" };
  }
  const [userLhsRaw, userRhsRaw] = userInput.split('=').map(s => s.trim());
  const [origLhsRaw, origRhsRaw] = originalEquation.split('=').map(s => s.trim());
  if (!userLhsRaw || !userRhsRaw) return { correct: false, error: 'Missing reactants or products.' };

  const userLhs = parseEquationSide(userLhsRaw);
  const userRhs = parseEquationSide(userRhsRaw);
  const origLhs = parseEquationSide(origLhsRaw);
  const origRhs = parseEquationSide(origRhsRaw);

  if (!userLhs || !userRhs) {
    return { correct: false, error: "Couldn't parse that — check formula syntax (e.g. 2H2O, Fe2O3)." };
  }
  if (!sameFormulaSet(userLhs.terms, origLhs.terms) || !sameFormulaSet(userRhs.terms, origRhs.terms)) {
    return { correct: false, error: "That doesn't use the same reactants/products as the given equation — only add coefficients, don't change species." };
  }
  if (!sameElementTotals(userLhs.elementTotals, userRhs.elementTotals)) {
    return { correct: false, error: 'Not balanced yet — element counts differ between the two sides.' };
  }
  return { correct: true };
}

function formatUnbalancedEquation(eq) {
  return eq.split('=').map(side => side.split('+').map(t => formatFormula(t.trim())).join(' + ')).join(' = ');
}

/* =====================================================================
   PROBLEM GENERATORS — each reuses the real core.js engine for its math
   ===================================================================== */
function generateMolarMass(compoundsById, compoundIds, elementsData) {
  const id = pick(compoundIds);
  const compound = compoundsById.get(id);
  if (!compound) return null;
  const molarMass = calculateMolarMass(compound.formula, elementsData);
  return {
    prompt: `What is the molar mass of ${compound.name} (${formatFormula(compound.formula)})?`,
    unit: 'g/mol',
    answer: molarMass,
    check: (raw) => numericCheck(raw, molarMass, { pct: 1.5 }),
  };
}

function generateMoleConversion(compoundsById, compoundIds, elementsData, cfg) {
  const id = pick(compoundIds);
  const compound = compoundsById.get(id);
  if (!compound) return null;
  const molarMass = calculateMolarMass(compound.formula, elementsData);
  if (Math.random() < 0.5) {
    const mass = randFloat(cfg.mass_range_g[0], cfg.mass_range_g[1], 1);
    const moles = mass / molarMass;
    return {
      prompt: `How many moles are in ${mass} g of ${compound.name} (${formatFormula(compound.formula)})? (Molar mass = ${molarMass.toFixed(2)} g/mol)`,
      unit: 'mol',
      answer: moles,
      check: (raw) => numericCheck(raw, moles, { pct: 3 }),
    };
  }
  const moles = randFloat(0.05, 3, 2);
  const mass = moles * molarMass;
  return {
    prompt: `What mass (in grams) is ${moles} mol of ${compound.name} (${formatFormula(compound.formula)})? (Molar mass = ${molarMass.toFixed(2)} g/mol)`,
    unit: 'g',
    answer: mass,
    check: (raw) => numericCheck(raw, mass, { pct: 2 }),
  };
}

function generateMolarity(compoundsById, compoundIds, elementsData, cfg) {
  const id = pick(compoundIds);
  const compound = compoundsById.get(id);
  if (!compound) return null;
  const molarMass = calculateMolarMass(compound.formula, elementsData);
  const mass = randFloat(cfg.mass_range_g[0], cfg.mass_range_g[1], 1);
  const volume = randFloat(cfg.volume_range_l[0], cfg.volume_range_l[1], 2);
  const moles = mass / molarMass;
  const molarity = calcMolarity(moles, volume);
  return {
    prompt: `${mass} g of ${compound.name} (${formatFormula(compound.formula)}) is dissolved in ${volume} L of solution. What is the molarity? (Molar mass = ${molarMass.toFixed(2)} g/mol)`,
    unit: 'M',
    answer: molarity,
    check: (raw) => numericCheck(raw, molarity, { pct: 3 }),
  };
}

function generateGasLaw(cfg) {
  const n = randFloat(cfg.moles_range_mol[0], cfg.moles_range_mol[1], 2);
  const t = randFloat(cfg.temperature_range_k[0], cfg.temperature_range_k[1], 0);
  const v = randFloat(cfg.volume_range_l[0], cfg.volume_range_l[1], 2);
  const p = solveIdealGas(null, v, n, t).val;
  const solveFor = pick(['P', 'V', 'n', 'T']);

  if (solveFor === 'P') {
    return { prompt: `A gas sample has n = ${n} mol, V = ${v} L, T = ${t} K. Using PV = nRT (R = 0.0821 L\u00b7atm/(mol\u00b7K)), find P (atm).`, unit: 'atm', answer: p, check: (raw) => numericCheck(raw, p, { pct: 3 }) };
  }
  if (solveFor === 'V') {
    const answer = solveIdealGas(p, null, n, t).val;
    return { prompt: `A gas sample has n = ${n} mol, P = ${p.toFixed(3)} atm, T = ${t} K. Find V (L).`, unit: 'L', answer, check: (raw) => numericCheck(raw, answer, { pct: 3 }) };
  }
  if (solveFor === 'n') {
    const answer = solveIdealGas(p, v, null, t).val;
    return { prompt: `A gas sample has P = ${p.toFixed(3)} atm, V = ${v} L, T = ${t} K. Find n (mol).`, unit: 'mol', answer, check: (raw) => numericCheck(raw, answer, { pct: 3 }) };
  }
  const answer = solveIdealGas(p, v, n, null).val;
  return { prompt: `A gas sample has P = ${p.toFixed(3)} atm, V = ${v} L, n = ${n} mol. Find T (K).`, unit: 'K', answer, check: (raw) => numericCheck(raw, answer, { pct: 3 }) };
}

function generatePHStrong(cfg) {
  const exponent = randFloat(cfg.conc_exponent_range[0], cfg.conc_exponent_range[1], 2);
  const conc = parseFloat(Math.pow(10, exponent).toPrecision(2));
  const isAcid = Math.random() < 0.5;
  const ph = isAcid ? -Math.log10(conc) : 14 - (-Math.log10(conc));
  return {
    prompt: `What is the pH of a ${conc} M solution of a strong ${isAcid ? 'acid' : 'base'}?`,
    unit: 'pH',
    answer: ph,
    check: (raw) => numericCheck(raw, ph, { abs: 0.1 }),
  };
}

function generateKsp(cfg) {
  const exp = randInt(cfg.ksp_exponent_range[0], cfg.ksp_exponent_range[1]);
  const mantissa = randFloat(1, 9.9, 1);
  const ksp = mantissa * Math.pow(10, exp);
  const [countA, countB] = pick(cfg.stoich_options);
  const s = calculateMolarSolubility(ksp, countA, countB);
  const aLabel = `A${countA > 1 ? countA : ''}`;
  const bLabel = `B${countB > 1 ? countB : ''}`;
  return {
    prompt: `A salt ${aLabel}${bLabel} has Ksp = ${ksp.toExponential(2)} and dissociates into ${countA} A ion${countA > 1 ? 's' : ''} + ${countB} B ion${countB > 1 ? 's' : ''}. What is its molar solubility, s (mol/L)?`,
    unit: 'mol/L',
    answer: s,
    check: (raw) => numericCheck(raw, s, { pct: 3 }),
  };
}

function generateBalancing(cfg) {
  const equation = pick(cfg.equations);
  return {
    isEquation: true,
    rawEquation: equation,
    prompt: `Balance this equation (type coefficients, e.g. "2H2 + O2 = 2H2O"):`,
    promptHtml: formatUnbalancedEquation(equation),
    check: (raw) => checkBalancedEquation(raw, equation),
    reveal: async () => {
      try { return formatEquation(await balanceEquationAsync(equation)); }
      catch (e) { return null; }
    },
  };
}

/* =====================================================================
   MODULE
   ===================================================================== */
export async function mountProblems(container) {
  container.innerHTML = `<div class="placeholder-note">Loading practice engine...</div>`;

  let compounds = [], elementsData = [], templates = null;
  try {
    [compounds, elementsData, templates] = await Promise.all([getCompounds(), getElements(), loadProblemTemplates()]);
  } catch (e) {
    container.innerHTML = `<div class="placeholder-note">Failed to load practice problem data.</div>`;
    return;
  }
  const compoundsById = new Map(compounds.map(c => [String(c.id).toLowerCase(), c]));

  const CATEGORIES = {
    molar_mass: { label: templates.molar_mass.label, gen: () => generateMolarMass(compoundsById, templates.molar_mass.compound_ids, elementsData) },
    mole_conversion: { label: templates.mole_conversion.label, gen: () => generateMoleConversion(compoundsById, templates.mole_conversion.compound_ids, elementsData, templates.mole_conversion) },
    molarity: { label: templates.molarity.label, gen: () => generateMolarity(compoundsById, templates.molarity.compound_ids, elementsData, templates.molarity) },
    gas_law: { label: templates.gas_law.label, gen: () => generateGasLaw(templates.gas_law) },
    ph_strong: { label: templates.ph_strong.label, gen: () => generatePHStrong(templates.ph_strong) },
    ksp: { label: templates.ksp.label, gen: () => generateKsp(templates.ksp) },
    equation_balancing: { label: templates.equation_balancing.label, gen: () => generateBalancing(templates.equation_balancing) },
  };

  container.innerHTML = `
    ${moduleHeaderHTML('🧩', 'Practice Problems', 'Infinitely generated practice questions, computed and graded with the same engines that power the Calculators tab.', '--accent-sodium')}
    <div class="panel">
      <div class="form-grid" style="grid-template-columns: 1fr auto; align-items: end; margin-bottom: 0;">
        <div class="field" style="margin-bottom: 0;">
          <label>Category</label>
          <select id="prob-category">
            ${Object.entries(CATEGORIES).map(([key, c]) => `<option value="${key}">${c.label}</option>`).join('')}
          </select>
        </div>
        <button class="btn-primary" id="prob-new" style="width: auto; padding: 12px 24px;">New Problem</button>
      </div>
    </div>

    <div class="card" id="prob-card">
      <div class="card-title"><span class="card-title-text">Question</span><span class="badge badge-info" id="prob-score">0 / 0</span></div>
      <div id="prob-prompt" style="font-size: 1.05rem; margin: 12px 0 20px; line-height: 1.6;"></div>
      <div class="form-grid" style="grid-template-columns: 1fr auto auto; align-items: end; margin-bottom: 0;">
        <div class="field" style="margin-bottom: 0;">
          <label id="prob-answer-label">Your Answer</label>
          <input type="text" id="prob-answer-input" autocomplete="off" placeholder="Type your answer..." />
        </div>
        <button class="btn-primary" id="prob-check" style="width: auto; padding: 12px 24px;">Check</button>
        <button class="btn-primary" id="prob-reveal" style="width: auto; padding: 12px 24px; background: var(--color-surface-alt); color: var(--color-text); border: 1px solid var(--color-border); box-shadow: none;">Reveal</button>
      </div>
      <div id="prob-feedback" style="margin-top: 16px;"></div>
    </div>
  `;

  const categorySelect = document.getElementById('prob-category');
  const promptDiv = document.getElementById('prob-prompt');
  const answerLabel = document.getElementById('prob-answer-label');
  const answerInput = document.getElementById('prob-answer-input');
  const feedbackDiv = document.getElementById('prob-feedback');
  const scoreBadge = document.getElementById('prob-score');

  let currentProblem = null;
  let score = { correct: 0, total: 0 };

  function updateScoreBadge() {
    scoreBadge.textContent = `${score.correct} / ${score.total}`;
  }

  function newProblem() {
    const categoryKey = categorySelect.value;
    let problem = null;
    // Curated compound pools always resolve, but retry defensively in case
    // a future template references a compound id that isn't in compounds.json.
    for (let attempt = 0; attempt < 5 && !problem; attempt++) {
      problem = CATEGORIES[categoryKey].gen();
    }
    if (!problem) {
      promptDiv.innerHTML = `<span style="color: var(--color-danger);">Couldn't generate a problem for this category — try another.</span>`;
      currentProblem = null;
      return;
    }
    currentProblem = problem;
    promptDiv.innerHTML = problem.promptHtml
      ? `${problem.prompt}<div class="equation-box" style="margin-top:10px;">${problem.promptHtml}</div>`
      : problem.prompt;
    answerLabel.textContent = problem.isEquation ? 'Balanced Equation' : `Your Answer${problem.unit ? ` (${problem.unit})` : ''}`;
    answerInput.value = '';
    feedbackDiv.innerHTML = '';
    answerInput.focus();
  }

  function checkAnswer() {
    if (!currentProblem) return;
    const result = currentProblem.check(answerInput.value);
    if (result.error) {
      feedbackDiv.innerHTML = `<div class="misconception-box" style="margin-top:0;">${result.error}</div>`;
      return;
    }
    score.total += 1;
    if (result.correct) score.correct += 1;
    updateScoreBadge();
    if (result.correct) {
      feedbackDiv.innerHTML = `<div class="explanation-box" style="margin-top:0; border-left-color: var(--color-success);"><strong>✅ Correct!</strong></div>`;
    } else {
      const expected = currentProblem.isEquation
        ? ''
        : ` Expected \u2248 ${typeof currentProblem.answer === 'number' ? currentProblem.answer.toPrecision(4) : currentProblem.answer}${currentProblem.unit ? ' ' + currentProblem.unit : ''}.`;
      feedbackDiv.innerHTML = `<div class="misconception-box" style="margin-top:0;"><strong>❌ Not quite.</strong>${expected}</div>`;
    }
  }

  async function revealAnswer() {
    if (!currentProblem) return;
    if (currentProblem.isEquation) {
      feedbackDiv.innerHTML = `<div class="explanation-box" style="margin-top:0;">Solving on the background thread...</div>`;
      const balanced = await currentProblem.reveal();
      feedbackDiv.innerHTML = balanced
        ? `<div class="explanation-box" style="margin-top:0;"><strong>Balanced:</strong></div><div class="equation-box">${balanced}</div>`
        : `<div class="misconception-box" style="margin-top:0;">Couldn't solve this one automatically.</div>`;
      return;
    }
    const val = currentProblem.answer;
    const display = typeof val === 'number' ? val.toPrecision(4) : val;
    feedbackDiv.innerHTML = `<div class="explanation-box" style="margin-top:0;"><strong>Answer:</strong> ${display}${currentProblem.unit ? ' ' + currentProblem.unit : ''}</div>`;
  }

  categorySelect.addEventListener('change', newProblem);
  document.getElementById('prob-new').addEventListener('click', newProblem);
  document.getElementById('prob-check').addEventListener('click', checkAnswer);
  document.getElementById('prob-reveal').addEventListener('click', revealAnswer);
  answerInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') checkAnswer(); });

  updateScoreBadge();
  newProblem();
}