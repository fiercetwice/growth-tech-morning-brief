# Growth Tech Morning Brief v0.5.10 — typed company events and analysis

Cloudflare Worker that collects a Growth Tech market snapshot at 09:35 America/New_York without a paid FMP plan.

## Sources and fields

- Yahoo Finance's unofficial chart endpoint: current price, daily move, 52-week position and five years of split-adjusted daily history.
- Yahoo Finance's unofficial chart endpoint: S&P 500, Nasdaq 100, Dow and Russell 2000 futures; U.S. 10-year yield; U.S. Dollar Index; WTI and Brent crude, including daily moves and quote timestamps.
- Nasdaq public calendar endpoints: today's economic releases and earnings schedule, including available event times, actual/consensus/previous values, EPS forecasts and covered-watchlist matches.
- Federal Reserve official monetary-policy RSS: fresh rate decisions, FOMC statements, projections, and Chair commentary published during the prior seven days.
- Yahoo Finance's unofficial search-news endpoint: fresh company headlines for covered symbols, including publisher, URL, publication time, and symbol association.
- Nasdaq's unofficial public full-market stock screener: roughly 7,000 listed companies, including sector, industry, market capitalization, price move, and volume. Growth-Tech equities outside the core watchlist are filtered by market capitalization, dollar liquidity, theme relevance, and abnormal move before Yahoo news enrichment and AI review.
- SEC EDGAR CompanyFacts: reported revenue, diluted EPS, diluted shares, cash and debt. Discovery names use the SEC ticker map plus Nasdaq's screened current price/market cap to calculate current trailing P/E or P/S without extra history requests.
- Local calculation: reported TTM and latest-quarter revenue/EPS growth, point-in-time trailing P/E and P/S history, and five-year valuation percentiles. A historical date uses only SEC filings published by that date, avoiding look-ahead bias.
- Deterministic Target & Mispricing Engine: when the SEC cache is fresh and history is sufficient, apply historical trailing-multiple P25/P50/P75 to the latest valid split-normalized TTM EPS/share or revenue/share input to produce bear/base/bull implied values. Prior filing vintages are retained for dispersion checks. The output separates the broad valuation threshold from executable suggested and stronger buy zones. Buy zones combine the 60-session close distribution, 20-session realized volatility, the valuation threshold, and a 2.0x minimum modeled risk/reward cap; no model-generated price is accepted.
- Absolute opportunity gate: material fresh events, same-day earnings, moves of at least 3%, or extreme valuation/range risk flags may reach structured AI research. Buy/Sell still require a verified catalyst. Without supplied holdings and target weights, `Trim` and `Review position size` are not allowed actions; extreme valuation remains Watch-only.
- R2 caches SEC responses for seven days, keeps full dated calculation snapshots, stores compact dated briefs, and saves Gemini-generated Markdown reports.

Yahoo and Nasdaq endpoints are unofficial public web endpoints and can change or rate-limit access. Every context category carries source and freshness metadata, and a category failure never blocks the equity snapshot. The Federal Reserve feed is official, but its inclusion does not by itself imply that a policy item caused a stock move. SEC data is authoritative but issuers use differing XBRL tags; unavailable fields remain null rather than being invented. Analyst-consensus forward valuation, target prices, and estimate revisions are not included and remain explicitly unavailable; trailing-implied ranges are never labeled analyst targets.

## One-time R2 setup and deployment

```bash
npx wrangler r2 bucket create growth-tech-brief-data
npm install
npm test
npm run deploy
```

The existing `RUN_TOKEN` remains attached to the Worker. `FMP_API_KEY` is no longer used and may be deleted later with `npx wrangler secret delete FMP_API_KEY`.

Manual run:

```bash
curl -X POST \
  "https://growth-tech-morning-brief.ck-market-tools.workers.dev/run" \
  -H "Authorization: Bearer YOUR_RUN_TOKEN"
```

`/run` now returns a compact JSON brief with a ready-to-render `markdown` field. Full price, fundamental and valuation histories are retained in R2 instead of being returned to the terminal.

Run the full report pipeline immediately, including snapshot refresh, AI report generation, R2 report storage, and delivery:

```bash
curl -X POST \
  "https://growth-tech-morning-brief.ck-market-tools.workers.dev/run-report" \
  -H "Authorization: Bearer YOUR_RUN_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{}'
```

Retry delivery for today's existing report without calling Gemini or overwriting the stored report:

```bash
curl -X POST \
  "https://growth-tech-morning-brief.ck-market-tools.workers.dev/run-report" \
  -H "Authorization: Bearer YOUR_RUN_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"forceDelivery":true}'
```

Regenerate today's stored report before retrying delivery. The previous stored report is preserved if the selected provider does not return a complete, validated report:

```bash
curl -X POST \
  "https://growth-tech-morning-brief.ck-market-tools.workers.dev/run-report" \
  -H "Authorization: Bearer YOUR_RUN_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"forceRegenerate":true,"forceDelivery":true}'
```

Test a preconfigured DeepSeek route without changing the scheduled default. A provider/model override requires forced regeneration so the request cannot silently reuse a report generated by another model:

```bash
curl -X POST \
  "https://growth-tech-morning-brief.ck-market-tools.workers.dev/run-report" \
  -H "Authorization: Bearer YOUR_RUN_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"forceRegenerate":true,"provider":"deepseek","model":"deepseek-v4-flash"}'
```

Deliver the latest stored report to the configured webhook:

```bash
curl -X POST \
  "https://growth-tech-morning-brief.ck-market-tools.workers.dev/deliver-latest" \
  -H "Authorization: Bearer YOUR_RUN_TOKEN"
```

Read the latest saved brief:

```bash
curl "https://growth-tech-morning-brief.ck-market-tools.workers.dev/latest" \
  -H "Authorization: Bearer YOUR_RUN_TOKEN"
```


## GitHub Actions deployment

The `.github/workflows/cloudflare-worker.yml` workflow runs `npm test` for pull requests, pushes to `main`, and manual dispatches. Successful pushes to `main` and manual dispatches deploy the Worker with `npm run deploy` using the existing `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repository secrets. Before the post-deploy report test, the workflow waits until `/health` reports the exact engine version and build revision. It then calls the build-specific `/run-report/v0.5.10/build/0.5.10` endpoint and retries only a 404 response, so a still-propagating older Worker cannot generate or overwrite the new report artifact.


## AI provider router, report generation, and delivery

On the valid 09:35 AM ET scheduled run, the Worker writes the stock snapshot, reads `snapshots/latest.json` back from R2, routes a compact snapshot to the selected AI provider, and stores the generated Markdown report at both `reports/YYYY-MM-DD.md` and `reports/latest.md`. `AI_PROVIDER` selects `gemini` (default), `deepseek`, or `openai-compatible`. Scheduled runs use environment configuration; authenticated `/run-report` requests may temporarily override `provider` and `model` only when `forceRegenerate` is true. Request bodies cannot set base URLs, so the Worker cannot be used as an arbitrary outbound proxy.

Gemini defaults to `gemini-3.5-flash` with low thinking. DeepSeek uses its official OpenAI-compatible Chat Completions endpoint, defaults to `deepseek-v4-flash`, and disables thinking. Neither route sets an application-level output-token ceiling. Generic OpenAI-compatible endpoints are available only through a preconfigured HTTPS base URL and secret.

Each provider returns bounded structured research packets. The final Markdown is not model-generated: deterministic code renders and validates the exact five-section product schema—Executive Summary, Overnight and Market Context, AI Cycle Dashboard, Sector Scorecard, and Watchlist. Executive Summary is capped at five neutral, decision-oriented bullets: `AI Cycle and Sector Implications`, `Market Context`, one lifecycle-aware event field (`Key Scheduled Event`, `Key Reported Event`, or `Key Event Status`), `Highest-Ranked Recommendation`, and `Primary Valuation Risk`. Core-watchlist events outrank discovery headlines; stale and missing-data warnings remain in the underlying sections unless they invalidate an action. Post-research model `Avoid` positions remain in the separate Research Audit. The two dashboards contain every configured row; the Watchlist table contains every core symbol with a uniform price/change/range/valuation/valuation-threshold/buy-zone/catalyst/risk/final-action/recommendation-gate/research-status contract. `Recommendation Gate Result` makes every researched pass or rejection explicit; an empty recommendation set identifies one concise closest setup. `Final Action` remains the single post-gate action source: discovery Buy/Sell calls require a directionally verified material event, while a core value call may instead use the qualified rerating-path exception described below. A scheduled or pending-verification earnings event does not by itself clear the verified-catalyst gate, and a large move without either form of evidence is Watch-only. The Sector Scorecard uses non-transactional `Favorable`/`Neutral`/`Cautious` stances rather than Buy/Sell actions and distinguishes fresh, stale, and unknown SEC freshness. A fresh status without a valid as-of date is classified as unknown. Valuation cells identify trailing multiples explicitly and mark unavailable forward estimates as unavailable. Without supplied holdings and target weights, `Trim` and `Review position size` are forbidden.

`REPORT_MODE` selects `standard` or `verbose` generation and defaults to `verbose` in the deployed configuration. Both modes preserve exactly five top-level sections. The Research Audit is always rendered as a separate `research-audit/YYYY-MM-DD.md` R2 artifact and never appears inside the Morning Brief. Every generated report identifies its report mode, engine version, build revision, unique Report ID, generation timestamp, and SHA-256 content hash. Authenticated forced runs may override the mode with `{"forceRegenerate":true,"reportMode":"standard"}` or `{"forceRegenerate":true,"verbose":true}`.

The staged generation introduced in v0.5.6 remains intact. Deterministic code screens the full market, then the Worker researches up to 12 admitted candidates in bounded batches (three by default). Immediate setup-gate candidates take priority; unused capacity is filled dynamically from the complete valid core watchlist and marked `auto_watchlist`. A snapshot-to-research invariant requires the selected count to equal `min(12, valid core + discovery universe)`; the separate audit discloses `capacity=filled/target` plus any core exclusions. Auto-watchlist admission creates research coverage but does not clear the catalyst/action gate. Each batch returns validated structured JSON covering catalysts, supporting and conflicting evidence, mispricing, risk/reward, missing evidence, invalidation, and the action-gate result. Dollar-denominated support, resistance, target, stop, entry, or exit levels are rejected unless they match a supplied current, 52-week, bear/base/bull, valuation-threshold, suggested-zone, or stronger-zone price. A failed batch is retried once; if it still fails, every affected symbol remains `research incomplete` and cannot receive an action.

v0.5.7 enriches every admitted discovery candidate with available SEC fundamentals and explicitly separates a genuine extraction/coverage gap from an upstream source failure. Balance-sheet context defines `netDebt = total debt - cash`; deterministic display code renders a negative value as net cash and removes contradictory model phrases such as “high debt.” It also persists a stable event ledger with `new`, `unchanged`, and `resolved` deltas. Funnel metrics distinguish `gateQualified`, `recommendedActions`, and `rejectedOrWatch`. `researchSymbols` may support company analysis; `contextOnlySymbols` may appear only as sourced facts in market, dashboard, sector, and Watchlist coverage. Unresearched core rows use `Wait — Not researched today`.

v0.5.8.1 made the deterministic target layer split-safe. Yahoo split events normalize SEC EPS/share and share counts to the current-share basis before point-in-time P/E or P/S is computed. The latest valid TTM per-share metric is the target input; prior filing vintages measure dispersion rather than being median-normalized into a stale target. Fewer than 126 valuation observations, fewer than two filing vintages, stale or unknown SEC freshness, missing price data, split-basis gaps, current-input inconsistency above 10%, or vintage dispersion above 200% return `Target unavailable` with a reason. Confidence additionally depends on input dispersion. The preferred-entry price is base value divided by 1.20, and risk/reward is base-value upside divided by downside to bear value when both are positive.

v0.5.8.2 replaces pipeline-status Summary bullets with deterministic decision context. It combines direct AI-cycle observations with sector implications, reports the current macro tape, prioritizes scheduled core-watchlist earnings, ranks only gate-approved recommendations, and identifies the most extended researched valuation setup. Neutral labels replace promotional or vague wording.

v0.5.8.3 makes the recommendation and valuation output auditable. It adds a per-name `Recommendation Gate Result`, includes leading rejection reasons when no recommendation qualifies, renders a signed bear-case return instead of a negatively signed “downside,” states when the model has no bear-case loss, and marks an entry threshold as already satisfied when spot is below it. AI-cycle evidence separately labels the measurement period and publication date; generic cloud backlog is not treated as Enterprise AI adoption evidence.

v0.5.8.4 removes free-form model prose from recommendation-gate output and renders a structured deterministic gate audit instead. Earnings events carry explicit scheduled, pending-verification, reported-pending-verification, or verified-result lifecycle states; only structured evidence can support result characterization. Valuation bear/base/bull cases are not treated as stop-loss or thesis-invalidation levels. Executive Summary recommendation text is concise, and unknown SEC dates render as `<symbol> fundamentals date unavailable`.

v0.5.9.0 consolidates catalyst evidence into one deterministic state object used by the Watchlist catalyst cell, recommendation gate, and Summary. Its lifecycle is `unavailable`, `scheduled`, `reported_pending_verification`, `verified_positive`, or `verified_negative`; only directionally verified evidence can clear a matching Buy or Sell catalyst gate. It also adds `Suggested Buy Target / Buy Zone`, keeps the former preferred-entry value as a clearly labeled valuation threshold, and enforces action semantics: `Buy now` means spot is inside or below the approved suggested zone, `Buy on weakness` means the gate passed but spot remains above it, and `Watch` means the gate failed or no defensible executable zone exists. Rejected names may show a valuation-derived reference zone, but it is explicitly labeled non-actionable.

v0.5.9.1 hardens that decision layer against ticker-search contamination. A Yahoo result is now classified as company-specific only when the headline names the queried ticker, a configured company alias, or the discovery candidate's normalized company name. Competitor and sector read-throughs remain visible as indirect context but cannot become verified catalysts or clear the action gate. Executive Summary event text now reads the same per-symbol catalyst state used by Watchlist and Recommendation Gate. Buy/Sell actions must also agree with the research packet's strategic position, and rendered lifecycle/session labels use human-readable words instead of underscore tokens.

v0.5.10 adds a second evidence boundary after entity matching. Direct headlines are typed as `company_event` only when they describe an observable corporate event such as reported results, guidance changes, contracts, product launches, capital actions, transactions, or regulatory/legal developments. Direct analysis and opinion pieces are typed as `company_analysis`; competitor/sector items remain `sector_read_through`. Only `company_event` evidence may enter the catalyst lifecycle, verify direction, clear the action gate, or appear as a Key Reported Event. Analysis remains visible as explicitly non-gating context in the Watchlist and event ledger.

The AI Cycle Dashboard now consumes structured direct-indicator observations from official company disclosures. The Worker loads an `AI_CYCLE_OBSERVATIONS_JSON` override first, then R2 `ai-cycle/latest.json`, then the release-bundled official bootstrap catalog. Quarterly observations default to a 120-day freshness window. A full directional rating requires fresh observations from at least two independent companies; one company is `Partial Coverage`, and expired or absent observations degrade to `Insufficient Data`. Observation values, units, period-end dates, publication dates, source types, and official URLs are preserved in the snapshot; company definitions are evaluated directionally and never summed.

Targets are calculated for ranking before research, but only `researchSymbols` may receive them in the final report; context-only rows are forced to `Target unavailable`. A Medium/High-confidence target and an available executable zone are required for Buy actions. A gate-approved name becomes `Buy now` when spot is at or below the suggested-zone ceiling and `Buy on weakness` when spot remains above it; below 5% base upside remains `Watch`. A core name may clear the catalyst gate without same-day news only with at least 20% base upside, complete financial evidence, and a testable 1Q/2Q rerating path; discovery names still require a directionally verified fresh catalyst. The dated snapshot and research packet preserve the target, buy zones, action, confidence, catalyst state, and data-completeness state for later 1D/5D/1M/3M calibration. SPY is identified as the market benchmark; sector benchmark mapping and realized outcomes remain pending rather than being invented.

The final renderer uses no model output budget. Candidate research retains a 4,000-token per-batch budget and one repair attempt. R2 report metadata and the Discord delivery receipt must carry the same content SHA-256; the production workflow rejects a generation/storage/delivery identity mismatch. `/health` exposes both `version` and `buildRevision`, so rolling isolates cannot be mistaken for the intended release.

The daily report always includes the configured AI-cycle rows, sector scorecard rows, and complete core Watchlist. Detailed packet reasoning remains in `research/YYYY-MM-DD.json` instead of expanding the Morning Brief into a long rejection memo.

AI-cycle demand and CapEx rows degrade to `Insufficient Data / Unclear` when fresh direct indicators are unavailable. Daily stock returns are momentum inputs, not evidence of end demand.

If a provider returns a token-limit finish reason or invalid research JSON, that bounded candidate batch is retried once. If the retry still fails, affected packets are marked incomplete and the deterministic Morning Brief remains conservative rather than accepting partial prose. Use `forceRegenerate` when `/run-report` should replace an existing dated report; use `forceDelivery` by itself when the stored report should be resent without calling the AI provider.

Configure these secrets or environment variables outside the repository:

- `AI_PROVIDER`: optional route selector: `gemini` (default), `deepseek`, or `openai-compatible`.
- `AI_MODEL`: optional model override for the selected scheduled route.
- `GEMINI_API_KEY`: required when using Gemini.
- `GEMINI_MODEL`: backward-compatible Gemini model override. Defaults to `gemini-3.5-flash`.
- `DEEPSEEK_API_KEY`: required when using DeepSeek. Store it as a Cloudflare Worker secret.
- `DEEPSEEK_MODEL`: optional DeepSeek model override. Defaults to `deepseek-v4-flash`.
- `DEEPSEEK_BASE_URL`: optional preconfigured DeepSeek-compatible HTTPS endpoint. Defaults to `https://api.deepseek.com`.
- `OPENAI_COMPAT_API_KEY`: required for a generic OpenAI-compatible route.
- `OPENAI_COMPAT_BASE_URL`: required preconfigured credential-free HTTPS base URL for that route.
- `OPENAI_COMPAT_MODEL`: required default model for that route unless `AI_MODEL` is set.
- `RESEND_API_KEY`, `REPORT_TO_EMAIL`, `REPORT_FROM_EMAIL`: optional email delivery through Resend.
- `DISCORD_WEBHOOK_URL`: optional Discord delivery using one concise verdict message plus the complete report as a Markdown attachment. Transient `429` and `5xx` responses receive bounded retries.
- `WEBHOOK_URL`: optional generic webhook delivery. Discord URLs are also detected here for backward compatibility; non-Discord URLs receive `{ date, markdown }` JSON.

Report storage is independent from delivery. Email or webhook failures are logged and returned in scheduled-run diagnostics without deleting or invalidating the stored R2 report.

`POST /deliver-latest` reads `reports/latest.md` and sends it to the configured webhook without returning or logging the webhook URL. It returns `404` with `{ "error": "no_report_yet" }` until a report has been stored.

## Custom GPT Action

Paste `openapi/gpt-action.yaml` into the Custom GPT Action editor. Configure Authentication as **API Key**, set the authentication type to **Bearer**, and store the existing `RUN_TOKEN` as the secret. Do not paste the token into the OpenAPI file.

Add `openapi/gpt-instructions.md` to the GPT's Instructions. The client should use `getLatestBrief` normally and call `refreshMorningBrief` only when the user explicitly asks for a refresh.

R2 object layout:

- `sec/companyfacts/*.json`: seven-day SEC cache.
- `snapshots/YYYY-MM-DD.json`: complete calculation history.
- `snapshots/latest.json`: latest complete snapshot.
- `briefs/YYYY-MM-DD.json`: compact daily brief.
- `briefs/latest.json`: response served by `/latest`.
- `reports/YYYY-MM-DD.md`: AI-generated Markdown report.
- `reports/latest.md`: latest AI-generated Markdown report. R2 custom metadata includes report date, provider, model, finish reason, output/thinking/total token counts when returned, generation attempt count, generated timestamp, and validation status.
- `research/YYYY-MM-DD.json` and `research/latest.json`: validated candidate packets, batch attempts, failures, and funnel counts.
- `events/YYYY-MM-DD.json` and `events/latest.json`: persistent company, earnings, and monetary-policy event IDs with new/unchanged/resolved deltas.
- `deliveries/YYYY-MM-DD.json`: Discord delivery receipt with success, failure, timestamp, report fingerprint, and attachment diagnostics.

## Configuration

- `WATCHLIST`: comma-separated core holdings and priority tickers. Every name is price-screened; after immediate setup candidates are admitted, remaining research capacity is dynamically filled from this list up to the 12-packet ceiling. It no longer defines the complete discovery universe.
- `DISCOVERY_ENABLED`: set to `false` to disable automatic movers discovery; defaults to `true`.
- `DISCOVERY_LIMIT`: maximum liquid, relevant full-market movers enriched with news and sent to the opportunity gate; defaults to 6 and is capped at 25.
- `DISCOVERY_MIN_MARKET_CAP`: minimum market capitalization for discovery; defaults to $250 million.
- `DISCOVERY_MIN_DOLLAR_VOLUME`: minimum current-session price × volume; defaults to $5 million.
- `SEC_REFRESH_LIMIT`: maximum uncached or expired SEC network refreshes per invocation; deployed default 2. Fresh cache entries are reused, and an expired entry remains available as stale data when the refresh budget is exhausted. Together with the bounded research pipeline and focused market series, this keeps the full report pipeline within the Workers Free 50-external-subrequest ceiling.
- `DISCOVERY_SEC_REFRESH_LIMIT`: maximum uncached discovery-company SEC refreshes per invocation; deployed default 6.
- `CORE_NEWS_LIMIT`: core watchlist names receiving company-news lookups; deployed default 3, prioritized by same-day earnings and then absolute price move. Every core name remains price-screened. On a cold SEC ticker-map refresh with email delivery enabled, one lookup is reserved so the worst-case path remains within the Worker subrequest ceiling.
- `REPORT_MODE`: `standard` or `verbose`; the deployed default is `verbose`. A request-level override requires `forceRegenerate: true`.
- `RESEARCH_BATCH_SIZE`: candidate count per independent AI research call; defaults to 3 and is capped at 5.
- `RESEARCH_MAX_TOKENS`: output budget for each structured research batch; defaults to 4,000.
- `RUN_TOKEN_REQUIRED`: keep `true` for public workers.dev deployments.
- `SEC_USER_AGENT`: optional descriptive SEC user agent with a contact email.
- `YAHOO_USER_AGENT`: optional user agent for Yahoo quote and market-context requests.
- `NASDAQ_USER_AGENT`: optional browser-compatible user agent for Nasdaq calendar requests.
- `NEWS_USER_AGENT`: optional user agent for Federal Reserve news requests.
- `AI_PROVIDER`: `gemini`, `deepseek`, or `openai-compatible`; defaults to `gemini`.
- `AI_MODEL`: optional scheduled-route model override.
- `GEMINI_API_KEY`, `GEMINI_MODEL`: Gemini credentials and optional model override.
- `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL`, `DEEPSEEK_BASE_URL`: DeepSeek credentials and optional route overrides.
- `OPENAI_COMPAT_API_KEY`, `OPENAI_COMPAT_BASE_URL`, `OPENAI_COMPAT_MODEL`: generic OpenAI-compatible route configuration.
- `RESEND_API_KEY`: optional Resend API key for email delivery.
- `REPORT_TO_EMAIL`: optional report recipient email address.
- `REPORT_FROM_EMAIL`: optional verified sender address for Resend.
- `DISCORD_WEBHOOK_URL`: optional Discord webhook URL that receives a verdict summary and the full Markdown report as an attached `.md` file.
- `WEBHOOK_URL`: optional generic endpoint that receives the generated Markdown report. Discord webhook URLs are supported directly for backward compatibility.

Two UTC cron expressions cover daylight-saving time. The Worker checks New York local time, so only the 09:35 ET trigger runs.

See [ROADMAP.md](ROADMAP.md) for the target hierarchy and subsequent calibration, supply-chain, thesis-memory, and portfolio-aware work.

## Security and data use

- Never commit `.dev.vars` or tokens.
- `/run`, `/run-report`, `/deliver-latest`, and `/latest` require `Authorization: Bearer <RUN_TOKEN>` when `RUN_TOKEN_REQUIRED` is `true`.
- Review Yahoo's terms before using this data in a public commercial product.
