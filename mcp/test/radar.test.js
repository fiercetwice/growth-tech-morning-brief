import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEntrySetup, buildWatchlistPacket } from '../src/radar.js';

test('entry setup exposes BUY gate fields and extension flags', () => {
  const row = buildEntrySetup({
    ticker: 'TEST',
    price: { last: 100, observations1m: 21, return5d: .02, return1m: .18, monthHigh: 101, monthLow: 80, drawdownFromMonthHigh: -.01, distanceFromMonthLow: .25, avgVolume1m: 1234 },
    valuation: { basis: 'ttm_quarterly', pe: { percentile: .3 }, ps: { percentile: .4 } },
    target: { base: 125, baseUpside: .25, confidence: 'high' },
    dataQuality: { completeOneMonth: true, secAvailable: true, targetAvailable: true, ttmVintageCount: 8, recentFilingCount: 3 },
  });
  assert.equal(row.buyNowDataGate, true);
  assert.equal(row.extensionFlags.oneMonthExtendedNearHigh, true);
  assert.equal(row.targetUpside, .25);
});

test('watchlist packet is compact and preserves failures', () => {
  const packet = buildWatchlistPacket({
    requested: 2,
    asOf: '2026-08-28T00:00:00Z',
    results: [
      { ticker: 'AAA', ok: true, data: { ticker: 'AAA', price: { observations1m: 20 }, valuation: {}, target: {}, dataQuality: {}, recentFilings: [{ form: '8-K', filed: '2026-08-27', items: '2.02' }], cache: { hit: true } } },
      { ticker: 'BBB', ok: false, error: 'source_failed' },
    ],
  });
  assert.equal(packet.succeeded, 1);
  assert.equal(packet.failed, 1);
  assert.equal(packet.rows[0].latestFiling.form, '8-K');
  assert.equal(packet.failures[0].ticker, 'BBB');
});
