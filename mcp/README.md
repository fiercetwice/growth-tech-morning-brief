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

## IP-allowlisted public MCP endpoint (`/mcp-public`)

`/mcp` requires the `RUN_TOKEN` bearer header. Claude's hosted connector UI (individual Pro/Max accounts) has no field for a static Bearer token today - only OAuth, and Claude's OAuth-connector flow has open, actively-reported reliability issues (token issued successfully but never attached to subsequent MCP requests). Rather than build and maintain a full OAuth authorization server for a single-user project, `/mcp-public` stays `none`-auth from MCP's perspective (fully supported, no OAuth-connector bugs) but is gated by an IP allowlist: it only accepts requests whose `CF-Connecting-IP` (set by Cloudflare's edge, not client-controlled) falls inside `env.ANTHROPIC_EGRESS_CIDRS` (currently `160.79.104.0/21`, Anthropic's published outbound range for Claude's hosted connector traffic across Claude.ai, Desktop, mobile, and Cowork - see `https://platform.claude.com/docs/en/api/ip-addresses`, and re-verify occasionally since Anthropic may change it). Requests from outside that range get a `403`.

Because this Worker runs on a `*.workers.dev` subdomain rather than a custom domain in this Cloudflare account, zone-level WAF Custom Rules do not apply here (`workers.dev` is Cloudflare's own zone, not one in this account) - so the check happens in the Worker's own code instead (`src/ip-allowlist.js`). The allowlist is skipped entirely (allow-all) when `ANTHROPIC_EGRESS_CIDRS` is unset or blank, so a missing config fails open rather than locking the endpoint out - deliberate, since this is the *only* gate on `/mcp-public` (no path secret, no Bearer token). Note this allows any caller whose traffic happens to originate from Anthropic's shared connector IP range, not specifically this project's owner - it is not equivalent to a per-user credential, and was chosen anyway given the tool set behind it is limited to deterministic ticker-symbol reads with no AI, no account data, and no write behavior.

It reuses the same `analyzeStock` / `analyzeWatchlist` / `buildEntrySetup` / `buildWatchlistPacket` / `getNasdaqEarningsCalendar` / `getConfiguredTickers` implementations as `/mcp` and `/api/v1/*` — no business logic is duplicated — but registers only:

- `get_entry_setup`
- `get_watchlist_packet` (capped at 25 tickers, vs. 100 on `/mcp`)
- `get_earnings_calendar`
- `get_watchlist_tickers` - returns the current `radar-tickers.txt` list (ticker symbols only, no analysis) so callers don't have to hardcode the watchlist; bundled into the Worker via the `Text` module rule in `wrangler.jsonc`

`analyze_stock`, `get_stock_snapshot`, and `analyze_watchlist` are never registered on this endpoint, so it cannot invoke the AI provider and cannot be used to run an unbounded/expensive batch. Ticker input is validated against the same symbol pattern as the REST API. `/mcp` is unchanged and still requires `RUN_TOKEN`.

Because GitHub Actions runners are not in Anthropic's published range, the CI smoke test intentionally asserts a `403` when it calls `/mcp-public` - that is proof the allowlist is live in production, not a test failure.

## Security

v0.2 uses a bearer `RUN_TOKEN` gate for public workers.dev deployment. The service is read-only and contains no brokerage credentials or trade-execution capability. `/mcp-public` (see above) uses an IP allowlist rather than full OAuth - OAuth was considered and rejected for this single-user project both due to the implementation/maintenance burden of running an authorization server and due to Claude's own documented OAuth-connector reliability bugs. If the IP-allowlist approach ever proves insufficient (e.g. Anthropic's range gets reused in a way that matters, or the tool set behind it grows more sensitive), a path secret or rate limiting would be reasonable next layers before reconsidering full OAuth.

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
