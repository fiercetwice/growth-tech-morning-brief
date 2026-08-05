# Growth Tech Morning Brief v0.3 — community data edition

Cloudflare Worker that collects a Growth Tech market snapshot at 09:35 America/New_York without a paid FMP plan.

## Sources and fields

- Yahoo Finance's unofficial chart endpoint: current price, daily move, 52-week position and five years of split-adjusted daily history.
- SEC EDGAR CompanyFacts: reported revenue, diluted EPS and diluted shares.
- Local calculation: point-in-time trailing P/E and P/S history plus five-year valuation percentiles. A historical date uses only SEC filings published by that date, avoiding look-ahead bias.
- R2 caches SEC responses for seven days, keeps full dated calculation snapshots, and stores compact dated briefs.

Yahoo is an unofficial community endpoint and can change or rate-limit access. SEC data is authoritative but issuers use differing XBRL tags; unavailable fields remain null rather than being invented. Historical analyst-consensus forward P/E is not included.

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

Read the latest saved brief:

```bash
curl "https://growth-tech-morning-brief.ck-market-tools.workers.dev/latest" \
  -H "Authorization: Bearer YOUR_RUN_TOKEN"
```


## GitHub Actions deployment

The `.github/workflows/cloudflare-worker.yml` workflow runs `npm test` for pull requests, pushes to `main`, and manual dispatches. Successful pushes to `main` and manual dispatches deploy the Worker with `npm run deploy` using the existing `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repository secrets.

## Custom GPT Action

Paste `openapi/gpt-action.yaml` into the Custom GPT Action editor. Configure Authentication as **API Key**, set the authentication type to **Bearer**, and store the existing `RUN_TOKEN` as the secret. Do not paste the token into the OpenAPI file.

Add `openapi/gpt-instructions.md` to the GPT's Instructions. The client should use `getLatestBrief` normally and call `refreshMorningBrief` only when the user explicitly asks for a refresh.

R2 object layout:

- `sec/companyfacts/*.json`: seven-day SEC cache.
- `snapshots/YYYY-MM-DD.json`: complete calculation history.
- `snapshots/latest.json`: latest complete snapshot.
- `briefs/YYYY-MM-DD.json`: compact daily brief.
- `briefs/latest.json`: response served by `/latest`.

## Configuration

- `WATCHLIST`: comma-separated tickers.
- `RUN_TOKEN_REQUIRED`: keep `true` for public workers.dev deployments.
- `SEC_USER_AGENT`: optional descriptive SEC user agent with a contact email.

Two UTC cron expressions cover daylight-saving time. The Worker checks New York local time, so only the 09:35 ET trigger runs.

## Security and data use

- Never commit `.dev.vars` or tokens.
- `/run` requires `Authorization: Bearer <RUN_TOKEN>`.
- Review Yahoo's terms before using this data in a public commercial product.
