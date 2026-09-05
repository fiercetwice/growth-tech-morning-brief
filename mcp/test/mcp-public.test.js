import test from 'node:test';
import assert from 'node:assert/strict';
import { createMcpHandler } from 'agents/mcp/server';
import { buildPublicServer } from '../src/index.js';

// buildPublicServer() never needs live env for this test: we only inspect
// which tools got registered and how they validate input, we don't invoke
// their handlers (which would hit Yahoo/SEC/R2).
function registeredToolNames(server) {
  return Object.keys(server._registeredTools || {}).sort();
}

function fieldSchema(server, toolName, field) {
  const tool = server._registeredTools?.[toolName];
  assert.ok(tool, `${toolName} must be registered`);
  // inputSchema is a ZodObject wrapping the tool's shape (see registerTool
  // usage in src/index.js), so drill into .shape to get the per-field schema.
  const schema = tool.inputSchema?.shape?.[field];
  assert.ok(schema, `expected a zod schema for ${toolName}.${field}`);
  return schema;
}

test('public MCP server exposes exactly the three restricted radar tools', () => {
  const server = buildPublicServer({});
  const names = registeredToolNames(server);
  assert.deepEqual(names, ['get_earnings_calendar', 'get_entry_setup', 'get_watchlist_packet']);
});

test('public MCP server never registers AI-enabled or write-capable tools', () => {
  const server = buildPublicServer({});
  const names = registeredToolNames(server);
  for (const forbidden of ['analyze_stock', 'analyze_watchlist', 'get_stock_snapshot']) {
    assert.equal(names.includes(forbidden), false, `${forbidden} must not be exposed publicly`);
  }
});

test('public get_watchlist_packet input schema rejects batches above the public cap', () => {
  const server = buildPublicServer({});
  const schema = fieldSchema(server, 'get_watchlist_packet', 'tickers');
  const tooMany = Array.from({ length: 26 }, (_, i) => `T${i}`);
  assert.equal(schema.safeParse(tooMany).success, false, 'batches above 25 tickers should fail validation');
  const ok = Array.from({ length: 25 }, (_, i) => `T${i}`);
  assert.equal(schema.safeParse(ok).success, true, 'exactly 25 tickers should be allowed');
});

test('public ticker schema rejects malformed symbols', () => {
  const server = buildPublicServer({});
  const schema = fieldSchema(server, 'get_entry_setup', 'ticker');
  assert.equal(schema.safeParse('AAPL').success, true);
  assert.equal(schema.safeParse('DROP TABLE').success, false);
  assert.equal(schema.safeParse('').success, false);
});

// Regression test for a real deploy bug: createMcpHandler's underlying
// createStatelessMcpHandler defaults its internal `route` option to "/mcp"
// and 404s any request whose pathname doesn't match that route - regardless
// of which path index.js itself dispatched on. Without passing
// { route: '/mcp-public' } explicitly, every request to /mcp-public was
// silently 404'd by the MCP library itself, even though our own routing in
// index.js was correct. This test calls the handler exactly as index.js
// does (including the route option) and checks it does NOT reflexively 404
// its own path, and DOES 404 a path it wasn't configured for.
test('mcp-public handler is reachable at its own path (route option wired correctly)', async () => {
  const handler = createMcpHandler(() => buildPublicServer({}), { route: '/mcp-public' });
  const req = new Request('https://example.com/mcp-public', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
  });
  const res = await handler(req, {}, {});
  assert.notEqual(res.status, 404, 'handler must not 404 requests to the path it was configured with');
});

test('mcp-public handler 404s a path it was not configured for', async () => {
  const handler = createMcpHandler(() => buildPublicServer({}), { route: '/mcp-public' });
  const req = new Request('https://example.com/some-other-path', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
  });
  const res = await handler(req, {}, {});
  assert.equal(res.status, 404);
});
