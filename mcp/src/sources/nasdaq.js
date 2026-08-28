const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36';

export async function getNasdaqEarningsCalendar(date, env = {}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) throw new Error('invalid_date');
  const url = `https://api.nasdaq.com/api/calendar/earnings?date=${encodeURIComponent(date)}`;
  const res = await fetch(url, {
    headers: {
      'user-agent': env.NASDAQ_USER_AGENT || DEFAULT_UA,
      accept: 'application/json, text/plain, */*',
      'accept-language': 'en-US,en;q=0.9',
      origin: 'https://www.nasdaq.com',
      referer: 'https://www.nasdaq.com/',
    },
  });
  if (!res.ok) throw new Error(`nasdaq_earnings_http_${res.status}`);
  const body = await res.json();
  const rows = body?.data?.rows || [];
  return rows.map(normalizeRow);
}

function normalizeRow(row) {
  return {
    symbol: String(row?.symbol || '').toUpperCase() || null,
    name: row?.name || null,
    time: row?.time || null,
    fiscalQuarterEnding: row?.fiscalQuarterEnding || null,
    epsForecast: parseNumber(row?.epsForecast),
    lastYearEps: parseNumber(row?.lastYearEPS),
    lastYearReportDate: row?.lastYearRptDt || null,
    marketCap: parseMoney(row?.marketCap),
  };
}

function parseNumber(value) {
  if (value == null || value === '') return null;
  const n = Number(String(value).replace(/[$,]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function parseMoney(value) {
  if (value == null || value === '') return null;
  const s = String(value).replace(/[$,]/g, '').trim().toUpperCase();
  const m = s.match(/^(-?\d+(?:\.\d+)?)\s*([KMBT])?$/);
  if (!m) return parseNumber(value);
  const base = Number(m[1]);
  const scale = { K: 1e3, M: 1e6, B: 1e9, T: 1e12 }[m[2]] || 1;
  return base * scale;
}
