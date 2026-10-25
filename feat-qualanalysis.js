/**
 * feat-qualanalysis.js
 * Qualitative Analysis Simulator — Phase 2 of the feature roadmap.
 *
 * A state machine ("select-category" -> "investigating" -> "revealed") that
 * hands the student a hidden unknown (drawn from identification_test.json),
 * lets them run its dry/wet tests, and asks them to identify it from the
 * real recorded results. No chemistry beyond what's already in the JSON
 * data files is invented here — this is a UI/interaction layer on top of
 * the existing, vetted identification_test.json dataset.
 */

import { getIdTests, getMisconceptions, formatMultiEquation } from './core.js';
import { createInfoCard, resultField, titleCase, moduleHeaderHTML, jumpButtonHTML } from './feat-helpers.js';

const CATEGORIES = ['Cation', 'Anion', 'Gas'];
const CATEGORY_ICON = { Cation: '➕', Anion: '➖', Gas: '💨' };
const STATS_KEY = 'elementa-qa-stats';

export async function mountQualAnalysis(container) {
  container.innerHTML = `<div class="placeholder-note">Loading qualitative analysis engine...</div>`;

  let allTests, misconceptions;
  try {
    allTests = await getIdTests();
  } catch (e) {
    container.innerHTML = `<div class="placeholder-note">Failed to load identification test data. Try refreshing.</div>`;
    return;
  }
  try { misconceptions = await getMisconceptions(); } catch (e) { misconceptions = []; }

  if (!allTests || allTests.length === 0) {
    container.innerHTML = `<div class="placeholder-note">No identification test data available.</div>`;
    return;
  }

  // ── State ────────────────────────────────────────────────────────────
  const state = {
    category: null,
    target: null,
    candidates: [],
    log: [],
    testsRun: { dry: false, wet: false },
    phase: 'select-category', // select-category | investigating | revealed
    correct: null,
    stats: loadStats(),
  };

  function loadStats() {
    try {
      const raw = sessionStorage.getItem(STATS_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* sessionStorage unavailable / bad JSON — fall through */ }
    return { correct: 0, attempts: 0, totalTests: 0 };
  }

  function saveStats() {
    try { sessionStorage.setItem(STATS_KEY, JSON.stringify(state.stats)); } catch (e) { /* ignore */ }
  }

  function poolFor(category) {
    // Only ions/gases with at least one real test defined are eligible unknowns.
    return allTests.filter(t => t.category === category && (t.dry_test || t.wet_test));
  }

  function startNew(category) {
    const pool = poolFor(category);
    if (pool.length === 0) return; // shouldn't happen given current data, but guard anyway
    state.category = category;
    state.candidates = pool;
    state.target = pool[Math.floor(Math.random() * pool.length)];
    state.log = [];
    state.testsRun = { dry: false, wet: false };
    state.phase = 'investigating';
    state.correct = null;
    render();
  }

  function runTest(kind) {
    if (!state.target || state.phase !== 'investigating') return;
    const testData = kind === 'dry' ? state.target.dry_test : state.target.wet_test;
    if (!testData || state.testsRun[kind]) return;
    state.testsRun[kind] = true;
    state.stats.totalTests++;
    state.log.push({
      label: kind === 'dry' ? 'Preliminary (Dry) Test' : 'Confirmatory (Wet) Test',
      procedure: testData.procedure,
      result: testData.result,
      equation: testData.equation || null,
    });
    saveStats();
    render();
  }

  function submitGuess(guessId) {
    if (!guessId || state.phase !== 'investigating') return;
    state.correct = guessId === state.target.id;
    state.stats.attempts++;
    if (state.correct) state.stats.correct++;
    state.phase = 'revealed';
    saveStats();
    render();
  }

  function resetToCategorySelect() {
    state.phase = 'select-category';
    state.target = null;
    state.log = [];
    render();
  }

  // ── Render ───────────────────────────────────────────────────────────
  function render() {
    let html = moduleHeaderHTML(
      '🧫',
      'Qualitative Analysis Simulator',
      'Run real dry/wet tests on a hidden unknown sample, interpret the observations, and identify it — mirroring an actual qual-analysis practical.',
      '--accent-lithium'
    );

    html += `
      <div class="card" style="text-align:center; margin-bottom: 20px;">
        <div class="qa-stats">
          <div class="qa-stat"><div class="qa-stat-val">${state.stats.correct}/${state.stats.attempts}</div><div class="qa-stat-lbl">Correct IDs</div></div>
          <div class="qa-stat"><div class="qa-stat-val">${state.stats.totalTests}</div><div class="qa-stat-lbl">Tests Run</div></div>
        </div>
      </div>
    `;

    if (state.phase === 'select-category') {
      html += `
        <div class="panel" style="text-align:center;">
          <h3 style="margin-bottom: 12px;">Choose an Unknown Category</h3>
          <p class="text-muted" style="margin-bottom: 20px; max-width: 520px; margin-left:auto; margin-right:auto;">
            A hidden sample will be selected at random from that category. Use the available tests to
            gather evidence, then make your identification with as few tests as possible.
          </p>
          <div class="qa-category-select">
            ${CATEGORIES.map(c => `<button class="btn-primary qa-cat-btn" data-cat="${c}">${CATEGORY_ICON[c]} ${c}s</button>`).join('')}
          </div>
        </div>
      `;
      container.innerHTML = html;
      container.querySelectorAll('.qa-cat-btn').forEach(btn =>
        btn.addEventListener('click', () => startNew(btn.dataset.cat))
      );
      return;
    }

    // investigating or revealed
    const dryDisabled = !state.target.dry_test || state.testsRun.dry || state.phase === 'revealed';
    const wetDisabled = !state.target.wet_test || state.testsRun.wet || state.phase === 'revealed';

    html += `
      <div class="card" style="margin-bottom:16px;">
        <div class="card-title">
          <span class="card-title-text">🧪 Unknown Sample</span>
          <span class="badge badge-info">${state.category}</span>
        </div>
        <p class="text-muted" style="margin-bottom: 14px;">
          Candidate pool (${state.candidates.length}): ${state.candidates.map(c => titleCase(c.name)).join(', ')}
        </p>
        <div class="qa-actions">
          <button class="btn-primary qa-test-btn" data-kind="dry" style="width:auto;" ${dryDisabled ? 'disabled' : ''}>
            🔍 Run Preliminary (Dry) Test
          </button>
          <button class="btn-primary qa-test-btn" data-kind="wet" style="width:auto;" ${wetDisabled ? 'disabled' : ''}>
            🧫 Run Confirmatory (Wet) Test
          </button>
        </div>
      </div>
    `;

    if (state.log.length > 0) {
      html += `<h4 style="margin: 20px 0 10px; color: var(--color-heading);">Lab Notebook</h4>`;
      html += `<div class="stacked-cards">` + state.log.map(entry => `
        <div class="card protocol-box" style="margin-bottom:0;">
          <div class="protocol-box-header"><strong style="color: var(--color-primary); font-size:0.85rem; text-transform:uppercase;">${entry.label}</strong></div>
          ${resultField("Procedure", entry.procedure)}
          ${resultField("Observation", `<span style="color: var(--color-success); font-weight:600;">${entry.result}</span>`)}
          ${entry.equation ? formatMultiEquation(entry.equation) : ''}
        </div>
      `).join('') + `</div>`;
    } else {
      html += `<div class="placeholder-note">Run a test above to begin gathering evidence.</div>`;
    }

    if (state.phase === 'investigating') {
      html += `
        <div class="panel" style="margin-top:20px; text-align:center;">
          <h3 style="margin-bottom:12px;">Make Your Identification</h3>
          <div class="field" style="max-width:400px; margin: 0 auto 16px;">
            <select id="qa-guess-select">
              <option value="">-- Select the ion / gas --</option>
              ${state.candidates.map(c => `<option value="${c.id}">${titleCase(c.name)}</option>`).join('')}
            </select>
          </div>
          <button class="btn-primary" id="qa-submit-guess" style="max-width: 320px; margin: 0 auto; display:block;">Submit Identification</button>
        </div>
      `;
    } else if (state.phase === 'revealed') {
      const mis = misconceptions.find(m => m.target_id === state.target.id);
      html += `
        <div class="card" style="margin-top: 20px; border: 2px solid var(--color-${state.correct ? 'success' : 'danger'});">
          <div class="card-title">
            <span class="card-title-text">${state.correct ? '✅ Correct!' : '❌ Not Quite'}</span>
          </div>
          <p style="font-size:1.1rem; margin-bottom: 12px;">
            The unknown was: <strong style="color:var(--color-primary);">${titleCase(state.target.name)}</strong>
            <span class="text-muted" style="font-size:0.85rem;"> (identified using ${state.log.length} test${state.log.length === 1 ? '' : 's'})</span>
          </p>
          ${state.target.notes ? `<div class="explanation-box"><strong>Mechanistic Note:</strong> ${state.target.notes}</div>` : ''}
          ${mis ? `<div class="misconception-box"><strong>⚠️ Misconception Alert:</strong> <s>${mis.misconception}</s><br><em>Fact:</em> ${mis.correction}</div>` : ''}
          <div class="jump-row" style="margin-top:12px;">${jumpButtonHTML('Full reference entry', 'idtests', state.target.id, '🔬')}</div>
          <button class="btn-primary" id="qa-next-btn" style="margin-top:16px; max-width: 260px;">🔄 Try Another Unknown</button>
        </div>
      `;
    }

    container.innerHTML = html;

    container.querySelectorAll('.qa-test-btn').forEach(btn =>
      btn.addEventListener('click', () => runTest(btn.dataset.kind))
    );
    const submitBtn = document.getElementById('qa-submit-guess');
    if (submitBtn) {
      submitBtn.addEventListener('click', () => {
        const val = document.getElementById('qa-guess-select').value;
        submitGuess(val);
      });
    }
    const nextBtn = document.getElementById('qa-next-btn');
    if (nextBtn) nextBtn.addEventListener('click', resetToCategorySelect);
  }

  render();
}