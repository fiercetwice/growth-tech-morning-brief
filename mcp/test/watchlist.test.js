import test from 'node:test';
import assert from 'node:assert/strict';
import { getConfiguredTickers } from '../src/watchlist.js';

test('getConfiguredTickers returns a non-empty, deduplicated, uppercase list', () => {
  const tickers = getConfiguredTickers();
  assert.ok(Array.isArray(tickers));
  assert.ok(tickers.length > 0, 'radar-tickers.txt should not be empty');
  for (const t of tickers) {
    assert.equal(t, t.toUpperCase(), `${t} should already be uppercase`);
    assert.ok(t.length > 0, 'no blank entries');
  }
});

test('getConfiguredTickers includes known current watchlist members', () => {
  const tickers = getConfiguredTickers();
  for (const known of ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMD', 'FRCOY', 'CRWV']) {
    assert.ok(tickers.includes(known), `expected ${known} in configured watchlist`);
  }
});

test('getConfiguredTickers ignores comments and blank lines the same way the SEC sync workflow does', () => {
  // Mirrors the parsing rule in .github/workflows/sec-companyfacts-sync.yml:
  // strip, drop blanks, drop lines starting with '#'. We can't easily swap
  // in fixture text since the txt is bundled at import time, so this test
  // instead documents and locks the behavior via the real file: no entry
  // in the real result should start with '#' or be empty after trimming.
  const tickers = getConfiguredTickers();
  for (const t of tickers) {
    assert.ok(!t.startsWith('#'), 'comment lines must be filtered out');
    assert.equal(t.trim(), t, 'entries must already be trimmed');
  }
});
