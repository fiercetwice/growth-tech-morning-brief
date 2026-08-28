const TICKER_MAP_URL = 'https://www.sec.gov/files/company_tickers.json';

export async function resolveCik(ticker, env) {
  const cacheKey = `sec/ticker-map.json`;
  let data = null;
  if (env.RESEARCH_BUCKET) {
    const cached = await env.RESEARCH_BUCKET.get(cacheKey);
    if (cached) data = await cached.json();
  }
  if (!data) {
    const res = await fetch(TICKER_MAP_URL, { headers: secHeaders(env) });
    if (!res.ok) throw new Error(`sec_ticker_map_http_${res.status}`);
    data = await res.json();
    if (env.RESEARCH_BUCKET) await env.RESEARCH_BUCKET.put(cacheKey, JSON.stringify(data));
  }
  const upper = ticker.toUpperCase();
  const row = Object.values(data).find((x) => String(x.ticker || '').toUpperCase() === upper);
  if (!row) throw new Error(`sec_cik_not_found:${ticker}`);
  return String(row.cik_str).padStart(10, '0');
}

export async function getCompanyFacts(ticker, env) {
  const cik = await resolveCik(ticker, env);
  const key = `sec/companyfacts/${cik}.json`;
  if (env.RESEARCH_BUCKET) {
    const cached = await env.RESEARCH_BUCKET.get(key);
    if (cached) {
      const age = Date.now() - new Date(cached.uploaded || 0).getTime();
      if (age < 7 * 86400000) return await cached.json();
    }
  }
  const res = await fetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`, { headers: secHeaders(env) });
  if (!res.ok) throw new Error(`sec_companyfacts_http_${res.status}`);
  const data = await res.json();
  if (env.RESEARCH_BUCKET) await env.RESEARCH_BUCKET.put(key, JSON.stringify(data));
  return data;
}

export function extractCoreFundamentals(companyFacts) {
  const usgaap = companyFacts?.facts?.['us-gaap'] || {};
  return {
    revenue: latestAnnualOrQuarterly(usgaap.Revenues || usgaap.RevenueFromContractWithCustomerExcludingAssessedTax),
    dilutedEps: latestAnnualOrQuarterly(usgaap.EarningsPerShareDiluted),
    cash: latestInstant(usgaap.CashAndCashEquivalentsAtCarryingValue || usgaap.CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents),
    debt: latestInstant(usgaap.LongTermDebtAndFinanceLeaseObligationsCurrent || usgaap.LongTermDebtCurrent),
  };
}

function latestAnnualOrQuarterly(fact) {
  const units = fact?.units || {};
  const rows = Object.values(units).flat().filter((x) => x?.filed && Number.isFinite(x?.val));
  rows.sort((a, b) => String(b.filed).localeCompare(String(a.filed)));
  return rows[0] || null;
}

function latestInstant(fact) {
  return latestAnnualOrQuarterly(fact);
}

function secHeaders(env) {
  return {
    'user-agent': env.SEC_USER_AGENT || 'stock-research-mcp/0.1 contact@example.com',
    accept: 'application/json',
  };
}
