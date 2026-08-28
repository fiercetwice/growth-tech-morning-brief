import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';

const url = process.env.WORKER_URL;
const token = process.env.RUN_TOKEN;
if (!url) throw new Error('WORKER_URL required');
if (!token) throw new Error('RUN_TOKEN required');

const client = new Client(
  { name: 'github-smoke', version: '1.0.0' },
  { versionNegotiation: { mode: 'auto' } },
);
const transport = new StreamableHTTPClientTransport(new URL(`${url.replace(/\/$/, '')}/mcp`), {
  requestInit: { headers: { Authorization: `Bearer ${token}` } },
});

try {
  await client.connect(transport);
  const tools = await client.listTools();
  const names = new Set((tools?.tools || []).map(t => t.name));
  const expected = ['analyze_stock', 'get_stock_snapshot', 'analyze_watchlist', 'get_earnings_calendar'];
  for (const name of expected) {
    if (!names.has(name)) throw new Error(`missing_tool:${name}`);
  }
  console.log(JSON.stringify({
    ok: true,
    era: client.getProtocolEra?.() || null,
    server: client.getServerVersion?.() || null,
    tools: [...names].sort(),
  }));
} finally {
  await client.close().catch(() => {});
}
