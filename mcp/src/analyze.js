import { getYahooChart, summarizeOneMonth, chartRows, extractSplits } from './sources/yahoo.js';
import { getCompanyFacts, extractCoreFundamentals, getRecentFilings } from './sources/sec.js';
import { buildPointInTimeValuation } from './engines/valuation.js';
import { buildTargetModel } from './engines/target.js';
import { callAiProvider } from './providers/ai.js';

const ANALYSIS_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const DEGRADED_SEC_CACHE_TTL_MS = 10 * 60 * 1000;
// Bumped from v0.4.1: the valuation/target engines changed (MAX_SANE_MULTIPLE
// filtering in valuation.js, the implausible-result guard in target.js, and
// the net-income-derived EPS fallback in sec.js). Any cache entry written
// under the old version reflects the pre-fix, sometimes-wrong output (e.g.
// the real MARA/SMCI 5,849%/2,009% "upside" bug) - bumping the version key
// forces every symbol to recompute fresh rather than serving stale bad
// numbers for up to the remaining TTL after this deploy.
const ANALYSIS_CACHE_VERSION = 'v0.4.4';
const SEC_MIRROR_MANIFEST_KEY = 'sec/companyfacts-manifest.json';

async function getManifestUploadedMs(env, sharedCache) {
  const fetchManifest = () => env.RESEARCH_BUCKET.head(SEC_MIRROR_MANIFEST_KEY)
    .then(manifest => manifest ? new Date(manifest.uploaded || 0).getTime() : null)
    .catch(() => null);
  if (sharedCache) {
    if (!sharedCache.manifestUploadedMsPromise) sharedCache.manifestUploadedMsPromise = fetchManifest();
    return sharedCache.manifestUploadedMsPromise;
  }
  return fetchManifest();
}

async function readCachedAnalysis(symbol, env, includeAi, sharedCache) {
  if (!env.RESEARCH_BUCKET || includeAi) return null;
  const key = `analysis/${ANALYSIS_CACHE_VERSION}/${symbol}.json`;
  const obj = await env.RESEARCH_BUCKET.get(key);
  if (!obj) return null;
  const uploaded = new Date(obj.uploaded || 0).getTime();
  if (!Number.isFinite(uploaded)) return null;

  // A freshly published SEC mirror invalidates older analysis immediately. This
  // prevents a degraded SEC=false packet from masking new CompanyFacts until TTL.
  // getManifestUploadedMs() memoizes this across an entire analyzeWatchlist
  // batch via sharedCache - see its own comment for why that matters.
  const mirrorUploaded = await getManifestUploadedMs(env, sharedCache);
  if (Number.isFinite(mirrorUploaded) && mirrorUploaded > uploaded) return null;

  const cached = await obj.json();
  const ttl = cached?.dataQuality?.secAvailable === false
    ? DEGRADED_SEC_CACHE_TTL_MS
    : ANALYSIS_CACHE_TTL_MS;
  if (Date.now() - uploaded > ttl) return null;
  return cached;
}

async function writeCachedAnalysis(symbol, env, result, includeAi) {
  if (!env.RESEARCH_BUCKET || includeAi) return;
  await env.RESEARCH_BUCKET.put(`analysis/${ANALYSIS_CACHE_VERSION}/${symbol}.json`, JSON.stringify(result));
}

function emptyFundamentals() {
  return {
    revenue: null,
    dilutedEps: null,
    cash: null,
    debt: null,
    annualVintages: [],
    quarterlyVintages: [],
    ttmVintages: [],
    latestAnnual: null,
    latestTtm: null,
  };
}

export async function analyzeStock(ticker, env, options = {}) {
  const symbol = String(ticker || '').trim().toUpperCase();
  if (!symbol) throw new Error('ticker_required');
  const includeAi = options.includeAi !== false;
  const sharedCache = options.sharedCache; // see analyzeWatchlist - undefined for standalone single-ticker calls, which is fine: falls back to always-fetch-fresh, identical to prior behavior.

  const cached = await readCachedAnalysis(symbol, env, includeAi, sharedCache);
  if (cached) return { ...cached, cache: { hit: true } };

  const [monthChart, fiveYearChart, secFactsResult, filingsResult] = await Promise.all([
    getYahooChart(symbol, { range: '1mo', interval: '1d' }),
    getYahooChart(symbol, { range: '5y', interval: '1d' }),
    getCompanyFacts(symbol, env, sharedCache)
      .then(data => ({ ok: true, data }))
      .catch(error => ({ ok: false, error: String(error?.message || error) })),
    getRecentFilings(symbol, env, { forms: ['8-K','10-Q','10-K','6-K','20-F'], limit: 20 }, sharedCache)
      .then(data => ({ ok: true, data }))
      .catch(error => ({ ok: false, error: String(error?.message || error), data: [] })),
  ]);

  const price = summarizeOneMonth(monthChart);
  const splits = extractSplits(fiveYearChart);
  const companyFacts = secFactsResult.ok ? secFactsResult.data : null;
  const recentFilings = filingsResult.ok ? filingsResult.data : [];
  const fundamentals = companyFacts ? extractCoreFundamentals(companyFacts, splits) : emptyFundamentals();
  const historyRows = chartRows(fiveYearChart);
  const valuationVintages = fundamentals.ttmVintages?.length >= 4
    ? fundamentals.ttmVintages
    : fundamentals.annualVintages || [];
  const valuation = buildPointInTimeValuation({
    priceRows: historyRows,
    filingVintages: valuationVintages,
    splits,
  });
  const target = buildTargetModel({
    lastPrice: price.lastPrice,
    valuation,
    fundamentals: { ...fundamentals, latestAnnual: fundamentals.latestTtm || fundamentals.latestAnnual },
  });

  const valuationBasis = fundamentals.ttmVintages?.length >= 4
    ? 'ttm_quarterly'
    : fundamentals.annualVintages?.length
      ? 'annual_fallback'
      : 'unavailable';

  const deterministic = {
    ticker: symbol,
    price: {
      last: price.lastPrice,
      observations1m: price.observations,
      return1m: price.return1m,
      return5d: price.return5d,
      monthHigh: price.monthHigh,
      monthLow: price.monthLow,
      drawdownFromMonthHigh: price.drawdownFromMonthHigh,
      distanceFromMonthLow: price.distanceFromMonthLow,
      avgVolume1m: price.avgVolume,
    },
    fundamentals,
    valuation: { ...valuation, basis: valuationBasis },
    target,
    recentFilings,
    dataQuality: {
      completeOneMonth: price.observations >= 18,
      fiveYearPriceObservations: historyRows.length,
      secAvailable: Boolean(companyFacts),
      secFactsError: secFactsResult.ok ? null : secFactsResult.error,
      secFilingsAvailable: filingsResult.ok,
      secFilingsError: filingsResult.ok ? null : filingsResult.error,
      quarterlyVintageCount: fundamentals.quarterlyVintages?.length || 0,
      ttmVintageCount: fundamentals.ttmVintages?.length || 0,
      filingVintageCount: valuation.filingVintageCount,
      recentFilingCount: recentFilings.length,
      targetAvailable: Boolean(target?.available),
    },
  };

  let research = null;
  if (includeAi && (env.GEMINI_API_KEY || env.DEEPSEEK_API_KEY || env.OPENAI_COMPAT_API_KEY)) {
    research = await callAiProvider(env, {
      system: [
        'You are a stock research extraction component.',
        'Return only evidence-grounded structured JSON.',
        'Do not invent analyst targets, prices, earnings dates, or catalysts.',
        'Treat deterministic price, SEC, valuation, target, and filing fields as authoritative inputs.',
        'Extract catalysts, conflicting evidence, risks, and rerating conditions; do not override deterministic calculations.',
      ].join(' '),
      input: JSON.stringify({ ticker: symbol, deterministic }),
    });
  }

  const result = {
    version: '0.4.4',
    asOf: new Date().toISOString(),
    ...deterministic,
    research,
    cache: { hit: false },
  };
  await writeCachedAnalysis(symbol, env, result, includeAi);
  return result;
}

const RETRY_DELAY_BASE_MS = 750;

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

// Retries once, with a short randomized backoff, before giving up on a
// ticker. Deliberately not smarter than this (no error-type classification):
// a wasted retry on a genuinely permanent failure (e.g. FRCOY/CRWV's known
// SEC mapping gap) costs one extra attempt, which is cheap; the alternative
// - trying to distinguish transient from permanent errors - adds real
// complexity for a batch of only ~2 known permanent-failure tickers out of
// 56. This exists because a batch of 25 tickers hitting a transient
// capacity limit (Cloudflare's 6-simultaneous-connection cap, or SEC/Yahoo's
// own rate limiting - either is plausible and both respond to "wait a
// moment and try again") previously required a human/AI operator to notice
// the failures and manually retry in smaller batches; this makes that
// automatic.
export async function withRetry(fn) {
  try {
    return await fn();
  } catch (error) {
    await sleep(RETRY_DELAY_BASE_MS + Math.random() * 500);
    return await fn();
  }
}

export async function analyzeWatchlist(tickers, env, options = {}) {
  const symbols = [...new Set((tickers || []).map(x => String(x || '').trim().toUpperCase()).filter(Boolean))];
  const concurrency = Math.max(1, Math.min(Number(options.concurrency || 2), 5));
  const results = new Array(symbols.length);
  // Shared across every ticker in this batch: collapses the ticker-map fetch
  // (previously done twice per ticker - once each from getCompanyFacts and
  // getRecentFilings - and identical across all 56 tickers in the watchlist)
  // and the SEC-mirror-manifest freshness check (previously once per ticker)
  // down to a single fetch each per batch, rather than up to 50 and 25
  // redundant repeats of the exact same data respectively in a 25-ticker call.
  const sharedCache = {};
  let cursor = 0;

  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= symbols.length) return;
      const ticker = symbols[i];
      try {
        results[i] = { ticker, ok: true, data: await withRetry(() => analyzeStock(ticker, env, { ...options, sharedCache })) };
      } catch (error) {
        results[i] = { ticker, ok: false, error: String(error?.message || error) };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, symbols.length) }, () => worker()));
  return {
    version: '0.4.4',
    asOf: new Date().toISOString(),
    requested: symbols.length,
    succeeded: results.filter(x => x?.ok).length,
    failed: results.filter(x => x && !x.ok).length,
    results,
  };
}
