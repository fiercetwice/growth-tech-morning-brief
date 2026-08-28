import { McpServer } from '@modelcontextprotocol/server';
import { createMcpHandler } from 'agents/mcp/server';
import { z } from 'zod';
import { analyzeStock, analyzeWatchlist } from './analyze.js';
import { getNasdaqEarningsCalendar } from './sources/nasdaq.js';

function buildServer(env) {
  const server = new McpServer({ name: 'stock-research-mcp', version: '0.3.0' });

  server.registerTool('analyze_stock', {
    description: 'Analyze one stock with 1M price action, SEC TTM fundamentals, 5Y point-in-time valuation, recent SEC filings, deterministic target model, and optional AI research.',
    inputSchema: { ticker: z.string().min(1), include_ai: z.boolean().optional() },
  }, async ({ ticker, include_ai }) => ({ content: [{ type: 'text', text: JSON.stringify(await analyzeStock(ticker, env, { includeAi: include_ai !== false })) }] }));

  server.registerTool('get_stock_snapshot', {
    description: 'Return deterministic stock setup, SEC TTM fundamentals, valuation percentile, recent filings, and target model without AI.',
    inputSchema: { ticker: z.string().min(1) },
  }, async ({ ticker }) => ({ content: [{ type: 'text', text: JSON.stringify(await analyzeStock(ticker, env, { includeAi: false })) }] }));

  server.registerTool('analyze_watchlist', {
    description: 'Deep-analyze every supplied unique ticker; failures are isolated per symbol and deterministic results use R2 caching.',
    inputSchema: { tickers: z.array(z.string().min(1)).min(1).max(100), include_ai: z.boolean().optional(), concurrency: z.number().int().min(1).max(5).optional() },
  }, async ({ tickers, include_ai, concurrency }) => ({ content: [{ type: 'text', text: JSON.stringify(await analyzeWatchlist(tickers, env, { includeAi: include_ai !== false, concurrency: concurrency || 3 })) }] }));

  server.registerTool('get_earnings_calendar', {
    description: 'Return normalized Nasdaq public earnings-calendar rows for a date.',
    inputSchema: { date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) },
  }, async ({ date }) => ({ content: [{ type: 'text', text: JSON.stringify({ date, rows: await getNasdaqEarningsCalendar(date, env) }) }] }));

  return server;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/health') return Response.json({ ok: true, service: 'stock-research-mcp', version: '0.3.0' });
    if (env.RUN_TOKEN_REQUIRED === 'true') {
      const auth = request.headers.get('authorization') || '';
      if (!env.RUN_TOKEN || auth !== `Bearer ${env.RUN_TOKEN}`) return new Response('Unauthorized', { status: 401 });
    }
    if (url.pathname !== '/mcp') return new Response('Not found', { status: 404 });
    return createMcpHandler(() => buildServer(env))(request, env, ctx);
  },
};
