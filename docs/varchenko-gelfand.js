import {maskIndices} from './math.js';

// Supports fit in 21 bits (20 affine lines and the plane at infinity).
const bit = i => 1 << i;
const maskOf = indices => indices.reduce((mask, i) => mask | bit(i), 0);
const signMask = signs => signs.reduce((mask, sign, i) => sign > 0 ? mask | bit(i) : mask, 0);
const contains = (mask, subset) => (mask & subset) === subset;

function degree(mask) {
  let count = 0;
  for (; mask; mask &= mask - 1) count++;
  return count;
}

function* subsets(indices, size, start = 0, prefix = []) {
  if (!size) {
    yield prefix;
    return;
  }
  for (let i = start; i <= indices.length - size; i++) {
    yield* subsets(indices, size - 1, i + 1, [...prefix, indices[i]]);
  }
}

function* circuitSupports(data, mode, order) {
  const infinity = data.n;
  const triples = new Map();
  const finiteTriples = new Set();
  for (const vertex of data.vertices) {
    for (const support of subsets(vertex.lines, 3)) {
      const mask = maskOf(support);
      triples.set(mask, support);
      finiteTriples.add(mask);
    }
  }
  const parallel = new Map();
  data.lines.forEach(([a, b], i) => {
    // normalizeLine fixes the direction representative across a parallel class.
    const direction = [a, b].join(',');
    if (!parallel.has(direction)) parallel.set(direction, []);
    parallel.get(direction).push(i);
  });
  for (const group of parallel.values()) {
    for (const support of subsets([infinity, ...group], 3)) {
      triples.set(maskOf(support), support);
    }
  }
  for (const [mask, support] of triples) {
    if (mode === 'cone' || finiteTriples.has(mask) || support[0] === infinity) yield support;
  }

  // The cone has no proportional normals, and its rank is at most three.
  // Four elements form a circuit precisely when all their triples are independent.
  // In the affine presentation, the relevant quadruples contain infinity and
  // give the minimal empty triples; finite quadruples add no NBC reductions.
  const candidates = mode === 'cone' ? subsets(order, 4) : subsets(order, 3, 0, [infinity]);
  for (const support of candidates) {
    const mask = maskOf(support);
    if (support.every(i => !triples.has(mask ^ bit(i)))) yield support;
  }
}

function circuitSigns(support, coneMasks) {
  const patternCount = 1 << support.length;
  let realized = 0;
  for (const mask of coneMasks) {
    let pattern = 0;
    for (let i = 0; i < support.length; i++) {
      if (mask & bit(support[i])) pattern |= bit(i);
    }
    realized |= bit(pattern);
  }
  // Restricting chambers to a circuit realizes all strict sign assignments
  // except the two opposite circuit signs. Orient the first element positively.
  for (let pattern = 1; pattern < patternCount; pattern += 2) {
    const opposite = pattern ^ (patternCount - 1);
    if ((realized | bit(pattern) | bit(opposite)) === bit(patternCount) - 1 &&
        !(realized & (bit(pattern) | bit(opposite)))) {
      return support.map((_, i) => pattern & bit(i) ? 1 : -1);
    }
  }
  throw Error('符号付き circuit を chamber の符号から確認できません');
}

function addTerm(terms, mask, coefficient) {
  const total = (terms.get(mask) || 0n) + coefficient;
  if (total) terms.set(mask, total);
  else terms.delete(mask);
}

function addPattern(terms, support, signs, polarity, coefficient) {
  let required = 0;
  let optional = 0;
  support.forEach((i, j) => {
    if (signs[j] === polarity) required |= bit(i);
    else optional |= bit(i);
  });
  // Expand the signed product: x_i on a positive side, x_i - 1 on a negative side.
  for (let chosen = optional; ; chosen = (chosen - 1) & optional) {
    const sign = degree(optional ^ chosen) % 2 ? -1n : 1n;
    addTerm(terms, required | chosen, coefficient * sign);
    if (!chosen) break;
  }
}

function polynomialRelations(data, mode, order, coneMasks) {
  const idempotents = order.map(i => ({
    kind: 'idempotent', support: [i],
    terms: [{mask: bit(i), square: i, coefficient: 1n}, {mask: bit(i), coefficient: -1n}]
  }));
  const filtered = idempotents.slice();
  const graded = idempotents.map(relation => ({...relation, terms: relation.terms.slice(0, 1)}));

  for (const circuit of circuitSupports(data, mode, order)) {
    const circuitSign = circuitSigns(circuit, coneMasks);
    const empty = mode === 'affine' && circuit[0] === data.n;
    // x_∞ = 1 specializes the signed cone relation to a single forbidden pattern.
    const support = empty ? circuit.slice(1) : circuit;
    const signs = empty ? circuitSign.slice(1) : circuitSign;
    const kind = empty ? 'empty' : 'circuit';
    const leadingMask = maskOf(circuit.slice(1));
    const polynomial = new Map();
    addPattern(polynomial, support, signs, 1, 1n);
    if (!empty) addPattern(polynomial, support, signs, -1, -1n);

    const terms = [...polynomial].map(([mask, coefficient]) => ({mask, coefficient}))
      .sort((a, b) => degree(b.mask) - degree(a.mask) || a.mask - b.mask);
    const relation = {kind, support, signs, leadingMask, terms};
    filtered.push(relation);
    graded.push({...relation, terms: terms.filter(term => degree(term.mask) === degree(leadingMask))});
  }
  return {filtered, graded};
}

function makeReducer(filtered, basis) {
  const rules = new Map();
  for (const {leadingMask, terms} of filtered) {
    if (leadingMask === undefined || rules.has(leadingMask)) continue;
    if (terms.find(term => term.mask === leadingMask)?.coefficient !== 1n) {
      throw Error('NBC の簡約関係式がモニックではありません');
    }
    rules.set(leadingMask, terms.filter(term => term.mask !== leadingMask));
  }
  const brokenCircuits = [...rules.keys()];
  const reductions = new Map(basis.map(({mask}) => [mask, new Map([[mask, 1n]])]));

  function reduce(mask) {
    if (reductions.has(mask)) return reductions.get(mask);
    const leading = brokenCircuits.find(broken => contains(mask, broken));
    if (leading === undefined) throw Error('NBC 単項式の簡約を確認できません');
    const remainder = mask ^ leading;
    const result = new Map();
    // Each substitution lowers degree, or exchanges a larger element for
    // the least element of its circuit. OR imposes the filtered idempotents.
    for (const term of rules.get(leading)) {
      for (const [basisMask, value] of reduce(remainder | term.mask)) {
        addTerm(result, basisMask, -term.coefficient * value);
      }
    }
    reductions.set(mask, result);
    return result;
  }
  return reduce;
}

const cache = new WeakMap();

/** Integer Heaviside functions and their associated graded algebra. */
export function varchenkoGelfand(data, mode = 'affine') {
  if (mode !== 'affine' && mode !== 'cone') throw Error('VG mode must be affine or cone.');
  if (!cache.has(data)) cache.set(data, new Map());
  const cached = cache.get(data);
  if (cached.has(mode)) return cached.get(mode);

  const cone = mode === 'cone';
  const infinity = data.n;
  const affineOrder = Array.from({length: data.n}, (_, i) => i);
  const order = cone ? [infinity, ...affineOrder] : affineOrder;
  const labels = affineOrder.map(i => 'H' + (i + 1));
  if (cone) labels.push('H∞');

  const affine = data.cells.map(({id, signs}) => ({id, signs: signs.slice(), mask: signMask(signs)}));
  const fullConeMask = bit(data.n + 1) - 1;
  const positiveMasks = affine.map(chamber => chamber.mask | bit(infinity));
  const negativeMasks = positiveMasks.map(mask => mask ^ fullConeMask);
  const chambers = cone
    ? affine.map(({id, signs}, i) => ({
        id: id + '⁺', affineId: id, signs: [...signs, 1], chart: 1, mask: positiveMasks[i]
      })).concat(affine.map(({id, signs}, i) => ({
        id: id + '⁻', affineId: id, signs: [...signs.map(sign => -sign), -1], chart: -1, mask: negativeMasks[i]
      })))
    : affine;
  const {filtered, graded} = polynomialRelations(data, mode, order, [...positiveMasks, ...negativeMasks]);
  const brokenCircuits = [...new Set(filtered.map(relation => relation.leadingMask)
    .filter(mask => mask !== undefined))];
  const affineRank = data.b2 ? 2 : data.n ? 1 : 0;
  const rank = affineRank + Number(cone);
  const hilbert = Array(rank + 1).fill(0);
  const basis = [];
  for (let d = 0; d <= rank; d++) {
    for (const indices of subsets(order, d)) {
      const mask = maskOf(indices);
      if (brokenCircuits.some(broken => contains(mask, broken))) continue;
      basis.push({mask, indices, degree: d});
      hilbert[d]++;
    }
  }
  if (basis.length !== chambers.length) throw Error('NBC 基底の個数と chamber 数が一致しません');

  const byBasis = new Map(basis.map((term, i) => [term.mask, i]));
  const byChamber = new Set(chambers.map(chamber => chamber.mask));
  const reduce = makeReducer(filtered, basis);
  const basisTerms = terms => [...terms].sort(([a], [b]) => byBasis.get(a) - byBasis.get(b))
    .map(([mask, coefficient]) => ({mask, coefficient}));

  function requireBasis(mask) {
    if (!byBasis.has(mask)) throw Error('未知の NBC 基底元です');
  }

  function product(left, right, ring = 'filtered') {
    requireBasis(left);
    requireBasis(right);
    if (ring === 'filtered') return basisTerms(reduce(left | right));
    if (ring !== 'graded') throw Error('VG ring must be filtered or graded.');
    const productDegree = degree(left) + degree(right);
    const support = left | right;
    if (productDegree > rank || degree(support) !== productDegree) return [];
    // In the associated graded ring only the top filtration-degree terms survive.
    return basisTerms(reduce(support)).filter(term => degree(term.mask) === productDegree);
  }

  function toChambers(mask) {
    requireBasis(mask);
    return chambers.filter(chamber => contains(chamber.mask, mask))
      .map(chamber => ({mask: chamber.mask, coefficient: 1n}));
  }

  function toNBC(mask) {
    if (!byChamber.has(mask)) throw Error('未知の chamber です');
    // A chamber indicator is the product of x_i or 1-x_i according to its signs.
    // Start with its positive factors, then reduce after each complement to
    // avoid expanding up to 2^n monomials before cancellation.
    let terms = reduce(mask);
    const negative = maskIndices(mask ^ (bit(order.length) - 1), order.length);
    for (const i of negative) {
      const next = new Map(terms);
      for (const [basisMask, coefficient] of terms) {
        for (const [outputMask, value] of reduce(basisMask | bit(i))) {
          addTerm(next, outputMask, -coefficient * value);
        }
      }
      terms = next;
    }
    return basisTerms(terms);
  }

  function indicatorGrading(mask) {
    const terms = toNBC(mask);
    const components = Array.from({length: rank + 1}, () => []);
    let filtrationDegree = 0;
    for (const term of terms) {
      const d = degree(term.mask);
      components[d].push(term);
      filtrationDegree = Math.max(filtrationDegree, d);
    }
    return {terms, filtrationDegree, components: components.slice(0, filtrationDegree + 1)};
  }

  const result = {
    mode, labels, order, chambers, basis, hilbert,
    filteredRelations: filtered, gradedRelations: graded, product, toChambers, toNBC, indicatorGrading
  };
  cached.set(mode, result);
  return result;
}
