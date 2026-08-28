import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTtmVintages, extractQuarterlyVintages } from '../src/sources/sec.js';

test('TTM waits until all four quarters are filed', () => {
  const q = [
    { fy: 2025, fp: 'Q1', end: '2025-03-31', filed: '2025-05-01', revenue: 100, dilutedSharesAdjusted: 10, epsPerShareAdjusted: 1 },
    { fy: 2025, fp: 'Q2', end: '2025-06-30', filed: '2025-08-01', revenue: 110, dilutedSharesAdjusted: 10, epsPerShareAdjusted: 1.1 },
    { fy: 2025, fp: 'Q3', end: '2025-09-30', filed: '2025-11-01', revenue: 120, dilutedSharesAdjusted: 10, epsPerShareAdjusted: 1.2 },
    { fy: 2025, fp: 'Q4', end: '2025-12-31', filed: '2026-02-15', revenue: 130, dilutedSharesAdjusted: 10, epsPerShareAdjusted: 1.3 },
  ];
  const ttm = buildTtmVintages(q);
  assert.equal(ttm.length, 1);
  assert.equal(ttm[0].filed, '2026-02-15');
  assert.equal(ttm[0].epsPerShareAdjusted, 4.6);
  assert.equal(ttm[0].revenuePerShareAdjusted, 46);
});

test('quarter extraction ignores YTD Q2/Q3 rows and derives Q4 from FY minus 9M', () => {
  const units = {
    USD: [
      { fy: 2025, fp: 'Q1', form: '10-Q', start: '2025-01-01', end: '2025-03-31', filed: '2025-05-01', val: 100 },
      { fy: 2025, fp: 'Q2', form: '10-Q', start: '2025-04-01', end: '2025-06-30', filed: '2025-08-01', val: 110 },
      { fy: 2025, fp: 'Q2', form: '10-Q', start: '2025-01-01', end: '2025-06-30', filed: '2025-08-01', val: 210 },
      { fy: 2025, fp: 'Q3', form: '10-Q', start: '2025-07-01', end: '2025-09-30', filed: '2025-11-01', val: 120 },
      { fy: 2025, fp: 'Q3', form: '10-Q', start: '2025-01-01', end: '2025-09-30', filed: '2025-11-01', val: 330 },
      { fy: 2025, fp: 'FY', form: '10-K', start: '2025-01-01', end: '2025-12-31', filed: '2026-02-15', val: 460 },
    ],
  };
  const usgaap = {
    Revenues: { units },
    EarningsPerShareDiluted: { units: { 'USD/shares': units.USD.map(x => ({ ...x, val: x.val / 100 })) } },
    WeightedAverageNumberOfDilutedSharesOutstanding: { units: { shares: [
      { fy: 2025, fp: 'Q1', form: '10-Q', start: '2025-01-01', end: '2025-03-31', filed: '2025-05-01', val: 10 },
      { fy: 2025, fp: 'Q2', form: '10-Q', start: '2025-04-01', end: '2025-06-30', filed: '2025-08-01', val: 10 },
      { fy: 2025, fp: 'Q3', form: '10-Q', start: '2025-07-01', end: '2025-09-30', filed: '2025-11-01', val: 10 },
    ] } },
  };
  const q = extractQuarterlyVintages(usgaap);
  assert.equal(q.find(x => x.fp === 'Q2').revenue, 110);
  assert.equal(q.find(x => x.fp === 'Q3').revenue, 120);
  assert.equal(q.find(x => x.fp === 'Q4').revenue, 130);
  assert.equal(q.find(x => x.fp === 'Q4').derived, true);
});
