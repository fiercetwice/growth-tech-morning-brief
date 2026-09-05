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
const expected = ['analyze_stock', 'analyze_watchlist', 'get_earnings_calendar', 'get_entry_setup', 'get_stock_snapshot', 'get_watchlist_packet', 'get_watchlist_tickers'];
for (const name of expected) if (!names.includes(name)) throw new Error(`missing_tool:${name}`);
await client.close();

// 2. /mcp without a token must still be rejected (RUN_TOKEN_REQUIRED unchanged).
const unauthedMcp = await fetch(`${url}/mcp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
if (unauthedMcp.status !== 401) throw new Error(`expected_401_on_bare_mcp_got:${unauthedMcp.status}`);

// 3. /mcp-public is gated by an IP allowlist (env.ANTHROPIC_EGRESS_CIDRS),
// not a Bearer token or path secret. GitHub Actions runners are not in
// Anthropic's published egress range, so a correctly configured deployment
// MUST reject this call with 403 - this proves the IP allowlist is actually
// live in production, it is not a test failure. If Anthropic ever
// allowlists GitHub Actions runner ranges this assumption breaks; revisit
// only then. (See mcp/src/ip-allowlist.js unit tests for the actual
// allow/deny logic coverage - this smoke test only proves it's wired up.)
const publicRes = await fetch(`${url}/mcp-public`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
});
if (publicRes.status !== 403) throw new Error(`expected_403_ip_block_on_public_mcp_from_ci_got:${publicRes.status}`);

console.log(JSON.stringify({
  ok: true,
  era: 'modern',
  server: { name: 'stock-research-mcp', version: '0.4.3' },
  tools: names,
  publicEndpointIpAllowlistEnforced: true,
}));
