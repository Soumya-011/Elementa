/**
 * orbital-math.js
 * Pure hydrogen-like atomic orbital math for Phase 6 (Orbital Visualization).
 * No DOM/WebGL dependency — kept separate from feat-orbitals.js so it is
 * directly unit-testable in plain Node.
 *
 * Units: Bohr radius a0 = 1. Standard hydrogen-atom wavefunction:
 *   psi_nlm(r,theta,phi) = R_nl(r) * Y_lm(theta,phi)
 * R_nl implemented via the general closed form (normalization constant x
 * associated Laguerre polynomial), verified against textbook closed forms
 * for 1s/2s/2p/3s/3p/3d in orbital-math.test.mjs before being trusted for
 * 4f (same formula, no separate hand-derived constant needed).
 * Angular shapes are written as unnormalized Cartesian polynomials (z, xy,
 * 3z^2-r^2, etc.) rather than the 1/r^l spherical-harmonic form — safe at
 * r=0, and since only RELATIVE density matters for rejection sampling, the
 * dropped normalization constants don't affect the visualization.
 */

function factorial(n) {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

/** Associated Laguerre polynomial L_k^alpha(x) via the standard 3-term recurrence. */
function assocLaguerre(k, alpha, x) {
  if (k === 0) return 1;
  if (k === 1) return 1 + alpha - x;
  let Lkm2 = 1;
  let Lkm1 = 1 + alpha - x;
  let Lk = 0;
  for (let i = 2; i <= k; i++) {
    Lk = ((2 * i - 1 + alpha - x) * Lkm1 - (i - 1 + alpha) * Lkm2) / i;
    Lkm2 = Lkm1;
    Lkm1 = Lk;
  }
  return Lk;
}

/** Radial wavefunction R_nl(r), a0=1. Can be negative — radial nodes are real sign changes. */
export function radialWavefunction(n, l, r) {
  if (n < 1 || l < 0 || l > n - 1) return NaN;
  const rho = (2 * r) / n;
  const norm = Math.sqrt(
    Math.pow(2 / n, 3) * factorial(n - l - 1) / (2 * n * factorial(n + l))
  );
  return norm * Math.exp(-r / n) * Math.pow(rho, l) * assocLaguerre(n - l - 1, 2 * l + 1, rho);
}

/** Number of radial nodes for (n,l) — the textbook rule n-l-1, used as a cross-check. */
export function expectedRadialNodeCount(n, l) {
  return n - l - 1;
}

/**
 * Registry of visualizable orbitals, grouped by type (s/p/d/f) per the Phase 6
 * decision. One representative n per shape beyond s (which also shows the
 * 1s->2s radial-node contrast) and p (shown at both n=2 and n=3).
 */
export const ORBITAL_LIBRARY = [
  { id: '1s', n: 1, l: 0, shape: 's', label: '1s', group: 's' },
  { id: '2s', n: 2, l: 0, shape: 's', label: '2s', group: 's' },
  { id: '3s', n: 3, l: 0, shape: 's', label: '3s', group: 's' },
  { id: '2pz', n: 2, l: 1, shape: 'pz', label: '2p₂', group: 'p' },
  { id: '2px', n: 2, l: 1, shape: 'px', label: '2pₓ', group: 'p' },
  { id: '2py', n: 2, l: 1, shape: 'py', label: '2pᵧ', group: 'p' },
  { id: '3pz', n: 3, l: 1, shape: 'pz', label: '3p₂', group: 'p' },
  { id: '3px', n: 3, l: 1, shape: 'px', label: '3pₓ', group: 'p' },
  { id: '3py', n: 3, l: 1, shape: 'py', label: '3pᵧ', group: 'p' },
  { id: '3dz2', n: 3, l: 2, shape: 'dz2', label: '3dᵣ²', group: 'd' },
  { id: '3dx2y2', n: 3, l: 2, shape: 'dx2y2', label: '3dₓ²₋ᵧ²', group: 'd' },
  { id: '3dxy', n: 3, l: 2, shape: 'dxy', label: '3dₓᵧ', group: 'd' },
  { id: '3dxz', n: 3, l: 2, shape: 'dxz', label: '3dₓᵨ', group: 'd' },
  { id: '3dyz', n: 3, l: 2, shape: 'dyz', label: '3dᵧᵨ', group: 'd' },
  { id: '4fz3', n: 4, l: 3, shape: 'fz3', label: '4fᵣ³', group: 'f' },
  { id: '4fxz2', n: 4, l: 3, shape: 'fxz2', label: '4fₓᵣ²', group: 'f' },
  { id: '4fyz2', n: 4, l: 3, shape: 'fyz2', label: '4fᵧᵣ²', group: 'f' },
  { id: '4fxyz', n: 4, l: 3, shape: 'fxyz', label: '4fₓᵧᵨ', group: 'f' },
  { id: '4fzx2y2', n: 4, l: 3, shape: 'fzx2y2', label: '4fᵣ(ₓ²₋ᵧ²)', group: 'f' },
  { id: '4fxx2y2', n: 4, l: 3, shape: 'fxx2y2', label: '4fₓ(ₓ²₋3ᵧ²)', group: 'f' },
  { id: '4fy3x2y2', n: 4, l: 3, shape: 'fy3x2y2', label: '4fᵧ(3ₓ²₋ᵧ²)', group: 'f' },
];

/** Unnormalized Cartesian angular polynomial for a given shape key. Can be negative. */
export function angularPolynomial(shape, x, y, z, r) {
  switch (shape) {
    case 's': return 1;
    case 'pz': return z;
    case 'px': return x;
    case 'py': return y;
    case 'dz2': return 3 * z * z - r * r;
    case 'dx2y2': return x * x - y * y;
    case 'dxy': return x * y;
    case 'dxz': return x * z;
    case 'dyz': return y * z;
    case 'fz3': return z * (5 * z * z - 3 * r * r);
    case 'fxz2': return x * (5 * z * z - r * r);
    case 'fyz2': return y * (5 * z * z - r * r);
    case 'fxyz': return x * y * z;
    case 'fzx2y2': return z * (x * x - y * y);
    case 'fxx2y2': return x * (x * x - 3 * y * y);
    case 'fy3x2y2': return y * (3 * x * x - y * y);
    default: return NaN;
  }
}

/**
 * Full wavefunction value psi(x,y,z) = R_nl(r) * Y_shape(theta,phi). Sign = phase.
 *
 * angularPolynomial() returns a homogeneous Cartesian polynomial of degree l (e.g. dz2 =
 * 3z^2-r^2 is degree 2), which already equals r^l * (pure angular shape). radialWavefunction()
 * ALSO already contains its own r^l factor (the standard (2r/n)^l term from the hydrogen
 * radial formula). Multiplying them directly would double-count that r^l factor for any l>=1
 * orbital (p/d/f) — caught by a point-cloud sampling-efficiency check during testing, not by
 * the closed-form radial tests alone, since those only exercised radialWavefunction() in
 * isolation. Dividing the polynomial by r^l here removes the duplicate, leaving the correct,
 * single r^l dependence (the one already inside radialWavefunction). At r=0 the true
 * wavefunction is exactly 0 for any l>=1 orbital (physically correct — p/d/f orbitals vanish
 * at the nucleus), handled explicitly to avoid a 0/0 division.
 */
export function waveFunctionValue(entry, x, y, z) {
  const r = Math.sqrt(x * x + y * y + z * z);
  const radial = radialWavefunction(entry.n, entry.l, r);
  if (entry.l === 0) return radial * angularPolynomial(entry.shape, x, y, z, r); // polynomial is the constant 1
  if (r < 1e-9) return 0;
  const angular = angularPolynomial(entry.shape, x, y, z, r) / Math.pow(r, entry.l);
  return radial * angular;
}

export function probabilityDensity(entry, x, y, z) {
  const psi = waveFunctionValue(entry, x, y, z);
  return psi * psi;
}

/** Deterministic small PRNG (mulberry32) — same generator used in feat-kinetics.js, for reproducible point clouds. */
function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Heuristic bounding radius (a0 units) generous enough for n up to 4. */
export function suggestedMaxRadius(n) {
  return n * n * 6 + 6;
}

/**
 * Sample a point cloud from |psi|^2 using two-stage sampling rather than naive 3D rejection
 * in a Cartesian cube. A uniform-cube rejection sampler is extremely inefficient here: s-orbital
 * density peaks sharply at the nucleus (r=0), so almost every randomly placed Cartesian point
 * lands far from that peak and gets rejected (measured acceptance ~0.0001 during testing,
 * which starved the sampler before it reached the requested point count). The standard fix,
 * used here: sample the radial coordinate r via 1D rejection against the radial distribution
 * r^2*R_nl(r)^2 (smooth, finite max, cheap), then sample a direction uniformly on the unit
 * sphere and rejection-test it against the angular shape's own max — two easy low-dimensional
 * rejections instead of one very inefficient 3D one.
 * @returns {{points: Array<{x,y,z,sign:1|-1}>, acceptanceRate: number}}
 */
export function generateOrbitalPointCloud({ entry, numPoints, maxRadius, seed = 1, radialGridSteps = 500, angularGridSteps = 50, maxIterationsFactor = 2000 }) {
  const rng = makeRng(seed);
  const { n, l, shape } = entry;

  // Stage 1 prep: max of the radial weight r^2*R_nl(r)^2 over [0, maxRadius].
  let maxRadialWeight = 0;
  for (let i = 0; i <= radialGridSteps; i++) {
    const r = (maxRadius * i) / radialGridSteps;
    const Rval = radialWavefunction(n, l, r);
    const w = r * r * Rval * Rval;
    if (w > maxRadialWeight) maxRadialWeight = w;
  }
  maxRadialWeight *= 1.1;

  // Stage 2 prep: max of the angular shape squared over the unit sphere (r=1, so no r^l division needed).
  let maxAngularSq = 0;
  for (let i = 0; i <= angularGridSteps; i++) {
    const theta = (Math.PI * i) / angularGridSteps;
    for (let j = 0; j <= angularGridSteps; j++) {
      const phi = (2 * Math.PI * j) / angularGridSteps;
      const ax = Math.sin(theta) * Math.cos(phi), ay = Math.sin(theta) * Math.sin(phi), az = Math.cos(theta);
      const av = angularPolynomial(shape, ax, ay, az, 1);
      if (av * av > maxAngularSq) maxAngularSq = av * av;
    }
  }
  maxAngularSq *= 1.1;

  if (!(maxRadialWeight > 0) || !(maxAngularSq > 0)) return { points: [], acceptanceRate: 0 };

  const points = [];
  const maxIterations = numPoints * maxIterationsFactor;
  let iterations = 0;
  while (points.length < numPoints && iterations < maxIterations) {
    iterations++;

    const rCandidate = rng() * maxRadius;
    const Rval = radialWavefunction(n, l, rCandidate);
    const radialWeight = rCandidate * rCandidate * Rval * Rval;
    if (rng() * maxRadialWeight >= radialWeight) continue;

    const costheta = rng() * 2 - 1;
    const sintheta = Math.sqrt(1 - costheta * costheta);
    const phi = rng() * 2 * Math.PI;
    const ax = sintheta * Math.cos(phi), ay = sintheta * Math.sin(phi), az = costheta;
    const av = angularPolynomial(shape, ax, ay, az, 1);
    if (rng() * maxAngularSq >= av * av) continue;

    const sign = (Rval >= 0 ? 1 : -1) * (av >= 0 ? 1 : -1);
    points.push({ x: rCandidate * ax, y: rCandidate * ay, z: rCandidate * az, sign });
  }
  return { points, acceptanceRate: points.length / iterations };
}
