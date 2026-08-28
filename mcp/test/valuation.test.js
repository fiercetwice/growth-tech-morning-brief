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
