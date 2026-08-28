const TICKER_MAP_URL = 'https://www.sec.gov/files/company_tickers.json';

export async function resolveCik(ticker, env) {
  const cacheKey = 'sec/ticker-map.json';
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
  const row = Object.values(data).find(x => String(x.ticker || '').toUpperCase() === upper);
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

export function extractCoreFundamentals(companyFacts, splits = []) {
  const usgaap = companyFacts?.facts?.['us-gaap'] || {};
  const annual = extractAnnualVintages(usgaap, splits);
  const latestAnnual = annual.at(-1) || null;
  return {
    revenue: latestAnnualOrQuarterly(usgaap.Revenues || usgaap.RevenueFromContractWithCustomerExcludingAssessedTax),
    dilutedEps: latestAnnualOrQuarterly(usgaap.EarningsPerShareDiluted),
    cash: latestInstant(usgaap.CashAndCashEquivalentsAtCarryingValue || usgaap.CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents),
    debt: latestInstant(usgaap.LongTermDebtAndFinanceLeaseObligationsCurrent || usgaap.LongTermDebtCurrent || usgaap.LongTermDebt),
    annualVintages: annual,
    latestAnnual,
  };
}

export function extractAnnualVintages(usgaap, splits = []) {
  const revFact = usgaap.Revenues || usgaap.RevenueFromContractWithCustomerExcludingAssessedTax;
  const epsFact = usgaap.EarningsPerShareDiluted;
  const sharesFact = usgaap.WeightedAverageNumberOfDilutedSharesOutstanding;
  const revenues = annualRows(revFact);
  const eps = annualRows(epsFact);
  const shares = annualRows(sharesFact);
  const years = new Set([...revenues, ...eps, ...shares].map(r => r.fy).filter(Number.isFinite));
  const out = [];
  for (const fy of [...years].sort((a,b) => a-b)) {
    const r = latestForFy(revenues, fy);
    const e = latestForFy(eps, fy);
    const s = latestForFy(shares, fy);
    const filed = [r?.filed, e?.filed, s?.filed].filter(Boolean).sort().at(-1);
    if (!filed) continue;
    const splitFactor = futureSplitFactor(Date.parse(filed), splits);
    const revenue = r?.val ?? null;
    const epsPerShare = e?.val ?? null;
    const dilutedShares = s?.val ?? null;
    const revenuePerShare = Number.isFinite(revenue) && Number.isFinite(dilutedShares) && dilutedShares > 0 ? revenue / dilutedShares : null;
    out.push({
      fy,
      filed,
      end: r?.end || e?.end || s?.end || null,
      revenue,
      dilutedShares,
      epsPerShare,
      revenuePerShare,
      splitFactorToPresent: splitFactor,
      epsPerShareAdjusted: Number.isFinite(epsPerShare) ? epsPerShare / splitFactor : null,
      revenuePerShareAdjusted: Number.isFinite(revenuePerShare) ? revenuePerShare / splitFactor : null,
    });
  }
  return out;
}

function annualRows(fact) {
  const rows = Object.values(fact?.units || {}).flat().filter(x =>
    x?.filed && Number.isFinite(x?.val) && Number.isFinite(x?.fy) && (x.fp === 'FY' || x.form === '10-K' || x.form === '20-F')
  );
  rows.sort((a,b) => String(a.filed).localeCompare(String(b.filed)));
  return rows;
}

function latestForFy(rows, fy) {
  return rows.filter(x => x.fy === fy).sort((a,b) => String(a.filed).localeCompare(String(b.filed))).at(-1) || null;
}

function futureSplitFactor(filedMs, splits) {
  let factor = 1;
  for (const s of splits || []) if (s.timeMs > filedMs && Number.isFinite(s.ratio) && s.ratio > 0) factor *= s.ratio;
  return factor;
}

function latestAnnualOrQuarterly(fact) {
  const rows = Object.values(fact?.units || {}).flat().filter(x => x?.filed && Number.isFinite(x?.val));
  rows.sort((a,b) => String(b.filed).localeCompare(String(a.filed)));
  return rows[0] || null;
}

function latestInstant(fact) { return latestAnnualOrQuarterly(fact); }

function secHeaders(env) {
  return {
    'user-agent': env.SEC_USER_AGENT || 'stock-research-mcp/0.2 research-service',
    accept: 'application/json',
  };
}
