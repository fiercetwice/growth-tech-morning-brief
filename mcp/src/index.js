import { McpServer } from '@modelcontextprotocol/server';
import { createMcpHandler } from 'agents/mcp/server';
import { z } from 'zod';
import { analyzeStock, analyzeWatchlist } from './analyze.js';
import { buildEntrySetup, buildWatchlistPacket } from './radar.js';
import { getNasdaqEarningsCalendar } from './sources/nasdaq.js';
import { handlePublicApi } from './http-api.js';
import { OPENAPI_SPEC } from './openapi.js';

const VERSION = '0.4.3';

// Symbols allowed through the unauthenticated public MCP endpoint. Same shape
// as SYMBOL_RE in http-api.js, duplicated here (not imported) since it is not
// currently exported; kept intentionally strict for an unauthenticated surface.
const PUBLIC_SYMBOL_RE = /^[A-Z0-9.\-]{1,16}$/;
const PUBLIC_TICKER_SCHEMA = z.string().min(1).max(16).regex(PUBLIC_SYMBOL_RE, 'invalid_ticker');
// Lower than the internal /mcp cap (100) and the REST cap (75): this endpoint
// has no auth and no rate limiting yet, so batch size is the main throttle.
const PUBLIC_MAX_TICKERS = 25;
const PUBLIC_CONCURRENCY = 3;

function registerCoreTools(server, env) {
  server.registerTool('analyze_stock', {
    description: 'Analyze one stock with 1M price action, SEC TTM fundamentals, 5Y point-in-time valuation, recent SEC filings, deterministic target model, and optional AI research.',
    inputSchema: { ticker: z.string().min(1), include_ai: z.boolean().optional() },
  }, async ({ ticker, include_ai }) => ({ content: [{ type: 'text', text: JSON.stringify(await analyzeStock(ticker, env, { includeAi: include_ai !== false })) }] }));

  server.registerTool('get_stock_snapshot', {
    description: 'Return deterministic stock setup, SEC TTM fundamentals, valuation percentile, recent filings, and target model without AI.',
    inputSchema: { ticker: z.string().min(1) },
  }, async ({ ticker }) => ({ content: [{ type: 'text', text: JSON.stringify(await analyzeStock(ticker, env, { includeAi: false })) }] }));

  server.registerTool('get_entry_setup', {
    description: 'Return a compact single-stock entry packet with the fields needed by Stock Entry Radar BUY/STARTER gates.',
    inputSchema: { ticker: z.string().min(1) },
  }, async ({ ticker }) => {
    const analysis = await analyzeStock(ticker, env, { includeAi: false });
    return { content: [{ type: 'text', text: JSON.stringify(buildEntrySetup(analysis)) }] };
  });

  server.registerTool('analyze_watchlist', {
    description: 'Deep-analyze every supplied unique ticker; failures are isolated per symbol and deterministic results use R2 caching.',
    inputSchema: { tickers: z.array(z.string().min(1)).min(1).max(100), include_ai: z.boolean().optional(), concurrency: z.number().int().min(1).max(5).optional() },
  }, async ({ tickers, include_ai, concurrency }) => ({ content: [{ type: 'text', text: JSON.stringify(await analyzeWatchlist(tickers, env, { includeAi: include_ai !== false, concurrency: concurrency || 3 })) }] }));

  server.registerTool('get_watchlist_packet', {
    description: 'Return a compact full-watchlist packet for Stock Entry Radar, including entry setup, valuation context, latest SEC filing hint, cache state, and per-symbol failures.',
    inputSchema: { tickers: z.array(z.string().min(1)).min(1).max(100), concurrency: z.number().int().min(1).max(5).optional() },
  }, async ({ tickers, concurrency }) => {
    const batch = await analyzeWatchlist(tickers, env, { includeAi: false, concurrency: concurrency || 3 });
    return { content: [{ type: 'text', text: JSON.stringify(buildWatchlistPacket(batch)) }] };
  });

  server.registerTool('get_earnings_calendar', {
    description: 'Return normalized Nasdaq public earnings-calendar rows for a date.',
    inputSchema: { date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) },
  }, async ({ date }) => ({ content: [{ type: 'text', text: JSON.stringify({ date, rows: await getNasdaqEarningsCalendar(date, env) }) }] }));
}

function buildServer(env) {
  const server = new McpServer({ name: 'stock-research-mcp', version: VERSION });
  registerCoreTools(server, env);
  return server;
}

// Restricted, unauthenticated server for Claude connector access (and any
// other client that can't send a custom Bearer token). Exposes only the
// deterministic, read-only Stock Entry Radar tools — no analyze_stock /
// analyze_watchlist (those can invoke the AI provider), no account or
// brokerage data, no write behavior. Reuses the exact same underlying
// analyze/radar/nasdaq implementations as the authenticated /mcp endpoint
// and the /api/v1 REST routes; no business logic is duplicated here.
export function buildPublicServer(env) {
  const server = new McpServer({ name: 'stock-research-mcp-public', version: VERSION });

  server.registerTool('get_entry_setup', {
    description: 'Return a compact single-stock entry packet with the fields needed by Stock Entry Radar BUY/STARTER gates.',
    inputSchema: { ticker: PUBLIC_TICKER_SCHEMA },
  }, async ({ ticker }) => {
    const analysis = await analyzeStock(ticker.toUpperCase(), env, { includeAi: false });
    return { content: [{ type: 'text', text: JSON.stringify(buildEntrySetup(analysis)) }] };
  });

  server.registerTool('get_watchlist_packet', {
    description: `Return a compact full-watchlist packet for Stock Entry Radar (max ${PUBLIC_MAX_TICKERS} tickers on this public endpoint).`,
    inputSchema: { tickers: z.array(PUBLIC_TICKER_SCHEMA).min(1).max(PUBLIC_MAX_TICKERS) },
  }, async ({ tickers }) => {
    const unique = [...new Set(tickers.map(t => t.toUpperCase()))];
    const batch = await analyzeWatchlist(unique, env, { includeAi: false, concurrency: PUBLIC_CONCURRENCY });
    return { content: [{ type: 'text', text: JSON.stringify(buildWatchlistPacket(batch)) }] };
  });

  server.registerTool('get_earnings_calendar', {
    description: 'Return normalized Nasdaq public earnings-calendar rows for a date.',
    inputSchema: { date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) },
  }, async ({ date }) => ({ content: [{ type: 'text', text: JSON.stringify({ date, rows: await getNasdaqEarningsCalendar(date, env) }) }] }));

  return server;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/health') return Response.json({ ok: true, service: 'stock-research-mcp', version: VERSION });
    if (url.pathname === '/openapi.json') {
      if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });
      return Response.json(OPENAPI_SPEC, {
        headers: {
          'cache-control': 'public, max-age=300, s-maxage=300',
          'x-content-type-options': 'nosniff',
        },
      });
    }

    if (url.pathname.startsWith('/api/v1/')) {
      const response = await handlePublicApi(request, env);
      if (response) return response;
    }

    // Unauthenticated, restricted MCP surface for clients (e.g. the Claude
    // connector UI) that can't attach a custom Bearer token. Deliberately
    // checked before the RUN_TOKEN_REQUIRED gate below so it never requires
    // auth; buildPublicServer() itself limits which tools are registered.
    if (url.pathname === '/mcp-public') {
      return createMcpHandler(() => buildPublicServer(env))(request, env, ctx);
    }

    if (env.RUN_TOKEN_REQUIRED === 'true') {
      const auth = request.headers.get('authorization') || '';
      if (!env.RUN_TOKEN || auth !== `Bearer ${env.RUN_TOKEN}`) return new Response('Unauthorized', { status: 401 });
    }
    if (url.pathname !== '/mcp') return new Response('Not found', { status: 404 });
    return createMcpHandler(() => buildServer(env))(request, env, ctx);
  },
};
