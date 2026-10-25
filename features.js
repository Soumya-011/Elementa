/**
 * features.js — Thin entry point.
 * Imports all feature modules, registers them with the router, and boots the app.
 */

import {
  getElements, getCompounds, getReactions, getPreparations, getIdTests, getMisconceptions, getReactivity,
  navigateTo, registerModule, startRouter
} from './core.js';

import { mountLanding, mountSearch } from './feat-landing.js';
import { mountCompounds, mountReactions, mountPreparations, mountIdentificationTests } from './feat-database.js';
import { mountPeriodicTable, mountReactivity, mountMolecularOrbitals, mountVSEPR, mountFlameTests, mountSolubilityRules } from './feat-theory.js';
import { mountCalculators, mountUnitConverter, upgradeCalculators, upgradeLayout, addCommonIonEffect, addElectrochemicalSeries } from './feat-compute.js';
import { mountProblems } from './feat-problems.js';
import { mountQualAnalysis } from './feat-qualanalysis.js';
import { mountTitration } from './feat-titration.js';
import { mountKinetics } from './feat-kinetics.js';
import { mountOrbitals } from './feat-orbitals.js';

import './feat-helpers.js';

try {
  registerModule('landing', 'Home', mountLanding, { icon: '🏠', accent: 'copper', group: 'Study' });
  registerModule('compounds', 'Compounds DB', mountCompounds, { icon: '🧪', accent: 'copper' });
  registerModule('reactions', 'Reaction Mechanics', mountReactions, { icon: '⚗️', accent: 'lithium' });
  registerModule('preparations', 'Synthesis Protocols', mountPreparations, { icon: '🏭', accent: 'lithium' });
  registerModule('idtests', 'Identification Analysis', mountIdentificationTests, { icon: '🔬', accent: 'lithium' });
  registerModule('qualanalysis', 'Qual. Analysis Sim', mountQualAnalysis, { icon: '🧫', accent: 'lithium' });
  registerModule('titration', 'Titration Simulator', mountTitration, { icon: '🧪', accent: 'lithium' });
  registerModule('kinetics', 'Kinetics Grapher', mountKinetics, { icon: '📉', accent: 'potassium' });
  registerModule('orbitals3d', 'Atomic Orbitals 3D', mountOrbitals, { icon: '⚛️', accent: 'potassium' });
  registerModule('molecularorbitals', 'Molecular Orbitals', mountMolecularOrbitals, { icon: '🧲', accent: 'potassium' });
  registerModule('vsepr', 'VSEPR Theory', mountVSEPR, { icon: '🔷', accent: 'potassium' });
  registerModule('flametests', 'Flame Tests', mountFlameTests, { icon: '🔥', accent: 'lithium' });
  registerModule('solubility', 'Solubility Rules', mountSolubilityRules, { icon: '💧', accent: 'copper' });
  registerModule('periodictable', 'Periodic Table', mountPeriodicTable, { icon: '🧬', accent: 'potassium' });
  registerModule('reactivity', 'Reactivity Series', mountReactivity, { icon: '📈', accent: 'potassium' });
  registerModule('calculators', 'Calculators', mountCalculators, { icon: '🧮', accent: 'sodium', group: 'Compute' });
  registerModule('unitconverter', 'Unit Converter', mountUnitConverter, { icon: '🔄', accent: 'sodium' });
  registerModule('problems', 'Practice Problems', mountProblems, { icon: '🧩', accent: 'sodium' });
  registerModule('search', 'Global Search', mountSearch, { icon: '🔍', accent: 'sodium' });

  // Phase 7 — generic cross-module deep-link infra. navigateTo(id, params)
  // already remounts a module with params when params is truthy (core.js);
  // this delegated listener is the other half: any module can render
  // `jumpButtonHTML(label, moduleId, focusId)` (feat-helpers.js) and clicking
  // it calls navigateTo(moduleId, { focus: focusId }). Consuming modules
  // (Phase 8+) read params.focus from their own mountFn(container, params)
  // to pre-select the right element/compound/ion. One listener here, not one
  // per module, since feat-helpers.js intentionally has no core.js import.
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-jump-module]');
    if (!btn) return;
    const moduleId = btn.dataset.jumpModule;
    const focus = btn.dataset.jumpFocus || null;
    // Phase 9: optional JSON extras (data-jump-params) merge over { focus }.
    let extra = {};
    try { if (btn.dataset.jumpParams) extra = JSON.parse(btn.dataset.jumpParams) || {}; } catch (_) { extra = {}; }
    navigateTo(moduleId, { focus, ...extra });
  });

  startRouter('landing');
} catch (err) {
  console.error('[Elementa] Fatal init error:', err);
  const views = document.getElementById('app-views');
  if (views) {
    views.innerHTML = `
      <div class="card" style="border-color: var(--color-danger, #dc2626);">
        <div class="card-title" style="color: var(--color-danger, #dc2626);">App failed to start</div>
        <p class="text-muted" style="margin-top: 10px;">${err.message}</p>
      </div>`;
  }
}