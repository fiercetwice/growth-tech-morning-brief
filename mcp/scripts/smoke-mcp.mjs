import { Client } from '@modelcontextprotocol/client';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/client/streamableHttp.js';

const url = process.env.WORKER_URL;
const token = process.env.RUN_TOKEN;
if (!url || !token) throw new Error('WORKER_URL and RUN_TOKEN are required');

const transport = new StreamableHTTPClientTransport(new URL(`${url}/mcp`), {
  requestInit: { headers: { Authorization: `Bearer ${token}` } },
});
const client = new Client({ name: 'stock-research-mcp-smoke', version: '1.0.0' });
await client.connect(transport);
const result = await client.listTools();
const names = (result.tools || []).map(x => x.name).sort();
const expected = ['analyze_stock','analyze_watchlist','get_earnings_calendar','get_entry_setup','get_stock_snapshot','get_watchlist_packet'];
for (const name of expected) if (!names.includes(name)) throw new Error(`missing_tool:${name}`);
console.log(JSON.stringify({ ok: true, era: 'modern', server: { name: 'stock-research-mcp', version: '0.4.0' }, tools: names }));
await client.close();
