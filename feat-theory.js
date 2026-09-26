/**
 * feat-theory.js
 * Periodic Table, Reactivity Series, Molecular Orbitals, VSEPR,
 * Flame Tests, and Solubility Rules modules.
 */

import {
  getElements, getMisconceptions, getReactions, getReactivity, navigateTo
} from './core.js';

import { resultField, moduleHeaderHTML, titleCase } from './feat-helpers.js';

/* =====================================================================
   8. PERIODIC TABLE MODULE
   ===================================================================== */
const elements118Str = "1,H,Hydrogen|2,He,Helium|3,Li,Lithium|4,Be,Beryllium|5,B,Boron|6,C,Carbon|7,N,Nitrogen|8,O,Oxygen|9,F,Fluorine|10,Ne,Neon|11,Na,Sodium|12,Mg,Magnesium|13,Al,Aluminum|14,Si,Silicon|15,P,Phosphorus|16,S,Sulfur|17,Cl,Chlorine|18,Ar,Argon|19,K,Potassium|20,Ca,Calcium|21,Sc,Scandium|22,Ti,Titanium|23,V,Vanadium|24,Cr,Chromium|25,Mn,Manganese|26,Fe,Iron|27,Co,Cobalt|28,Ni,Nickel|29,Cu,Copper|30,Zn,Zinc|31,Ga,Gallium|32,Ge,Germanium|33,As,Arsenic|34,Se,Selenium|35,Br,Bromine|36,Kr,Krypton|37,Rb,Rubidium|38,Sr,Strontium|39,Y,Yttrium|40,Zr,Zirconium|41,Nb,Niobium|42,Mo,Molybdenum|43,Tc,Technetium|44,Ru,Ruthenium|45,Rh,Rhodium|46,Pd,Palladium|47,Ag,Silver|48,Cd,Cadmium|49,In,Indium|50,Sn,Tin|51,Sb,Antimony|52,Te,Tellurium|53,I,Iodine|54,Xe,Xenon|55,Cs,Cesium|56,Ba,Barium|57,La,Lanthanum|58,Ce,Cerium|59,Pr,Praseodymium|60,Nd,Neodymium|61,Pm,Promethium|62,Sm,Samarium|63,Eu,Europium|64,Gd,Gadolinium|65,Tb,Terbium|66,Dy,Dysprosium|67,Ho,Holmium|68,Er,Erbium|69,Tm,Thulium|70,Yb,Ytterbium|71,Lu,Lutetium|72,Hf,Hafnium|73,Ta,Tantalum|74,W,Tungsten|75,Re,Rhenium|76,Os,Osmium|77,Ir,Iridium|78,Pt,Platinum|79,Au,Gold|80,Hg,Mercury|81,Tl,Thallium|82,Pb,Lead|83,Bi,Bismuth|84,Po,Polonium|85,At,Astatine|86,Rn,Radon|87,Fr,Francium|88,Ra,Radium|89,Ac,Actinium|90,Th,Thorium|91,Pa,Protactinium|92,U,Uranium|93,Np,Neptunium|94,Pu,Plutonium|95,Am,Americium|96,Cm,Curium|97,Bk,Berkelium|98,Cf,Californium|99,Es,Einsteinium|100,Fm,Fermium|101,Md,Mendelevium|102,No,Nobelium|103,Lr,Lawrencium|104,Rf,Rutherfordium|105,Db,Dubnium|106,Sg,Seaborgium|107,Bh,Bohrium|108,Hs,Hassium|109,Mt,Meitnerium|110,Ds,Darmstadtium|111,Rg,Roentgenium|112,Cn,Copernicium|113,Nh,Nihonium|114,Fl,Flerovium|115,Mc,Moscovium|116,Lv,Livermorium|117,Ts,Tennessine|118,Og,Oganesson";

function getGridPos(z) {
  if(z===1) return {r:1, c:1};
  if(z===2) return {r:1, c:18};
  if(z>=3 && z<=10) return {r:2, c: z<5 ? z-2 : z+8};
  if(z>=11 && z<=18) return {r:3, c: z<13 ? z-10 : z};
  if(z>=19 && z<=36) return {r:4, c: z-18};
  if(z>=37 && z<=54) return {r:5, c: z-36};
  if(z>=55 && z<=86) {
    if(z>=57 && z<=71) return {r:9, c: z-53};
    if(z<57) return {r:6, c: z-54};
    return {r:6, c: z-68};
  }
  if(z>=87 && z<=118) {
    if(z>=89 && z<=103) return {r:10, c: z-85};
    if(z<89) return {r:7, c: z-86};
    return {r:7, c: z-100};
  }
}

function getCategoryMatch(z) {
  if([1, 6, 7, 8, 15, 16, 34].includes(z)) return { cls: 'nonmetal', lbl: 'Nonmetal' };
  if([2, 10, 18, 36, 54, 86, 118].includes(z)) return { cls: 'noble', lbl: 'Noble Gas' };
  if([3, 11, 19, 37, 55, 87].includes(z)) return { cls: 'alkali', lbl: 'Alkali Metal' };
  if([4, 12, 20, 38, 56, 88].includes(z)) return { cls: 'alkaline-earth', lbl: 'Alkaline Earth' };
  if([5, 14, 32, 33, 51, 52, 84].includes(z)) return { cls: 'metalloid', lbl: 'Metalloid' };
  if([9, 17, 35, 53, 85, 117].includes(z)) return { cls: 'halogen', lbl: 'Halogen' };
  if([13, 31, 49, 50, 81, 82, 83, 113, 114, 115, 116].includes(z)) return { cls: 'basic-metal', lbl: 'Basic Metal' };
  if((z>=21&&z<=30)||(z>=39&&z<=48)||(z>=72&&z<=80)||(z>=104&&z<=112)) return { cls: 'transition', lbl: 'Transition Metal' };
  if(z>=57 && z<=71) return { cls: 'lanthanide', lbl: 'Lanthanide' };
  if(z>=89 && z<=103) return { cls: 'actinide', lbl: 'Actinide' };
  return { cls: 'unknown', lbl: 'Unknown' };
}

function getBlock(z) {
  if (z === 1 || z === 2) return 's';
  if ((z >= 57 && z <= 71) || (z >= 89 && z <= 103)) return 'f';
  const pos = getGridPos(z);
  if (!pos) return 'unknown';
  if (pos.c === 1 || pos.c === 2) return 's';
  if (pos.c >= 13 && pos.c <= 18) return 'p';
  if (pos.c >= 3 && pos.c <= 12) return 'd';
  return 'unknown';
}

function getElectronConfiguration(z) {
  const aufbau = [
    { label: "1s", max: 2 }, { label: "2s", max: 2 }, { label: "2p", max: 6 },
    { label: "3s", max: 2 }, { label: "3p", max: 6 }, { label: "4s", max: 2 },
    { label: "3d", max: 10 }, { label: "4p", max: 6 }, { label: "5s", max: 2 },
    { label: "4d", max: 10 }, { label: "5p", max: 6 }, { label: "6s", max: 2 },
    { label: "4f", max: 14 }, { label: "5d", max: 10 }, { label: "6p", max: 6 },
    { label: "7s", max: 2 }, { label: "5f", max: 14 }, { label: "6d", max: 10 },
    { label: "7p", max: 6 }
  ];
  if (z === 46) return "1s<sup>2</sup> 2s<sup>2</sup> 2p<sup>6</sup> 3s<sup>2</sup> 3p<sup>6</sup> 4s<sup>2</sup> 3d<sup>10</sup> 4p<sup>6</sup> 4d<sup>10</sup>";

  let config = [];
  let remaining = z;
  for (let i = 0; i < aufbau.length; i++) {
    if (remaining <= 0) break;
    const shell = aufbau[i];
    const e = Math.min(remaining, shell.max);
    config.push(`${shell.label}${e}`);
    remaining -= e;
  }
  let configStr = config.join(" ");
  configStr = configStr.replace(/([456])s2 (?:([45][fp]\d+) )?(\d)d([49])$/, (match, p1, p2, p3, p4) => {
    const dTarget = p4 === "4" ? "5" : "10";
    const mid = p2 ? `${p2} ` : "";
    return `${p1}s1 ${mid}${p3}d${dTarget}`;
  });
  return configStr.split(" ").map(f => f.replace(/(\d[spdf])(\d+)/, "$1<sup>$2</sup>")).join(" ");
}
export async function mountPeriodicTable(container) {
  container.innerHTML = `<div class="placeholder-note">Loading periodic table...</div>`;
  let elementsData, misconceptions, reactionsData;
  try { elementsData = await getElements(); } catch (e) { container.innerHTML = `<div class="placeholder-note">Failed to load elements.</div>`; return; }
  try { misconceptions = await getMisconceptions(); } catch (e) { misconceptions = []; }
  try { reactionsData = await getReactions(); } catch (e) { reactionsData = []; }
  
  let gridHtml = `<div class="pt-container"><div class="pt-grid">`;
  
  elements118Str.split('|').forEach(part => {
    const [zStr, sym, name] = part.split(',');
    const z = parseInt(zStr);
    const pos = getGridPos(z);
    const cat = getCategoryMatch(z);
    
    const dbRef = elementsData.find(e => e.atomic_number === z);
    const boxShadowStr = dbRef ? "box-shadow: inset 0 0 0 2px rgba(255,255,255,0.4);" : "";
    
    gridHtml += `
      <div class="pt-element cat-${cat.cls}" 
           style="grid-row: ${pos.r}; grid-column: ${pos.c}; ${boxShadowStr}"
           data-z="${z}" data-sym="${sym}" data-name="${name}" data-cat="${cat.lbl}">
        <div class="pt-num">${z}</div>
        <div class="pt-sym">${sym}</div>
        <div class="pt-name">${name}</div>
      </div>
    `;
  });

  gridHtml += `<div class="pt-placeholder" style="grid-row: 6; grid-column: 3;">57-71</div><div class="pt-placeholder" style="grid-row: 7; grid-column: 3;">89-103</div></div></div>`;

  const legends = [
    {cls: 'alkali', lbl: 'Alkali Metal'}, {cls: 'alkaline-earth', lbl: 'Alkaline Earth'}, {cls: 'transition', lbl: 'Transition Metal'},
    {cls: 'basic-metal', lbl: 'Basic Metal'}, {cls: 'metalloid', lbl: 'Metalloid'}, {cls: 'nonmetal', lbl: 'Nonmetal'},
    {cls: 'halogen', lbl: 'Halogen'}, {cls: 'noble', lbl: 'Noble Gas'}, {cls: 'lanthanide', lbl: 'Lanthanide'}, {cls: 'actinide', lbl: 'Actinide'}
  ];
  gridHtml += `<div class="pt-legend">` + legends.map(l => `<div class="pt-legend-item"><div class="pt-legend-color cat-${l.cls}"></div>${l.lbl}</div>`).join("") + `</div>`;

  container.innerHTML = gridHtml;

  const modal = document.getElementById('pt-modal');
  const modalBody = document.getElementById('pt-modal-body');
  
  container.querySelectorAll('.pt-element').forEach(el => {
    el.addEventListener('click', () => {
      const z = parseInt(el.dataset.z);
      const sym = el.dataset.sym;
      const name = el.dataset.name;
      const catLabel = el.dataset.cat;
      const dbRef = elementsData.find(e => e.atomic_number === z);
      const hasReactions = reactionsData.some(r => r.reactant_id === dbRef?.id || r.reagent_id === dbRef?.id);
      
      let body = `<h2 style="margin-bottom:4px; display:flex; justify-content:space-between;"><span>${name} (${sym})</span> <span>Z=${z}</span></h2><p class="text-muted" style="margin-bottom:12px;">${catLabel}</p>`;
      const block = getBlock(z);
      body += `<div class="result-row" style="background: var(--color-surface-alt); padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--color-border); margin-bottom: 14px;">
        <div class="result-field" style="min-width: 80px;"><div class="label">Protons</div><div class="value">${z}</div></div>
        <div class="result-field" style="min-width: 80px;"><div class="label">Electrons</div><div class="value">${z}</div></div>
        <div class="result-field" style="min-width: 80px;"><div class="label">Block</div><div class="value" style="text-transform: uppercase;">${block}-block</div></div>
      </div>`;

      const configStr = getElectronConfiguration(z);
      let stabilityNote = [24, 29, 42, 47, 79].includes(z) ? `<div style="font-size: 0.8rem; color: var(--color-success); margin-top: 8px;">* Note: This element borrows an s-electron to feature a more stable half-filled or fully-filled d-orbital configuration.</div>` : "";
      
      body += `<div class="result-field" style="margin-bottom:14px; background: var(--color-surface-alt); padding: 16px; border-radius: var(--radius-sm); border: 1px solid var(--color-border);">
        <div class="label">Electron Configuration</div><div class="value" style="font-family: var(--font-mono); font-size: 1.05rem; line-height: 1.6; word-break: break-word;">${configStr}</div>${stabilityNote}
      </div>`;
      
      if(dbRef) {
        body += `<div class="result-field" style="margin-bottom:12px;"><div class="label">Chemical Properties</div>`;
        if (dbRef.atomic_mass) body += `<div class="value" style="font-size: 0.95rem; margin-top: 6px;"><strong>Mass:</strong> ${dbRef.atomic_mass} amu (${dbRef.atomic_mass} g/mol)</div>`;
        if (dbRef.oxidation_states) body += `<div class="value" style="font-size: 0.95rem; margin-top: 6px;"><strong>Common Oxidation States:</strong> ${dbRef.oxidation_states}</div>`;
        body += `</div>`;
        if (dbRef.electronegativity) body += `<div class="result-row" style="margin-bottom: 12px;">${resultField("Electronegativity", dbRef.electronegativity)}${resultField("Electron Affinity", dbRef.electron_affinity ? `${dbRef.electron_affinity} kJ/mol` : "N/A")}</div>`;
        if (dbRef.special_feature) body += `<div class="explanation-box" style="margin-bottom: 16px;"><strong>Special Feature:</strong> ${dbRef.special_feature}</div>`;

        let badges = `<span class="badge badge-success" style="margin-right:6px;">${titleCase(dbRef.category)}</span>`;
        if (dbRef.amphoteric) badges += `<span class="badge badge-warning" style="margin-right:6px;">Amphoteric</span>`;
        if (dbRef.below_hydrogen) badges += `<span class="badge badge-info" style="margin-right:6px;">Below Hydrogen</span>`;
        body += `<div style="margin-bottom:16px;">${badges}</div>`;

        const mis = misconceptions.find(m => m.target_id === dbRef.id);
        if (mis) body += `<div class="misconception-box" style="margin-bottom: 16px;"><strong>⚠️ Misconception Alert:</strong> <s>${mis.misconception}</s><br><br><em>Fact:</em> ${mis.correction}</div>`;
        if (hasReactions) body += `<button class="btn-primary" id="btn-pt-rxn" style="margin-top: 10px;">Find Reactions</button>`;
        else body += `<p class="text-muted" style="font-size:0.85rem; margin-top:16px;">We haven't added specific reaction equations for ${name} to the database yet.</p>`;
      } else {
        body += `<p class="text-muted" style="font-size:0.9rem; margin-top:16px;">Detailed chemical properties are not yet mapped for this element in the database.</p>`;
      }
      
      modalBody.innerHTML = body;
      modal.classList.add('active');

      const btn = document.getElementById('btn-pt-rxn');
      if (btn) btn.addEventListener('click', () => { modal.classList.remove('active'); navigateTo('reactions'); });
    });
  });

  // Click outside modal content to close
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('active');
  });
}
/* =====================================================================
   9. REACTIVITY LADDER MODULE
   ===================================================================== */
export async function mountReactivity(container, params = null) {
  container.innerHTML = `<div class="placeholder-note">Loading reactivity data...</div>`;
  let reactivityData;
  try { reactivityData = await getReactivity(); } catch (e) {
    console.error('[Elementa] Failed to load reactivity data:', e);
    container.innerHTML = `<div class="placeholder-note">Failed to load reactivity data. Try clearing your browser data and refreshing.</div>`;
    return;
  }
  if (!reactivityData || reactivityData.length === 0) {
    container.innerHTML = `<div class="placeholder-note">No reactivity data available. Try clearing your browser data and refreshing.</div>`;
    return;
  }
  container.innerHTML = `
    <div class="panel" style="text-align: center;">
      <h2 style="color: var(--color-primary);">Reactivity Series</h2>
      <p class="text-muted" style="max-width: 600px; margin: 0 auto;">Metals arranged in descending order of their reactivity.</p>
    </div>
    <div class="reactivity-container"><div class="reactivity-ladder" id="ladder-grid"></div></div>
  `;
  const grid = document.getElementById("ladder-grid");
  const highlightIds = params?.highlight || [];
  
  reactivityData.forEach(item => {
    const isHighlight = highlightIds.includes(item.id);
    const isRef = item.is_reference;
    const cls = `ladder-item ${isHighlight ? 'highlight' : ''} ${isRef ? 'reference' : ''}`;
    
    let symColor = 'var(--color-heading)';
    if (isRef) symColor = 'var(--color-text-muted)';
    else if (item.id === 'gold' || item.id === 'platinum' || item.id === 'silver') symColor = 'var(--color-warning)';
    else if (['potassium','sodium','calcium','magnesium'].includes(item.id)) symColor = 'var(--color-danger)';

    const el = document.createElement("div");
    el.className = cls;
    el.innerHTML = `<div class="ladder-sym" style="color: ${symColor};">${item.symbol}</div><div class="ladder-details"><div class="ladder-name">${item.name}</div><div class="ladder-extraction">Extraction: ${item.extraction || "N/A"}</div></div>`;
    grid.appendChild(el);

    if (isHighlight) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
  });
}
export async function mountMolecularOrbitals(container) {
  container.innerHTML = `<div class="placeholder-note">Loading MO diagrams...</div>`;

  // ── Orbital data for each homonuclear diatomic ──────────────────────
  const molecules = {
    H2: {
      symbol: 'H₂', name: 'Dihydrogen', electrons: 2,
      orbitals: [
        { name: 'σ1s',  energy: 100, type: 'bonding',     maxE: 2, fillE: 2 },
        { name: 'σ*1s', energy: 200, type: 'antibonding',  maxE: 2, fillE: 0 },
      ],
      insight: 'H₂ has a bond order of 1 (single bond) and is diamagnetic. Its single bonding pair makes it the simplest stable molecule.'
    },
    He2: {
      symbol: 'He₂', name: 'Di helium (hypothetical)', electrons: 4,
      orbitals: [
        { name: 'σ1s',  energy: 100, type: 'bonding',     maxE: 2, fillE: 2 },
        { name: 'σ*1s', energy: 200, type: 'antibonding',  maxE: 2, fillE: 2 },
      ],
      insight: 'He₂ has a bond order of 0 — bonding and antibonding electrons cancel out. This is why helium exists as monatomic gas, not a diatomic molecule.'
    },
    Li2: {
      symbol: 'Li₂', name: 'Dilithium', electrons: 6,
      orbitals: [
        { name: 'σ1s',  energy: 100, type: 'bonding',     maxE: 2, fillE: 2 },
        { name: 'σ*1s', energy: 200, type: 'antibonding',  maxE: 2, fillE: 2 },
        { name: 'σ2s',  energy: 300, type: 'bonding',     maxE: 2, fillE: 2 },
        { name: 'σ*2s', energy: 400, type: 'antibonding',  maxE: 2, fillE: 0 },
      ],
      insight: 'Li₂ has a bond order of 1 (single bond). The core 1s electrons cancel out, so only the 2s valence electrons contribute to bonding.'
    },
    B2: {
      symbol: 'B₂', name: 'Diboron', electrons: 10,
      orbitals: [
        { name: 'σ1s',  energy: 100, type: 'bonding',     maxE: 2, fillE: 2 },
        { name: 'σ*1s', energy: 200, type: 'antibonding',  maxE: 2, fillE: 2 },
        { name: 'σ2s',  energy: 300, type: 'bonding',     maxE: 2, fillE: 2 },
        { name: 'σ*2s', energy: 400, type: 'antibonding',  maxE: 2, fillE: 2 },
        { name: 'π2px = π2py', energy: 500, type: 'bonding', maxE: 4, fillE: 2 },
        { name: 'σ2pz', energy: 600, type: 'bonding',     maxE: 2, fillE: 0 },
      ],
      insight: 'B₂ is paramagnetic with two unpaired electrons — a surprising result! The π2p orbitals are lower in energy than σ2pz for B₂, C₂, and N₂, which explains this unusual magnetic behavior.'
    },
    C2: {
      symbol: 'C₂', name: 'Dicarbon', electrons: 12,
      orbitals: [
        { name: 'σ1s',  energy: 100, type: 'bonding',     maxE: 2, fillE: 2 },
        { name: 'σ*1s', energy: 200, type: 'antibonding',  maxE: 2, fillE: 2 },
        { name: 'σ2s',  energy: 300, type: 'bonding',     maxE: 2, fillE: 2 },
        { name: 'σ*2s', energy: 400, type: 'antibonding',  maxE: 2, fillE: 2 },
        { name: 'π2px = π2py', energy: 500, type: 'bonding', maxE: 4, fillE: 4 },
        { name: 'σ2pz', energy: 600, type: 'bonding',     maxE: 2, fillE: 0 },
      ],
      insight: 'C₂ has a bond order of 2 (double bond) and is diamagnetic. In gas-phase spectroscopy, C₂ exhibits a quadruple bond character due to s-p mixing effects — one of chemistry\'s most elegant subtleties.'
    },
    N2: {
      symbol: 'N₂', name: 'Dinitrogen', electrons: 14,
      orbitals: [
        { name: 'σ1s',  energy: 100, type: 'bonding',     maxE: 2, fillE: 2 },
        { name: 'σ*1s', energy: 200, type: 'antibonding',  maxE: 2, fillE: 2 },
        { name: 'σ2s',  energy: 300, type: 'bonding',     maxE: 2, fillE: 2 },
        { name: 'σ*2s', energy: 400, type: 'antibonding',  maxE: 2, fillE: 2 },
        { name: 'π2px = π2py', energy: 500, type: 'bonding', maxE: 4, fillE: 4 },
        { name: 'σ2pz', energy: 600, type: 'bonding',     maxE: 2, fillE: 2 },
      ],
      insight: 'N₂ has a bond order of 3 (triple bond) — one of the strongest bonds in chemistry. The N≡N triple bond (941 kJ/mol) is why nitrogen gas is so inert and the Haber process requires extreme conditions to break it.'
    },
    O2: {
      symbol: 'O₂', name: 'Dioxygen', electrons: 16,
      orbitals: [
        { name: 'σ1s',  energy: 100, type: 'bonding',     maxE: 2, fillE: 2 },
        { name: 'σ*1s', energy: 200, type: 'antibonding',  maxE: 2, fillE: 2 },
        { name: 'σ2s',  energy: 300, type: 'bonding',     maxE: 2, fillE: 2 },
        { name: 'σ*2s', energy: 400, type: 'antibonding',  maxE: 2, fillE: 2 },
        { name: 'σ2pz', energy: 500, type: 'bonding',     maxE: 2, fillE: 2 },
        { name: 'π2px = π2py', energy: 600, type: 'bonding', maxE: 4, fillE: 4 },
      ],
      insight: 'O₂ is paramagnetic with two unpaired electrons in the π*2p antibonding orbitals. This was one of the triumphs of MO theory — VSEPR and Lewis structures cannot explain why liquid oxygen is attracted to a magnet!'
    },
    F2: {
      symbol: 'F₂', name: 'Difluorine', electrons: 18,
      orbitals: [
        { name: 'σ1s',  energy: 100, type: 'bonding',     maxE: 2, fillE: 2 },
        { name: 'σ*1s', energy: 200, type: 'antibonding',  maxE: 2, fillE: 2 },
        { name: 'σ2s',  energy: 300, type: 'bonding',     maxE: 2, fillE: 2 },
        { name: 'σ*2s', energy: 400, type: 'antibonding',  maxE: 2, fillE: 2 },
        { name: 'σ2pz', energy: 500, type: 'bonding',     maxE: 2, fillE: 2 },
        { name: 'π2px = π2py', energy: 600, type: 'bonding', maxE: 4, fillE: 4 },
      ],
      insight: 'F₂ has a bond order of 1 (single bond) and is diamagnetic. Despite fluorine being the most electronegative element, the F–F bond is surprisingly weak (158 kJ/mol) due to lone pair repulsions between the small atoms.'
    },
    Ne2: {
      symbol: 'Ne₂', name: 'Dineon (hypothetical)', electrons: 20,
      orbitals: [
        { name: 'σ1s',  energy: 100, type: 'bonding',     maxE: 2, fillE: 2 },
        { name: 'σ*1s', energy: 200, type: 'antibonding',  maxE: 2, fillE: 2 },
        { name: 'σ2s',  energy: 300, type: 'bonding',     maxE: 2, fillE: 2 },
        { name: 'σ*2s', energy: 400, type: 'antibonding',  maxE: 2, fillE: 2 },
        { name: 'σ2pz', energy: 500, type: 'bonding',     maxE: 2, fillE: 2 },
        { name: 'π2px = π2py', energy: 600, type: 'bonding', maxE: 4, fillE: 4 },
      ],
      insight: 'Ne₂ has a bond order of 0 — like He₂, the noble gas configuration results in complete cancellation of bonding and antibonding electrons. Neon exists as individual atoms.'
    },
  };

  // Add antibonding orbitals for O₂, F₂, Ne₂ that were filled
  // O₂: 2 unpaired in π*2p → π*2px=π*2py (2 of 4 filled)
  // F₂: π*2px=π*2py fully filled (4 of 4)
  // Ne2: π*2p full + σ*2pz full
  molecules.O2.orbitals.push(
    { name: 'π*2px = π*2py', energy: 700, type: 'antibonding', maxE: 4, fillE: 2 }
  );
  molecules.F2.orbitals.push(
    { name: 'π*2px = π*2py', energy: 700, type: 'antibonding', maxE: 4, fillE: 4 }
  );
  molecules.Ne2.orbitals.push(
    { name: 'π*2px = π*2py', energy: 700, type: 'antibonding', maxE: 4, fillE: 4 },
    { name: 'σ*2pz', energy: 800, type: 'antibonding', maxE: 2, fillE: 2 }
  );

  // ── Build selector buttons ───────────────────────────────────────────
  const molKeys = ['H2', 'He2', 'Li2', 'B2', 'C2', 'N2', 'O2', 'F2', 'Ne2'];

  container.innerHTML = `
    ${moduleHeaderHTML('⚛️', 'Molecular Orbital Theory', 'Visualize electron configurations in homonuclear diatomic molecules using MO theory. Select a molecule to see its energy level diagram, bond order, and magnetic properties.', '--accent-potassium')}
    <div class="mo-container">
      <div class="mo-selector" id="mo-selector">
        ${molKeys.map(k => `<button class="mo-btn" data-mol="${k}">${molecules[k].symbol}</button>`).join('')}
      </div>
      <div id="mo-diagram-area"></div>
    </div>
  `;

  /** Render the MO diagram for a selected molecule */
  function renderDiagram(mol) {
    const data = molecules[mol];
    if (!data) return;

    // Calculate properties
    const bondingE = data.orbitals.filter(o => o.type === 'bonding').reduce((s, o) => s + o.fillE, 0);
    const antibondingE = data.orbitals.filter(o => o.type === 'antibonding').reduce((s, o) => s + o.fillE, 0);
    const bondOrder = (bondingE - antibondingE) / 2;

    // Count unpaired electrons
    let unpairedCount = 0;
    data.orbitals.forEach(o => {
      if (o.fillE % 2 !== 0) unpairedCount += 1;
    });

    const isParamagnetic = unpairedCount > 0;
    const isStable = bondOrder > 0;

    // Determine if there's a bonding/antibonding split for the separator
    const hasBothTypes = data.orbitals.some(o => o.type === 'bonding') && data.orbitals.some(o => o.type === 'antibonding');

    // Build orbital levels HTML
    let levelsHtml = '';
    let separatorAdded = false;

    // Render from top (highest energy) to bottom (lowest energy)
    const sortedOrbitals = [...data.orbitals].sort((a, b) => b.energy - a.energy);

    sortedOrbitals.forEach((orbital, idx) => {
      // Add separator before the first antibonding orbital (from top)
      if (!separatorAdded && hasBothTypes && orbital.type === 'antibonding' && sortedOrbitals[idx + 1]?.type === 'bonding') {
        levelsHtml += `<div class="mo-separator"></div>`;
        separatorAdded = true;
      }

      // Build electron arrows
      let arrowsHtml = '<div class="mo-electrons">';
      const half = Math.floor(orbital.maxE / 2);
      for (let i = 0; i < half; i++) {
        const filled = i < Math.ceil(orbital.fillE / 2);
        // Check if this electron is unpaired (last spin-up with no spin-down partner)
        const isUnpaired = filled && (i === Math.ceil(orbital.fillE / 2) - 1) && (orbital.fillE % 2 !== 0);
        const upClass = `mo-arrow-up${filled ? '' : ' empty'}${isUnpaired ? ' unpaired' : ''}`;
        const downFilled = (i * 2 + 2) <= orbital.fillE;
        const downClass = `mo-arrow-down${downFilled ? '' : ' empty'}`;
        arrowsHtml += `<div class="mo-arrow-pair"><span class="${upClass}"></span><span class="${downClass}"></span></div>`;
      }
      arrowsHtml += '</div>';

      levelsHtml += `
        <div class="mo-level">
          <div class="mo-level-label" title="${orbital.type === 'bonding' ? 'Bonding orbital' : 'Antibonding orbital'}">${orbital.name}</div>
          <div class="mo-level-line" style="opacity: ${orbital.fillE > 0 ? 1 : 0.4};"></div>
          ${arrowsHtml}
        </div>
      `;
    });

    // Build result cards
    const resultCards = `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-top: 24px;">
        <div class="card" style="text-align: center;">
          <div class="card-title">Bond Order</div>
          <div style="font-size: 2rem; font-weight: 800; color: ${bondOrder > 0 ? 'var(--color-success)' : 'var(--color-danger)'};">${bondOrder}</div>
          ${bondOrder >= 3 ? '<div style="font-size:0.8rem;color:var(--color-success);">Triple bond</div>' :
            bondOrder === 2 ? '<div style="font-size:0.8rem;color:var(--color-info);">Double bond</div>' :
            bondOrder === 1 ? '<div style="font-size:0.8rem;color:var(--color-warning);">Single bond</div>' :
            '<div style="font-size:0.8rem;color:var(--color-danger);">No bond</div>'}
        </div>
        <div class="card" style="text-align: center;">
          <div class="card-title">Magnetic Property</div>
          <div style="font-size: 1.4rem; font-weight: 700; color: ${isParamagnetic ? 'var(--color-alert)' : 'var(--color-info)'};">${isParamagnetic ? 'Paramagnetic' : 'Diamagnetic'}</div>
          <div style="font-size:0.8rem;color:var(--color-text-muted);">${unpairedCount} unpaired e⁻</div>
        </div>
        <div class="card" style="text-align: center;">
          <div class="card-title">Stability</div>
          <div style="font-size: 1.4rem; font-weight: 700; color: ${isStable ? 'var(--color-success)' : 'var(--color-danger)'};">${isStable ? 'Stable' : 'Unstable'}</div>
          <div style="font-size:0.8rem;color:var(--color-text-muted);">${isStable ? 'Bond order > 0' : 'Bond order = 0'}</div>
        </div>
      </div>
    `;

    document.getElementById('mo-diagram-area').innerHTML = `
      <div class="mo-diagram">
        <div class="mo-diagram-title">${data.symbol} — ${data.name} <span style="color:var(--color-text-muted);font-weight:400;font-size:0.85rem;">(${data.electrons} valence electrons)</span></div>
        <div style="position: relative;">
          <div class="mo-axis"></div>
          ${levelsHtml}
        </div>
      </div>
      ${resultCards}
      <div class="explanation-box" style="margin-top: 16px;">
        <strong>💡 Key Insight:</strong> ${data.insight}
      </div>
    `;
  }

  // ── Wire selector buttons ────────────────────────────────────────────
  document.getElementById('mo-selector').addEventListener('click', (e) => {
    const btn = e.target.closest('.mo-btn');
    if (!btn) return;
    document.querySelectorAll('.mo-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderDiagram(btn.dataset.mol);
  });

  // Default selection
  document.querySelector('.mo-btn[data-mol="N2"]')?.classList.add('active');
  renderDiagram('N2');
}


/* =====================================================================
   2. VSEPR GEOMETRY PREDICTOR
   ===================================================================== */

/**
 * VSEPR geometry predictor. User selects bonding and lone pairs,
 * gets AXnEm notation, geometry name, bond angles, hybridization, and polarity.
 */
export async function mountVSEPR(container) {
  container.innerHTML = `<div class="placeholder-note">Loading VSEPR predictor...</div>`;

  // Local element molar mass map (for formula display, not strictly needed but useful)
  const elementMasses = {
    H: 1.008, He: 4.003, Li: 6.941, Be: 9.012, B: 10.81,
    C: 12.011, N: 14.007, O: 15.999, F: 18.998, Ne: 20.180,
    Na: 22.990, Mg: 24.305, Al: 26.982, Si: 28.086, P: 30.974,
    S: 32.06, Cl: 35.45, Ar: 39.948, K: 39.098, Ca: 40.078,
    Fe: 55.845, Cu: 63.546, Zn: 65.38, Br: 79.904, I: 126.90,
    Ag: 107.87, Ba: 137.33, Pb: 207.2
  };

  // ── VSEPR lookup table: key = "bonding-lone" ────────────────────────
  const vseprData = {
    '2-0': { notation: 'AX₂',           name: 'Linear',                angles: '180°',        hybrid: 'sp',    polar: false,
      desc: 'Two bonding pairs on opposite sides of the central atom. All positions are equivalent, creating a straight line through the central atom.' },
    '3-0': { notation: 'AX₃',           name: 'Trigonal Planar',       angles: '120°',        hybrid: 'sp²',   polar: false,
      desc: 'Three bonding pairs in a flat triangular arrangement. All atoms lie in the same plane with 120° between each bond. Examples: BF₃, CO₃²⁻.' },
    '2-1': { notation: 'AX₂E',          name: 'Bent (V-shaped)',       angles: '< 120°',      hybrid: 'sp²',   polar: true,
      desc: 'Two bonding pairs and one lone pair. The lone pair repels more strongly, compressing the bond angle below 120°. Examples: SO₂, O₃.' },
    '4-0': { notation: 'AX₄',           name: 'Tetrahedral',           angles: '109.5°',      hybrid: 'sp³',   polar: false,
      desc: 'Four bonding pairs arranged at the corners of a regular tetrahedron. The most symmetric 3D geometry. Examples: CH₄, NH₄⁺.' },
    '3-1': { notation: 'AX₃E',          name: 'Trigonal Pyramidal',    angles: '< 109.5°',    hybrid: 'sp³',   polar: true,
      desc: 'Three bonding pairs and one lone pair. The lone pair pushes the bonding pairs down, creating a pyramid shape. Examples: NH₃, PCl₃.' },
    '2-2': { notation: 'AX₂E₂',         name: 'Bent (V-shaped)',       angles: '< 109.5°',    hybrid: 'sp³',   polar: true,
      desc: 'Two bonding pairs and two lone pairs. Two lone pairs compress the bond angle even further than AX₂E. Examples: H₂O, H₂S.' },
    '5-0': { notation: 'AX₅',           name: 'Trigonal Bipyramidal',  angles: '120° / 90°',  hybrid: 'sp³d',  polar: false,
      desc: 'Five bonding pairs: three equatorial (120° apart) and two axial (90° to equatorial). Examples: PCl₅, SF₄⁻ (as IF₅ parent geometry).' },
    '4-1': { notation: 'AX₄E',          name: 'Seesaw',               angles: '< 120° / < 90°', hybrid: 'sp³d', polar: true,
      desc: 'Four bonding pairs and one lone pair. The lone pair occupies an equatorial position, creating the asymmetric seesaw shape. Examples: SF₄, TeCl₄.' },
    '3-2': { notation: 'AX₃E₂',         name: 'T-shaped',             angles: '90°',         hybrid: 'sp³d',  polar: true,
      desc: 'Three bonding pairs and two lone pairs. Both lone pairs occupy equatorial positions, leaving three positions in a T shape. Examples: ClF₃, BrF₃.' },
    '6-0': { notation: 'AX₆',           name: 'Octahedral',            angles: '90°',         hybrid: 'sp³d²', polar: false,
      desc: 'Six bonding pairs at the corners of a regular octahedron. All positions are equivalent with 90° angles. Examples: SF₆, PF₆⁻.' },
    '5-1': { notation: 'AX₅E',          name: 'Square Pyramidal',     angles: '< 90°',       hybrid: 'sp³d²', polar: true,
      desc: 'Five bonding pairs and one lone pair. The lone pair pushes the base atoms closer together, reducing the angle from 90°. Examples: BrF₅, XeOF₄.' },
    '4-2': { notation: 'AX₄E₂',         name: 'Square Planar',        angles: '90°',         hybrid: 'sp³d²', polar: false,
      desc: 'Four bonding pairs and two lone pairs. The two lone pairs occupy axial positions opposite each other, leaving four atoms in a flat square. Examples: XeF₄, ICl₄⁻.' },
  };

  container.innerHTML = `
    ${moduleHeaderHTML('📐', 'VSEPR Geometry Predictor', 'Predict molecular geometry from the number of bonding and lone pairs around a central atom using Valence Shell Electron Pair Repulsion theory.', '--accent-copper')}
    <div class="card" style="max-width: 600px; margin: 0 auto 20px;">
      <div class="card-title">Select Electron Pair Configuration</div>
      <div class="form-grid" style="grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 12px;">
        <div class="field">
          <label>Bonding Pairs</label>
          <select id="vsepr-bp">
            ${[2,3,4,5,6].map(n => `<option value="${n}">${n}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>Lone Pairs</label>
          <select id="vsepr-lp">
            ${[0,1,2,3].map(n => `<option value="${n}">${n}</option>`).join('')}
          </select>
        </div>
      </div>
    </div>
    <div id="vsepr-result"></div>
  `;

  /** Render the VSEPR prediction results */
  function updateVSEPR() {
    const bp = parseInt(document.getElementById('vsepr-bp').value);
    const lp = parseInt(document.getElementById('vsepr-lp').value);
    const key = `${bp}-${lp}`;
    const data = vseprData[key];
    const resultDiv = document.getElementById('vsepr-result');

    if (!data) {
      resultDiv.innerHTML = `
        <div class="explanation-box" style="border-color: var(--color-warning);">
          <strong>No VSEPR geometry found</strong> for ${bp} bonding pairs and ${lp} lone pairs. This combination is not commonly observed in stable molecules.
        </div>
      `;
      return;
    }

    resultDiv.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 20px;">
        <div class="card" style="text-align: center;">
          <div class="card-title">AX Notation</div>
          <div style="font-size: 1.6rem; font-weight: 800; color: var(--color-primary);">${data.notation}</div>
        </div>
        <div class="card" style="text-align: center;">
          <div class="card-title">Geometry</div>
          <div style="font-size: 1.2rem; font-weight: 700; color: var(--color-primary);">${data.name}</div>
        </div>
        <div class="card" style="text-align: center;">
          <div class="card-title">Bond Angles</div>
          <div style="font-size: 1.2rem; font-weight: 700; color: var(--color-info);">${data.angles}</div>
        </div>
        <div class="card" style="text-align: center;">
          <div class="card-title">Hybridization</div>
          <div style="font-size: 1.4rem; font-weight: 800; font-family: var(--font-mono); color: var(--color-warning);">${data.hybrid}</div>
        </div>
        <div class="card" style="text-align: center;">
          <div class="card-title">Polarity</div>
          <div style="font-size: 1.2rem; font-weight: 700; color: ${data.polar ? 'var(--color-alert)' : 'var(--color-success)'};">${data.polar ? '⚡ Polar' : '○ Nonpolar'}</div>
        </div>
      </div>
      <div class="vsepr-canvas-wrap card" style="padding: 20px; text-align: center;">
        <div style="font-size: 1.3rem; font-weight: 700; margin-bottom: 8px; color: var(--color-primary);">${data.name}</div>
        <div style="font-size: 0.95rem; color: var(--color-text-muted); margin-bottom: 12px;">Ideal angles: ${data.angles} · ${data.hybrid} hybridized</div>
        <div style="border: 2px dashed var(--color-border); border-radius: var(--radius-sm); padding: 20px; margin: 12px 0;">
          <div style="font-size: 0.9rem; line-height: 1.6;">${data.desc}</div>
        </div>
        <div style="font-size: 0.85rem; color: var(--color-text-muted); margin-top: 8px;">
          Steric number = ${bp + lp} (${bp} bonding + ${lp} lone pair${lp !== 1 ? 's' : ''})
          · ${data.polar ? 'Asymmetric → molecular dipole exists' : 'Symmetric → dipole moments cancel'}
        </div>
      </div>
    `;
  }

  document.getElementById('vsepr-bp').addEventListener('change', updateVSEPR);
  document.getElementById('vsepr-lp').addEventListener('change', updateVSEPR);
  updateVSEPR(); // Initial render
}
/* =====================================================================
   3. FLAME TEST COLORS
   ===================================================================== */

/**
 * Displays a grid of flame test cards with colored swatches,
 * ion names, formulas, and brief observation notes.
 */
export async function mountFlameTests(container) {
  container.innerHTML = `<div class="placeholder-note">Loading flame tests...</div>`;

  // ── Flame test data ──────────────────────────────────────────────────
  const flameData = [
    { ion: 'Lithium',    formula: 'Li⁺',  color: 'Crimson',      hex: '#c0392b', obs: 'Intense crimson-red flame. Lithium\'s flame is so distinctive it\'s used in fireworks to create red colors.' },
    { ion: 'Sodium',     formula: 'Na⁺',  color: 'Yellow',       hex: '#f1c40f', obs: 'Bright golden-yellow flame that masks nearly all other colors. Sodium contamination is a common interference in flame tests.' },
    { ion: 'Potassium',  formula: 'K⁺',   color: 'Lilac',        hex: '#8e44ad', obs: 'Pale lilac/violet flame. Often observed through cobalt blue glass to filter out yellow sodium interference.' },
    { ion: 'Calcium',    formula: 'Ca²⁺', color: 'Orange-red',   hex: '#e67e22', obs: 'Brick red-orange flame. Calcium compounds are common in minerals and give brickwork its reddish appearance when fired.' },
    { ion: 'Copper(II)', formula: 'Cu²⁺', color: 'Blue-green',   hex: '#1abc9c', obs: 'Characteristic blue-green (aqua) flame. Copper\'s color is due to d-d electron transitions, unlike s-block elements.' },
    { ion: 'Barium',     formula: 'Ba²⁺', color: 'Apple green',  hex: '#27ae60', obs: 'Yellow-green flame. Barium compounds are toxic but produce vivid green colors in pyrotechnics.' },
    { ion: 'Strontium',  formula: 'Sr²⁺', color: 'Crimson',      hex: '#c0392b', obs: 'Bright crimson-red flame, similar to lithium but more intense. Strontium is the classic "red" in road flares and emergency signals.' },
    { ion: 'Rubidium',   formula: 'Rb⁺',  color: 'Red-violet',   hex: '#9b59b6', obs: 'Reddish-violet flame. Rubidium is one of the more obscure alkali metals, with flame color between potassium and lithium.' },
    { ion: 'Cesium',     formula: 'Cs⁺',  color: 'Blue',         hex: '#2980b9', obs: 'Blue/violet flame. Cesium has the lowest ionization energy of all stable elements, making its electrons easily excited.' },
    { ion: 'Boron',      formula: 'B³⁺',  color: 'Bright green', hex: '#2ecc71', obs: 'Distinct bright green flame. Boron compounds like boric acid are used to create green fire in demonstrations.' },
    { ion: 'Lead',       formula: 'Pb²⁺', color: 'Blue-white',   hex: '#bdc3c7', obs: 'Pale blue-white flame. Lead is toxic and its flame test is less commonly performed in teaching labs today.' },
  ];

  container.innerHTML = `
    <div class="module-header" style="--mh-accent: #c0392b;">
      <div class="mh-icon">🔥</div>
      <div>
        <h2 class="mh-title">Flame Test Colors</h2>
        <p class="mh-desc">A nichrome wire is dipped in concentrated HCl, then into the sample compound, and held in a Bunsen flame. The characteristic color produced is caused by electrons in metal ions being excited to higher energy levels and emitting photons of specific wavelengths as they fall back down.</p>
      </div>
    </div>
    <div class="flame-grid">
      ${flameData.map(f => `
        <div class="flame-card">
          <div class="flame-swatch" style="background: ${f.hex};">
            <span style="color: #fff; font-weight: 700; font-size: 0.85rem; text-shadow: 0 1px 3px rgba(0,0,0,0.5);">${f.color}</span>
          </div>
          <div class="flame-card-body">
            <div style="font-weight: 700; font-size: 1rem; color: var(--color-primary);">${f.ion}</div>
            <div style="font-family: var(--font-mono); color: var(--color-text-muted); font-size: 0.9rem;">${f.formula}</div>
            <p style="font-size: 0.82rem; color: var(--color-text-muted); margin-top: 8px; line-height: 1.5;">${f.obs}</p>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}
/* =====================================================================
   4. SOLUBILITY RULES
   ===================================================================== */

/**
 * Displays solubility rules in three accordion-style groups:
 * always soluble, mostly soluble (with exceptions), and mostly insoluble.
 */
export async function mountSolubilityRules(container) {
  container.innerHTML = `<div class="placeholder-note">Loading solubility rules...</div>`;

  // ── Solubility rules data ────────────────────────────────────────────
  const groups = [
    {
      title: 'Always Soluble',
      badge: 'soluble',
      rules: [
        { ion: 'NH₄⁺ (Ammonium)',      status: 'Soluble', badge: 'soluble',   exceptions: [] },
        { ion: 'Group 1 Alkali Metals', status: 'Soluble', badge: 'soluble',   exceptions: [] },
        { ion: 'NO₃⁻ (Nitrate)',        status: 'Soluble', badge: 'soluble',   exceptions: [] },
        { ion: 'CH₃COO⁻ (Acetate)',     status: 'Soluble', badge: 'soluble',   exceptions: [] },
      ]
    },
    {
      title: 'Mostly Soluble (with exceptions)',
      badge: 'soluble',
      rules: [
        { ion: 'Cl⁻, Br⁻, I⁻ (Halides)',    status: 'Soluble', badge: 'soluble',    exceptions: ['Ag⁺', 'Pb²⁺', 'Hg₂²⁺'] },
        { ion: 'SO₄²⁻ (Sulfate)',             status: 'Soluble', badge: 'soluble',    exceptions: ['Ba²⁺', 'Pb²⁺', 'Ca²⁺ (slightly)', 'Sr²⁺ (slightly)'] },
      ]
    },
    {
      title: 'Mostly Insoluble (with exceptions)',
      badge: 'insoluble',
      rules: [
        { ion: 'OH⁻ (Hydroxide)',           status: 'Insoluble', badge: 'insoluble', exceptions: ['Group 1', 'Ba²⁺', 'Ca²⁺ (slightly)'] },
        { ion: 'CO₃²⁻ (Carbonate)',          status: 'Insoluble', badge: 'insoluble', exceptions: ['Group 1', 'NH₄⁺'] },
        { ion: 'PO₄³⁻ (Phosphate)',          status: 'Insoluble', badge: 'insoluble', exceptions: ['Group 1', 'NH₄⁺'] },
        { ion: 'S²⁻ (Sulfide)',              status: 'Insoluble', badge: 'insoluble', exceptions: ['Group 1', 'NH₄⁺', 'Group 2'] },
      ]
    },
  ];

  container.innerHTML = `
    ${moduleHeaderHTML('💧', 'Solubility Rules', 'Quick reference for predicting whether an ionic compound will dissolve in water. Rules are grouped by solubility behavior, with notable exceptions highlighted.', '--accent-sodium')}
    <div id="sol-groups">
      ${groups.map((g, gi) => `
        <div class="sol-group">
          <div class="sol-group-header" data-group="${gi}" style="cursor: pointer;">
            <span style="font-weight: 700;">${g.title}</span>
            <span class="sol-badge-${g.badge}">${g.badge === 'soluble' ? '✓ Soluble' : '✗ Insoluble'}</span>
            <span style="margin-left: auto; color: var(--color-text-muted);">▼</span>
          </div>
          <div class="sol-group-body" id="sol-group-body-${gi}">
            ${g.rules.map(r => `
              <div class="sol-rule">
                <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                  <span style="font-weight: 600;">${r.ion}</span>
                  <span class="sol-badge-${r.badge}">${r.status}</span>
                  ${r.exceptions.length > 0 ? r.exceptions.map(ex => `<span class="sol-badge-exception">⚠ ${ex}</span>`).join('') : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  `;

  // ── Accordion toggle logic ───────────────────────────────────────────
  document.querySelectorAll('.sol-group-header').forEach(header => {
    header.addEventListener('click', () => {
      const body = document.getElementById(`sol-group-body-${header.dataset.group}`);
      const isOpen = body.style.display !== 'none';
      // Toggle this group
      body.style.display = isOpen ? 'none' : 'block';
      // Update arrow
      const arrow = header.querySelector('span:last-child');
      if (arrow) arrow.textContent = isOpen ? '▶' : '▼';
    });
  });
}
