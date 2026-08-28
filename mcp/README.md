# Stock Research MCP v0.2

Remote MCP service for the Stock Entry Radar.

## Goals

- Reuse proven data-source ideas from `growth-tech-morning-brief` without changing its production pipeline.
- Keep price, fundamental, valuation, and target calculations deterministic.
- Use AI only for bounded evidence extraction and research synthesis.
- Deploy independently on Cloudflare Workers with R2 caching.

## Data sources

- Yahoo Finance unofficial chart endpoint: 1M and 5Y price history, adjusted closes, volume, and split events.
- SEC EDGAR CompanyFacts: authoritative reported fundamentals and filing vintages.
- Nasdaq public earnings-calendar endpoint: normalized earnings schedule rows.
- Cloudflare R2: SEC ticker map / CompanyFacts cache and future research caches.
- AI provider router: Gemini by default, plus DeepSeek and generic OpenAI-compatible endpoints.

Yahoo and Nasdaq endpoints are unofficial public endpoints and can change or rate-limit. SEC is the authoritative fundamentals source. Source failures are isolated rather than silently replaced with invented values.

## Deterministic valuation layer

v0.2 builds a point-in-time valuation history from price observations and SEC filing vintages. A price date can use only a filing that had already been published by that date. Yahoo split events normalize historical EPS/share and revenue/share to the current-share basis.

Current implementation intentionally starts with annual filing vintages. This is conservative and avoids look-ahead bias; quarterly TTM reconstruction is the next accuracy upgrade.

For P/E and P/S histories the engine reports:

- current multiple
- P25 / P50 / P75
- historical percentile
- observation count
- filing-vintage count

The deterministic target engine uses a profitable company's P/E history when available, otherwise P/S, to produce:

- bear value = P25 multiple × latest split-normalized per-share fundamental
- base value = P50 multiple × latest split-normalized per-share fundamental
- bull value = P75 multiple × latest split-normalized per-share fundamental
- base upside
- preferred entry threshold (`base / 1.20`)
- modeled risk/reward
- confidence based on history and filing coverage

These are model-implied values, not Wall Street analyst targets.

## MCP tools

### `get_stock_snapshot`
Deterministic packet only: 1M setup, SEC fundamentals, 5Y valuation percentile, and target model. No AI call.

### `analyze_stock`
Same deterministic packet plus optional AI research. AI is instructed not to override deterministic calculations or invent targets/catalysts.

### `analyze_watchlist`
Deep-analyzes every unique supplied ticker (up to 100) with bounded concurrency. Failure is isolated per ticker. `include_ai=false` can be used for a deterministic full-universe pass; `include_ai=true` performs AI research for every successfully loaded name.

### `get_earnings_calendar`
Returns normalized Nasdaq public earnings-calendar rows for a YYYY-MM-DD date.

## Local test / deploy

```bash
cd mcp
npm install
npm test
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

Worker secrets are scoped to each Worker. Reusing the old AI account still requires adding the same secret to this new Worker.

## Security

v0.2 uses a bearer `RUN_TOKEN` gate for public workers.dev deployment. The service is read-only and contains no brokerage credentials or trade-execution capability. OAuth can replace bearer auth later.

## Tests

`npm test` currently covers:

- no-look-ahead filing selection
- split normalization of per-share data
- deterministic target-method selection

## Remaining production work

1. Validate and pin the Cloudflare Agents MCP transport API in a real Worker deploy.
2. Upgrade annual valuation vintages to quarterly point-in-time TTM reconstruction.
3. Add company-specific catalyst lifecycle and IR/SEC event verification.
4. Add persistent R2 stock-analysis cache to reduce repeated Yahoo/SEC/AI calls.
5. Add a Radar-oriented batch response that directly exposes entry-setup fields, target confidence, and missing-data reasons.
