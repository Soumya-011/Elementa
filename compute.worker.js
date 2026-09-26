/* =====================================================================
   UNIVERSAL COMPUTE ROUTER (Background Thread)
   ===================================================================== */

// The worker listens for incoming messages from the main thread
self.onmessage = function(event) {
    const { action, payload, id } = event.data;
    
    try {
        switch(action) {
            case 'BALANCE_EQUATION':
                const result = executeMatrixBalancer(payload);
                self.postMessage({ id, status: 'success', data: result });
                break;
                
            // Future Roadmap Phase 3: Add KINETICS_INTEGRATION here
            // Future Roadmap Phase 3: Add ELECTROCHEM_SOLVER here

            default:
                throw new Error(`Unknown action routed to Web Worker: ${action}`);
        }
    } catch (error) {
        self.postMessage({ id, status: 'error', error: error.message });
    }
};

/* =====================================================================
   EXACT RATIONAL ARITHMETIC (BigInt-backed fractions)
   Gaussian elimination on the stoichiometric matrix needs exact division,
   not floats — floating point would accumulate rounding error and could
   silently produce a wrong-but-plausible-looking coefficient set on larger
   equations. Every intermediate value stays an exact fraction until the
   final "scale to smallest integers" step.
   ===================================================================== */
class Frac {
  constructor(n, d = 1n) {
    if (typeof n !== 'bigint') n = BigInt(n);
    if (typeof d !== 'bigint') d = BigInt(d);
    if (d === 0n) throw new Error('Division by zero while balancing.');
    if (d < 0n) { n = -n; d = -d; }
    const g = Frac.gcdBig(n < 0n ? -n : n, d);
    this.n = g === 0n ? 0n : n / g;
    this.d = g === 0n ? 1n : d / g;
  }
  static gcdBig(a, b) {
    a = a < 0n ? -a : a; b = b < 0n ? -b : b;
    while (b) { [a, b] = [b, a % b]; }
    return a === 0n ? 1n : a;
  }
  add(o) { return new Frac(this.n * o.d + o.n * this.d, this.d * o.d); }
  sub(o) { return new Frac(this.n * o.d - o.n * this.d, this.d * o.d); }
  mul(o) { return new Frac(this.n * o.n, this.d * o.d); }
  div(o) { if (o.n === 0n) throw new Error('Division by zero while balancing.'); return new Frac(this.n * o.d, this.d * o.n); }
  neg() { return new Frac(-this.n, this.d); }
  isZero() { return this.n === 0n; }
}

/* =====================================================================
   HEAVY ALGORITHMIC ENGINES
   ===================================================================== */

/**
 * Equation balancer.
 *
 * Builds the stoichiometric matrix (rows = elements, columns = terms;
 * reactant entries positive, product entries negative — so a valid
 * balance is exactly a null-space vector of this matrix), row-reduces it
 * with exact-fraction Gaussian elimination, and scales the resulting
 * 1-dimensional null space to the smallest positive integers.
 *
 * Previously this brute-forced every coefficient combination from 1 to 40
 * per term via nested-loop DFS — correct, but O(40^numTerms): an equation
 * with 5+ species (redox equations routinely have 5-6) could mean tens of
 * billions of combinations, which just hangs the worker thread indefinitely
 * with no error and no result. Gaussian elimination is O(elements * terms^2)
 * — effectively instant regardless of how many species are involved, and
 * has no arbitrary coefficient ceiling.
 */
function executeMatrixBalancer(equation) {
    const [lhsStr, rhsStr] = equation.split('=').map(s => s.trim());
    if (!lhsStr || !rhsStr) throw new Error("Equation must contain an '=' sign to separate reactants and products.");

    // Topology Parser specific to the worker
    const parseFormula = (formula) => {
        const counts = {};
        const stack = [{}];
        let i = 0;
        while (i < formula.length) {
            if (formula[i] === '(' || formula[i] === '[') {
                stack.push({});
                i++;
            } else if (formula[i] === ')' || formula[i] === ']') {
                const top = stack.pop();
                i++;
                let mult = "";
                while (i < formula.length && /[0-9]/.test(formula[i])) { mult += formula[i]; i++; }
                mult = mult ? parseInt(mult) : 1;
                for (let [el, count] of Object.entries(top)) {
                    stack[stack.length - 1][el] = (stack[stack.length - 1][el] || 0) + count * mult;
                }
            } else {
                let el = formula[i++];
                if (i < formula.length && /[a-z]/.test(formula[i])) el += formula[i++];
                let num = "";
                while (i < formula.length && /[0-9]/.test(formula[i])) { num += formula[i]; i++; }
                num = num ? parseInt(num) : 1;
                stack[stack.length - 1][el] = (stack[stack.length - 1][el] || 0) + num;
            }
        }
        return stack[0];
    };

    const parseSide = (sideStr, multiplier) => {
        return sideStr.split('+').map(term => {
            term = term.trim();
            const termMatch = term.match(/^(\d*)(.*)$/);
            let formula = termMatch[2];
            const counts = parseFormula(formula);
            for (let k in counts) counts[k] *= multiplier;
            return { term: formula, counts };
        });
    };

    const lhsTerms = parseSide(lhsStr, 1);
    const rhsTerms = parseSide(rhsStr, -1);
    const allTerms = [...lhsTerms, ...rhsTerms];
    const numTerms = allTerms.length;

    const elements = new Set();
    allTerms.forEach(t => Object.keys(t.counts).forEach(e => elements.add(e)));
    const uniqueElements = Array.from(elements);

    // Stoichiometric matrix as exact fractions (rows = elements, cols = terms).
    // Sign convention (reactant +, product -) already baked into t.counts by parseSide.
    const matrix = uniqueElements.map(el => allTerms.map(t => new Frac(t.counts[el] || 0)));

    // --- Gaussian elimination to row-reduced echelon form ---
    const rows = matrix.length;
    const pivotCols = [];
    let pivotRow = 0;
    for (let col = 0; col < numTerms && pivotRow < rows; col++) {
        let sel = -1;
        for (let r = pivotRow; r < rows; r++) {
            if (!matrix[r][col].isZero()) { sel = r; break; }
        }
        if (sel === -1) continue; // no pivot possible in this column — it's a free variable

        [matrix[pivotRow], matrix[sel]] = [matrix[sel], matrix[pivotRow]];
        const pivotVal = matrix[pivotRow][col];
        for (let c = 0; c < numTerms; c++) matrix[pivotRow][c] = matrix[pivotRow][c].div(pivotVal);
        for (let r = 0; r < rows; r++) {
            if (r === pivotRow) continue;
            const factor = matrix[r][col];
            if (factor.isZero()) continue;
            for (let c = 0; c < numTerms; c++) matrix[r][c] = matrix[r][c].sub(factor.mul(matrix[pivotRow][c]));
        }
        pivotCols.push(col);
        pivotRow++;
    }

    const freeCols = [];
    for (let c = 0; c < numTerms; c++) if (!pivotCols.includes(c)) freeCols.push(c);

    if (freeCols.length === 0) {
        throw new Error("No way to balance this equation — check that the same elements/species appear on both sides.");
    }
    if (freeCols.length > 1) {
        throw new Error("This equation has more than one independent way to balance — try specifying it more precisely.");
    }

    // Exactly one free variable (the normal case for a well-formed equation):
    // set it to 1 and back-substitute every pivot column from the RREF rows.
    const freeCol = freeCols[0];
    const x = new Array(numTerms).fill(null);
    x[freeCol] = new Frac(1n);
    for (let r = 0; r < pivotCols.length; r++) {
        x[pivotCols[r]] = matrix[r][freeCol].neg();
    }

    // Scale every coefficient to the smallest common integer (LCM of denominators),
    // then reduce by the GCD of the resulting integers to get the minimal solution.
    let lcmDen = 1n;
    for (const f of x) lcmDen = (lcmDen * f.d) / Frac.gcdBig(lcmDen, f.d);
    let ints = x.map(f => f.n * (lcmDen / f.d));

    let g = 0n;
    for (const v of ints) g = Frac.gcdBig(g, v < 0n ? -v : v);
    if (g > 1n) ints = ints.map(v => v / g);

    // A real balanced equation has every coefficient positive. The free
    // variable is always forced positive by our own +1 normalization above,
    // so if anything else comes out non-positive, this equation genuinely
    // can't be balanced as split into these reactants/products.
    if (ints.some(v => v <= 0n)) {
        throw new Error("Couldn't find a valid positive-coefficient balance — double check the reactants and products.");
    }

    const formatTerm = (formula, coeff) => (coeff === 1n ? "" : coeff.toString()) + formula;
    const lhsRes = lhsTerms.map((t, i) => formatTerm(t.term, ints[i])).join(" + ");
    const rhsRes = rhsTerms.map((t, i) => formatTerm(t.term, ints[lhsTerms.length + i])).join(" + ");

    return `${lhsRes} -> ${rhsRes}`;
}