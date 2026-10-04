/**
 * feat-charts.js
 * Phase 3 of the feature roadmap: a shared, hand-rolled, inline-SVG line
 * chart component. No external dependencies, no service-worker/CSP changes.
 * Consumed by the Titration Simulator (Phase 4) and Kinetics Grapher (Phase 5).
 *
 * Usage:
 *   import { LineChart } from './feat-charts.js';
 *   const chart = new LineChart(containerEl, {
 *     title: 'Titration Curve',
 *     xLabel: 'Volume added (mL)', yLabel: 'pH',
 *     series: [{ name: 'pH', points: [{x:0,y:1.1}, ...], pointRadius: 0 }],
 *     markers: [{ x: 25.0, label: 'Equivalence', color: 'var(--color-warning)' }]
 *   });
 *   chart.update({ series: [...] }); // re-render with new/changed data
 *   chart.destroy();                // detach listeners when unmounting
 */

const NS = 'http://www.w3.org/2000/svg';
const SERIES_ACCENTS = ['copper', 'lithium', 'potassium', 'sodium'];

function svgEl(tag, attrs = {}) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

/** Round a [min,max] domain out to "nice" tick values (1/2/5 * 10^n steps). */
export function niceTicks(min, max, count = 5) {
  if (min === max) { min -= 1; max += 1; }
  const range = max - min;
  const rawStep = range / count;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const norm = rawStep / mag;
  let step;
  if (norm < 1.5) step = 1 * mag;
  else if (norm < 3) step = 2 * mag;
  else if (norm < 7) step = 5 * mag;
  else step = 10 * mag;
  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;
  const ticks = [];
  for (let t = niceMin; t <= niceMax + step * 0.001; t += step) ticks.push(Math.round(t * 1e9) / 1e9);
  return { ticks, min: niceMin, max: niceMax };
}

export function formatTick(n) {
  if (Math.abs(n) >= 10000 || (Math.abs(n) < 0.001 && n !== 0)) return n.toExponential(2);
  return parseFloat(n.toPrecision(4)).toString();
}

export class LineChart {
  /**
   * @param {HTMLElement} container
   * @param {object} config
   *   series: [{ name, color, points: [{x,y}], fill?: boolean, pointRadius?: number }]
   *   title, xLabel, yLabel
   *   markers: [{ x, label, color }]       // vertical reference lines (e.g. equivalence point)
   *   xDomain, yDomain: [min, max]         // optional explicit domain override
   *   height: number (px, default 320)     // width is always 100% responsive
   */
  constructor(container, config = {}) {
    this.container = container;
    this.config = config;
    this.height = config.height || 320;
    this.padding = { top: 36, right: 24, bottom: 48, left: 56 };
    this._onResize = () => this._draw();
    this._ro = null;
    this._build();
  }

  _build() {
    this.container.innerHTML = '';
    this.wrap = document.createElement('div');
    this.wrap.className = 'chart-wrap';
    this.svg = svgEl('svg', { class: 'chart-svg', role: 'img' });
    this.wrap.appendChild(this.svg);
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'chart-tooltip';
    this.tooltip.style.display = 'none';
    this.wrap.appendChild(this.tooltip);
    this.container.appendChild(this.wrap);

    if (typeof ResizeObserver !== 'undefined') {
      this._ro = new ResizeObserver(() => this._draw());
      this._ro.observe(this.wrap);
    } else {
      window.addEventListener('resize', this._onResize);
    }
    this._draw();
  }

  /** Merge new config in and re-render (e.g. live-updating a slider-driven simulation). */
  update(config) {
    this.config = { ...this.config, ...config };
    this._draw();
  }

  /** Detach listeners/observers. Call this before unmounting the container. */
  destroy() {
    if (this._ro) this._ro.disconnect();
    window.removeEventListener('resize', this._onResize);
    this.container.innerHTML = '';
  }

  _draw() {
    const { series = [], title, xLabel, yLabel, markers = [], xDomain, yDomain } = this.config;
    const width = this.wrap.clientWidth || 600;
    const height = this.height;
    const { top, right, bottom, left } = this.padding;
    const plotW = Math.max(10, width - left - right);
    const plotH = Math.max(10, height - top - bottom);

    this.svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    this.svg.setAttribute('width', '100%');
    this.svg.setAttribute('height', String(height));
    this.svg.innerHTML = '';

    const allPoints = series.flatMap(s => s.points || []);
    if (allPoints.length === 0) {
      const empty = svgEl('text', { x: width / 2, y: height / 2, 'text-anchor': 'middle', class: 'chart-empty-text' });
      empty.textContent = 'No data to display';
      this.svg.appendChild(empty);
      return;
    }

    let [xMin, xMax] = xDomain || [Math.min(...allPoints.map(p => p.x)), Math.max(...allPoints.map(p => p.x))];
    let [yMin, yMax] = yDomain || [Math.min(...allPoints.map(p => p.y)), Math.max(...allPoints.map(p => p.y))];
    const xTicksInfo = niceTicks(xMin, xMax);
    const yTicksInfo = niceTicks(yMin, yMax);
    xMin = xTicksInfo.min; xMax = xTicksInfo.max;
    yMin = yTicksInfo.min; yMax = yTicksInfo.max;
    if (xMax === xMin) xMax = xMin + 1;
    if (yMax === yMin) yMax = yMin + 1;

    const sx = (x) => left + ((x - xMin) / (xMax - xMin)) * plotW;
    const sy = (y) => top + plotH - ((y - yMin) / (yMax - yMin)) * plotH;

    // Gridlines + tick labels
    const gridGroup = svgEl('g', { class: 'chart-grid' });
    yTicksInfo.ticks.forEach(t => {
      const y = sy(t);
      gridGroup.appendChild(svgEl('line', { x1: left, x2: left + plotW, y1: y, y2: y, class: 'chart-gridline' }));
      const lbl = svgEl('text', { x: left - 10, y: y + 4, 'text-anchor': 'end', class: 'chart-tick-label' });
      lbl.textContent = formatTick(t);
      gridGroup.appendChild(lbl);
    });
    xTicksInfo.ticks.forEach(t => {
      const x = sx(t);
      gridGroup.appendChild(svgEl('line', { x1: x, x2: x, y1: top, y2: top + plotH, class: 'chart-gridline chart-gridline-v' }));
      const lbl = svgEl('text', { x: x, y: top + plotH + 20, 'text-anchor': 'middle', class: 'chart-tick-label' });
      lbl.textContent = formatTick(t);
      gridGroup.appendChild(lbl);
    });
    this.svg.appendChild(gridGroup);

    // Axes
    const axisGroup = svgEl('g', { class: 'chart-axes' });
    axisGroup.appendChild(svgEl('line', { x1: left, x2: left, y1: top, y2: top + plotH, class: 'chart-axis-line' }));
    axisGroup.appendChild(svgEl('line', { x1: left, x2: left + plotW, y1: top + plotH, y2: top + plotH, class: 'chart-axis-line' }));
    this.svg.appendChild(axisGroup);

    if (title) {
      const t = svgEl('text', { x: width / 2, y: 20, 'text-anchor': 'middle', class: 'chart-title' });
      t.textContent = title;
      this.svg.appendChild(t);
    }
    if (xLabel) {
      const t = svgEl('text', { x: left + plotW / 2, y: height - 8, 'text-anchor': 'middle', class: 'chart-axis-label' });
      t.textContent = xLabel;
      this.svg.appendChild(t);
    }
    if (yLabel) {
      const cy = top + plotH / 2;
      const t = svgEl('text', { x: 14, y: cy, 'text-anchor': 'middle', class: 'chart-axis-label', transform: `rotate(-90 14 ${cy})` });
      t.textContent = yLabel;
      this.svg.appendChild(t);
    }

    // Reference markers (vertical lines, e.g. titration equivalence point)
    markers.forEach(m => {
      const x = sx(m.x);
      const mg = svgEl('g', { class: 'chart-marker' });
      mg.appendChild(svgEl('line', { x1: x, x2: x, y1: top, y2: top + plotH, class: 'chart-marker-line', stroke: m.color || 'var(--color-warning)' }));
      if (m.label) {
        const lbl = svgEl('text', { x: x, y: top - 6, 'text-anchor': 'middle', class: 'chart-marker-label', fill: m.color || 'var(--color-warning)' });
        lbl.textContent = m.label;
        mg.appendChild(lbl);
      }
      this.svg.appendChild(mg);
    });

    // Series: fill, line, points
    const hoverPoints = [];
    series.forEach((s, i) => {
      const color = s.color || `var(--accent-${SERIES_ACCENTS[i % SERIES_ACCENTS.length]})`;
      const pts = (s.points || []).slice().sort((a, b) => a.x - b.x);
      if (pts.length === 0) return;
      const pathD = pts.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${sx(p.x)} ${sy(p.y)}`).join(' ');

      if (s.fill) {
        const fillD = `${pathD} L ${sx(pts[pts.length - 1].x)} ${top + plotH} L ${sx(pts[0].x)} ${top + plotH} Z`;
        this.svg.appendChild(svgEl('path', { d: fillD, class: 'chart-fill', fill: color, opacity: 0.12, stroke: 'none' }));
      }
      this.svg.appendChild(svgEl('path', { d: pathD, class: 'chart-line', fill: 'none', stroke: color }));

      const r = s.pointRadius ?? (pts.length <= 60 ? 3 : 0);
      if (r > 0) {
        pts.forEach(p => {
          this.svg.appendChild(svgEl('circle', { cx: sx(p.x), cy: sy(p.y), r, class: 'chart-point', fill: color }));
        });
      }
      pts.forEach(p => hoverPoints.push({ sx: sx(p.x), sy: sy(p.y), x: p.x, y: p.y, seriesName: s.name, color }));
    });

    // Legend (only when there's more than one series to distinguish)
    if (series.length > 1) {
      const legend = svgEl('g', { class: 'chart-legend' });
      let lx = left;
      series.forEach((s, i) => {
        const color = s.color || `var(--accent-${SERIES_ACCENTS[i % SERIES_ACCENTS.length]})`;
        legend.appendChild(svgEl('rect', { x: lx, y: 4, width: 10, height: 10, fill: color, rx: 2 }));
        const lbl = svgEl('text', { x: lx + 14, y: 13, class: 'chart-legend-label' });
        const name = s.name || `Series ${i + 1}`;
        lbl.textContent = name;
        legend.appendChild(lbl);
        lx += 14 + name.length * 7 + 16;
      });
      this.svg.appendChild(legend);
    }

    // Hover crosshair + tooltip (nearest point by x-distance)
    const crosshair = svgEl('line', { class: 'chart-crosshair', y1: top, y2: top + plotH, x1: -100, x2: -100 });
    this.svg.appendChild(crosshair);
    const hitRect = svgEl('rect', { x: left, y: top, width: plotW, height: plotH, fill: 'transparent', class: 'chart-hit-rect' });
    this.svg.appendChild(hitRect);

    hitRect.addEventListener('mousemove', (evt) => {
      const rect = this.svg.getBoundingClientRect();
      const scaleX = rect.width > 0 ? width / rect.width : 1;
      const mx = (evt.clientX - rect.left) * scaleX;
      let nearest = null, bestDist = Infinity;
      hoverPoints.forEach(hp => {
        const d = Math.abs(hp.sx - mx);
        if (d < bestDist) { bestDist = d; nearest = hp; }
      });
      if (nearest) {
        crosshair.setAttribute('x1', nearest.sx);
        crosshair.setAttribute('x2', nearest.sx);
        crosshair.style.display = 'block';
        this.tooltip.style.display = 'block';
        this.tooltip.style.left = `${(nearest.sx / width) * 100}%`;
        this.tooltip.style.top = `${(nearest.sy / height) * 100}%`;
        this.tooltip.innerHTML = `${nearest.seriesName ? `<strong>${nearest.seriesName}</strong><br>` : ''}x: ${formatTick(nearest.x)}<br>y: ${formatTick(nearest.y)}`;
      }
    });
    hitRect.addEventListener('mouseleave', () => {
      crosshair.style.display = 'none';
      this.tooltip.style.display = 'none';
    });
  }
}

export function createLineChart(container, config) {
  return new LineChart(container, config);
}

/* =====================================================================
   TEMPORARY DEV-ONLY DEMO — proves the engine renders/updates/tooltips
   correctly before Phase 4 (Titration Simulator) and Phase 5 (Kinetics
   Grapher) become its real consumers. Remove this export + its
   registerModule() call in features.js once Phase 4 ships.
   ===================================================================== */
export async function mountChartDemo(container) {
  container.innerHTML = `
    <div class="module-header" style="--mh-accent: var(--accent-sodium); --mh-accent-dim: var(--accent-sodium-dim);">
      <div class="mh-icon">📈</div>
      <div class="mh-text"><h2>Chart Engine Preview (dev)</h2><p>Temporary scaffold for Phase 3 — remove once the Titration Simulator / Kinetics Grapher land.</p></div>
    </div>
    <div class="card"><h3 style="margin-bottom:8px;">Simulated Titration Curve</h3><div id="chart-demo-titration" style="min-height:320px;"></div></div>
    <div class="card"><h3 style="margin-bottom:8px;">Simulated First-Order Decay (multi-series)</h3><div id="chart-demo-kinetics" style="min-height:320px;"></div></div>
  `;

  // Synthetic sigmoid titration curve (strong acid + strong base, 0.1M, 25 mL analyte)
  const titrationPts = [];
  for (let v = 0; v <= 50; v += 0.5) {
    const pH = 1 + 12 / (1 + Math.exp(-0.9 * (v - 25)));
    titrationPts.push({ x: v, y: Math.round(pH * 100) / 100 });
  }
  new LineChart(document.getElementById('chart-demo-titration'), {
    title: 'Strong Acid vs Strong Base',
    xLabel: 'Volume of NaOH added (mL)', yLabel: 'pH',
    series: [{ name: 'pH', points: titrationPts, pointRadius: 0 }],
    markers: [{ x: 25, label: 'Equivalence (25 mL)', color: 'var(--color-warning)' }],
    yDomain: [0, 14],
  });

  // Synthetic first-order decay, two different rate constants
  const decay = (k) => Array.from({ length: 21 }, (_, i) => ({ x: i, y: Math.round(100 * Math.exp(-k * i)) / 100 }));
  new LineChart(document.getElementById('chart-demo-kinetics'), {
    title: '[A] vs Time — First-Order Decay',
    xLabel: 'Time (s)', yLabel: 'Concentration (M)',
    series: [
      { name: 'k = 0.15 /s', points: decay(0.15), fill: true },
      { name: 'k = 0.35 /s', points: decay(0.35), fill: true },
    ],
  });
}