import { getYahooChart, summarizeOneMonth } from './sources/yahoo.js';
import { getCompanyFacts, extractCoreFundamentals } from './sources/sec.js';
import { callAiProvider } from './providers/ai.js';

export async function analyzeStock(ticker, env) {
  const symbol = String(ticker || '').trim().toUpperCase();
  if (!symbol) throw new Error('ticker_required');

  const [chart, companyFacts] = await Promise.all([
    getYahooChart(symbol, { range: '1mo', interval: '1d' }),
    getCompanyFacts(symbol, env),
  ]);

  const price = summarizeOneMonth(chart);
  const fundamentals = extractCoreFundamentals(companyFacts);

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
    },
    fundamentals,
    dataQuality: {
      completeOneMonth: price.observations >= 18,
      secAvailable: Boolean(companyFacts),
    },
  };

  let research = null;
  if (env.GEMINI_API_KEY || env.DEEPSEEK_API_KEY || env.OPENAI_COMPAT_API_KEY) {
    research = await callAiProvider(env, {
      system: [
        'You are a stock research extraction component.',
        'Return only evidence-grounded structured JSON.',
        'Do not invent analyst targets, prices, earnings dates, or catalysts.',
        'Distinguish facts from interpretation.',
      ].join(' '),
      input: JSON.stringify({ ticker: symbol, deterministic }),
    });
  }

  return {
    version: '0.1.0',
    asOf: new Date().toISOString(),
    ...deterministic,
    research,
  };
}
