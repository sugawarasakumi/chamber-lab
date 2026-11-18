import assert from 'node:assert/strict';
import {arrangement, PRESETS, q, QQ, rref} from './docs/math.js';
import {varchenkoGelfand} from './docs/varchenko-gelfand.js';

const contains = (mask, support) => (mask & support) === support;
const indices = (mask, n) => Array.from({length: n}, (_, i) => i).filter(i => mask & 2 ** i);
const supportMask = support => support.reduce((mask, i) => mask + 2 ** i, 0);
const signMask = signs => supportMask(signs.flatMap((sign, i) => sign > 0 ? [i] : []));
const sorted = masks => [...masks].sort((a, b) => a - b);
const preset = id => PRESETS.find(p => p.id === id).lines;
const fixtures = [
  {name: 'empty', lines: [], hilbert: [1]},
  {name: 'single', lines: [[1, 0, 0]], hilbert: [1, 1]},
  {name: 'parallel', lines: [[1, 0, 0], [1, 0, -1]], hilbert: [1, 2]},
  {name: 'crossing', lines: [[1, 0, 0], [0, 1, 0]], hilbert: [1, 2, 1]},
  {name: 'pencil', lines: [[1, 0, 0], [0, 1, 0], [1, 1, 0]], hilbert: [1, 3, 2]},
  {name: 'triangle', lines: preset('triangle'), hilbert: [1, 3, 3]},
  {name: 'A3', lines: preset('a3'), hilbert: [1, 5, 6]},
  {name: 'grid', lines: preset('grid'), hilbert: [1, 6, 9]},
  {name: 'exact real field', lines: [[1, 0, 0], [0, 1, 0], [1, '-sqrt(2)', 0], [1, 'sqrt(2)', -1]], hilbert: [1, 4, 5]}
];

// Derive all minimal dependencies by exhaustive exact row ranks on small
// fixtures, independently of geometric flat enumeration or NBC reduction.
function independentNBC(data, cone) {
  const normals = cone ? [...data.lines, [q(0), q(0), q(1)]] : data.lines;
  const n = normals.length;
  const count = 2 ** n;
  const dependency = Array.from({length: count}, (_, mask) => {
    const rows = indices(mask, n).map(i => normals[i]);
    const rank = rref(rows, QQ, 3).rank;
    if (!cone && rref(rows.map(row => row.slice(0, 2)), QQ, 2).rank < rank) return 'empty';
    return rank < rows.length ? 'circuit' : null;
  });
  const minimal = new Map();
  const forbidden = [];
  for (let mask = 1; mask < count; mask++) {
    if (!dependency[mask]) continue;
    const bits = indices(mask, n);
    if (bits.some(i => dependency[mask ^ 2 ** i])) continue;
    minimal.set(mask, dependency[mask]);
    // Cone uses H∞ first in the NBC order, with the same generator index as in the app.
    const first = cone && bits.includes(n - 1) ? n - 1 : bits[0];
    forbidden.push(dependency[mask] === 'empty' ? mask : mask ^ 2 ** first);
  }
  const basis = Array.from({length: count}, (_, mask) => mask)
    .filter(mask => !forbidden.some(support => contains(mask, support)));
  return {basis, minimal};
}

function coefficients(terms, sign = 1n) {
  return Object.fromEntries(terms.map(({mask, coefficient, square}) =>
    [square === undefined ? String(mask) : `${mask}:${square}`, sign * coefficient]));
}

function equalUpToSign(actual, expected, label) {
  const first = actual[0];
  assert(first, label);
  const sign = expected[first.square === undefined ? first.mask : `${first.mask}:${first.square}`] === first.coefficient ? 1n : -1n;
  assert.deepEqual(coefficients(actual, sign), expected, label);
}

function signedProduct(support, positive, n) {
  const coefficients = {};
  const negative = support ^ positive;
  for (let mask = negative;; mask = (mask - 1) & negative) {
    coefficients[positive | mask] = indices(mask, n).length % 2 ? -1n : 1n;
    if (!mask) break;
  }
  return coefficients;
}

const evaluate = (terms, chamberMask) => terms.reduce((value, term) =>
  value + (contains(chamberMask, term.mask) ? term.coefficient : 0n), 0n);

function checkPresentation(vg, minimal, label) {
  const n = vg.labels.length;
  assert.equal(vg.filteredRelations.length, n + minimal.size, label);
  assert.equal(vg.gradedRelations.length, n + minimal.size, label);
  const gradedBySupport = new Map(vg.gradedRelations.map(relation =>
    [supportMask(relation.support), relation]));
  const checked = new Set();
  for (const filtered of vg.filteredRelations) {
    const support = supportMask(filtered.support);
    assert(!checked.has(support), label);
    checked.add(support);
    const graded = gradedBySupport.get(support);
    assert(graded, label);
    assert.equal(graded.kind, filtered.kind, label);
    assert(vg.chambers.every(chamber => evaluate(filtered.terms, chamber.mask) === 0n), label);
    if (filtered.kind === 'idempotent') {
      assert.equal(filtered.support.length, 1, label);
      const square = `${support}:${filtered.support[0]}`;
      equalUpToSign(filtered.terms, {[square]: 1n, [support]: -1n}, label);
      equalUpToSign(graded.terms, {[square]: 1n}, label);
      continue;
    }
    assert.equal(filtered.kind, minimal.get(support), label);
    const observed = new Set(vg.chambers.map(chamber => chamber.mask & support));
    const missing = [];
    for (let mask = support;; mask = (mask - 1) & support) {
      if (!observed.has(mask)) missing.push(mask);
      if (!mask) break;
    }
    assert.equal(missing.length, filtered.kind === 'empty' ? 1 : 2, label);
    const expected = signedProduct(support, missing[0], n);
    if (filtered.kind === 'circuit') {
      assert.equal(missing[0] ^ missing[1], support, label);
      const opposite = signedProduct(support, missing[1], n);
      const factor = -expected[support] * opposite[support];
      for (const [mask, coefficient] of Object.entries(opposite)) {
        expected[mask] = (expected[mask] ?? 0n) + factor * coefficient;
        if (!expected[mask]) delete expected[mask];
      }
    }
    equalUpToSign(filtered.terms, expected, label);
    const degree = Math.max(...Object.keys(expected).map(mask => indices(Number(mask), n).length));
    const homogeneous = Object.fromEntries(Object.entries(expected)
      .filter(([mask]) => indices(Number(mask), n).length === degree));
    equalUpToSign(graded.terms, homogeneous, label);
  }
}

function checkProductsAndBasisChange(vg, label) {
  const degreeByMask = new Map(vg.basis.map(monomial => [monomial.mask, monomial.degree]));
  for (const monomial of vg.basis) {
    const expected = vg.chambers.filter(chamber => contains(chamber.mask, monomial.mask));
    assert.deepEqual(coefficients(vg.toChambers(monomial.mask)),
      Object.fromEntries(expected.map(chamber => [chamber.mask, 1n])), label);
  }
  for (const chamber of vg.chambers) {
    const expansion = vg.toNBC(chamber.mask);
    assert(expansion.every(term => degreeByMask.has(term.mask) && typeof term.coefficient === 'bigint'), label);
    for (const target of vg.chambers) {
      assert.equal(evaluate(expansion, target.mask), target.mask === chamber.mask ? 1n : 0n, label);
    }
  }
  for (const [i, left] of vg.basis.entries()) {
    for (const right of vg.basis.slice(i)) {
      const degree = left.degree + right.degree;
      const product = vg.product(left.mask, right.mask, 'filtered');
      assert(product.every(term => degreeByMask.get(term.mask) <= degree && typeof term.coefficient === 'bigint'), label);
      for (const chamber of vg.chambers) {
        assert.equal(evaluate(product, chamber.mask), contains(chamber.mask, left.mask | right.mask) ? 1n : 0n, label);
      }
      const top = product.filter(term => degreeByMask.get(term.mask) === degree);
      assert.deepEqual(coefficients(vg.product(left.mask, right.mask, 'graded')), coefficients(top), label);
      assert.deepEqual(coefficients(vg.product(right.mask, left.mask, 'filtered')), coefficients(product), label);
    }
  }
}

for (const {name, lines, hilbert} of fixtures) {
  const data = arrangement(lines);
  for (const mode of ['affine', 'cone']) {
    const cone = mode === 'cone';
    const label = `${name} (${mode})`;
    const vg = varchenkoGelfand(data, mode);
    const expectedChambers = data.cells.map(chamber => signMask(chamber.signs));
    if (cone) {
      const infinity = 2 ** data.n;
      expectedChambers.push(...expectedChambers.map(mask => (infinity - 1) ^ mask));
      for (let i = 0; i < data.cells.length; i++) expectedChambers[i] |= infinity;
    }
    assert.deepEqual(sorted(vg.chambers.map(chamber => chamber.mask)), sorted(expectedChambers), label);
    assert(vg.chambers.every(chamber => signMask(chamber.signs) === chamber.mask), label);
    assert.equal(vg.labels.length, data.n + Number(cone), label);
    const {basis, minimal} = independentNBC(data, cone);
    assert.deepEqual(sorted(vg.basis.map(monomial => monomial.mask)), basis, label);
    assert.equal(vg.basis.length, vg.chambers.length, label);
    const expectedHilbert = cone ? [...hilbert, 0].map((count, i) => count + (hilbert[i - 1] ?? 0)) : hilbert;
    assert.deepEqual(vg.hilbert, expectedHilbert, label);
    for (const monomial of vg.basis) {
      assert.deepEqual(sorted(monomial.indices), indices(monomial.mask, vg.labels.length), label);
      assert.equal(monomial.degree, monomial.indices.length, label);
    }
    checkPresentation(vg, minimal, label);
    checkProductsAndBasisChange(vg, label);
  }
}

const parallel = varchenkoGelfand(arrangement(fixtures.find(f => f.name === 'parallel').lines));
assert.deepEqual(coefficients(parallel.product(1, 2, 'filtered')), {2: 1n});
assert.deepEqual(parallel.product(1, 2, 'graded'), []);
assert.deepEqual(coefficients(parallel.product(2, 2, 'filtered')), {2: 1n});
assert.deepEqual(parallel.product(2, 2, 'graded'), []);

const pencil = varchenkoGelfand(arrangement(fixtures.find(f => f.name === 'pencil').lines));
assert.deepEqual(coefficients(pencil.product(2, 4, 'filtered')), {3: 1n, 5: -1n, 4: 1n});
assert.deepEqual(coefficients(pencil.product(2, 4, 'graded')), {3: 1n, 5: -1n});

const nonadapted = arrangement(preset('a3'), [-2, 5, -1]);
assert.equal(nonadapted.adapted, false);
for (const mode of ['affine', 'cone']) {
  const movedFlag = varchenkoGelfand(nonadapted, mode);
  const standard = varchenkoGelfand(arrangement(preset('a3')), mode);
  assert.deepEqual(movedFlag.basis, standard.basis);
  for (const chamber of movedFlag.chambers) {
    assert.deepEqual(coefficients(movedFlag.toNBC(chamber.mask)), coefficients(standard.toNBC(chamber.mask)));
  }
}

console.log('Varchenko–Gelfand: exact affine/cone presentations, independently derived NBC bases, integral products and chamber basis changes on nine fixtures, and flag independence passed.');
