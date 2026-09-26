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

import './feat-helpers.js';

try {
  registerModule('landing', 'Home', mountLanding, { icon: '🏠', accent: 'copper', group: 'Study' });
  registerModule('compounds', 'Compounds DB', mountCompounds, { icon: '🧪', accent: 'copper' });
  registerModule('reactions', 'Reaction Mechanics', mountReactions, { icon: '⚗️', accent: 'lithium' });
  registerModule('preparations', 'Synthesis Protocols', mountPreparations, { icon: '🏭', accent: 'lithium' });
  registerModule('idtests', 'Identification Analysis', mountIdentificationTests, { icon: '🔬', accent: 'lithium' });
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