import { getYahooChart, summarizeOneMonth, chartRows, extractSplits } from './sources/yahoo.js';
import { getCompanyFacts, extractCoreFundamentals } from './sources/sec.js';
import { buildPointInTimeValuation } from './engines/valuation.js';
import { buildTargetModel } from './engines/target.js';
import { callAiProvider } from './providers/ai.js';

export async function analyzeStock(ticker, env, options = {}) {
  const symbol = String(ticker || '').trim().toUpperCase();
  if (!symbol) throw new Error('ticker_required');
  const includeAi = options.includeAi !== false;

  const [monthChart, fiveYearChart, companyFacts] = await Promise.all([
    getYahooChart(symbol, { range: '1mo', interval: '1d' }),
    getYahooChart(symbol, { range: '5y', interval: '1d' }),
    getCompanyFacts(symbol, env),
  ]);

  const price = summarizeOneMonth(monthChart);
  const splits = extractSplits(fiveYearChart);
  const fundamentals = extractCoreFundamentals(companyFacts, splits);
  const historyRows = chartRows(fiveYearChart);
  const valuation = buildPointInTimeValuation({
    priceRows: historyRows,
    filingVintages: fundamentals.annualVintages || [],
    splits,
  });
  const target = buildTargetModel({
    lastPrice: price.lastPrice,
    valuation,
    fundamentals,
  });

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
    valuation,
    target,
    dataQuality: {
      completeOneMonth: price.observations >= 18,
      fiveYearPriceObservations: historyRows.length,
      secAvailable: Boolean(companyFacts),
      filingVintageCount: valuation.filingVintageCount,
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
        'Treat deterministic price, SEC, valuation, and target fields as authoritative inputs.',
        'Extract catalysts, conflicting evidence, risks, and rerating conditions; do not override deterministic calculations.',
      ].join(' '),
      input: JSON.stringify({ ticker: symbol, deterministic }),
    });
  }

  return {
    version: '0.2.0',
    asOf: new Date().toISOString(),
    ...deterministic,
    research,
  };
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
    version: '0.2.0',
    asOf: new Date().toISOString(),
    requested: symbols.length,
    succeeded: results.filter(x => x?.ok).length,
    failed: results.filter(x => x && !x.ok).length,
    results,
  };
}
