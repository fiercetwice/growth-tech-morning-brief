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
  return {
    revenue: latestAnnualOrQuarterly(usgaap.Revenues || usgaap.RevenueFromContractWithCustomerExcludingAssessedTax),
    dilutedEps: latestAnnualOrQuarterly(usgaap.EarningsPerShareDiluted),
    cash: latestInstant(usgaap.CashAndCashEquivalentsAtCarryingValue || usgaap.CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents),
    debt: latestInstant(usgaap.LongTermDebtAndFinanceLeaseObligationsCurrent || usgaap.LongTermDebtCurrent || usgaap.LongTermDebt),
    annualVintages: annual,
    quarterlyVintages: quarterly,
    ttmVintages: ttm,
    latestAnnual: annual.at(-1) || null,
    latestTtm: ttm.at(-1) || null,
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
    const r = latestForFy(revenues, fy), e = latestForFy(eps, fy), s = latestForFy(shares, fy);
    const filed = [r?.filed, e?.filed, s?.filed].filter(Boolean).sort().at(-1);
    if (!filed) continue;
    const splitFactor = futureSplitFactor(Date.parse(filed), splits);
    const revenue = r?.val ?? null, epsPerShare = e?.val ?? null, dilutedShares = s?.val ?? null;
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
  const revenueFact = usgaap.Revenues || usgaap.RevenueFromContractWithCustomerExcludingAssessedTax;
  const epsFact = usgaap.EarningsPerShareDiluted;
  const sharesFact = usgaap.WeightedAverageNumberOfDilutedSharesOutstanding;
  const revenues = metricQuarterRows(revenueFact);
  const eps = metricQuarterRows(epsFact);
  const shares = metricQuarterRows(sharesFact, { deriveQ4: false });
  const keys = new Set([...revenues, ...eps, ...shares].map(r => `${r.fy}|${r.fp}|${r.end || ''}`));
  const out = [];
  for (const key of keys) {
    const [fyText, fp, end] = key.split('|');
    const fy = Number(fyText);
    const r = latestForQuarter(revenues, fy, fp, end);
    const e = latestForQuarter(eps, fy, fp, end);
    const s = latestForQuarter(shares, fy, fp, end) || nearestShares(shares, fy, end);
    const filed = [r?.filed, e?.filed, s?.filed].filter(Boolean).sort().at(-1);
    if (!filed) continue;
    const splitFactor = futureSplitFactor(Date.parse(filed), splits);
    const revenue = r?.val ?? null, epsPerShare = e?.val ?? null, dilutedShares = s?.val ?? null;
    out.push({
      fy, fp, end: end || r?.end || e?.end || s?.end || null, filed, revenue, dilutedShares, epsPerShare,
      splitFactorToPresent: splitFactor,
      dilutedSharesAdjusted: Number.isFinite(dilutedShares) ? dilutedShares * splitFactor : null,
      epsPerShareAdjusted: Number.isFinite(epsPerShare) ? epsPerShare / splitFactor : null,
      derived: Boolean(r?.derived || e?.derived),
    });
  }
  return out.sort((a,b) => String(a.end || a.filed).localeCompare(String(b.end || b.filed)));
}

export function buildTtmVintages(quarterly) {
  const q = [...(quarterly || [])].filter(x => x?.filed && x?.end).sort((a,b) => String(a.end).localeCompare(String(b.end)));
  const out = [];
  for (let i = 3; i < q.length; i++) {
    const window = q.slice(i - 3, i + 1);
    if (new Set(window.map(x => `${x.fy}-${x.fp}`)).size !== 4) continue;
    const filed = window.map(x => x.filed).sort().at(-1);
    const epsOk = window.every(x => Number.isFinite(x.epsPerShareAdjusted));
    const revOk = window.every(x => Number.isFinite(x.revenue));
    const latestShares = [...window].reverse().find(x => Number.isFinite(x.dilutedSharesAdjusted) && x.dilutedSharesAdjusted > 0)?.dilutedSharesAdjusted ?? null;
    const epsPerShareAdjusted = epsOk ? window.reduce((a,x) => a + x.epsPerShareAdjusted, 0) : null;
    const ttmRevenue = revOk ? window.reduce((a,x) => a + x.revenue, 0) : null;
    const revenuePerShareAdjusted = Number.isFinite(ttmRevenue) && Number.isFinite(latestShares) ? ttmRevenue / latestShares : null;
    if (!Number.isFinite(epsPerShareAdjusted) && !Number.isFinite(revenuePerShareAdjusted)) continue;
    out.push({
      filed,
      end: window.at(-1).end,
      source: 'ttm_quarterly',
      quarters: window.map(x => ({ fy: x.fy, fp: x.fp, end: x.end, filed: x.filed, derived: x.derived })),
      epsPerShare: epsPerShareAdjusted,
      revenuePerShare: revenuePerShareAdjusted,
      epsPerShareAdjusted,
      revenuePerShareAdjusted,
    });
  }
  return out;
}

function metricQuarterRows(fact, { deriveQ4 = true } = {}) {
  const all = Object.values(fact?.units || {}).flat().filter(x => x?.filed && x?.end && Number.isFinite(x?.val) && Number.isFinite(x?.fy));
  const direct = all.filter(x => ['Q1','Q2','Q3','Q4'].includes(x.fp) && ['10-Q','10-K','20-F','6-K'].includes(x.form) && isSingleQuarter(x));
  const out = dedupeQuarterRows(direct);
  if (!deriveQ4) return out;
  const annual = all.filter(x => (x.fp === 'FY' || x.form === '10-K' || x.form === '20-F') && isAnnualDuration(x));
  const ytdQ3 = all.filter(x => x.fp === 'Q3' && ['10-Q','6-K'].includes(x.form) && isNineMonthDuration(x));
  for (const a of annual) {
    const q3 = ytdQ3.filter(x => x.fy === a.fy && Date.parse(x.end) <= Date.parse(a.end)).sort((x,y) => String(x.filed).localeCompare(String(y.filed))).at(-1);
    if (!q3) continue;
    const val = a.val - q3.val;
    if (!Number.isFinite(val)) continue;
    out.push({ ...a, fp: 'Q4', val, start: q3.end, derived: true });
  }
  return dedupeQuarterRows(out);
}

function dedupeQuarterRows(rows) {
  const map = new Map();
  for (const row of rows.sort((a,b) => String(a.filed).localeCompare(String(b.filed)))) {
    const key = `${row.fy}|${row.fp}|${row.end || ''}`;
    map.set(key, row);
  }
  return [...map.values()];
}

function durationDays(row) {
  if (!row?.start || !row?.end) return null;
  return (Date.parse(row.end) - Date.parse(row.start)) / 86400000;
}
function isSingleQuarter(row) { const d = durationDays(row); return Number.isFinite(d) && d >= 55 && d <= 120; }
function isNineMonthDuration(row) { const d = durationDays(row); return Number.isFinite(d) && d >= 220 && d <= 310; }
function isAnnualDuration(row) { const d = durationDays(row); return Number.isFinite(d) && d >= 300 && d <= 390; }

function annualRows(fact) {
  const rows = Object.values(fact?.units || {}).flat().filter(x => x?.filed && Number.isFinite(x?.val) && Number.isFinite(x?.fy) && (x.fp === 'FY' || x.form === '10-K' || x.form === '20-F'));
  rows.sort((a,b) => String(a.filed).localeCompare(String(b.filed)));
  return rows;
}
function latestForFy(rows, fy) { return rows.filter(x => x.fy === fy).sort((a,b) => String(a.filed).localeCompare(String(b.filed))).at(-1) || null; }
function latestForQuarter(rows, fy, fp, end) { return rows.filter(x => x.fy === fy && x.fp === fp && String(x.end || '') === String(end || '')).sort((a,b) => String(a.filed).localeCompare(String(b.filed))).at(-1) || null; }
function nearestShares(rows, fy, end) { return rows.filter(x => x.fy === fy && Date.parse(x.end || 0) <= Date.parse(end || 0)).sort((a,b) => String(a.end).localeCompare(String(b.end))).at(-1) || null; }
function futureSplitFactor(filedMs, splits) { let factor = 1; for (const s of splits || []) if (s.timeMs > filedMs && Number.isFinite(s.ratio) && s.ratio > 0) factor *= s.ratio; return factor; }
function latestAnnualOrQuarterly(fact) { const rows = Object.values(fact?.units || {}).flat().filter(x => x?.filed && Number.isFinite(x?.val)); rows.sort((a,b) => String(b.filed).localeCompare(String(a.filed))); return rows[0] || null; }
function latestInstant(fact) { return latestAnnualOrQuarterly(fact); }
function secHeaders(env) { return { 'user-agent': env.SEC_USER_AGENT || 'stock-research-mcp/0.3 research-service', accept: 'application/json' }; }
