import test from 'node:test';
import assert from 'node:assert/strict';
import { createMcpHandler } from 'agents/mcp/server';
import worker, { buildPublicServer } from '../src/index.js';

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

test('public MCP server exposes exactly the four allowed radar tools', () => {
  const server = buildPublicServer({});
  const names = registeredToolNames(server);
  // get_watchlist_tickers added deliberately: it only returns ticker symbols
  // (no analysis, no account data), sourced from the same static config file
  // the SEC sync workflow already reads, so it keeps the daily-monitor task
  // in sync with radar-tickers.txt without hardcoding the list into a prompt.
  assert.deepEqual(names, ['get_earnings_calendar', 'get_entry_setup', 'get_watchlist_packet', 'get_watchlist_tickers']);
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

// --- Full default-export fetch handler: /mcp-public gated by IP allowlist ---
// These exercise export default { fetch } directly, the way the real Worker
// dispatches, rather than calling createMcpHandler in isolation - this is
// what actually caught the missing-route-option bug in the first place, so
// the routing layer itself needs its own coverage independent of
// buildPublicServer()'s tool list.

function baseEnv(overrides = {}) {
  return {
    RUN_TOKEN_REQUIRED: 'true',
    RUN_TOKEN: 'unit-test-run-token',
    ...overrides,
  };
}

test('fetch: /mcp-public reaches the public MCP server when no IP allowlist is configured', async () => {
  const env = baseEnv({ ANTHROPIC_EGRESS_CIDRS: undefined });
  const req = new Request('https://example.com/mcp-public', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
  });
  const res = await worker.fetch(req, env, {});
  assert.notEqual(res.status, 401);
  assert.notEqual(res.status, 403);
  assert.notEqual(res.status, 404);
});

test('fetch: /mcp-public is blocked by IP allowlist when caller IP is outside it', async () => {
  const env = baseEnv({ ANTHROPIC_EGRESS_CIDRS: '160.79.104.0/21' });
  const req = new Request('https://example.com/mcp-public', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'cf-connecting-ip': '8.8.8.8' },
    body: '{}',
  });
  const res = await worker.fetch(req, env, {});
  assert.equal(res.status, 403);
});

test('fetch: /mcp-public with an allowlisted IP reaches the public MCP server', async () => {
  const env = baseEnv({ ANTHROPIC_EGRESS_CIDRS: '160.79.104.0/21' });
  const req = new Request('https://example.com/mcp-public', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'cf-connecting-ip': '160.79.105.10' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
  });
  const res = await worker.fetch(req, env, {});
  assert.notEqual(res.status, 403);
  assert.notEqual(res.status, 401);
  assert.notEqual(res.status, 404);
});

test('fetch: /mcp (private, Bearer-protected) behavior is unchanged by the public-endpoint work', async () => {
  const env = baseEnv();
  const unauthed = await worker.fetch(new Request('https://example.com/mcp', { method: 'POST', body: '{}' }), env, {});
  assert.equal(unauthed.status, 401);

  const authed = await worker.fetch(new Request('https://example.com/mcp', {
    method: 'POST',
    headers: { authorization: 'Bearer unit-test-run-token', 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
  }), env, {});
  assert.notEqual(authed.status, 401);
  assert.notEqual(authed.status, 404);
});
