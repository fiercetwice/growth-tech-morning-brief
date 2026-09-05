import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';

const url = process.env.WORKER_URL;
const token = process.env.RUN_TOKEN;
if (!url || !token) throw new Error('WORKER_URL and RUN_TOKEN are required');

// 1. Authenticated /mcp: unchanged behavior, full tool set, Bearer required.
const transport = new StreamableHTTPClientTransport(new URL(`${url}/mcp`), {
  requestInit: { headers: { Authorization: `Bearer ${token}` } },
});
const client = new Client({ name: 'stock-research-mcp-smoke', version: '1.0.0' });
await client.connect(transport);
const result = await client.listTools();
const names = (result.tools || []).map(x => x.name).sort();
const expected = ['analyze_stock','analyze_watchlist','get_earnings_calendar','get_entry_setup','get_stock_snapshot','get_watchlist_packet'];
for (const name of expected) if (!names.includes(name)) throw new Error(`missing_tool:${name}`);
await client.close();

// 2. /mcp without a token must still be rejected (RUN_TOKEN_REQUIRED unchanged).
const unauthedMcp = await fetch(`${url}/mcp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
if (unauthedMcp.status !== 401) throw new Error(`expected_401_on_bare_mcp_got:${unauthedMcp.status}`);

// 3. /mcp-public: no auth header, restricted tool set only.
const publicTransport = new StreamableHTTPClientTransport(new URL(`${url}/mcp-public`));
const publicClient = new Client({ name: 'stock-research-mcp-smoke-public', version: '1.0.0' });
await publicClient.connect(publicTransport);
const publicResult = await publicClient.listTools();
const publicNames = (publicResult.tools || []).map(x => x.name).sort();
const expectedPublic = ['get_earnings_calendar', 'get_entry_setup', 'get_watchlist_packet'];
if (publicNames.join(',') !== expectedPublic.join(',')) {
  throw new Error(`unexpected_public_tool_set:${publicNames.join(',')}`);
}
for (const forbidden of ['analyze_stock', 'analyze_watchlist', 'get_stock_snapshot']) {
  if (publicNames.includes(forbidden)) throw new Error(`forbidden_tool_exposed_publicly:${forbidden}`);
}
await publicClient.close();

console.log(JSON.stringify({
  ok: true,
  era: 'modern',
  server: { name: 'stock-research-mcp', version: '0.4.3' },
  tools: names,
  publicTools: publicNames,
}));
