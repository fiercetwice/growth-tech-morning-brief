import test from 'node:test';
import assert from 'node:assert/strict';
import { extractAnnualVintages, extractQuarterlyVintages } from '../src/sources/sec.js';

// Regression tests for the real V (Visa) production bug: multi-class share
// structures (Visa reports separate diluted EPS for Class A/B/C common
// stock, with no single blended figure in the primary statements) mean the
// SEC companyfacts API can have zero entries for the undimensioned
// EarningsPerShareDiluted concept, even for a completely standard,
// fully-compliant 10-K/10-Q filer. Without a fallback this silently produces
// secAvailable=true but targetAvailable=false forever. These tests use a
// synthetic usgaap fixture with NO EarningsPerShareDiluted fact at all -
// mirroring what a multi-class filer's companyfacts response can look like -
// to prove the net-income-derived fallback actually kicks in.

function annualUnits(vals) {
  return { units: { USD: vals.map(([fy, val]) => ({
    fy, fp: 'FY', form: '10-K', start: `${fy - 1}-01-01`, end: `${fy}-12-31`, filed: `${fy + 1}-02-15`, val,
  })) } };
}
function annualSharesUnits(vals) {
  return { units: { shares: vals.map(([fy, val]) => ({
    fy, fp: 'FY', form: '10-K', start: `${fy - 1}-01-01`, end: `${fy}-12-31`, filed: `${fy + 1}-02-15`, val,
  })) } };
}

test('extractAnnualVintages derives EPS from NetIncomeLoss / diluted shares when EarningsPerShareDiluted is entirely absent', () => {
  const usgaap = {
    Revenues: annualUnits([[2024, 29000]]),
    NetIncomeLoss: annualUnits([[2024, 15000]]),
    WeightedAverageNumberOfDilutedSharesOutstanding: annualSharesUnits([[2024, 2000]]),
    // No EarningsPerShareDiluted key at all - the multi-class scenario.
  };
  const annual = extractAnnualVintages(usgaap);
  assert.equal(annual.length, 1);
  assert.equal(annual[0].epsPerShare, 7.5); // 15000 / 2000
  assert.equal(annual[0].epsDerived, true);
});

test('extractAnnualVintages prefers the real EarningsPerShareDiluted tag when it IS present (no behavior change for ordinary single-class filers)', () => {
  const usgaap = {
    Revenues: annualUnits([[2024, 29000]]),
    EarningsPerShareDiluted: annualUnits([[2024, 6.0]]),
    NetIncomeLoss: annualUnits([[2024, 15000]]),
    WeightedAverageNumberOfDilutedSharesOutstanding: annualSharesUnits([[2024, 2000]]),
  };
  const annual = extractAnnualVintages(usgaap);
  assert.equal(annual.length, 1);
  // 6.0 from the real tag, NOT 7.5 from net-income/shares - the real tag
  // always wins when it exists, since it correctly reflects buybacks,
  // preferred dividends, etc. that a naive net-income/shares calc would miss.
  assert.equal(annual[0].epsPerShare, 6.0);
  assert.equal(annual[0].epsDerived, false);
});

test('extractQuarterlyVintages derives EPS from NetIncomeLoss / diluted shares when EarningsPerShareDiluted is entirely absent', () => {
  const q1 = { fy: 2025, fp: 'Q1', form: '10-Q', start: '2025-01-01', end: '2025-03-31', filed: '2025-05-01' };
  const usgaap = {
    Revenues: { units: { USD: [{ ...q1, val: 8000 }] } },
    NetIncomeLoss: { units: { USD: [{ ...q1, val: 4000 }] } },
    WeightedAverageNumberOfDilutedSharesOutstanding: { units: { shares: [{ ...q1, val: 2000 }] } },
  };
  const q = extractQuarterlyVintages(usgaap);
  const row = q.find(x => x.fp === 'Q1');
  assert.ok(row, 'Q1 row should exist');
  assert.equal(row.epsPerShare, 2); // 4000 / 2000
  assert.equal(row.epsDerived, true);
});

test('extractAnnualVintages does not derive EPS when diluted shares are missing (no divide-by-zero, no fabricated value)', () => {
  const usgaap = {
    Revenues: annualUnits([[2024, 29000]]),
    NetIncomeLoss: annualUnits([[2024, 15000]]),
    // No WeightedAverageNumberOfDilutedSharesOutstanding at all.
  };
  const annual = extractAnnualVintages(usgaap);
  assert.equal(annual.length, 1);
  assert.equal(annual[0].epsPerShare, null);
  assert.equal(annual[0].epsDerived, false);
});
