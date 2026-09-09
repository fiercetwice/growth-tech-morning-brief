import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveCik } from '../src/sources/sec.js';
import { withRetry } from '../src/analyze.js';

// Regression tests for the real 2026-09-08 production issue: 25-ticker
// batches failing partway through with "Too many subrequests". Root cause
// couldn't be pinned to one single mechanism with certainty (Cloudflare's
// 6-simultaneous-connection cap and SEC/Yahoo's own downstream rate limiting
// are both plausible and the fix helps either way), so the fix is defense in
// depth: eliminate genuinely duplicate subrequests within a batch, lower
// concurrency, and retry transient per-ticker failures automatically.

function fakeBucket(tickerMapJson) {
  let getCalls = 0;
  return {
    getCalls: () => getCalls,
    async get(key) {
      if (key !== 'sec/ticker-map.json') return null;
      getCalls++;
      return { json: async () => tickerMapJson, uploaded: new Date().toISOString() };
    },
    async put() {},
  };
}

test('resolveCik with a shared cache fetches the ticker map only once across many calls', async () => {
  const tickerMap = { 0: { ticker: 'AAPL', cik_str: 320193 }, 1: { ticker: 'MSFT', cik_str: 789019 } };
  const bucket = fakeBucket(tickerMap);
  const env = { RESEARCH_BUCKET: bucket };
  const sharedCache = {};

  const [aapl, msft, aaplAgain] = await Promise.all([
    resolveCik('AAPL', env, sharedCache),
    resolveCik('MSFT', env, sharedCache),
    resolveCik('AAPL', env, sharedCache),
  ]);

  assert.equal(aapl, '0000320193');
  assert.equal(msft, '0000789019');
  assert.equal(aaplAgain, '0000320193');
  assert.equal(bucket.getCalls(), 1, 'the ticker map should be fetched exactly once regardless of how many tickers/calls share the cache');
});

test('resolveCik without a shared cache fetches the ticker map every call (unchanged standalone behavior)', async () => {
  const tickerMap = { 0: { ticker: 'AAPL', cik_str: 320193 } };
  const bucket = fakeBucket(tickerMap);
  const env = { RESEARCH_BUCKET: bucket };

  await resolveCik('AAPL', env);
  await resolveCik('AAPL', env);

  assert.equal(bucket.getCalls(), 2, 'standalone (non-batch) calls must not silently share state across unrelated invocations');
});

test('resolveCik throws for a genuinely unknown ticker even with a shared cache (no false positive from memoization)', async () => {
  const tickerMap = { 0: { ticker: 'AAPL', cik_str: 320193 } };
  const env = { RESEARCH_BUCKET: fakeBucket(tickerMap) };
  const sharedCache = {};
  await assert.rejects(() => resolveCik('NOPE', env, sharedCache), /sec_cik_not_found/);
});

test('withRetry succeeds on the first try without waiting when there is no failure', async () => {
  let calls = 0;
  const result = await withRetry(async () => { calls++; return 'ok'; });
  assert.equal(result, 'ok');
  assert.equal(calls, 1);
});

test('withRetry retries exactly once after a transient failure, then succeeds', async () => {
  let calls = 0;
  const result = await withRetry(async () => {
    calls++;
    if (calls === 1) throw new Error('transient_failure');
    return 'ok';
  });
  assert.equal(result, 'ok');
  assert.equal(calls, 2);
});

test('withRetry gives up after the single retry also fails (does not retry forever)', async () => {
  let calls = 0;
  await assert.rejects(() => withRetry(async () => { calls++; throw new Error('persistent_failure'); }), /persistent_failure/);
  assert.equal(calls, 2, 'exactly one retry - an initial attempt plus one more, not an unbounded retry loop');
});
