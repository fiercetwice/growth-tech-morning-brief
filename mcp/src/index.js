import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { analyzeStock } from './analyze.js';

function buildServer(env) {
  const server = new McpServer({ name: 'stock-research-mcp', version: '0.1.0' });

  server.tool('analyze_stock', 'Analyze a stock with 1M price action, SEC fundamentals, and optional AI research.', {
    ticker: z.string().min(1),
  }, async ({ ticker }) => {
    const result = await analyzeStock(ticker, env);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  });

  server.tool('get_stock_snapshot', 'Return deterministic 1M stock setup and core SEC fundamentals.', {
    ticker: z.string().min(1),
  }, async ({ ticker }) => {
    const result = await analyzeStock(ticker, { ...env, GEMINI_API_KEY: undefined, DEEPSEEK_API_KEY: undefined, OPENAI_COMPAT_API_KEY: undefined });
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  });

  return server;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/health') {
      return Response.json({ ok: true, service: 'stock-research-mcp', version: '0.1.0' });
    }
    if (env.RUN_TOKEN_REQUIRED === 'true') {
      const auth = request.headers.get('authorization') || '';
      if (!env.RUN_TOKEN || auth !== `Bearer ${env.RUN_TOKEN}`) {
        return new Response('Unauthorized', { status: 401 });
      }
    }
    if (url.pathname !== '/mcp') return new Response('Not found', { status: 404 });

    // Streamable HTTP transport wiring is intentionally isolated here so the
    // data/engine modules remain transport-agnostic. This branch is the v0.1
    // scaffold; deployment validation will pin the Cloudflare MCP adapter API.
    const { createMcpHandler } = await import('agents/mcp');
    return createMcpHandler(buildServer(env))(request, env);
  },
};
