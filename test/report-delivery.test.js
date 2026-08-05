import test from "node:test";
import assert from "node:assert/strict";
import { compactSnapshotForReport, runScheduledBrief, sendReportEmail, sendReportWebhook } from "../src/index.js";

function r2(initial = {}) {
  const objects = new Map(Object.entries(initial));
  return {
    objects,
    async get(key) {
      if (!objects.has(key)) return null;
      const body = objects.get(key);
      return {
        body,
        uploaded: new Date("2026-08-05T13:35:00.000Z"),
        async json() { return JSON.parse(body); },
        async text() { return body; },
      };
    },
    async put(key, value) { objects.set(key, value); },
  };
}

function yahooChart(symbol = "NVDA") {
  return {
    chart: { result: [{
      meta: { regularMarketPrice: 110, regularMarketPreviousClose: 100, currency: "USD", shortName: symbol },
      timestamp: [1785849300, 1785935700],
      indicators: { quote: [{ close: [100, 110], volume: [1000, 5000] }], adjclose: [{ adjclose: [100, 110] }] },
    }] },
  };
}

function responseJson(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

async function withFetchStub(handler, run) {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    calls.push({ url, init });
    return handler(url, init, calls);
  };
  try {
    return await run(calls);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("scheduled run stores Gemini report, sends Resend email, and preserves webhook delivery", async () => {
  const bucket = r2();
  const env = {
    WATCHLIST: "NVDA",
    GEMINI_API_KEY: "gemini-test-key",
    RESEND_API_KEY: "resend-test-key",
    REPORT_TO_EMAIL: "pm@example.com",
    REPORT_FROM_EMAIL: "brief@example.com",
    WEBHOOK_URL: "https://hooks.example.test/brief",
    BRIEF_BUCKET: bucket,
  };

  const result = await withFetchStub((url, init) => {
    if (url.startsWith("https://query1.finance.yahoo.com")) return responseJson(yahooChart());
    if (url.startsWith("https://data.sec.gov")) return responseJson({ entityName: "NVIDIA", facts: { "us-gaap": {} } });
    if (url.startsWith("https://generativelanguage.googleapis.com")) {
      assert.equal(init.headers["x-goog-api-key"], "gemini-test-key");
      const body = JSON.parse(init.body);
      assert.match(body.contents[0].parts[0].text, /institutional-style Growth Tech Morning Brief/);
      assert.match(body.contents[0].parts[0].text, /volume spikes/);
      return responseJson({ candidates: [{ content: { parts: [{ text: "# Growth Tech Morning Brief\n\nAction: Hold NVDA." }] } }] });
    }
    if (url === "https://api.resend.com/emails") {
      assert.equal(init.headers.authorization, "Bearer resend-test-key");
      assert.equal(init.headers["idempotency-key"], "growth-tech-morning-brief-2026-08-05");
      const body = JSON.parse(init.body);
      assert.equal(body.to[0], "pm@example.com");
      assert.match(body.html, /<h1>Growth Tech Morning Brief<\/h1>/);
      assert.match(body.text, /Action: Hold NVDA/);
      return responseJson({ id: "email_123" });
    }
    if (url === "https://hooks.example.test/brief") {
      assert.deepEqual(JSON.parse(init.body), { date: "2026-08-05", markdown: "# Growth Tech Morning Brief\n\nAction: Hold NVDA." });
      return new Response(null, { status: 204 });
    }
    throw new Error(`Unexpected fetch ${url}`);
  }, () => runScheduledBrief(env, new Date("2026-08-05T13:35:00.000Z")));

  assert.equal(result.report.generated, true);
  assert.equal(result.report.stored, true);
  assert.deepEqual(result.report.email, { sent: true, id: "email_123" });
  assert.deepEqual(result.report.webhook, { sent: true, provider: "generic" });
  assert.equal(bucket.objects.get("reports/2026-08-05.md"), "# Growth Tech Morning Brief\n\nAction: Hold NVDA.");
  assert.equal(bucket.objects.get("reports/latest.md"), "# Growth Tech Morning Brief\n\nAction: Hold NVDA.");
});

test("delivery failures are isolated after the R2 report is stored", async () => {
  const bucket = r2();
  const env = {
    WATCHLIST: "NVDA",
    GEMINI_API_KEY: "gemini-test-key",
    RESEND_API_KEY: "resend-test-key",
    REPORT_TO_EMAIL: "pm@example.com",
    REPORT_FROM_EMAIL: "brief@example.com",
    WEBHOOK_URL: "https://hooks.example.test/brief",
    BRIEF_BUCKET: bucket,
  };

  const result = await withFetchStub((url) => {
    if (url.startsWith("https://query1.finance.yahoo.com")) return responseJson(yahooChart());
    if (url.startsWith("https://data.sec.gov")) return responseJson({ facts: { "us-gaap": {} } });
    if (url.startsWith("https://generativelanguage.googleapis.com")) return responseJson({ candidates: [{ content: { parts: [{ text: "stored markdown" }] } }] });
    if (url === "https://api.resend.com/emails") return responseJson({ message: "quota exceeded" }, 429);
    if (url === "https://hooks.example.test/brief") return new Response("bad gateway", { status: 502 });
    throw new Error(`Unexpected fetch ${url}`);
  }, () => runScheduledBrief(env, new Date("2026-08-05T13:35:00.000Z")));

  assert.equal(bucket.objects.get("reports/2026-08-05.md"), "stored markdown");
  assert.equal(result.report.stored, true);
  assert.equal(result.report.email.failed, true);
  assert.match(result.report.email.error, /Resend email failed \(429\)/);
  assert.equal(result.report.webhook.failed, true);
  assert.match(result.report.webhook.error, /Webhook delivery failed \(502\)/);
});

test("existing dated report prevents duplicate report generation and delivery", async () => {
  const bucket = r2({ "reports/2026-08-05.md": "already sent" });
  const env = { WATCHLIST: "NVDA", GEMINI_API_KEY: "gemini-test-key", BRIEF_BUCKET: bucket };

  const result = await withFetchStub((url) => {
    if (url.startsWith("https://query1.finance.yahoo.com")) return responseJson(yahooChart());
    if (url.startsWith("https://data.sec.gov")) return responseJson({ facts: { "us-gaap": {} } });
    throw new Error(`Report generation should have been skipped, got ${url}`);
  }, () => runScheduledBrief(env, new Date("2026-08-05T13:35:00.000Z")));

  assert.deepEqual(result.report, { skipped: true, reason: "report_already_exists", date: "2026-08-05" });
  assert.equal(bucket.objects.get("reports/2026-08-05.md"), "already sent");
});

test("off-time daylight-saving cron trigger skips snapshots and reports", async () => {
  const env = { WATCHLIST: "NVDA", BRIEF_BUCKET: r2() };
  await withFetchStub((url) => { throw new Error(`No network expected for skipped trigger ${url}`); }, async () => {
    const result = await runScheduledBrief(env, new Date("2026-08-05T14:35:00.000Z"));
    assert.equal(result.skipped, true);
    assert.equal(result.reason, "not_09_35_ET");
  });
});

test("email delivery is skipped unless all Resend settings are present", async () => {
  const result = await sendReportEmail({ RESEND_API_KEY: "key" }, "2026-08-05", "markdown");
  assert.deepEqual(result, { skipped: true, reason: "email_not_configured" });
});

test("Discord webhooks receive content messages instead of generic JSON", async () => {
  const longMarkdown = `# Report\n\n${"AI-cycle signal. ".repeat(150)}`;
  const env = { WEBHOOK_URL: "https://discord.com/api/webhooks/123/token" };

  const result = await withFetchStub((url, init) => {
    assert.equal(url, env.WEBHOOK_URL);
    const body = JSON.parse(init.body);
    assert.equal("content" in body, true);
    assert.equal("markdown" in body, false);
    assert.match(body.content, /^\*\*Growth Tech Morning Brief — 2026-08-05\*\*/);
    assert.ok(body.content.length <= 1900);
    return new Response(null, { status: 204 });
  }, () => sendReportWebhook(env, "2026-08-05", longMarkdown));

  assert.equal(result.sent, true);
  assert.equal(result.provider, "discord");
  assert.ok(result.messages > 1);
});

test("compact report payload excludes raw history while retaining volume leaders", () => {
  const compact = compactSnapshotForReport({
    generatedAt: "2026-08-05T13:35:00.000Z",
    session: "regular_open_plus_5m",
    coverage: { requested: 1, succeeded: 1, failed: 0 },
    watchlist: [{
      symbol: "NVDA", price: 110, changePercent: 10, yearLow: 90, yearHigh: 120,
      positionIn52WeekRange: 66.67, missing: false, valuation: null,
      history: [{ date: "2026-08-05", adjustedClose: 110, volume: 5000 }],
    }],
  });

  assert.equal(compact.watchlist[0].history, undefined);
  assert.deepEqual(compact.volumeLeaders, [{ symbol: "NVDA", volume: 5000 }]);
});
