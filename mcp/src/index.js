import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { analyzeStock, analyzeWatchlist } from './analyze.js';
import { getNasdaqEarningsCalendar } from './sources/nasdaq.js';

function buildServer(env) {
  const server = new McpServer({ name: 'stock-research-mcp', version: '0.2.0' });

  server.tool('analyze_stock', 'Analyze a stock with 1M price action, SEC fundamentals, 5Y point-in-time valuation, deterministic target model, and optional AI research.', {
    ticker: z.string().min(1),
    include_ai: z.boolean().optional(),
  }, async ({ ticker, include_ai }) => {
    const result = await analyzeStock(ticker, env, { includeAi: include_ai !== false });
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  });

  server.tool('get_stock_snapshot', 'Return deterministic stock setup, SEC fundamentals, valuation percentile, and target model without AI.', {
    ticker: z.string().min(1),
  }, async ({ ticker }) => {
    const result = await analyzeStock(ticker, env, { includeAi: false });
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  });

  server.tool('analyze_watchlist', 'Deep-analyze every supplied unique ticker; failures are isolated per symbol.', {
    tickers: z.array(z.string().min(1)).min(1).max(100),
    include_ai: z.boolean().optional(),
    concurrency: z.number().int().min(1).max(5).optional(),
  }, async ({ tickers, include_ai, concurrency }) => {
    const result = await analyzeWatchlist(tickers, env, {
      includeAi: include_ai !== false,
      concurrency: concurrency || 3,
    });
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  });

  server.tool('get_earnings_calendar', 'Return normalized Nasdaq public earnings-calendar rows for a date.', {
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }, async ({ date }) => {
    const rows = await getNasdaqEarningsCalendar(date, env);
    return { content: [{ type: 'text', text: JSON.stringify({ date, rows }) }] };
  });

  return server;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/health') {
      return Response.json({ ok: true, service: 'stock-research-mcp', version: '0.2.0' });
    }
    if (env.RUN_TOKEN_REQUIRED === 'true') {
      const auth = request.headers.get('authorization') || '';
      if (!env.RUN_TOKEN || auth !== `Bearer ${env.RUN_TOKEN}`) {
        return new Response('Unauthorized', { status: 401 });
      }
    }
    if (url.pathname !== '/mcp') return new Response('Not found', { status: 404 });

    const { createMcpHandler } = await import('agents/mcp');
    return createMcpHandler(buildServer(env))(request, env);
  },
};
