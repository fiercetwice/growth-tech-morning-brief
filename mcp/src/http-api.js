import { analyzeStock, analyzeWatchlist } from './analyze.js';
import { buildEntrySetup, buildWatchlistPacket } from './radar.js';

const SYMBOL_RE = /^[A-Z0-9.\-]{1,16}$/;

function json(data, status = 200, maxAge = 300) {
  return Response.json(data, {
    status,
    headers: {
      'cache-control': `public, max-age=${maxAge}, s-maxage=${maxAge}`,
      'x-content-type-options': 'nosniff',
    },
  });
}

function tickerParam(url) {
  const ticker = String(url.searchParams.get('ticker') || '').trim().toUpperCase();
  if (!SYMBOL_RE.test(ticker)) throw new Error('invalid_ticker');
  return ticker;
}

function tickersParam(url) {
  const raw = String(url.searchParams.get('tickers') || '');
  const tickers = [...new Set(raw.split(',').map(x => x.trim().toUpperCase()).filter(Boolean))];
  if (!tickers.length || tickers.length > 75 || tickers.some(x => !SYMBOL_RE.test(x))) {
    throw new Error('invalid_tickers');
  }
  return tickers;
}

export async function handlePublicApi(request, env) {
  const url = new URL(request.url);
  if (request.method !== 'GET') return json({ ok: false, error: 'method_not_allowed' }, 405, 0);

  try {
    if (url.pathname === '/api/v1/stock') {
      const ticker = tickerParam(url);
      const data = await analyzeStock(ticker, env, { includeAi: false });
      return json({ ok: true, data }, 200, 300);
    }

    if (url.pathname === '/api/v1/entry') {
      const ticker = tickerParam(url);
      const analysis = await analyzeStock(ticker, env, { includeAi: false });
      return json({ ok: true, data: buildEntrySetup(analysis) }, 200, 300);
    }

    if (url.pathname === '/api/v1/watchlist') {
      const tickers = tickersParam(url);
      const batch = await analyzeWatchlist(tickers, env, { includeAi: false, concurrency: 3 });
      return json({ ok: true, data: buildWatchlistPacket(batch) }, 200, 300);
    }

    return null;
  } catch (error) {
    const message = String(error?.message || error);
    const badRequest = message === 'invalid_ticker' || message === 'invalid_tickers';
    return json({ ok: false, error: message }, badRequest ? 400 : 502, 0);
  }
}
