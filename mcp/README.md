# Stock Research MCP v0.1

Remote MCP service for the Stock Entry Radar.

## Goals

- Reuse proven data-source ideas from `growth-tech-morning-brief` without changing its production pipeline.
- Keep price/fundamental/valuation calculations deterministic.
- Use AI only for bounded evidence extraction and research synthesis.
- Deploy independently on Cloudflare Workers with R2 caching.

## Initial data sources

- Yahoo Finance unofficial chart endpoint: current/1M price history and split events.
- SEC EDGAR CompanyFacts: authoritative reported fundamentals.
- Cloudflare R2: ticker map / CompanyFacts cache and future valuation snapshots.
- AI provider router: Gemini by default, plus DeepSeek and generic OpenAI-compatible endpoints.

Future modules will add Nasdaq earnings/calendar data, five-year point-in-time valuation history, target engine, catalyst lifecycle, and batch/watchlist analysis.

## MCP tools

### `get_stock_snapshot`

Deterministic one-month price setup and core SEC fundamentals. No AI call.

### `analyze_stock`

Same deterministic packet plus optional AI research when an AI provider secret is configured.

Planned tools:

- `get_price_history`
- `get_fundamentals`
- `get_valuation`
- `get_earnings_context`
- `get_catalysts`
- `get_target_model`
- `analyze_watchlist`

## Local/deploy

```bash
cd mcp
npm install
npx wrangler r2 bucket create stock-research-mcp-data
npx wrangler secret put RUN_TOKEN
npx wrangler secret put GEMINI_API_KEY
npm run deploy
```

The Worker exposes:

- `GET /health`
- MCP Streamable HTTP endpoint: `/mcp`

Expected production URL:

```text
https://stock-research-mcp.<cloudflare-subdomain>.workers.dev/mcp
```

## AI configuration

Compatible with the existing Morning Brief environment names:

- `AI_PROVIDER=gemini|deepseek|openai-compatible`
- `AI_MODEL`
- `GEMINI_API_KEY`
- `GEMINI_MODEL` (default `gemini-3.5-flash`)
- `DEEPSEEK_API_KEY`
- `DEEPSEEK_MODEL` (default `deepseek-v4-flash`)
- `DEEPSEEK_BASE_URL`
- `OPENAI_COMPAT_API_KEY`
- `OPENAI_COMPAT_BASE_URL`
- `OPENAI_COMPAT_MODEL`

Worker secrets are scoped to each Worker. Reusing the old API account therefore still requires setting the same secret value on this Worker.

## Security

v0.1 uses a bearer `RUN_TOKEN` gate for public workers.dev deployment. The service is read-only and contains no trade execution capability. OAuth can replace bearer auth later if needed.

## Important v0.1 status

This branch is a scaffold, not yet production-ready. Before first deploy:

1. Pin and test the Cloudflare Agents MCP adapter API used by `createMcpHandler`.
2. Add tests for Yahoo/SEC parsing and incomplete data.
3. Port the old split-normalization and point-in-time valuation engine.
4. Add Nasdaq earnings/calendar and catalyst validation.
5. Add `analyze_watchlist` with bounded concurrency and R2 caching.
