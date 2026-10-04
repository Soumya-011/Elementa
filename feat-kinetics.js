/**
 * feat-kinetics.js
 * Phase 5 of the feature roadmap: Kinetics Grapher.
 *
 * Scope (decided with the user before building): concentration-vs-time
 * explorer for 0th/1st/2nd order reactions with half-life, an order-
 * determination panel that linearizes [A]/ln[A]/1/[A] vs time and reports
 * R^2 for each (the real lab technique for finding reaction order from
 * data), and an Arrhenius tab (Ea / A from a k-vs-T data set).
 *
 * All formulas are exact closed-form kinetics equations — no sourced
 * reference constants are needed here (unlike Phase 4's Ka/Kb table).
 * Consumes the shared LineChart engine from feat-charts.js (Phase 3).
 */

import { LineChart } from './feat-charts.js';
import { moduleHeaderHTML } from './feat-helpers.js';

const GAS_CONSTANT_R = 8.314462618; // J/(mol*K) — same constant already used by calculateNernst() in core.js

/* =====================================================================
   PURE MATH — exported for direct (jsdom-free) unit testing
   ===================================================================== */

/** Integrated rate law: [A] at time t for a 0th/1st/2nd order reaction. */
export function concentrationAtTime(order, k, A0, t) {
  if (!(A0 > 0) || k < 0 || t < 0) return NaN;
  if (order === 0) return Math.max(0, A0 - k * t);
  if (order === 1) return A0 * Math.exp(-k * t);
  if (order === 2) return 1 / (1 / A0 + k * t);
  return NaN;
}

/** Half-life for a 0th/1st/2nd order reaction. */
export function halfLife(order, k, A0) {
  if (!(k > 0)) return NaN;
  if (order === 0) return A0 / (2 * k);
  if (order === 1) return Math.LN2 / k;
  if (order === 2) return 1 / (k * A0);
  return NaN;
}

/** Ordinary least-squares linear regression. Returns null if fewer than 2 valid points. */
export function linearRegression(xs, ys) {
  const n = xs.length;
  if (n < 2 || ys.length !== n) return null;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0, sumYY = 0;
  for (let i = 0; i < n; i++) {
    sumX += xs[i]; sumY += ys[i];
    sumXY += xs[i] * ys[i]; sumXX += xs[i] * xs[i]; sumYY += ys[i] * ys[i];
  }
  const denom = n * sumXX - sumX * sumX;
  if (Math.abs(denom) < 1e-15) return null;
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  const yMean = sumY / n;
  let ssTot = 0, ssRes = 0;
  for (let i = 0; i < n; i++) {
    const pred = slope * xs[i] + intercept;
    ssRes += (ys[i] - pred) ** 2;
    ssTot += (ys[i] - yMean) ** 2;
  }
  const r2 = ssTot < 1e-15 ? 1 : 1 - ssRes / ssTot;
  return { slope, intercept, r2 };
}

/** Deterministic small PRNG (mulberry32) so "noisy" sample data is reproducible across a render. */
function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generate sample concentration-vs-time data for the order-determination panel.
 * @param {object} p { order, k, A0, maxT, numPoints, noisePct, seed }
 */
export function generateKineticsData(p) {
  const { order, k, A0, maxT, numPoints = 10, noisePct = 0, seed = 1 } = p;
  const rng = makeRng(seed);
  const points = [];
  for (let i = 1; i <= numPoints; i++) {
    const t = (maxT * i) / numPoints;
    let conc = concentrationAtTime(order, k, A0, t);
    if (noisePct > 0 && isFinite(conc)) {
      const noise = 1 + (rng() * 2 - 1) * (noisePct / 100);
      conc = Math.max(1e-12, conc * noise);
    }
    points.push({ t, conc });
  }
  return points;
}

/** Build the three linearized views ([A], ln[A], 1/[A] vs t) with regression fits. */
export function computeLinearizations(data) {
  const valid = data.filter(d => d.conc > 1e-12);
  const ts = valid.map(d => d.t);
  const zeroYs = valid.map(d => d.conc);
  const firstYs = valid.map(d => Math.log(d.conc));
  const secondYs = valid.map(d => 1 / d.conc);

  return {
    zero:   { label: '[A] vs t (zero order)',    xs: ts, ys: zeroYs,   fit: linearRegression(ts, zeroYs) },
    first:  { label: 'ln[A] vs t (first order)',  xs: ts, ys: firstYs,  fit: linearRegression(ts, firstYs) },
    second: { label: '1/[A] vs t (second order)', xs: ts, ys: secondYs, fit: linearRegression(ts, secondYs) },
  };
}

/** Which of the three linearizations best matches a straight line. */
export function bestLinearization(linearizations) {
  const entries = Object.entries(linearizations).filter(([, v]) => v.fit);
  if (entries.length === 0) return null;
  entries.sort((a, b) => b[1].fit.r2 - a[1].fit.r2);
  return entries[0][0]; // 'zero' | 'first' | 'second'
}

/**
 * Arrhenius fit from a set of (T in K, k) points: ln(k) = ln(A) - (Ea/R)*(1/T).
 * Returns { Ea (J/mol), A, r2 } or null if fewer than 2 valid points.
 */
export function arrheniusFit(dataPoints) {
  const valid = dataPoints.filter(p => p.T > 0 && p.k > 0);
  if (valid.length < 2) return null;
  const xs = valid.map(p => 1 / p.T);
  const ys = valid.map(p => Math.log(p.k));
  const reg = linearRegression(xs, ys);
  if (!reg) return null;
  const Ea = -reg.slope * GAS_CONSTANT_R;
  const A = Math.exp(reg.intercept);
  return { Ea, A, r2: reg.r2, slope: reg.slope, intercept: reg.intercept };
}

export function predictRateConstant(Ea, A, T) {
  if (!(A > 0) || !(T > 0)) return NaN;
  return A * Math.exp(-Ea / (GAS_CONSTANT_R * T));
}

/* =====================================================================
   MODULE
   ===================================================================== */
export async function mountKinetics(container) {
  container.innerHTML = moduleHeaderHTML(
    '📉',
    'Kinetics Grapher',
    'Explore concentration-vs-time curves, determine reaction order from linearized data, and extract activation energy from the Arrhenius equation.',
    '--accent-potassium'
  );

  container.insertAdjacentHTML('beforeend', `
    <div class="calc-nav" style="margin-bottom: 20px; max-width: 360px; margin-left: auto; margin-right: auto;">
      <div class="field" style="margin-bottom: 0;">
        <label style="font-weight: 600; margin-bottom: 4px; display: block; text-align: center;">View</label>
        <select id="kin-tab-select" style="font-size: 0.95rem; padding: 10px 14px; text-align: center;">
          <option value="explorer">📈 Order Explorer</option>
          <option value="determine">🔎 Determine Order</option>
          <option value="arrhenius">🌡️ Arrhenius Equation</option>
        </select>
      </div>
    </div>
    <div id="kin-explorer" class="calc-panel"></div>
    <div id="kin-determine" class="calc-panel hidden"></div>
    <div id="kin-arrhenius" class="calc-panel hidden"></div>
  `);

  const tabs = ['explorer', 'determine', 'arrhenius'];
  const tabSelect = document.getElementById('kin-tab-select');
  tabSelect.addEventListener('change', () => {
    tabs.forEach(t => document.getElementById(`kin-${t}`).classList.toggle('hidden', t !== tabSelect.value));
  });

  mountExplorer(document.getElementById('kin-explorer'));
  mountDetermine(document.getElementById('kin-determine'));
  mountArrhenius(document.getElementById('kin-arrhenius'));
}

const ORDER_UNITS = { 0: 'M/s', 1: '1/s', 2: '1/(M·s)' };

function mountExplorer(panel) {
  panel.innerHTML = `
    <h3 style="color: var(--color-primary); margin-bottom: 4px;">Concentration vs. Time Explorer</h3>
    <p class="calc-subtitle">Pick a reaction order and rate constant to see how [A] decays, and where the half-life falls.</p>
    <div class="form-grid" style="grid-template-columns: repeat(3, 1fr);">
      <div class="field"><label>Reaction Order</label>
        <select id="exp-order"><option value="0">Zero order</option><option value="1" selected>First order</option><option value="2">Second order</option></select>
      </div>
      <div class="field"><label>Rate Constant k (<span id="exp-k-units">1/s</span>)</label><input type="number" id="exp-k" value="0.1" step="any" min="0.0000001" /></div>
      <div class="field"><label>Initial Conc. [A]₀ (M)</label><input type="number" id="exp-a0" value="1.0" step="any" min="0.0001" /></div>
    </div>
    <button class="btn-primary" id="exp-plot">▶ Plot Curve</button>
    <div id="exp-readout" style="margin-top:16px;"></div>
    <div class="card" style="margin-top:16px;"><div id="exp-chart"></div></div>
  `;
  const orderSel = document.getElementById('exp-order');
  const kUnitsLabel = document.getElementById('exp-k-units');
  orderSel.addEventListener('change', () => { kUnitsLabel.textContent = ORDER_UNITS[parseInt(orderSel.value)]; });

  let chart = null;
  document.getElementById('exp-plot').addEventListener('click', () => {
    const order = parseInt(orderSel.value);
    const k = parseFloat(document.getElementById('exp-k').value);
    const A0 = parseFloat(document.getElementById('exp-a0').value);
    const readout = document.getElementById('exp-readout');
    if (!(k > 0) || !(A0 > 0)) {
      readout.innerHTML = `<div class="misconception-box"><strong>Invalid input:</strong> k and [A]₀ must be positive numbers.</div>`;
      return;
    }
    const t12 = halfLife(order, k, A0);
    const maxT = t12 * 5;
    const points = [];
    for (let i = 0; i <= 200; i++) {
      const t = (maxT * i) / 200;
      points.push({ x: t, y: concentrationAtTime(order, k, A0, t) });
    }

    readout.innerHTML = `
      <div class="result-row" style="background: var(--color-surface-alt); padding: 16px; border-radius: var(--radius-sm); border: 1px solid var(--color-border);">
        <div class="result-field"><div class="label">Order</div><div class="value">${order === 0 ? 'Zero' : order === 1 ? 'First' : 'Second'}</div></div>
        <div class="result-field"><div class="label">Half-Life (t<sub>1/2</sub>)</div><div class="value" style="color: var(--color-primary); font-weight:600;">${t12.toFixed(3)} s</div></div>
        <div class="result-field"><div class="label">[A] at t<sub>1/2</sub></div><div class="value">${(A0/2).toFixed(4)} M</div></div>
      </div>
    `;

    const chartEl = document.getElementById('exp-chart');
    if (!chart) {
      chart = new LineChart(chartEl, {});
    }
    chart.update({
      title: 'Concentration vs. Time', xLabel: 'Time (s)', yLabel: '[A] (M)',
      series: [
        { name: '[A]', points, pointRadius: 0, fill: true },
        { name: 'Half-life', points: [{ x: t12, y: A0 / 2 }], pointRadius: 6, color: 'var(--color-danger)' },
      ],
      markers: [{ x: t12, label: `t½ = ${t12.toFixed(2)}s`, color: 'var(--color-warning)' }],
      yDomain: [0, A0 * 1.05],
    });
  });

  document.getElementById('exp-plot').click();
}

function mountDetermine(panel) {
  panel.innerHTML = `
    <h3 style="color: var(--color-primary); margin-bottom: 4px;">Determine Reaction Order from Data</h3>
    <p class="calc-subtitle">Generate sample [A]-vs-time data, then see which of the three linearizations is actually a straight line — that's how order is determined experimentally.</p>
    <div class="form-grid" style="grid-template-columns: repeat(3, 1fr);">
      <div class="field"><label>True Order (to generate data)</label>
        <select id="det-order"><option value="0">Zero order</option><option value="1" selected>First order</option><option value="2">Second order</option></select>
      </div>
      <div class="field"><label>Rate Constant k</label><input type="number" id="det-k" value="0.1" step="any" min="0.0000001" /></div>
      <div class="field"><label>Initial Conc. [A]₀ (M)</label><input type="number" id="det-a0" value="1.0" step="any" min="0.0001" /></div>
      <div class="field"><label># Data Points</label><input type="number" id="det-n" value="10" step="1" min="4" max="30" /></div>
      <div class="field"><label>Simulated Noise (%)</label><input type="number" id="det-noise" value="0" step="any" min="0" max="20" /></div>
    </div>
    <button class="btn-primary" id="det-run">▶ Generate Data &amp; Analyze</button>
    <div id="det-result" style="margin-top:16px;"></div>
    <div class="stacked-cards" id="det-charts" style="margin-top:16px;"></div>
  `;

  const charts = {};
  document.getElementById('det-run').addEventListener('click', () => {
    const order = parseInt(document.getElementById('det-order').value);
    const k = parseFloat(document.getElementById('det-k').value);
    const A0 = parseFloat(document.getElementById('det-a0').value);
    const numPoints = parseInt(document.getElementById('det-n').value);
    const noisePct = parseFloat(document.getElementById('det-noise').value) || 0;
    const resultDiv = document.getElementById('det-result');

    if (!(k > 0) || !(A0 > 0) || !(numPoints >= 4)) {
      resultDiv.innerHTML = `<div class="misconception-box"><strong>Invalid input:</strong> k, [A]₀ must be positive and you need at least 4 data points.</div>`;
      return;
    }

    const t12 = halfLife(order, k, A0);
    const data = generateKineticsData({ order, k, A0, maxT: t12 * 4, numPoints, noisePct, seed: Date.now() % 100000 });
    const lin = computeLinearizations(data);
    const best = bestLinearization(lin);
    const BEST_ORDER_LABEL = { zero: 'Zero', first: 'First', second: 'Second' };

    resultDiv.innerHTML = `
      <div class="explanation-box">
        <strong>Best linear fit:</strong> ${lin[best].label} (R² = ${lin[best].fit.r2.toFixed(5)}) →
        this data is consistent with a <strong style="color: var(--color-primary);">${BEST_ORDER_LABEL[best]}-order</strong> reaction.
        ${best === ({0:'zero',1:'first',2:'second'})[order] ? ' ✅ matches the order used to generate the data.' : ''}
      </div>
    `;

    const chartsDiv = document.getElementById('det-charts');
    if (!chartsDiv.children.length) {
      chartsDiv.innerHTML = `
        <div class="card" id="det-card-zero"><h4 style="margin-bottom:8px;">Zero-Order Test: [A] vs t</h4><div id="det-chart-zero"></div><div class="text-muted" id="det-r2-zero" style="margin-top:8px; font-size:0.85rem;"></div></div>
        <div class="card" id="det-card-first"><h4 style="margin-bottom:8px;">First-Order Test: ln[A] vs t</h4><div id="det-chart-first"></div><div class="text-muted" id="det-r2-first" style="margin-top:8px; font-size:0.85rem;"></div></div>
        <div class="card" id="det-card-second"><h4 style="margin-bottom:8px;">Second-Order Test: 1/[A] vs t</h4><div id="det-chart-second"></div><div class="text-muted" id="det-r2-second" style="margin-top:8px; font-size:0.85rem;"></div></div>
      `;
    }

    ['zero', 'first', 'second'].forEach(key => {
      const entry = lin[key];
      const card = document.getElementById(`det-card-${key}`);
      card.style.borderColor = key === best ? 'var(--color-success)' : 'var(--color-border)';
      card.style.borderWidth = key === best ? '2px' : '1px';

      const fitLine = entry.fit ? [
        { x: entry.xs[0], y: entry.fit.slope * entry.xs[0] + entry.fit.intercept },
        { x: entry.xs[entry.xs.length - 1], y: entry.fit.slope * entry.xs[entry.xs.length - 1] + entry.fit.intercept },
      ] : [];

      if (!charts[key]) charts[key] = new LineChart(document.getElementById(`det-chart-${key}`), {});
      charts[key].update({
        xLabel: 'Time (s)', yLabel: key === 'zero' ? '[A] (M)' : key === 'first' ? 'ln[A]' : '1/[A] (1/M)',
        series: [
          { name: 'Data', points: entry.xs.map((x, i) => ({ x, y: entry.ys[i] })), pointRadius: 4 },
          { name: 'Linear fit', points: fitLine, pointRadius: 0, color: 'var(--color-text-muted)' },
        ],
        height: 220,
      });
      document.getElementById(`det-r2-${key}`).innerHTML = entry.fit ? `R² = <strong>${entry.fit.r2.toFixed(5)}</strong>` : 'Fit unavailable';
    });
  });

  document.getElementById('det-run').click();
}

function mountArrhenius(panel) {
  let rows = [
    { T: 290, k: 1.5e-3 },
    { T: 300, k: 4.0e-3 },
    { T: 310, k: 1.0e-2 },
    { T: 320, k: 2.3e-2 },
  ];

  panel.innerHTML = `
    <h3 style="color: var(--color-primary); margin-bottom: 4px;">Arrhenius Equation: Finding E<sub>a</sub> and A</h3>
    <p class="calc-subtitle">Enter rate constants measured at different temperatures. A linear fit of ln(k) vs 1/T gives activation energy and the pre-exponential factor.</p>
    <div id="arr-rows"></div>
    <div class="qa-actions" style="margin: 10px 0;">
      <button class="btn-primary" id="arr-add-row" style="width:auto; padding: 8px 16px;">+ Add Data Point</button>
    </div>
    <button class="btn-primary" id="arr-calc">▶ Calculate E<sub>a</sub> &amp; A</button>
    <div id="arr-result" style="margin-top:16px;"></div>
    <div class="card" style="margin-top:16px;"><div id="arr-chart"></div></div>
    <div class="panel" style="margin-top:16px;">
      <h4 style="margin-bottom:10px;">Predict k at a New Temperature</h4>
      <div class="form-grid" style="grid-template-columns: 1fr 1fr; align-items:end;">
        <div class="field"><label>Temperature (K)</label><input type="number" id="arr-predict-t" value="298" step="any" min="1" /></div>
        <div id="arr-predict-result" class="text-muted"></div>
      </div>
    </div>
  `;

  const rowsDiv = document.getElementById('arr-rows');
  let chart = null;
  let lastFit = null;

  function renderRows() {
    rowsDiv.innerHTML = rows.map((r, i) => `
      <div class="form-grid" style="grid-template-columns: 1fr 1fr auto; align-items:end; margin-bottom:8px;" data-row="${i}">
        <div class="field" style="margin-bottom:0;"><label>Temperature (K)</label><input type="number" class="arr-t-input" data-i="${i}" value="${r.T}" step="any" min="1" /></div>
        <div class="field" style="margin-bottom:0;"><label>Rate Constant k</label><input type="number" class="arr-k-input" data-i="${i}" value="${r.k}" step="any" min="0" /></div>
        <button class="btn-primary arr-remove-row" data-i="${i}" style="width:auto; padding:8px 14px; height:fit-content;" ${rows.length <= 2 ? 'disabled' : ''}>✕</button>
      </div>
    `).join('');

    rowsDiv.querySelectorAll('.arr-t-input').forEach(el => el.addEventListener('input', () => { rows[parseInt(el.dataset.i)].T = parseFloat(el.value); }));
    rowsDiv.querySelectorAll('.arr-k-input').forEach(el => el.addEventListener('input', () => { rows[parseInt(el.dataset.i)].k = parseFloat(el.value); }));
    rowsDiv.querySelectorAll('.arr-remove-row').forEach(el => el.addEventListener('click', () => {
      if (rows.length <= 2) return;
      rows.splice(parseInt(el.dataset.i), 1);
      renderRows();
    }));
  }
  renderRows();

  document.getElementById('arr-add-row').addEventListener('click', () => {
    rows.push({ T: 300, k: 0.01 });
    renderRows();
  });

  document.getElementById('arr-calc').addEventListener('click', () => {
    const resultDiv = document.getElementById('arr-result');
    const fit = arrheniusFit(rows);
    if (!fit) {
      resultDiv.innerHTML = `<div class="misconception-box"><strong>Invalid input:</strong> need at least 2 rows with positive T and k.</div>`;
      return;
    }
    lastFit = fit;
    const EaKJ = fit.Ea / 1000;
    resultDiv.innerHTML = `
      <div class="result-row" style="background: var(--color-surface-alt); padding: 16px; border-radius: var(--radius-sm); border: 1px solid var(--color-primary);">
        <div class="result-field"><div class="label">Activation Energy (E<sub>a</sub>)</div><div class="value" style="color: var(--color-primary); font-weight:700; font-size:1.2rem;">${EaKJ.toFixed(2)} kJ/mol</div></div>
        <div class="result-field"><div class="label">Pre-exponential Factor (A)</div><div class="value">${fit.A.toExponential(3)}</div></div>
        <div class="result-field"><div class="label">Fit Quality (R²)</div><div class="value">${fit.r2.toFixed(5)}</div></div>
      </div>
    `;

    const xs = rows.map(r => 1 / r.T);
    const ys = rows.map(r => Math.log(r.k));
    const fitLine = [
      { x: Math.min(...xs), y: fit.slope * Math.min(...xs) + fit.intercept },
      { x: Math.max(...xs), y: fit.slope * Math.max(...xs) + fit.intercept },
    ];

    const chartEl = document.getElementById('arr-chart');
    if (!chart) chart = new LineChart(chartEl, {});
    chart.update({
      title: 'Arrhenius Plot: ln(k) vs 1/T', xLabel: '1/T (1/K)', yLabel: 'ln(k)',
      series: [
        { name: 'Data', points: xs.map((x, i) => ({ x, y: ys[i] })), pointRadius: 5 },
        { name: 'Linear fit', points: fitLine, pointRadius: 0, color: 'var(--color-text-muted)' },
      ],
    });
    updatePrediction();
  });

  function updatePrediction() {
    const predDiv = document.getElementById('arr-predict-result');
    if (!lastFit) { predDiv.textContent = 'Calculate Ea & A first.'; return; }
    const T = parseFloat(document.getElementById('arr-predict-t').value);
    if (!(T > 0)) { predDiv.textContent = ''; return; }
    const k = predictRateConstant(lastFit.Ea, lastFit.A, T);
    predDiv.innerHTML = `Predicted k at ${T} K: <strong style="color:var(--color-primary);">${k.toExponential(4)}</strong>`;
  }
  document.getElementById('arr-predict-t').addEventListener('input', updatePrediction);

  document.getElementById('arr-calc').click();
}