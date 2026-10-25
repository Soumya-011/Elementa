/**
 * feat-helpers.js
 * Shared UI utilities and helpers — no core.js imports.
 */

// Define the spin animation programmatically to avoid CSS dependency issues
const style = document.createElement('style');
style.innerHTML = `@keyframes spin { 100% { transform: rotate(360deg); } }`;
document.head.appendChild(style);

/* =====================================================================
   0. SMILES 2D RENDERING ENGINE INTEGRATION
   ===================================================================== */
export let activeSmilesDrawers = [];

window.addEventListener('themeChanged', (e) => {
    const theme = e.detail.theme;
    activeSmilesDrawers.forEach(item => {
        item.drawer.draw(item.tree, item.canvasId, theme, false);
    });
});

export function drawSmiles(smilesStr, canvasId, width = 300, height = 250) {
    if (typeof SmilesDrawer === 'undefined') return;
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const theme = isDark ? 'dark' : 'light';

    try {
        let drawer = new SmilesDrawer.Drawer({ width: width, height: height });
        SmilesDrawer.parse(smilesStr, function(tree) {
            drawer.draw(tree, canvas, theme, false);
            activeSmilesDrawers = activeSmilesDrawers.filter(d => d.canvasId !== canvasId);
            activeSmilesDrawers.push({ drawer, tree, canvasId });
        }, function(err) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        });
    } catch (e) { console.error("Canvas Rendering Exception:", e); }
}

/* =====================================================================
   1. REUSABLE UI COMPONENTS & HELPERS
   ===================================================================== */
export function titleCase(str) {
  if (str == null) return "N/A";
  const s = String(str);
  if (s.toLowerCase() === "null" || s.trim() === "" || s.toLowerCase() === "n/a") return "N/A";
  return s.replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase());
}

export function createInfoCard({ title, subtitle, badgeText, badgeType = "success", rows = [], bodyHtml = "" }) {
  const card = document.createElement("div");
  card.className = "card";
  const badgeHtml = badgeText ? `<span class="badge badge-${badgeType}">${badgeText}</span>` : "";

  card.innerHTML = `
    <div class="card-title"><span class="card-title-text">${title}</span>${badgeHtml}</div>
    ${subtitle ? `<div class="card-subtitle">${subtitle}</div>` : ""}
    ${rows.join("")}
    ${bodyHtml}
  `;
  return card;
}

export function resultField(label, valueHtml) {
  return `<div class="result-field"><div class="label">${label}</div><div class="value">${valueHtml}</div></div>`;
}

export function moduleHeaderHTML(icon, title, description, accent) {
  return `
    <div class="module-header" style="--mh-accent: ${accent};">
      <div class="mh-icon">${icon}</div>
      <div class="mh-text">
        <h2>${title}</h2>
        <p>${description}</p>
      </div>
    </div>
  `;
}

/* =====================================================================
   2. CROSS-MODULE DEEP-LINK BUTTON (Phase 7 interlinking infra)
   Renders a button carrying data-jump-module / data-jump-focus attributes.
   The actual click handling lives in features.js as a single delegated
   listener (navigateTo(moduleId, { focus })) — this file stays free of
   core.js imports, same as every other export here.
   Escaping: focusId/moduleId go into an HTML attribute (quote-escaped
   only); label goes into text content (angle-bracket-escaped) since it's
   always a short plain string the caller controls, never user input.
   ===================================================================== */
export function jumpButtonHTML(label, moduleId, focusId, icon = '→', extraParams = null) {
  const escAttr = (v) => String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  const escText = (v) => String(v).replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // Phase 9: optional extraParams (plain object) is carried as JSON in
  // data-jump-params and merged into the navigateTo params by the delegated
  // click handler in features.js. `focus` stays the simple single-id channel.
  const extraAttr = extraParams ? ` data-jump-params="${escAttr(JSON.stringify(extraParams))}"` : '';
  return `<button type="button" class="jump-btn" data-jump-module="${escAttr(moduleId)}" data-jump-focus="${escAttr(focusId ?? '')}"${extraAttr}>${escText(label)} <span class="jump-btn-icon">${icon}</span></button>`;
}