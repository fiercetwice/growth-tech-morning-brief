import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPointInTimeValuation } from '../src/engines/valuation.js';
import { buildTargetModel } from '../src/engines/target.js';

test('valuation uses only filed vintages available at each price date', () => {
  const day = 86400000;
  const t0 = Date.parse('2025-01-01');
  const priceRows = Array.from({ length: 300 }, (_, i) => ({
    timeMs: t0 + i * day,
    close: 20 + i * 0.01,
    adjustedClose: 20 + i * 0.01,
  }));
  const filingVintages = [
    { filed: '2025-01-15', epsPerShare: 2, revenuePerShare: 10 },
    { filed: '2025-07-15', epsPerShare: 2.5, revenuePerShare: 11 },
  ];
  const v = buildPointInTimeValuation({ priceRows, filingVintages });
  assert.ok(v.pe.observations > 200);
  assert.ok(v.pe.p25 <= v.pe.p50);
  assert.ok(v.pe.p50 <= v.pe.p75);
  assert.equal(v.filingVintageCount, 2);
});

test('split normalization adjusts old per-share data', () => {
  const t = Date.parse('2025-06-01');
  const rows = Array.from({ length: 130 }, (_, i) => ({ timeMs: t + i * 86400000, adjustedClose: 100 }));
  const v = buildPointInTimeValuation({
    priceRows: rows,
    filingVintages: [{ filed: '2025-01-01', epsPerShare: 10, revenuePerShare: 50 }],
    splits: [{ timeMs: Date.parse('2025-03-01'), ratio: 2 }],
  });
  assert.equal(v.pe.current, 20); // EPS normalized from 10 to 5 after 2:1 split
});

test('target model prefers PE when profitable', () => {
  const target = buildTargetModel({
    lastPrice: 100,
    valuation: {
      filingVintageCount: 4,
      pe: { observations: 800, p25: 20, p50: 25, p75: 30 },
      ps: { observations: 800, p25: 5, p50: 7, p75: 9 },
    },
    fundamentals: { latestAnnual: { epsPerShareAdjusted: 5, revenuePerShareAdjusted: 20 } },
  });
  assert.equal(target.available, true);
  assert.equal(target.method, 'PE');
  assert.equal(target.base, 125);
  assert.equal(target.confidence, 'high');
});

// Regression tests for the real MARA/SMCI production bug: a barely-profitable
// TTM quarter (near-zero EPS) inside the 5-year price window inflates the P/E
// percentile distribution to absurd levels, and buildTargetModel then
// multiplies that inflated p50 by the current EPS to produce a nonsense
// "target" - the live report on 2026-09-06 showed 5,849% and 2,009% "upside"
// for these two tickers, which is what these tests reproduce and fix.

test('valuation excludes near-zero-EPS days from the P/E distribution instead of letting them dominate it', () => {
  const day = 86400000;
  const t0 = Date.parse('2020-01-01');
  // 250 normal trading days at a legitimate ~20x P/E (EPS=1, price~20)...
  const normalRows = Array.from({ length: 250 }, (_, i) => ({
    timeMs: t0 + i * day,
    adjustedClose: 20 + (i % 5),
  }));
  // ...then one barely-profitable quarter (63 trading days, EPS=0.001) that
  // pushes implied P/E for every one of those days into the tens of
  // thousands - exactly the MARA/SMCI failure mode.
  const degradedStart = t0 + 250 * day;
  const degradedRows = Array.from({ length: 63 }, (_, i) => ({
    timeMs: degradedStart + i * day,
    adjustedClose: 20,
  }));
  const priceRows = [...normalRows, ...degradedRows];
  const filingVintages = [
    { filed: '2020-01-05', epsPerShare: 1, revenuePerShare: 10 },
    { filed: new Date(degradedStart).toISOString().slice(0, 10), epsPerShare: 0.001, revenuePerShare: 10 },
  ];
  const v = buildPointInTimeValuation({ priceRows, filingVintages });
  // All 63 degenerate days must be excluded, not folded into the percentiles.
  assert.equal(v.pe.excludedExtreme, 63);
  // The percentiles should reflect only the legitimate ~20-24x days.
  assert.ok(v.pe.p50 < 30, `p50 should stay in the sane ~20x range, got ${v.pe.p50}`);
});

test('target model refuses to return an implausible target even when the historical percentile respects valuation.js\'s own 500x sanity ceiling', () => {
  // Demonstrates genuine defense-in-depth: even a p50 that exactly respects
  // valuation.js's own MAX_SANE_MULTIPLE cap (500x) still produces a
  // nonsense target when multiplied by an otherwise perfectly ordinary
  // current EPS - so target.js needs its own independent guard rather than
  // relying on valuation.js having fully sanitized every possible input.
  const target = buildTargetModel({
    lastPrice: 20,
    valuation: {
      filingVintageCount: 4,
      pe: { observations: 800, p25: 400, p50: 500, p75: 500 }, // right at the valuation.js ceiling
    },
    fundamentals: { latestAnnual: { epsPerShareAdjusted: 5, revenuePerShareAdjusted: null } }, // ordinary EPS
  });
  assert.equal(target.available, false);
  assert.equal(target.reason, 'implausible_multiple_result');
});

test('target model still returns real, plausible targets for ordinary deep-value setups', () => {
  // Guard against the fix being overzealous: a genuinely large but plausible
  // recovery target (e.g. ~150% upside for a beaten-down cyclical) must NOT
  // get caught by the sanity clamp.
  const target = buildTargetModel({
    lastPrice: 10,
    valuation: {
      filingVintageCount: 4,
      pe: { observations: 800, p25: 15, p50: 20, p75: 25 },
    },
    fundamentals: { latestAnnual: { epsPerShareAdjusted: 1.2, revenuePerShareAdjusted: null } },
  });
  assert.equal(target.available, true);
  assert.ok(target.baseUpside > 1, 'a large but real upside should still come through');
});
