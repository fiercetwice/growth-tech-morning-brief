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

export async function getRecentFilings(ticker, env, { forms = ['8-K', '10-Q', '10-K'], limit = 20 } = {}) {
  const cik = await resolveCik(ticker, env);
  const key = `sec/submissions/${cik}.json`;
  let data = null;
  if (env.RESEARCH_BUCKET) {
    const cached = await env.RESEARCH_BUCKET.get(key);
    if (cached) {
      const age = Date.now() - new Date(cached.uploaded || 0).getTime();
      if (age < 6 * 3600000) data = await cached.json();
    }
  }
  if (!data) {
    const res = await fetch(`https://data.sec.gov/submissions/CIK${cik}.json`, { headers: secHeaders(env) });
    if (!res.ok) throw new Error(`sec_submissions_http_${res.status}`);
    data = await res.json();
    if (env.RESEARCH_BUCKET) await env.RESEARCH_BUCKET.put(key, JSON.stringify(data));
  }
  const recent = data?.filings?.recent || {};
  const rows = [];
  for (let i = 0; i < (recent.form || []).length; i++) {
    const form = recent.form[i];
    if (!forms.includes(form)) continue;
    rows.push({
      form,
      filed: recent.filingDate?.[i] || null,
      reportDate: recent.reportDate?.[i] || null,
      accessionNumber: recent.accessionNumber?.[i] || null,
      primaryDocument: recent.primaryDocument?.[i] || null,
      items: recent.items?.[i] || null,
    });
    if (rows.length >= limit) break;
  }
  return rows;
}

export function extractCoreFundamentals(companyFacts, splits = []) {
  const usgaap = companyFacts?.facts?.['us-gaap'] || {};
  const annual = extractAnnualVintages(usgaap, splits);
  const quarterly = extractQuarterlyVintages(usgaap, splits);
  const ttm = buildTtmVintages(quarterly);
  const latestAnnual = annual.at(-1) || null;
  const latestTtm = ttm.at(-1) || null;
  return {
    revenue: latestAnnualOrQuarterly(usgaap.Revenues || usgaap.RevenueFromContractWithCustomerExcludingAssessedTax),
    dilutedEps: latestAnnualOrQuarterly(usgaap.EarningsPerShareDiluted),
    cash: latestInstant(usgaap.CashAndCashEquivalentsAtCarryingValue || usgaap.CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents),
    debt: latestInstant(usgaap.LongTermDebtAndFinanceLeaseObligationsCurrent || usgaap.LongTermDebtCurrent || usgaap.LongTermDebt),
    annualVintages: annual,
    quarterlyVintages: quarterly,
    ttmVintages: ttm,
    latestAnnual,
    latestTtm,
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
    out.push({ fy, filed, end: r?.end || e?.end || s?.end || null, revenue, dilutedShares, epsPerShare, revenuePerShare,
      splitFactorToPresent: splitFactor,
      epsPerShareAdjusted: Number.isFinite(epsPerShare) ? epsPerShare / splitFactor : null,
      revenuePerShareAdjusted: Number.isFinite(revenuePerShare) ? revenuePerShare / splitFactor : null,
    });
  }
  return out;
}

export function extractQuarterlyVintages(usgaap, splits = []) {
  const revFact = usgaap.Revenues || usgaap.RevenueFromContractWithCustomerExcludingAssessedTax;
  const epsFact = usgaap.EarningsPerShareDiluted;
  const sharesFact = usgaap.WeightedAverageNumberOfDilutedSharesOutstanding;
  const revenues = quarterRows(revFact);
  const eps = quarterRows(epsFact);
  const shares = quarterRows(sharesFact);
  const keys = new Set([...revenues, ...eps, ...shares].map(r => `${r.fy}|${r.fp}|${r.end || ''}`));
  const out = [];
  for (const key of keys) {
    const [fyText, fp, end] = key.split('|');
    const fy = Number(fyText);
    const r = latestForQuarter(revenues, fy, fp, end);
    const e = latestForQuarter(eps, fy, fp, end);
    const s = latestForQuarter(shares, fy, fp, end);
    const filed = [r?.filed, e?.filed, s?.filed].filter(Boolean).sort().at(-1);
    if (!filed) continue;
    const splitFactor = futureSplitFactor(Date.parse(filed), splits);
    const revenue = r?.val ?? null;
    const epsPerShare = e?.val ?? null;
    const dilutedShares = s?.val ?? null;
    const revenuePerShare = Number.isFinite(revenue) && Number.isFinite(dilutedShares) && dilutedShares > 0 ? revenue / dilutedShares : null;
    out.push({ fy, fp, end: end || r?.end || e?.end || s?.end || null, filed, revenue, dilutedShares, epsPerShare, revenuePerShare,
      splitFactorToPresent: splitFactor,
      epsPerShareAdjusted: Number.isFinite(epsPerShare) ? epsPerShare / splitFactor : null,
      revenuePerShareAdjusted: Number.isFinite(revenuePerShare) ? revenuePerShare / splitFactor : null,
    });
  }
  return out.sort((a,b) => String(a.end || a.filed).localeCompare(String(b.end || b.filed)));
}

export function buildTtmVintages(quarterly) {
  const q = [...(quarterly || [])].filter(x => x?.filed && x?.end).sort((a,b) => String(a.end).localeCompare(String(b.end)));
  const out = [];
  for (let i = 3; i < q.length; i++) {
    const window = q.slice(i - 3, i + 1);
    const filed = window.map(x => x.filed).sort().at(-1);
    const epsOk = window.every(x => Number.isFinite(x.epsPerShareAdjusted));
    const revOk = window.every(x => Number.isFinite(x.revenuePerShareAdjusted));
    const epsPerShareAdjusted = epsOk ? window.reduce((a,x) => a + x.epsPerShareAdjusted, 0) : null;
    const revenuePerShareAdjusted = revOk ? window.reduce((a,x) => a + x.revenuePerShareAdjusted, 0) : null;
    if (!Number.isFinite(epsPerShareAdjusted) && !Number.isFinite(revenuePerShareAdjusted)) continue;
    out.push({
      filed,
      end: window.at(-1).end,
      source: 'ttm_quarterly',
      quarters: window.map(x => ({ fy: x.fy, fp: x.fp, end: x.end, filed: x.filed })),
      epsPerShare: epsPerShareAdjusted,
      revenuePerShare: revenuePerShareAdjusted,
      epsPerShareAdjusted,
      revenuePerShareAdjusted,
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

function quarterRows(fact) {
  const rows = Object.values(fact?.units || {}).flat().filter(x =>
    x?.filed && x?.end && Number.isFinite(x?.val) && Number.isFinite(x?.fy) && ['Q1','Q2','Q3','Q4'].includes(x.fp) && ['10-Q','10-K','20-F','6-K'].includes(x.form)
  );
  rows.sort((a,b) => String(a.filed).localeCompare(String(b.filed)));
  return rows;
}

function latestForFy(rows, fy) {
  return rows.filter(x => x.fy === fy).sort((a,b) => String(a.filed).localeCompare(String(b.filed))).at(-1) || null;
}

function latestForQuarter(rows, fy, fp, end) {
  return rows.filter(x => x.fy === fy && x.fp === fp && String(x.end || '') === String(end || ''))
    .sort((a,b) => String(a.filed).localeCompare(String(b.filed))).at(-1) || null;
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
    'user-agent': env.SEC_USER_AGENT || 'stock-research-mcp/0.3 research-service',
    accept: 'application/json',
  };
}
