const UA = 'Mozilla/5.0 stock-research-mcp/0.2';

export async function getYahooChart(ticker, { range = '1mo', interval = '1d' } = {}) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}&events=div%2Csplits&includeAdjustedClose=true`;
  const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json' } });
  if (!res.ok) throw new Error(`yahoo_chart_http_${res.status}`);
  const data = await res.json();
  const result = data?.chart?.result?.[0];
  if (!result) throw new Error(`yahoo_chart_no_result:${ticker}`);
  return result;
}

export function chartRows(chart) {
  const ts = chart?.timestamp || [];
  const q = chart?.indicators?.quote?.[0] || {};
  const adj = chart?.indicators?.adjclose?.[0]?.adjclose || [];
  return ts.map((t, i) => ({
    t,
    timeMs: t * 1000,
    close: q.close?.[i],
    adjustedClose: adj?.[i],
    high: q.high?.[i],
    low: q.low?.[i],
    volume: q.volume?.[i],
  })).filter(r => Number.isFinite(r.close));
}

export function extractSplits(chart) {
  const raw = chart?.events?.splits || {};
  return Object.values(raw).map(s => {
    let ratio = null;
    if (Number.isFinite(s?.numerator) && Number.isFinite(s?.denominator) && s.denominator !== 0) {
      ratio = s.numerator / s.denominator;
    } else if (typeof s?.splitRatio === 'string' && s.splitRatio.includes(':')) {
      const [a,b] = s.splitRatio.split(':').map(Number);
      if (Number.isFinite(a) && Number.isFinite(b) && b !== 0) ratio = a / b;
    }
    return { timeMs: (s?.date || 0) * 1000, ratio, splitRatio: s?.splitRatio || null };
  }).filter(s => Number.isFinite(s.timeMs) && Number.isFinite(s.ratio) && s.ratio > 0);
}

export function summarizeOneMonth(chart) {
  const rows = chartRows(chart);
  if (rows.length < 2) throw new Error('insufficient_price_history');
  const first = rows[0].close;
  const last = rows.at(-1).close;
  const monthHigh = Math.max(...rows.map(r => Number.isFinite(r.high) ? r.high : r.close));
  const monthLow = Math.min(...rows.map(r => Number.isFinite(r.low) ? r.low : r.close));
  const fiveStart = rows[Math.max(0, rows.length - 6)].close;
  const volumes = rows.map(r => r.volume).filter(Number.isFinite);
  const avgVolume = volumes.length ? volumes.reduce((a,b) => a+b, 0) / volumes.length : null;
  return {
    observations: rows.length,
    lastPrice: last,
    return1m: last / first - 1,
    return5d: last / fiveStart - 1,
    monthHigh,
    monthLow,
    drawdownFromMonthHigh: last / monthHigh - 1,
    distanceFromMonthLow: last / monthLow - 1,
    avgVolume,
    rows,
  };
}
