import { getYahooChart, summarizeOneMonth, chartRows, extractSplits } from './sources/yahoo.js';
import { getCompanyFacts, extractCoreFundamentals, getRecentFilings } from './sources/sec.js';
import { buildPointInTimeValuation } from './engines/valuation.js';
import { buildTargetModel } from './engines/target.js';
import { callAiProvider } from './providers/ai.js';

const ANALYSIS_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const ANALYSIS_CACHE_VERSION = 'v0.4.1';

async function readCachedAnalysis(symbol, env, includeAi) {
  if (!env.RESEARCH_BUCKET || includeAi) return null;
  const key = `analysis/${ANALYSIS_CACHE_VERSION}/${symbol}.json`;
  const obj = await env.RESEARCH_BUCKET.get(key);
  if (!obj) return null;
  const uploaded = new Date(obj.uploaded || 0).getTime();
  if (!Number.isFinite(uploaded) || Date.now() - uploaded > ANALYSIS_CACHE_TTL_MS) return null;
  return await obj.json();
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

  const cached = await readCachedAnalysis(symbol, env, includeAi);
  if (cached) return { ...cached, cache: { hit: true } };

  // Price history is the hard dependency for entry setup. SEC is intentionally soft:
  // if SEC blocks a Worker egress IP, return a usable price packet with explicit
  // data-quality flags instead of failing the entire watchlist scan.
  const [monthChart, fiveYearChart, secFactsResult, filingsResult] = await Promise.all([
    getYahooChart(symbol, { range: '1mo', interval: '1d' }),
    getYahooChart(symbol, { range: '5y', interval: '1d' }),
    getCompanyFacts(symbol, env)
      .then(data => ({ ok: true, data }))
      .catch(error => ({ ok: false, error: String(error?.message || error) })),
    getRecentFilings(symbol, env, { forms: ['8-K','10-Q','10-K','6-K','20-F'], limit: 20 })
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
    version: '0.4.1',
    asOf: new Date().toISOString(),
    ...deterministic,
    research,
    cache: { hit: false },
  };
  await writeCachedAnalysis(symbol, env, result, includeAi);
  return result;
}

export async function analyzeWatchlist(tickers, env, options = {}) {
  const symbols = [...new Set((tickers || []).map(x => String(x || '').trim().toUpperCase()).filter(Boolean))];
  const concurrency = Math.max(1, Math.min(Number(options.concurrency || 3), 5));
  const results = new Array(symbols.length);
  let cursor = 0;

  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= symbols.length) return;
      const ticker = symbols[i];
      try {
        results[i] = { ticker, ok: true, data: await analyzeStock(ticker, env, options) };
      } catch (error) {
        results[i] = { ticker, ok: false, error: String(error?.message || error) };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, symbols.length) }, () => worker()));
  return {
    version: '0.4.1',
    asOf: new Date().toISOString(),
    requested: symbols.length,
    succeeded: results.filter(x => x?.ok).length,
    failed: results.filter(x => x && !x.ok).length,
    results,
  };
}
