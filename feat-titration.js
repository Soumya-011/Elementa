/**
 * feat-titration.js
 * Phase 4 of the feature roadmap: interactive Acid-Base Titration Simulator.
 *
 * Scope (decided with the user before building):
 *  - Strong acid <-> strong base (exact, no added constants)
 *  - Weak acid <-> strong base titrant, and weak base <-> strong acid titrant
 *    (monoprotic only), using a small literature Ka/Kb reference table — the
 *    same category of "known constant" the existing pH calculator already
 *    asks the user to type in manually.
 *  - Indicator color-change overlay with a suitability check against the
 *    computed equivalence pH.
 *
 * Consumes the shared LineChart engine from feat-charts.js (Phase 3).
 */

import { LineChart } from './feat-charts.js';
import { moduleHeaderHTML } from './feat-helpers.js';

const Kw = 1e-14;

/* =====================================================================
   REFERENCE DATA
   Ka/Kb are standard literature values at 25°C (same figures commonly
   printed in general-chemistry tables; Ka(CH3COOH)=1.8e-5 is the same
   number already suggested as a placeholder in the existing pH calculator).
   ===================================================================== */
export const ACIDS = [
  { id: 'hcl', name: 'Hydrochloric Acid', formula: 'HCl', strength: 'strong' },
  { id: 'hno3', name: 'Nitric Acid', formula: 'HNO3', strength: 'strong' },
  { id: 'acetic_acid', name: 'Acetic Acid', formula: 'CH3COOH', strength: 'weak', Ka: 1.8e-5 },
  { id: 'hf', name: 'Hydrofluoric Acid', formula: 'HF', strength: 'weak', Ka: 6.3e-4 },
];

export const BASES = [
  { id: 'naoh', name: 'Sodium Hydroxide', formula: 'NaOH', strength: 'strong' },
  { id: 'koh', name: 'Potassium Hydroxide', formula: 'KOH', strength: 'strong' },
  { id: 'nh3_aq', name: 'Ammonia Solution', formula: 'NH3', strength: 'weak', Kb: 1.8e-5 },
];

export const INDICATORS = [
  { id: 'none', name: 'None', lowPH: null, highPH: null },
  { id: 'phenolphthalein', name: 'Phenolphthalein', lowPH: 8.2, highPH: 10.0, lowLabel: 'Colorless', highLabel: 'Pink', lowHex: '#f1eef7', highHex: '#e91e8c' },
  { id: 'methyl_orange', name: 'Methyl Orange', lowPH: 3.1, highPH: 4.4, lowLabel: 'Red', highLabel: 'Yellow', lowHex: '#e53935', highHex: '#fdd835' },
  { id: 'bromothymol_blue', name: 'Bromothymol Blue', lowPH: 6.0, highPH: 7.6, lowLabel: 'Yellow', highLabel: 'Blue', lowHex: '#fdd835', highHex: '#1e88e5' },
  { id: 'litmus', name: 'Litmus', lowPH: 4.5, highPH: 8.3, lowLabel: 'Red', highLabel: 'Blue', lowHex: '#e53935', highHex: '#3949ab' },
];

const EPS_REL = 1e-6;

/* =====================================================================
   PURE MATH — exported for direct (jsdom-free) unit testing
   ===================================================================== */

/** Solve the standard weak-electrolyte quadratic K = x^2/(C-x) for x > 0.
 *  Same closed form already used by the existing pH calculator for weak acids/bases. */
export function solveWeakMonoprotic(K, C) {
  if (!(K > 0) || !(C > 0)) return 0;
  return (-K + Math.sqrt(K * K + 4 * K * C)) / 2;
}

export function computeEquivalenceVolumeML(Ca, VaML, Cb) {
  if (!(Ca > 0) || !(VaML > 0) || !(Cb > 0)) return 0;
  return (Ca * VaML) / Cb;
}

/**
 * @param {object} p
 *   mode: 'acid-analyte' | 'base-analyte'
 *   analyte: entry from ACIDS or BASES (the species in the flask)
 *   Ca: analyte concentration (M), VaML: analyte initial volume (mL)
 *   Cb: titrant concentration (M), VbML: titrant volume added so far (mL)
 * @returns {{ pH: number, region: 'initial'|'before-eq'|'equivalence'|'after-eq' }}
 */
export function computePH(p) {
  const { mode, analyte, Ca, VaML, Cb, VbML } = p;
  if (!(Ca > 0) || !(VaML > 0) || !(Cb > 0) || VbML < 0) return { pH: NaN, region: 'initial' };

  const Va = VaML / 1000, Vb = VbML / 1000;
  const Vtotal = Va + Vb;
  const nA = Ca * Va;      // moles of analyte originally present
  const nT = Cb * Vb;      // moles of titrant added so far
  const tol = Math.max(nA, nT, 1e-12) * EPS_REL;

  let pH;
  let region;

  if (mode === 'acid-analyte') {
    if (analyte.strength === 'strong') {
      if (nT < nA - tol) { pH = -Math.log10((nA - nT) / Vtotal); region = 'before-eq'; }
      else if (nT > nA + tol) { pH = 14 + Math.log10((nT - nA) / Vtotal); region = 'after-eq'; }
      else { pH = 7; region = 'equivalence'; }
    } else {
      const Ka = analyte.Ka;
      if (VbML === 0) {
        const H = solveWeakMonoprotic(Ka, Ca);
        pH = -Math.log10(H); region = 'initial';
      } else if (nT < nA - tol) {
        const nHA = nA - nT, nAminus = nT;
        pH = -Math.log10(Ka) + Math.log10(nAminus / nHA); region = 'before-eq';
      } else if (nT > nA + tol) {
        const OHexcess = (nT - nA) / Vtotal;
        pH = 14 + Math.log10(OHexcess); region = 'after-eq';
      } else {
        const Cconj = nA / Vtotal;
        const KbConj = Kw / Ka;
        const OH = solveWeakMonoprotic(KbConj, Cconj);
        pH = 14 + Math.log10(OH); region = 'equivalence';
      }
    }
  } else { // base-analyte
    if (analyte.strength === 'strong') {
      if (nT < nA - tol) { pH = 14 + Math.log10((nA - nT) / Vtotal); region = 'before-eq'; }
      else if (nT > nA + tol) { pH = -Math.log10((nT - nA) / Vtotal); region = 'after-eq'; }
      else { pH = 7; region = 'equivalence'; }
    } else {
      const Kb = analyte.Kb;
      if (VbML === 0) {
        const OH = solveWeakMonoprotic(Kb, Ca);
        pH = 14 + Math.log10(OH); region = 'initial';
      } else if (nT < nA - tol) {
        const nB = nA - nT, nBHplus = nT;
        const pOH = -Math.log10(Kb) + Math.log10(nBHplus / nB);
        pH = 14 - pOH; region = 'before-eq';
      } else if (nT > nA + tol) {
        const Hexcess = (nT - nA) / Vtotal;
        pH = -Math.log10(Hexcess); region = 'after-eq';
      } else {
        const Cconj = nA / Vtotal;
        const KaConj = Kw / Kb;
        const H = solveWeakMonoprotic(KaConj, Cconj);
        pH = -Math.log10(H); region = 'equivalence';
      }
    }
  }

  if (!isFinite(pH)) pH = pH > 0 ? 14 : 0;
  pH = Math.max(0, Math.min(14, pH));
  return { pH, region };
}

/** Full curve, densely sampled near the equivalence point for a sharp rise/fall. */
export function generateTitrationCurve(p, maxVolumeML) {
  const veq = computeEquivalenceVolumeML(p.Ca, p.VaML, p.Cb);
  const maxV = maxVolumeML || Math.max(veq * 2.2, veq + 15, 10);
  const coarseStep = maxV / 150;
  const vols = new Set();
  for (let v = 0; v <= maxV; v += coarseStep) vols.add(Math.round(v * 100) / 100);
  vols.add(Math.round(maxV * 100) / 100);
  if (veq > 0) {
    const fineWindow = Math.max(veq * 0.08, 1.5);
    for (let v = Math.max(0, veq - fineWindow); v <= Math.min(maxV, veq + fineWindow); v += 0.02) {
      vols.add(Math.round(v * 100) / 100);
    }
  }
  const sorted = Array.from(vols).sort((a, b) => a - b);
  const points = sorted.map(v => ({ x: v, y: computePH({ ...p, VbML: v }).pH }));
  return { points, veq, maxV };
}

/** Linear hex-color interpolation for the indicator transition band. */
function lerpHex(hexA, hexB, t) {
  t = Math.max(0, Math.min(1, t));
  const a = hexA.match(/[a-f0-9]{2}/gi).map(h => parseInt(h, 16));
  const b = hexB.match(/[a-f0-9]{2}/gi).map(h => parseInt(h, 16));
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
}

export function getIndicatorColorHex(indicator, pH) {
  if (!indicator || indicator.id === 'none' || !isFinite(pH)) return '#eef2f6';
  const { lowPH, highPH, lowHex, highHex } = indicator;
  if (pH <= lowPH) return lowHex;
  if (pH >= highPH) return highHex;
  return lerpHex(lowHex, highHex, (pH - lowPH) / (highPH - lowPH));
}

export function isIndicatorSuitable(indicator, equivalencePH) {
  if (!indicator || indicator.id === 'none' || !isFinite(equivalencePH)) return null;
  return equivalencePH >= indicator.lowPH && equivalencePH <= indicator.highPH;
}

/* =====================================================================
   MODULE
   ===================================================================== */
export async function mountTitration(container) {
  container.innerHTML = moduleHeaderHTML(
    '🧪',
    'Titration Simulator',
    'Titrate an acid or base of known concentration and watch the pH curve, equivalence point, and indicator color develop in real time.',
    '--accent-lithium'
  );

  let mode = 'acid-analyte';
  let analyte = ACIDS[0];
  let titrant = BASES[0];
  let Ca = 0.1, VaML = 25, Cb = 0.1;
  let indicator = INDICATORS[1]; // phenolphthalein default
  let curve = null;
  let chart = null;
  let VbML = 0;

  const setupHtml = `
    <div class="panel" id="titration-setup">
      <h3 style="margin-bottom: 14px;">Set Up the Titration</h3>
      <div class="form-grid" style="grid-template-columns: 1fr 1fr;">
        <div class="field">
          <label>What's in the flask?</label>
          <select id="tt-mode">
            <option value="acid-analyte">An acid (titrated with a strong base)</option>
            <option value="base-analyte">A base (titrated with a strong acid)</option>
          </select>
        </div>
        <div class="field">
          <label>Indicator</label>
          <select id="tt-indicator">
            ${INDICATORS.map(i => `<option value="${i.id}" ${i.id === indicator.id ? 'selected' : ''}>${i.name}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label id="tt-analyte-label">Acid in Flask</label>
          <select id="tt-analyte"></select>
        </div>
        <div class="field">
          <label id="tt-titrant-label">Titrant (Buret)</label>
          <select id="tt-titrant"></select>
        </div>
        <div class="field"><label>Analyte Concentration (M)</label><input type="number" id="tt-ca" value="${Ca}" step="any" min="0.0001" /></div>
        <div class="field"><label>Analyte Volume (mL)</label><input type="number" id="tt-va" value="${VaML}" step="any" min="0.1" /></div>
        <div class="field"><label>Titrant Concentration (M)</label><input type="number" id="tt-cb" value="${Cb}" step="any" min="0.0001" /></div>
      </div>
      <button class="btn-primary" id="tt-start" style="margin-top: 10px;">▶ Start Titration</button>
      <div id="tt-setup-error" class="misconception-box" style="display:none; margin-top:12px;"></div>
    </div>
    <div id="titration-run" style="display:none;"></div>
  `;
  container.insertAdjacentHTML('beforeend', setupHtml);

  const modeSelect = document.getElementById('tt-mode');
  const indicatorSelect = document.getElementById('tt-indicator');
  const analyteSelect = document.getElementById('tt-analyte');
  const titrantSelect = document.getElementById('tt-titrant');
  const analyteLabel = document.getElementById('tt-analyte-label');
  const titrantLabel = document.getElementById('tt-titrant-label');
  const caInput = document.getElementById('tt-ca');
  const vaInput = document.getElementById('tt-va');
  const cbInput = document.getElementById('tt-cb');
  const errorBox = document.getElementById('tt-setup-error');
  const runContainer = document.getElementById('titration-run');

  function populateSelectors() {
    const isAcidAnalyte = modeSelect.value === 'acid-analyte';
    analyteLabel.textContent = isAcidAnalyte ? 'Acid in Flask' : 'Base in Flask';
    titrantLabel.textContent = isAcidAnalyte ? 'Titrant (Strong Base, Buret)' : 'Titrant (Strong Acid, Buret)';
    const analytePool = isAcidAnalyte ? ACIDS : BASES;
    const titrantPool = (isAcidAnalyte ? BASES : ACIDS).filter(x => x.strength === 'strong');
    analyteSelect.innerHTML = analytePool.map(a => `<option value="${a.id}">${a.name}${a.strength === 'weak' ? ' (weak)' : ''}</option>`).join('');
    titrantSelect.innerHTML = titrantPool.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
  }
  modeSelect.addEventListener('change', populateSelectors);
  populateSelectors();

  document.getElementById('tt-start').addEventListener('click', () => {
    mode = modeSelect.value;
    const pool = mode === 'acid-analyte' ? ACIDS : BASES;
    const titrantPool = mode === 'acid-analyte' ? BASES : ACIDS;
    analyte = pool.find(a => a.id === analyteSelect.value);
    titrant = titrantPool.find(a => a.id === titrantSelect.value);
    indicator = INDICATORS.find(i => i.id === indicatorSelect.value);
    Ca = parseFloat(caInput.value);
    VaML = parseFloat(vaInput.value);
    Cb = parseFloat(cbInput.value);

    if (!(Ca > 0) || !(VaML > 0) || !(Cb > 0)) {
      errorBox.style.display = 'block';
      errorBox.innerHTML = '<strong>Invalid input:</strong> concentrations and volume must be positive numbers.';
      return;
    }
    errorBox.style.display = 'none';
    VbML = 0;
    startRun();
  });

  function startRun() {
    runContainer.style.display = 'block';
    const params = { mode, analyte, Ca, VaML, Cb };
    curve = generateTitrationCurve(params);
    const eqResult = computePH({ ...params, VbML: curve.veq });

    runContainer.innerHTML = `
      <div class="card" style="margin-top:16px; display:flex; gap:24px; flex-wrap:wrap; align-items:center;">
        <div style="flex: 0 0 140px; text-align:center;">
          <svg id="tt-flask" width="110" height="130" viewBox="0 0 110 130">
            <path d="M40 10 H70 V45 L95 110 Q98 120 85 120 H25 Q12 120 15 110 L40 45 Z" fill="none" stroke="var(--color-text-muted)" stroke-width="3"/>
            <path id="tt-flask-liquid" d="M30 70 L95 108 Q98 120 85 120 H25 Q12 120 15 108 Z" fill="#eef2f6" stroke="none"/>
            <path d="M40 10 H70 V45 L95 110 Q98 120 85 120 H25 Q12 120 15 110 L40 45 Z" fill="none" stroke="var(--color-text-muted)" stroke-width="3"/>
            <rect x="36" y="4" width="38" height="8" rx="2" fill="var(--color-text-muted)"/>
          </svg>
          <div id="tt-indicator-note" style="font-size:0.72rem; color: var(--color-text-muted); margin-top:4px;"></div>
        </div>
        <div style="flex: 1; min-width: 220px;">
          <div class="qa-stats" style="justify-content:flex-start; gap: 28px;">
            <div class="qa-stat"><div class="qa-stat-val" id="tt-vol-readout">0.00 mL</div><div class="qa-stat-lbl">Titrant Added</div></div>
            <div class="qa-stat"><div class="qa-stat-val" id="tt-ph-readout">—</div><div class="qa-stat-lbl">pH</div></div>
          </div>
          <div id="tt-region-badge" style="margin-top:10px;"></div>
          <div class="text-muted" style="font-size: 0.82rem; margin-top:10px;">
            Equivalence: <strong>${curve.veq.toFixed(2)} mL</strong>, pH <strong>${eqResult.pH.toFixed(2)}</strong>
            ${(() => { const s = isIndicatorSuitable(indicator, eqResult.pH); if (s === null) return ''; return s ? ' &nbsp; ✅ good indicator choice' : ' &nbsp; ⚠️ transition range misses the equivalence point'; })()}
          </div>
        </div>
      </div>

      <div class="card" style="margin-top:16px;">
        <div class="qa-actions" style="justify-content:center; margin-bottom:14px;">
          <button class="btn-primary" id="tt-minus1" style="width:auto; padding:8px 16px;">−1 mL</button>
          <button class="btn-primary" id="tt-minus01" style="width:auto; padding:8px 16px;">−0.1 mL</button>
          <button class="btn-primary" id="tt-plus01" style="width:auto; padding:8px 16px;">+0.1 mL</button>
          <button class="btn-primary" id="tt-plus1" style="width:auto; padding:8px 16px;">+1 mL</button>
          <button class="btn-primary" id="tt-reset" style="width:auto; padding:8px 16px;">↺ Reset</button>
        </div>
        <input type="range" id="tt-slider" min="0" max="${curve.maxV}" step="0.02" value="0" style="width:100%;" />
      </div>

      <div class="card" style="margin-top:16px;">
        <div id="tt-chart"></div>
      </div>
    `;

    chart = new LineChart(document.getElementById('tt-chart'), {
      title: 'pH vs. Volume of Titrant Added',
      xLabel: 'Volume added (mL)', yLabel: 'pH',
      series: [
        { name: 'pH curve', points: curve.points, pointRadius: 0 },
        { name: 'Current', points: [{ x: 0, y: computePH({ ...params, VbML: 0 }).pH }], pointRadius: 6, color: 'var(--color-danger)' },
      ],
      markers: [{ x: curve.veq, label: `Equivalence (${curve.veq.toFixed(2)} mL)`, color: 'var(--color-warning)' }],
      yDomain: [0, 14],
    });

    const slider = document.getElementById('tt-slider');
    slider.addEventListener('input', () => setVolume(parseFloat(slider.value)));
    document.getElementById('tt-plus1').addEventListener('click', () => setVolume(VbML + 1));
    document.getElementById('tt-plus01').addEventListener('click', () => setVolume(VbML + 0.1));
    document.getElementById('tt-minus1').addEventListener('click', () => setVolume(VbML - 1));
    document.getElementById('tt-minus01').addEventListener('click', () => setVolume(VbML - 0.1));
    document.getElementById('tt-reset').addEventListener('click', () => setVolume(0));

    setVolume(0);
  }

  const REGION_LABELS = {
    'initial': { text: 'Initial solution', badge: 'info' },
    'before-eq': { text: 'Before equivalence', badge: 'warning' },
    'equivalence': { text: '⚡ At equivalence point', badge: 'primary' },
    'after-eq': { text: 'Past equivalence', badge: 'success' },
  };

  function setVolume(v) {
    VbML = Math.max(0, Math.min(curve.maxV, Math.round(v * 100) / 100));
    document.getElementById('tt-slider').value = VbML;
    const { pH, region } = computePH({ mode, analyte, Ca, VaML, Cb, VbML });

    document.getElementById('tt-vol-readout').textContent = `${VbML.toFixed(2)} mL`;
    document.getElementById('tt-ph-readout').textContent = isFinite(pH) ? pH.toFixed(2) : '—';

    const r = REGION_LABELS[region] || REGION_LABELS['before-eq'];
    document.getElementById('tt-region-badge').innerHTML = `<span class="badge badge-${r.badge}">${r.text}</span>`;

    const color = getIndicatorColorHex(indicator, pH);
    const liquid = document.getElementById('tt-flask-liquid');
    if (liquid) liquid.setAttribute('fill', color);
    const note = document.getElementById('tt-indicator-note');
    if (note) {
      note.textContent = indicator.id === 'none' ? '' :
        (pH <= indicator.lowPH ? indicator.lowLabel : pH >= indicator.highPH ? indicator.highLabel : `${indicator.lowLabel} → ${indicator.highLabel}`);
    }

    if (chart) {
      chart.update({ series: [
        { name: 'pH curve', points: curve.points, pointRadius: 0 },
        { name: 'Current', points: [{ x: VbML, y: pH }], pointRadius: 6, color: 'var(--color-danger)' },
      ]});
    }
  }
}
