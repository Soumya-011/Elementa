/* =====================================================================
   CORE ENGINE & WORKER BRIDGE (Elementa v1)
   ===================================================================== */

// 1. Initialize the Universal Compute Router (Web Worker)
const computeWorker = new Worker('compute.worker.js');
const pendingPromises = new Map();
let messageIdCounter = 0;

// 2. Global Promise Router for asynchronous background tasks
computeWorker.onmessage = (event) => {
    const { id, status, data, error } = event.data;
    if (pendingPromises.has(id)) {
        const { resolve, reject } = pendingPromises.get(id);
        if (status === 'success') {
            resolve(data);
        } else {
            reject(new Error(error));
        }
        pendingPromises.delete(id);
    }
};

/* =====================================================================
   INDEXEDDB ASYNCHRONOUS DATA ENGINE (Phase 1.3)
   ===================================================================== */

const DB_NAME = 'ElementaDB';
const DB_VERSION = 3; // Bumped: force re-creation of all object stores (reactivity was missing in older DBs)
const STORES = [
    'elements', 'compounds', 'reactions', 'preparations', 
    'identification_test', 'misconceptions', 'reactivity'
];
// Keyed store (not autoIncrement) so we can get()/put() by formula/name lookup key.
const KEYED_STORES = { 'structures': 'id' };

let dbPromise = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        console.log(`[Elementa DB] Initializing IndexedDB architecture version ${DB_VERSION}`);
        
        STORES.forEach(store => {
          if (!db.objectStoreNames.contains(store)) {
            db.createObjectStore(store, { autoIncrement: true });
          }
        });
        Object.entries(KEYED_STORES).forEach(([store, keyPath]) => {
          if (!db.objectStoreNames.contains(store)) {
            db.createObjectStore(store, { keyPath });
          }
        });
      };
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  return dbPromise;
}

const memCache = new Map();

export async function loadData(name) {
  if (memCache.has(name)) return memCache.get(name);
  const db = await getDB();
  
  // Check if the object store exists before attempting a transaction
  if (!db.objectStoreNames.contains(name)) {
    console.warn(`[Elementa DB] Store '${name}' missing — fetching from network to populate.`);
    return loadDataFromNetwork(name, db);
  }

  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction(name, 'readonly');
      const store = transaction.objectStore(name);
      const request = store.getAll();
      
      request.onsuccess = async () => {
        const data = request.result;
        if (data && data.length > 0) {
          memCache.set(name, data);
          resolve(data);
        } else {
          try {
            const result = await loadDataFromNetwork(name, db);
            resolve(result);
          } catch (err) {
            console.warn(`[Elementa] Failed to fetch '${name}' after empty IDB:`, err);
            resolve(null);
          }
        }
      };
      request.onerror = () => {
        console.warn(`[Elementa DB] IDB read error for '${name}', falling back to network.`, request.error);
        loadDataFromNetwork(name, db).then(resolve).catch(() => resolve(null));
      };
    } catch (err) {
      console.warn(`[Elementa DB] Transaction failed for '${name}', falling back to network.`, err);
      loadDataFromNetwork(name, db).then(resolve).catch(() => resolve(null));
    }
  });
}

/** Fetch data from data/${name}.json and write it into IndexedDB for offline use. */
async function loadDataFromNetwork(name, db) {
  console.log(`[Elementa DB] Fetching '${name}' from network...`);
  const res = await fetch(`data/${name}.json`);
  if (!res.ok) throw new Error(`HTTP ${res.status} for data/${name}.json`);
  const fetchedData = await res.json();
  if (!Array.isArray(fetchedData) || fetchedData.length === 0) {
    console.warn(`[Elementa DB] Fetched data for '${name}' is empty or not an array.`);
    return fetchedData;
  }

  // Try to persist to IndexedDB (may fail if store doesn't exist)
  try {
    if (db.objectStoreNames.contains(name)) {
      const writeTx = db.transaction(name, 'readwrite');
      const writeStore = writeTx.objectStore(name);
      fetchedData.forEach(item => writeStore.add(item));
      await new Promise((resolve, reject) => {
        writeTx.oncomplete = resolve;
        writeTx.onerror = () => reject(writeTx.error);
      });
    }
  } catch (err) {
    console.warn(`[Elementa DB] Could not write '${name}' to IDB:`, err);
  }

  memCache.set(name, fetchedData);
  return fetchedData;
}

export const getElements = () => loadData("elements");
export const getCompounds = () => loadData("compounds");
export const getReactions = () => loadData("reactions");
export const getPreparations = () => loadData("preparations");
export const getIdTests = () => loadData("identification_test");
export const getMisconceptions = () => loadData("misconceptions");
export const getReactivity = () => loadData("reactivity");

/* =====================================================================
   MATH ENGINES & STRING FORMATTING
   ===================================================================== */

export function formatFormula(formula) {
  if (!formula) return "";
  return formula.replace(/([A-Za-z\)])(\d+)/g, "$1<sub>$2</sub>").replace(/\^([0-9]*[+-])/g, "<sup>$1</sup>");
}

export function formatEquation(equation) {
  if (!equation) return "";
  // Replace longer pattern first to avoid -> consuming the tail of <->
  const isReversible = equation.includes("<->");
  const withArrow = equation.replace(/<->/g, "\x00").replace(/->/g, "&rarr;").replace(/\x00/g, "&harr;");
  const arrow = isReversible ? " &harr; " : " &rarr; ";
  return withArrow.split(/&rarr;|&harr;/).map(side => {
    return side.split(" + ").map(term => {
      const match = term.trim().match(/^(\d+)([A-Za-z(].*)$/);
      if (match) return `${match[1]}${formatFormula(match[2])}`;
      return formatFormula(term.trim());
    }).join(" + ");
  }).join(arrow);
}

export function formatMultiEquation(eqStr) {
  if (!eqStr) return "";
  return eqStr.split("|").map(eq => `<div class="equation-box">${formatEquation(eq.trim())}</div>`).join("");
}

const modules = new Map();
let mounted = new Set();

/**
 * @param {string} id
 * @param {string} label
 * @param {Function} mountFn
 * @param {{icon?: string, accent?: 'copper'|'lithium'|'potassium'|'sodium', group?: string}} [meta]
 *   accent maps to the flame-test color tokens in styles.css (--accent-<accent>).
 *   group, if set, renders a section eyebrow in the sidebar above this item.
 */
export function registerModule(id, label, mountFn, meta = {}) {
  const { icon = "⚛️", accent = "copper", group = null } = meta;
  modules.set(id, { id, label, mountFn, icon, accent, group });
}

export function navigateTo(id, params = null) {
  if (!modules.has(id)) return;
  document.querySelectorAll("#app-nav button").forEach(btn => btn.classList.toggle("active", btn.dataset.moduleId === id));
  document.querySelectorAll(".view").forEach(section => section.classList.toggle("active", section.id === `view-${id}`));
  
  const container = document.getElementById(`view-${id}`);
  if (!mounted.has(id) || params) {
    modules.get(id).mountFn(container, params);
    mounted.add(id);
  }
  if (!params) window.location.hash = id;
}

export function startRouter(defaultModuleId) {
  const nav = document.getElementById("app-nav");
  const root = document.getElementById("app-views");
  nav.innerHTML = ""; root.innerHTML = "";
  
  for (const { id, label, icon, accent, group } of modules.values()) {
    if (group) {
      if (nav.children.length > 0) {
        const divider = document.createElement("div");
        divider.className = "nav-divider";
        nav.appendChild(divider);
      }
      const eyebrow = document.createElement("p");
      eyebrow.className = "nav-eyebrow";
      eyebrow.textContent = group;
      nav.appendChild(eyebrow);
    }

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "nav-item";
    btn.dataset.moduleId = id;
    btn.style.setProperty("--nav-accent", `var(--accent-${accent})`);
    btn.style.setProperty("--nav-accent-dim", `var(--accent-${accent}-dim)`);
    btn.innerHTML = `<span class="nav-icon">${icon}</span><span class="nav-label">${label}</span>`;
    btn.addEventListener("click", () => {
      navigateTo(id);
      // Auto-close the mobile/tablet overlay drawer after selection (index.html exposes this hook)
      if (window.innerWidth <= 899 && typeof window.closeSidebarDrawer === "function") {
        window.closeSidebarDrawer();
      }
    });
    nav.appendChild(btn);
    
    const section = document.createElement("section");
    section.className = "view";
    section.id = `view-${id}`;
    root.appendChild(section);
  }

  const initial = window.location.hash.replace("#", "") || defaultModuleId;
  navigateTo(modules.has(initial) ? initial : defaultModuleId);
  window.addEventListener("hashchange", () => {
    const id = window.location.hash.replace("#", "");
    if (modules.has(id)) navigateTo(id);
  });
}

export function calculateMolarMass(formula, elementsData) {
  if (!formula || !elementsData || elementsData.length === 0) return 0;
  const massMap = {};
  elementsData.forEach(e => massMap[e.symbol] = e.atomic_mass || 0);

  let stack = [{}];
  let i = 0;
  while(i < formula.length && /[0-9]/.test(formula[i])) { i++; }

  while (i < formula.length) {
    let char = formula[i];
    if (char === '(' || char === '[') { stack.push({}); i++; }
    else if (char === ')' || char === ']') {
      let top = stack.pop(); i++;
      let numStr = "";
      while (i < formula.length && /[0-9.]/.test(formula[i])) { numStr += formula[i]; i++; }
      let mult = numStr ? parseFloat(numStr) : 1;
      let current = stack[stack.length - 1];
      for (let key in top) current[key] = (current[key] || 0) + (top[key] * mult);
    } else if (/[A-Z]/.test(char)) {
      let elem = char; i++;
      if (i < formula.length && /[a-z]/.test(formula[i])) { elem += formula[i]; i++; }
      let numStr = "";
      while (i < formula.length && /[0-9.]/.test(formula[i])) { numStr += formula[i]; i++; }
      let mult = numStr ? parseFloat(numStr) : 1;
      let current = stack[stack.length - 1];
      current[elem] = (current[elem] || 0) + mult;
    } else { i++; }
  }

  let counts = stack[0];
  let totalMass = 0;
  for (let elem in counts) {
    if (massMap[elem] !== undefined) totalMass += counts[elem] * massMap[elem];
    else throw new Error(`Unknown element parsed: ${elem}`);
  }
  return totalMass;
}

export function countAtoms(formula) {
  if (!formula) return 0;
  let stack = [{}];
  let i = 0;
  while(i < formula.length && /[0-9]/.test(formula[i])) { i++; }

  while (i < formula.length) {
    let char = formula[i];
    if (char === '(' || char === '[') { stack.push({}); i++; }
    else if (char === ')' || char === ']') {
      let top = stack.pop(); i++;
      let numStr = "";
      while (i < formula.length && /[0-9.]/.test(formula[i])) { numStr += formula[i]; i++; }
      let mult = numStr ? parseFloat(numStr) : 1;
      let current = stack[stack.length - 1];
      for (let key in top) current[key] = (current[key] || 0) + (top[key] * mult);
    } else if (/[A-Z]/.test(char)) {
      let elem = char; i++;
      if (i < formula.length && /[a-z]/.test(formula[i])) { elem += formula[i]; i++; }
      let numStr = "";
      while (i < formula.length && /[0-9.]/.test(formula[i])) { numStr += formula[i]; i++; }
      let mult = numStr ? parseFloat(numStr) : 1;
      let current = stack[stack.length - 1];
      current[elem] = (current[elem] || 0) + mult;
    } else { i++; }
  }

  let total = 0;
  for (let elem in stack[0]) total += stack[0][elem];
  return total;
}

export function calcMolarity(moles, liters) {
    if (!liters || liters <= 0) return 0;
    return moles / liters;
}

export function calcMolality(moles, kgSolvent) {
    if (!kgSolvent || kgSolvent <= 0) return 0;
    return moles / kgSolvent;
}

export function calcNormality(molarity, nFactor) {
    return molarity * (nFactor || 1);
}

export function solveIdealGas(p, v, n, t, r = 0.0821) {
  const isSet = (val) => val !== null && val !== undefined && !isNaN(val);
  if (!isSet(p) && isSet(v) && isSet(n) && isSet(t)) return { var: "P (atm)", val: (n * r * t) / v };
  if (!isSet(v) && isSet(p) && isSet(n) && isSet(t)) return { var: "V (L)", val: (n * r * t) / p };
  if (!isSet(n) && isSet(p) && isSet(v) && isSet(t)) return { var: "n (mol)", val: (p * v) / (r * t) };
  if (!isSet(t) && isSet(p) && isSet(v) && isSet(n)) return { var: "T (K)", val: (p * v) / (n * r) };
  return null;
}

export function solveCombinedGas(p1, v1, t1, p2, v2, t2) {
  const isSet = (val) => val !== null && val !== undefined && !isNaN(val);
  const c1 = (isSet(p1) && isSet(v1) && isSet(t1) && t1 !== 0) ? (p1 * v1) / t1 : null;
  const c2 = (isSet(p2) && isSet(v2) && isSet(t2) && t2 !== 0) ? (p2 * v2) / t2 : null;
  
  if (c1 !== null) {
    if (!isSet(p2) && isSet(v2) && isSet(t2)) return { var: "P2", val: (c1 * t2) / v2 };
    if (!isSet(v2) && isSet(p2) && isSet(t2)) return { var: "V2", val: (c1 * t2) / p2 };
    if (!isSet(t2) && isSet(p2) && isSet(v2)) return { var: "T2", val: (p2 * v2) / c1 };
  }
  if (c2 !== null) {
    if (!isSet(p1) && isSet(v1) && isSet(t1)) return { var: "P1", val: (c2 * t1) / v1 };
    if (!isSet(v1) && isSet(p1) && isSet(t1)) return { var: "V1", val: (c2 * t1) / p1 };
    if (!isSet(t1) && isSet(p1) && isSet(v1)) return { var: "T1", val: (p1 * v1) / c2 };
  }
  return null;
}

export function solveAvogadros(v1, n1, v2, n2) {
  const isSet = (val) => val !== null && val !== undefined && !isNaN(val);
  const c1 = (isSet(v1) && isSet(n1) && n1 !== 0) ? v1 / n1 : null;
  const c2 = (isSet(v2) && isSet(n2) && n2 !== 0) ? v2 / n2 : null;
  
  if (c1 !== null) {
    if (!isSet(v2) && isSet(n2)) return { var: "V2 (L)", val: c1 * n2 };
    if (!isSet(n2) && isSet(v2)) return { var: "n2 (mol)", val: v2 / c1 };
  }
  if (c2 !== null) {
    if (!isSet(v1) && isSet(n1)) return { var: "V1 (L)", val: c2 * n1 };
    if (!isSet(n1) && isSet(v1)) return { var: "n1 (mol)", val: v1 / c2 };
  }
  return null;
}

export function balanceEquationAsync(equationStr) {
    return new Promise((resolve, reject) => {
        const id = ++messageIdCounter;
        pendingPromises.set(id, { resolve, reject });
        computeWorker.postMessage({ action: 'BALANCE_EQUATION', payload: equationStr, id });
    });
}

// --- PHASE 3.1: KSP SOLUBILITY PREDICTIVE ENGINE ---

export function calculateQ(concA, concB, countA, countB) {
    if (isNaN(concA) || isNaN(concB) || isNaN(countA) || isNaN(countB)) return 0;
    return Math.pow(concA, countA) * Math.pow(concB, countB);
}

export function calculateMolarSolubility(ksp, countA, countB) {
    if (isNaN(ksp) || isNaN(countA) || isNaN(countB) || ksp <= 0 || countA <= 0 || countB <= 0) return 0;
    const factor = Math.pow(countA, countA) * Math.pow(countB, countB);
    const power = 1 / (countA + countB);
    return Math.pow(ksp / factor, power);
}

// --- PHASE 3.2: ELECTROCHEMICAL SIMULATOR (NERNST EQUATION) ---

const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
const lcm = (a, b) => (a * b) / gcd(a, b);

export function calculateNernst(e0Cat, e0An, nCat, nAn, concCat, concAn, tempK) {
    const R = 8.314462618; // Universal gas constant J/(mol·K)
    const F = 96485.33212; // Faraday constant C/mol
    
    const e0Cell = e0Cat - e0An;
    
    // Guard: concentrations must be strictly positive for Q to be meaningful
    if (concCat <= 0 || concAn <= 0) {
        return { e0Cell, nTotal: 0, q: NaN, eCell: NaN, error: "Concentrations must be strictly positive." };
    }
    
    // Calculate total electron transfer for balanced redox
    const nTotal = lcm(nCat, nAn);
    const multiplierCat = nTotal / nCat;
    const multiplierAn = nTotal / nAn;
    
    // Q = [Oxidation Product] / [Reduction Reactant]
    // Q = [Anode Ion]^(multiplierAn) / [Cathode Ion]^(multiplierCat)
    const q = Math.pow(concAn, multiplierAn) / Math.pow(concCat, multiplierCat);
    
    // E = E° - (RT/nF) * ln(Q)
    const factor = (R * tempK) / (nTotal * F);
    const eCell = e0Cell - (factor * Math.log(q));
    
    return { e0Cell, nTotal, q, eCell };
}

/* =====================================================================
   PHASE 2.3: 3D STRUCTURE HYBRID LOOKUP ENGINE
   Order: mem cache -> IndexedDB 'structures' -> bundled local dataset
          -> PubChem (online only) -> cache result to IndexedDB
   ===================================================================== */

let localStructuresPromise = null;
function loadLocalStructures() {
  if (!localStructuresPromise) {
    localStructuresPromise = fetch('data/structures.json')
      .then(res => res.ok ? res.json() : {})
      .catch(() => ({}));
  }
  return localStructuresPromise;
}

async function readStructureCache(db, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('structures', 'readonly');
    const req = tx.objectStore('structures').get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function writeStructureCache(db, record) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('structures', 'readwrite');
    tx.objectStore('structures').put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function fetchPubChemCID(query) {
  // Try as a compound name first, then as a molecular formula.
  const nameUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(query)}/cids/JSON`;
  try {
    const res = await fetch(nameUrl);
    if (res.ok) {
      const json = await res.json();
      const cid = json?.IdentifierList?.CID?.[0];
      if (cid) return cid;
    }
  } catch (e) { /* fall through to formula search */ }

  const formulaUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/fastformula/${encodeURIComponent(query)}/cids/JSON`;
  try {
    const res = await fetch(formulaUrl);
    if (res.ok) {
      const json = await res.json();
      const cid = json?.IdentifierList?.CID?.[0];
      if (cid) return cid;
    }
  } catch (e) { /* no match either way */ }

  return null;
}

async function fetchPubChem3DSDF(cid) {
  const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/SDF?record_type=3d`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`PubChem SDF fetch failed (HTTP ${res.status})`);
  return res.text();
}

/**
 * Resolve a formula or compound name to a renderable 3D structure.
 * Returns { name, data, format, source } on success, or { error } on failure.
 * source is one of: 'local' | 'indexeddb' | 'pubchem'
 * error is one of: 'not_found' | 'offline' | <message string>
 */
export async function getStructure(query) {
  const key = query.trim().toLowerCase();
  if (!key) return { error: 'not_found' };

  const memKey = `structure:${key}`;
  if (memCache.has(memKey)) return memCache.get(memKey);

  const db = await getDB();

  // L1: IndexedDB cache (previously resolved, offline-safe once cached)
  const cached = await readStructureCache(db, key).catch(() => null);
  if (cached) {
    const result = { name: cached.name, data: cached.data, format: cached.format, source: 'indexeddb' };
    memCache.set(memKey, result);
    return result;
  }

  // L2: bundled local dataset (guaranteed offline, curated set)
  const localSet = await loadLocalStructures();
  if (localSet[key]) {
    const entry = localSet[key];
    const record = { id: key, name: entry.name || query, data: entry.xyz, format: 'xyz' };
    await writeStructureCache(db, record).catch(() => {});
    const result = { name: record.name, data: record.data, format: record.format, source: 'local' };
    memCache.set(memKey, result);
    return result;
  }

  // L3: PubChem fallback, only attempted when online
  if (!navigator.onLine) return { error: 'offline' };

  try {
    const cid = await fetchPubChemCID(key);
    if (!cid) return { error: 'not_found' };
    const sdf = await fetchPubChem3DSDF(cid);
    const record = { id: key, name: query, data: sdf, format: 'sdf' };
    await writeStructureCache(db, record).catch(() => {});
    const result = { name: record.name, data: record.data, format: record.format, source: 'pubchem' };
    memCache.set(memKey, result);
    return result;
  } catch (e) {
    return { error: e.message };
  }
}