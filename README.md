# Growth Tech Morning Brief v0.4.3 — AI report edition

Cloudflare Worker that collects a Growth Tech market snapshot at 09:35 America/New_York without a paid FMP plan.

## Sources and fields

- Yahoo Finance's unofficial chart endpoint: current price, daily move, 52-week position and five years of split-adjusted daily history.
- SEC EDGAR CompanyFacts: reported revenue, diluted EPS and diluted shares.
- Local calculation: point-in-time trailing P/E and P/S history plus five-year valuation percentiles. A historical date uses only SEC filings published by that date, avoiding look-ahead bias.
- R2 caches SEC responses for seven days, keeps full dated calculation snapshots, stores compact dated briefs, and saves Gemini-generated Markdown reports.

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

Run the full report pipeline immediately, including snapshot refresh, Gemini report generation, R2 report storage, and delivery:

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

The `.github/workflows/cloudflare-worker.yml` workflow runs `npm test` for pull requests, pushes to `main`, and manual dispatches. Successful pushes to `main` and manual dispatches deploy the Worker with `npm run deploy` using the existing `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repository secrets.


## AI report generation and delivery

On the valid 09:35 AM ET scheduled run, the Worker writes the stock snapshot, reads `snapshots/latest.json` back from R2, sends a compact snapshot to Gemini, and stores the generated Markdown report at both `reports/YYYY-MM-DD.md` and `reports/latest.md`. The default Gemini model is `gemini-3.5-flash`, and `GEMINI_MODEL` can override it without changing code. The duplicate daylight-saving cron expression is ignored unless it maps to 09:35 AM ET. An existing dated report prevents duplicate Gemini generation, but delivery is retried until `deliveries/YYYY-MM-DD.json` records a successful Discord receipt.

Configure these secrets or environment variables outside the repository:

- `GEMINI_API_KEY`: required for AI report generation.
- `GEMINI_MODEL`: optional Gemini model override. Defaults to `gemini-3.5-flash`.
- `RESEND_API_KEY`, `REPORT_TO_EMAIL`, `REPORT_FROM_EMAIL`: optional email delivery through Resend.
- `DISCORD_WEBHOOK_URL`: optional Discord delivery using a `Stock Analyst Bot` username, avatar, and Markdown `content`.
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
- `reports/YYYY-MM-DD.md`: Gemini-generated Markdown report.
- `reports/latest.md`: latest Gemini-generated Markdown report.
- `deliveries/YYYY-MM-DD.json`: Discord delivery receipt with success, failure, timestamp and message count diagnostics.

## Configuration

- `WATCHLIST`: comma-separated tickers.
- `RUN_TOKEN_REQUIRED`: keep `true` for public workers.dev deployments.
- `SEC_USER_AGENT`: optional descriptive SEC user agent with a contact email.
- `GEMINI_API_KEY`: Gemini API key used by scheduled report generation.
- `GEMINI_MODEL`: optional Gemini model override. Defaults to `gemini-3.5-flash`.
- `RESEND_API_KEY`: optional Resend API key for email delivery.
- `REPORT_TO_EMAIL`: optional report recipient email address.
- `REPORT_FROM_EMAIL`: optional verified sender address for Resend.
- `DISCORD_WEBHOOK_URL`: optional Discord webhook URL that receives the generated Markdown report as message `content`.
- `WEBHOOK_URL`: optional generic endpoint that receives the generated Markdown report. Discord webhook URLs are supported directly for backward compatibility.

Two UTC cron expressions cover daylight-saving time. The Worker checks New York local time, so only the 09:35 ET trigger runs.

## Security and data use

- Never commit `.dev.vars` or tokens.
- `/run`, `/run-report`, `/deliver-latest`, and `/latest` require `Authorization: Bearer <RUN_TOKEN>` when `RUN_TOKEN_REQUIRED` is `true`.
- Review Yahoo's terms before using this data in a public commercial product.
