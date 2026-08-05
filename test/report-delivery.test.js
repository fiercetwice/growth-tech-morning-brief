import test from "node:test";
import assert from "node:assert/strict";
import worker, { compactSnapshotForReport, runScheduledBrief, sendReportEmail, sendReportWebhook, validateReportCompleteness } from "../src/index.js";

function r2(initial = {}) {
  const objects = new Map(Object.entries(initial));
  const putOptions = new Map();
  return {
    objects,
    putOptions,
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
    async put(key, value, options) {
      objects.set(key, value);
      putOptions.set(key, options);
    },
  };
}

function yahooChart(symbol = "NVDA") {
  return {
    chart: { result: [{
      meta: { regularMarketPrice: 110, regularMarketPreviousClose: 100, regularMarketTime: 1785935700, currency: "USD", shortName: symbol },
      timestamp: [1785849300, 1785935700],
      indicators: { quote: [{ close: [100, 110], volume: [1000, 5000] }], adjclose: [{ adjclose: [100, 110] }] },
    }] },
  };
}

function responseJson(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function completeReport(symbols = ["NVDA"], detail = "Balanced action is to monitor positioning and catalyst timing.") {
  const symbolText = symbols.join(", ");
  return [
    "# Growth Tech Morning Brief",
    "",
    "# Executive Summary",
    "- **AI Cycle:** Insufficient data; price action cannot establish the cycle.",
    "- **Catalyst:** unavailable — not in snapshot.",
    "- **Risk:** Elevated valuation and adverse price momentum are the principal observable risks.",
    `- **Best Opportunity:** None — no stock meets the deterministic Buy rule. ${detail}`,
    "- **Avoid:** None — no stock meets the deterministic Avoid rule.",
    "",
    "# Overnight and Market Context",
    `- **Sourced Facts:** ${symbolText} has supplied price, daily change, volume, range, and trailing valuation data.`,
    "- **Analysis:** Market context is mixed; no unsupported macro or earnings claim is made.",
    "- **Futures:** S&P 500 +10.0%, Nasdaq 100 +10.0%; Yahoo as of 2026-08-05T13:15:00Z.",
    "- **Rates:** U.S. 10Y yield 11.0%; Yahoo as of 2026-08-05T13:15:00Z.",
    "- **USD:** Dollar Index 110 (+10.0%); Yahoo as of 2026-08-05T13:15:00Z.",
    "- **Oil:** WTI 110 (+10.0%), Brent 110 (+10.0%); Yahoo as of 2026-08-05T13:15:00Z.",
    "- **Macro Events:** unavailable — calendar source failed in fixture.",
    "- **Earnings:** unavailable — calendar source failed in fixture.",
    "",
    "# AI Cycle Dashboard",
    "| Segment | Rating | Trend | Sourced Facts | Analysis |",
    "|---|---|---|---|---|",
    "| Hyperscaler AI CapEx | Insufficient Data | Unclear | unavailable | No inference without capex data. |",
    "| GPU Demand | Insufficient Data | Unclear | Supplied watchlist price data | Price action measures momentum only. |",
    "| AI Cloud | Insufficient Data | Unclear | Supplied watchlist price data | No demand inference. |",
    "| Enterprise AI | Insufficient Data | Unclear | unavailable | No inference. |",
    "| Inference | Insufficient Data | Unclear | unavailable | No inference. |",
    "",
    "# Sector Scorecard",
    "| Sector | Fundamentals | Valuation | Momentum | Action | Sourced Facts | Analysis |",
    "|---|---|---|---|---|---|---|",
    "| GPU | Unavailable | Unavailable | Positive | Hold | Supplied watchlist data | Momentum is constructive. |",
    "| AI Cloud | Unavailable | Unavailable | Unavailable | Wait | Supplied watchlist data | Await more evidence. |",
    "| GPU Cloud | Unavailable | Unavailable | Unavailable | Wait | Supplied watchlist data | Await more evidence. |",
    "| Networking | Unavailable | Unavailable | Unavailable | Wait | Supplied watchlist data | Balanced. |",
    "| Cooling | Unavailable | Unavailable | Unavailable | Wait | Supplied watchlist data | Balanced. |",
    "| Power | Unavailable | Unavailable | Unavailable | Wait | Supplied watchlist data | Balanced. |",
    "| Cybersecurity | Unavailable | Unavailable | Unavailable | Wait | Supplied watchlist data | Balanced. |",
    "| Cloud Software | Unavailable | Unavailable | Unavailable | Wait | Supplied watchlist data | Balanced. |",
    "",
    "# Watchlist",
    "| Symbol | Price | Daily Change | 52W Position | Forward P/E or P/S | Historical Valuation Percentile | Catalyst | Risk | Action |",
    "|---|---:|---:|---:|---:|---:|---|---|---|",
    ...symbols.map((symbol) => `| ${symbol} | $110 | +10% | 50% | n/a — not in snapshot | n/a | unavailable | Valuation and momentum risk | Hold |`),
  ].join("\n");
}

function geminiReport(text, finishReason = "STOP", usageMetadata = {}, parts = null) {
  return {
    candidates: [{ finishReason, content: { parts: parts ?? [{ text }] } }],
    usageMetadata,
  };
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
  const markdown = completeReport(["NVDA"], "Action: Hold NVDA.");
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
      const geminiUrl = new URL(url);
      assert.equal(geminiUrl.pathname, "/v1beta/models/gemini-3.5-flash:generateContent");
      assert.equal(geminiUrl.searchParams.get("key"), "gemini-test-key");
      assert.equal(init.headers["x-goog-api-key"], undefined);
      const body = JSON.parse(init.body);
      assert.match(body.contents[0].parts[0].text, /institutional sell-side Growth Tech Morning Brief/);
      assert.match(body.contents[0].parts[0].text, /Forward P\/E or P\/S/);
      assert.equal("maxOutputTokens" in body.generationConfig, false);
      assert.deepEqual(body.generationConfig.thinkingConfig, { thinkingLevel: "low" });
      return responseJson(geminiReport(markdown, "STOP", { candidatesTokenCount: 8192, thoughtsTokenCount: 12, totalTokenCount: 8204 }));
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
      assert.deepEqual(JSON.parse(init.body), { date: "2026-08-05", markdown });
      return new Response(null, { status: 204 });
    }
    throw new Error(`Unexpected fetch ${url}`);
  }, () => runScheduledBrief(env, new Date("2026-08-05T13:35:00.000Z")));

  assert.equal(result.report.generated, true);
  assert.equal(result.report.geminiModel, "gemini-3.5-flash");
  assert.equal(result.report.stored, true);
  assert.deepEqual(result.report.email, { sent: true, id: "email_123" });
  assert.deepEqual(result.report.webhook, { sent: true, provider: "generic" });
  assert.equal(bucket.objects.get("reports/2026-08-05.md"), markdown);
  assert.equal(bucket.objects.get("reports/latest.md"), markdown);
  assert.equal(bucket.putOptions.get("reports/latest.md").customMetadata.reportDate, "2026-08-05");
  assert.equal(bucket.putOptions.get("reports/latest.md").customMetadata.geminiModel, "gemini-3.5-flash");
  assert.equal(bucket.putOptions.get("reports/latest.md").customMetadata.finishReason, "STOP");
  assert.equal(bucket.putOptions.get("reports/latest.md").customMetadata.outputTokenCount, "8192");
  assert.equal(bucket.putOptions.get("reports/latest.md").customMetadata.thoughtsTokenCount, "12");
  assert.equal(bucket.putOptions.get("reports/latest.md").customMetadata.totalTokenCount, "8204");
  assert.equal(bucket.putOptions.get("reports/latest.md").customMetadata.generationAttempts, "1");
  assert.equal(bucket.putOptions.get("reports/latest.md").customMetadata.validation, "passed");
});

test("delivery failures are isolated after the R2 report is stored", async () => {
  const bucket = r2();
  const markdown = completeReport(["NVDA"], "Delivery channels fail after storage.");
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
    if (url.startsWith("https://generativelanguage.googleapis.com")) return responseJson(geminiReport(markdown));
    if (url === "https://api.resend.com/emails") return responseJson({ message: "quota exceeded" }, 429);
    if (url === "https://hooks.example.test/brief") return new Response("bad gateway", { status: 502 });
    throw new Error(`Unexpected fetch ${url}`);
  }, () => runScheduledBrief(env, new Date("2026-08-05T13:35:00.000Z")));

  assert.equal(bucket.objects.get("reports/2026-08-05.md"), markdown);
  assert.equal(result.report.stored, true);
  assert.equal(result.report.email.failed, true);
  assert.match(result.report.email.error, /Resend email failed \(429\)/);
  assert.equal(result.report.webhook.failed, true);
  assert.match(result.report.webhook.error, /Webhook delivery failed \(502\)/);
});

test("Gemini model can be overridden with GEMINI_MODEL", async () => {
  const bucket = r2();
  const markdown = completeReport(["NVDA"], "Override model produces a complete report.");
  const env = {
    WATCHLIST: "NVDA",
    GEMINI_API_KEY: "gemini-test-key",
    GEMINI_MODEL: "gemini-3.5-flash-preview",
    BRIEF_BUCKET: bucket,
  };

  const result = await withFetchStub((url) => {
    if (url.startsWith("https://query1.finance.yahoo.com")) return responseJson(yahooChart());
    if (url.startsWith("https://data.sec.gov")) return responseJson({ facts: { "us-gaap": {} } });
    if (url.startsWith("https://generativelanguage.googleapis.com")) {
      const geminiUrl = new URL(url);
      assert.equal(geminiUrl.pathname, "/v1beta/models/gemini-3.5-flash-preview:generateContent");
      assert.equal(geminiUrl.searchParams.get("key"), "gemini-test-key");
      return responseJson(geminiReport(markdown));
    }
    throw new Error(`Unexpected fetch ${url}`);
  }, () => runScheduledBrief(env, new Date("2026-08-05T13:35:00.000Z")));

  assert.equal(result.report.generated, true);
  assert.equal(result.report.geminiModel, "gemini-3.5-flash-preview");
  assert.equal(bucket.objects.get("reports/2026-08-05.md"), markdown);
});

test("DeepSeek route uses the official OpenAI-compatible endpoint without an output ceiling", async () => {
  const bucket = r2();
  const markdown = completeReport(["NVDA"], "DeepSeek generated this complete report.");
  const env = {
    WATCHLIST: "NVDA",
    AI_PROVIDER: "deepseek",
    DEEPSEEK_API_KEY: "deepseek-test-key",
    BRIEF_BUCKET: bucket,
  };

  const result = await withFetchStub((url, init) => {
    if (url.startsWith("https://query1.finance.yahoo.com")) return responseJson(yahooChart());
    if (url.startsWith("https://data.sec.gov")) return responseJson({ facts: { "us-gaap": {} } });
    assert.equal(url, "https://api.deepseek.com/chat/completions");
    assert.equal(init.headers.authorization, "Bearer deepseek-test-key");
    const body = JSON.parse(init.body);
    assert.equal(body.model, "deepseek-v4-flash");
    assert.deepEqual(body.thinking, { type: "disabled" });
    assert.equal("max_tokens" in body, false);
    assert.match(body.messages[0].content, /Hyperscaler AI CapEx/);
    return responseJson({
      choices: [{ finish_reason: "stop", message: { role: "assistant", content: markdown } }],
      usage: { completion_tokens: 1400, total_tokens: 3200 },
    });
  }, () => runScheduledBrief(env, new Date("2026-08-05T13:35:00.000Z")));

  assert.equal(result.report.generated, true);
  assert.equal(result.report.aiProvider, "deepseek");
  assert.equal(result.report.aiModel, "deepseek-v4-flash");
  assert.equal(bucket.putOptions.get("reports/latest.md").customMetadata.aiProvider, "deepseek");
  assert.equal(bucket.putOptions.get("reports/latest.md").customMetadata.aiModel, "deepseek-v4-flash");
  assert.equal(bucket.putOptions.get("reports/latest.md").customMetadata.outputTokenCount, "1400");
});

test("authenticated run-report can route a forced regeneration to a selected DeepSeek model", async () => {
  const bucket = r2({ "reports/2026-08-05.md": "old report", "reports/latest.md": "old report" });
  const markdown = completeReport(["NVDA"], "One-off DeepSeek route completed.");
  const env = {
    RUN_TOKEN_REQUIRED: "true",
    RUN_TOKEN: "secret",
    WATCHLIST: "NVDA",
    GEMINI_API_KEY: "gemini-key",
    DEEPSEEK_API_KEY: "deepseek-key",
    BRIEF_BUCKET: bucket,
  };

  const response = await withFetchStub((url, init) => {
    if (url.startsWith("https://query1.finance.yahoo.com")) return responseJson(yahooChart());
    if (url.startsWith("https://data.sec.gov")) return responseJson({ facts: { "us-gaap": {} } });
    assert.equal(url, "https://api.deepseek.com/chat/completions");
    assert.equal(JSON.parse(init.body).model, "deepseek-v4-pro");
    return responseJson({ choices: [{ finish_reason: "stop", message: { content: markdown } }] });
  }, () => worker.fetch(new Request("https://example.test/run-report", {
    method: "POST",
    headers: { authorization: "Bearer secret", "content-type": "application/json" },
    body: JSON.stringify({ forceRegenerate: true, provider: "deepseek", model: "deepseek-v4-pro" }),
  }), env));

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.report.aiProvider, "deepseek");
  assert.equal(body.report.aiModel, "deepseek-v4-pro");
  assert.equal(bucket.objects.get("reports/latest.md"), markdown);
});

test("run-report rejects provider/model overrides unless regeneration is explicit", async () => {
  const response = await worker.fetch(new Request("https://example.test/run-report", {
    method: "POST",
    headers: { authorization: "Bearer secret", "content-type": "application/json" },
    body: JSON.stringify({ provider: "deepseek", model: "deepseek-v4-flash" }),
  }), { RUN_TOKEN_REQUIRED: "true", RUN_TOKEN: "secret" });

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: "force_regenerate_required",
    message: "provider/model overrides require forceRegenerate=true",
  });
});

test("openai-compatible route uses only the preconfigured HTTPS base URL", async () => {
  const markdown = completeReport(["NVDA"], "Compatible endpoint generated this report.");
  const result = await withFetchStub((url, init) => {
    if (url.startsWith("https://query1.finance.yahoo.com")) return responseJson(yahooChart());
    if (url.startsWith("https://data.sec.gov")) return responseJson({ facts: { "us-gaap": {} } });
    assert.equal(url, "https://models.example.test/v1/chat/completions");
    const body = JSON.parse(init.body);
    assert.equal(body.model, "research-model");
    assert.equal("thinking" in body, false);
    return responseJson({ choices: [{ finish_reason: "stop", message: { content: markdown } }] });
  }, () => runScheduledBrief({
    WATCHLIST: "NVDA",
    AI_PROVIDER: "openai-compatible",
    OPENAI_COMPAT_API_KEY: "compat-key",
    OPENAI_COMPAT_BASE_URL: "https://models.example.test/v1/",
    OPENAI_COMPAT_MODEL: "research-model",
    BRIEF_BUCKET: r2(),
  }, new Date("2026-08-05T13:35:00.000Z")));

  assert.equal(result.report.aiProvider, "openai-compatible");
  assert.equal(result.report.aiModel, "research-model");
});

test("strict schema rejects unavailable claims when context data was supplied", () => {
  const markdown = completeReport(["NVDA"]).replace(
    "**Futures:** S&P 500 +10.0%, Nasdaq 100 +10.0%; Yahoo as of 2026-08-05T13:15:00Z.",
    "**Futures:** unavailable — not in snapshot.",
  );
  const validation = validateReportCompleteness(markdown, ["NVDA"], {
    marketContext: { futures: { status: "available" } },
    calendars: {},
  });
  assert.equal(validation.ok, false);
  assert.match(validation.errors.join("; "), /available context incorrectly marked unavailable: Futures/);
});

test("strict schema rejects a market recap that only has the five section names", () => {
  const recap = [
    "# Executive Summary", "Market action is mixed.",
    "# Overnight and Market Context", "NVDA moved higher.",
    "# AI Cycle Dashboard", "Hardware is bullish.",
    "# Sector Scorecard", "Networking leads.",
    "# Watchlist", "NVDA: $110 (+10%).",
  ].join("\n\n");
  const validation = validateReportCompleteness(recap, ["NVDA"]);
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.includes("missing Executive Summary field: AI Cycle"));
  assert.ok(validation.errors.includes("missing AI Cycle Dashboard row: Hyperscaler AI CapEx"));
  assert.ok(validation.errors.includes("missing Sector Scorecard row: Cloud Software"));
  assert.ok(validation.errors.includes("missing Watchlist column: Catalyst"));
});

test("semantic validation rejects unsupported demand and CapEx conclusions", () => {
  const markdown = completeReport(["NVDA"])
    .replace("Insufficient data; price action cannot establish the cycle.", "GPU demand remains robust and the CapEx cycle is intact.");
  const validation = validateReportCompleteness(markdown, ["NVDA"]);
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.includes("unsupported demand claim"));
  assert.ok(validation.errors.includes("unsupported CapEx-cycle claim"));
});

test("Gemini 404 diagnostics include status and model without exposing the API key", async () => {
  const env = {
    WATCHLIST: "NVDA",
    GEMINI_API_KEY: "gemini-secret-key",
    BRIEF_BUCKET: r2(),
  };

  const result = await withFetchStub((url) => {
    if (url.startsWith("https://query1.finance.yahoo.com")) return responseJson(yahooChart());
    if (url.startsWith("https://data.sec.gov")) return responseJson({ facts: { "us-gaap": {} } });
    if (url.startsWith("https://generativelanguage.googleapis.com")) {
      return responseJson({ error: { message: "models/gemini-old is unavailable for gemini-secret-key" } }, 404);
    }
    throw new Error(`Unexpected fetch ${url}`);
  }, () => runScheduledBrief(env, new Date("2026-08-05T13:35:00.000Z")));

  assert.match(result.report.error, /AI report failed \(404, provider: gemini, model: gemini-3.5-flash, finishReason: missing\):/);
  assert.match(result.report.error, /models\/gemini-old is unavailable for \[redacted\]/);
  assert.doesNotMatch(result.report.error, /gemini-secret-key/);
});

test("successful Gemini generation stores the report and delivers Discord", async () => {
  const bucket = r2();
  const markdown = completeReport(["NVDA"], "Discord delivery receives a complete generated report.");
  const env = {
    WATCHLIST: "NVDA",
    GEMINI_API_KEY: "gemini-test-key",
    DISCORD_WEBHOOK_URL: "https://discord.com/api/webhooks/123/token",
    BRIEF_BUCKET: bucket,
  };

  const discordContents = [];
  const result = await withFetchStub((url, init) => {
    if (url.startsWith("https://query1.finance.yahoo.com")) return responseJson(yahooChart());
    if (url.startsWith("https://data.sec.gov")) return responseJson({ facts: { "us-gaap": {} } });
    if (url.startsWith("https://generativelanguage.googleapis.com")) {
      const geminiUrl = new URL(url);
      assert.equal(geminiUrl.pathname, "/v1beta/models/gemini-3.5-flash:generateContent");
      return responseJson(geminiReport(markdown));
    }
    assert.equal(url, env.DISCORD_WEBHOOK_URL);
    discordContents.push(JSON.parse(init.body).content);
    return new Response(null, { status: 204 });
  }, () => runScheduledBrief(env, new Date("2026-08-05T13:35:00.000Z")));

  assert.equal(result.report.generated, true);
  assert.equal(result.report.geminiModel, "gemini-3.5-flash");
  assert.equal(bucket.objects.get("reports/2026-08-05.md"), markdown);
  assert.match(discordContents.join("\n"), /Discord delivery receives/);
  assert.deepEqual(result.report.webhook, {
    sent: true,
    provider: "discord",
    messages: discordContents.length,
    chunks: { expected: discordContents.length, delivered: discordContents.length, failed: 0 },
  });
});

test("Gemini joins multiple non-thought parts and excludes thought parts", async () => {
  const bucket = r2();
  const first = completeReport(["NVDA"], "Part one covers the required sections.");
  const splitAt = Math.floor(first.length / 2);
  const parts = [
    { text: "internal thinking summary", thought: true },
    { text: first.slice(0, splitAt) },
    { text: first.slice(splitAt) },
  ];

  const result = await withFetchStub((url) => {
    if (url.startsWith("https://query1.finance.yahoo.com")) return responseJson(yahooChart());
    if (url.startsWith("https://data.sec.gov")) return responseJson({ facts: { "us-gaap": {} } });
    if (url.startsWith("https://generativelanguage.googleapis.com")) return responseJson(geminiReport("", "STOP", {}, parts));
    throw new Error(`Unexpected fetch ${url}`);
  }, () => runScheduledBrief({ WATCHLIST: "NVDA", GEMINI_API_KEY: "key", BRIEF_BUCKET: bucket }, new Date("2026-08-05T13:35:00.000Z")));

  assert.equal(result.report.generated, true);
  assert.equal(bucket.objects.get("reports/2026-08-05.md"), first);
  assert.doesNotMatch(bucket.objects.get("reports/2026-08-05.md"), /internal thinking/);
});

test("MAX_TOKENS triggers exactly one concise retry", async () => {
  const bucket = r2();
  const completed = completeReport(["NVDA"], "The retry is shorter but still complete.");
  let geminiCalls = 0;

  const result = await withFetchStub((url, init) => {
    if (url.startsWith("https://query1.finance.yahoo.com")) return responseJson(yahooChart());
    if (url.startsWith("https://data.sec.gov")) return responseJson({ facts: { "us-gaap": {} } });
    if (url.startsWith("https://generativelanguage.googleapis.com")) {
      geminiCalls += 1;
      const request = JSON.parse(init.body);
      if (geminiCalls === 1) return responseJson(geminiReport("truncated", "MAX_TOKENS"));
      assert.match(request.contents[0].parts[0].text, /shorter but complete report/);
      return responseJson(geminiReport(completed, "STOP"));
    }
    throw new Error(`Unexpected fetch ${url}`);
  }, () => runScheduledBrief({ WATCHLIST: "NVDA", GEMINI_API_KEY: "key", BRIEF_BUCKET: bucket }, new Date("2026-08-05T13:35:00.000Z")));

  assert.equal(geminiCalls, 2);
  assert.equal(result.report.generated, true);
  assert.equal(bucket.objects.get("reports/2026-08-05.md"), completed);
  assert.equal(bucket.putOptions.get("reports/latest.md").customMetadata.generationAttempts, "2");
});

test("a second truncated Gemini response is rejected and not stored", async () => {
  const bucket = r2();
  let geminiCalls = 0;

  const result = await withFetchStub((url) => {
    if (url.startsWith("https://query1.finance.yahoo.com")) return responseJson(yahooChart());
    if (url.startsWith("https://data.sec.gov")) return responseJson({ facts: { "us-gaap": {} } });
    if (url.startsWith("https://generativelanguage.googleapis.com")) {
      geminiCalls += 1;
      return responseJson(geminiReport("still truncated", "MAX_TOKENS"));
    }
    throw new Error(`Unexpected fetch ${url}`);
  }, () => runScheduledBrief({ WATCHLIST: "NVDA", GEMINI_API_KEY: "key", BRIEF_BUCKET: bucket }, new Date("2026-08-05T13:35:00.000Z")));

  assert.equal(geminiCalls, 2);
  assert.match(result.report.error, /MAX_TOKENS/);
  assert.equal(bucket.objects.has("reports/2026-08-05.md"), false);
});

test("missing required sections are rejected", async () => {
  const bucket = r2();
  const result = await withFetchStub((url) => {
    if (url.startsWith("https://query1.finance.yahoo.com")) return responseJson(yahooChart());
    if (url.startsWith("https://data.sec.gov")) return responseJson({ facts: { "us-gaap": {} } });
    if (url.startsWith("https://generativelanguage.googleapis.com")) return responseJson(geminiReport("NVDA has a short note."));
    throw new Error(`Unexpected fetch ${url}`);
  }, () => runScheduledBrief({ WATCHLIST: "NVDA", GEMINI_API_KEY: "key", BRIEF_BUCKET: bucket }, new Date("2026-08-05T13:35:00.000Z")));

  assert.match(result.report.error, /missing section: Executive Summary/);
  assert.equal(bucket.objects.has("reports/2026-08-05.md"), false);
});

test("missing watchlist symbols are rejected", async () => {
  const bucket = r2();
  const markdown = completeReport(["NVDA"], "This intentionally omits the second symbol.");

  const result = await withFetchStub((url) => {
    if (url.startsWith("https://query1.finance.yahoo.com")) return responseJson(yahooChart(url.includes("AMZN") ? "AMZN" : "NVDA"));
    if (url.startsWith("https://data.sec.gov")) return responseJson({ facts: { "us-gaap": {} } });
    if (url.startsWith("https://generativelanguage.googleapis.com")) return responseJson(geminiReport(markdown));
    throw new Error(`Unexpected fetch ${url}`);
  }, () => runScheduledBrief({ WATCHLIST: "NVDA,AMZN", GEMINI_API_KEY: "key", BRIEF_BUCKET: bucket }, new Date("2026-08-05T13:35:00.000Z")));

  assert.match(result.report.error, /missing watchlist symbol: AMZN/);
  assert.equal(bucket.objects.has("reports/2026-08-05.md"), false);
});

test("incomplete Gemini response is never written to R2 or delivered", async () => {
  const bucket = r2();
  const result = await withFetchStub((url) => {
    if (url.startsWith("https://query1.finance.yahoo.com")) return responseJson(yahooChart());
    if (url.startsWith("https://data.sec.gov")) return responseJson({ facts: { "us-gaap": {} } });
    if (url.startsWith("https://generativelanguage.googleapis.com")) return responseJson(geminiReport("## Executive Summary\nNVDA starts but"));
    if (url.startsWith("https://discord.com")) throw new Error("Discord should not be called");
    throw new Error(`Unexpected fetch ${url}`);
  }, () => runScheduledBrief({
    WATCHLIST: "NVDA",
    GEMINI_API_KEY: "key",
    DISCORD_WEBHOOK_URL: "https://discord.com/api/webhooks/123/token",
    BRIEF_BUCKET: bucket,
  }, new Date("2026-08-05T13:35:00.000Z")));

  assert.match(result.report.error, /incomplete/);
  assert.equal(bucket.objects.has("reports/2026-08-05.md"), false);
});

test("forceRegenerate replaces an existing incomplete report after validation succeeds", async () => {
  const bucket = r2({ "reports/2026-08-05.md": "old incomplete", "reports/latest.md": "old incomplete" });
  const markdown = completeReport(["NVDA"], "Regeneration produces a complete replacement.");
  const env = {
    RUN_TOKEN_REQUIRED: "true",
    RUN_TOKEN: "secret",
    WATCHLIST: "NVDA",
    GEMINI_API_KEY: "key",
    DISCORD_WEBHOOK_URL: "https://discord.com/api/webhooks/123/token",
    BRIEF_BUCKET: bucket,
  };

  const discordContents = [];
  const response = await withFetchStub((url, init) => {
    if (url.startsWith("https://query1.finance.yahoo.com")) return responseJson(yahooChart());
    if (url.startsWith("https://data.sec.gov")) return responseJson({ facts: { "us-gaap": {} } });
    if (url.startsWith("https://generativelanguage.googleapis.com")) return responseJson(geminiReport(markdown));
    assert.equal(url, env.DISCORD_WEBHOOK_URL);
    discordContents.push(JSON.parse(init.body).content);
    return new Response(null, { status: 204 });
  }, () => worker.fetch(new Request("https://example.test/run-report", {
    method: "POST",
    headers: { authorization: "Bearer secret", "content-type": "application/json" },
    body: JSON.stringify({ forceRegenerate: true, forceDelivery: true }),
  }), env));

  assert.equal(response.status, 200);
  assert.match(discordContents.join("\n"), /Regeneration produces/);
  const body = await response.json();
  assert.equal(body.report.replaced, true);
  assert.equal(bucket.objects.get("reports/2026-08-05.md"), markdown);
  assert.equal(bucket.objects.get("reports/latest.md"), markdown);
  assert.equal(JSON.parse(bucket.objects.get("deliveries/2026-08-05.json")).discord.sent, true);
});

test("failed forced regeneration preserves the previous stored report", async () => {
  const bucket = r2({ "reports/2026-08-05.md": "previous report", "reports/latest.md": "previous report" });
  const response = await withFetchStub((url) => {
    if (url.startsWith("https://query1.finance.yahoo.com")) return responseJson(yahooChart());
    if (url.startsWith("https://data.sec.gov")) return responseJson({ facts: { "us-gaap": {} } });
    if (url.startsWith("https://generativelanguage.googleapis.com")) return responseJson(geminiReport("truncated", "MAX_TOKENS"));
    if (url.startsWith("https://discord.com")) throw new Error("Discord should not be called");
    throw new Error(`Unexpected fetch ${url}`);
  }, () => worker.fetch(new Request("https://example.test/run-report", {
    method: "POST",
    headers: { authorization: "Bearer secret", "content-type": "application/json" },
    body: JSON.stringify({ forceRegenerate: true, forceDelivery: true }),
  }), {
    RUN_TOKEN_REQUIRED: "true",
    RUN_TOKEN: "secret",
    WATCHLIST: "NVDA",
    GEMINI_API_KEY: "key",
    DISCORD_WEBHOOK_URL: "https://discord.com/api/webhooks/123/token",
    BRIEF_BUCKET: bucket,
  }));

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.match(body.report.error, /MAX_TOKENS/);
  assert.equal(bucket.objects.get("reports/2026-08-05.md"), "previous report");
  assert.equal(bucket.objects.get("reports/latest.md"), "previous report");
});

test("existing dated report prevents duplicate report generation but still evaluates delivery", async () => {
  const bucket = r2({ "reports/2026-08-05.md": "already sent" });
  const env = { WATCHLIST: "NVDA", GEMINI_API_KEY: "gemini-test-key", BRIEF_BUCKET: bucket };

  const result = await withFetchStub((url) => {
    if (url.startsWith("https://query1.finance.yahoo.com")) return responseJson(yahooChart());
    if (url.startsWith("https://data.sec.gov")) return responseJson({ facts: { "us-gaap": {} } });
    throw new Error(`Report generation should have been skipped, got ${url}`);
  }, () => runScheduledBrief(env, new Date("2026-08-05T13:35:00.000Z")));

  assert.deepEqual(result.report, {
    date: "2026-08-05",
    generated: false,
    stored: true,
    email: null,
    webhook: { skipped: true, reason: "webhook_not_configured" },
    reused: true,
  });
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
  const env = { DISCORD_WEBHOOK_URL: "https://discord.com/api/webhooks/123/token" };

  const result = await withFetchStub((url, init) => {
    assert.equal(url, env.DISCORD_WEBHOOK_URL);
    const body = JSON.parse(init.body);
    assert.equal("content" in body, true);
    assert.equal("markdown" in body, false);
    assert.equal(body.username, "Stock Analyst Bot");
    assert.equal(body.avatar_url, "https://i.imgur.com/4M34hi2.png");
    assert.doesNotMatch(body.content, /^\*\*Growth Tech Morning Brief — 2026-08-05\*\*/);
    assert.ok(body.content.length <= 1900);
    return new Response(null, { status: 204 });
  }, () => sendReportWebhook(env, "2026-08-05", longMarkdown));

  assert.equal(result.sent, true);
  assert.equal(result.provider, "discord");
  assert.ok(result.messages > 1);
});

test("Discord webhook delivery also supports Discord URLs in WEBHOOK_URL", async () => {
  const env = { WEBHOOK_URL: "https://discordapp.com/api/webhooks/123/token" };
  const result = await withFetchStub((url, init) => {
    assert.equal(url, env.WEBHOOK_URL);
    assert.match(JSON.parse(init.body).content, /Discord fallback/);
    return new Response(null, { status: 204 });
  }, () => sendReportWebhook(env, "2026-08-05", "Discord fallback"));

  assert.deepEqual(result, {
    sent: true,
    provider: "discord",
    messages: 1,
    chunks: { expected: 1, delivered: 1, failed: 0 },
  });
});

test("complete Discord reports are delivered through every chunk", async () => {
  const markdown = `${completeReport(["NVDA"], "Chunked delivery remains complete.")}\n\n${"Additional context line for chunking.\n".repeat(120)}`;
  const env = { DISCORD_WEBHOOK_URL: "https://discord.com/api/webhooks/123/token" };
  const contents = [];

  const result = await withFetchStub((url, init) => {
    assert.equal(url, env.DISCORD_WEBHOOK_URL);
    const body = JSON.parse(init.body);
    contents.push(body.content);
    assert.ok(body.content.length < 2000);
    return new Response(null, { status: 204 });
  }, () => sendReportWebhook(env, "2026-08-05", markdown));

  assert.equal(result.sent, true);
  assert.equal(result.messages, contents.length);
  assert.ok(contents.length > 1);
  assert.match(contents.at(1), /^Part 2\/\d+/);
  assert.doesNotMatch(contents.join("\n"), /\*\*Growth Tech Morning Brief —/);
  assert.deepEqual(result.chunks, { expected: contents.length, delivered: contents.length, failed: 0 });
});

test("Discord 429 responses are retried with the requested delay", async () => {
  const env = { DISCORD_WEBHOOK_URL: "https://discord.com/api/webhooks/123/token" };
  let calls = 0;

  const result = await withFetchStub((url) => {
    assert.equal(url, env.DISCORD_WEBHOOK_URL);
    calls += 1;
    if (calls === 1) {
      return new Response(JSON.stringify({ retry_after: 0 }), {
        status: 429,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response(null, { status: 204 });
  }, () => sendReportWebhook(env, "2026-08-05", completeReport(["NVDA"])));

  assert.equal(calls, result.messages + 1);
  assert.deepEqual(result.chunks, { expected: result.messages, delivered: result.messages, failed: 0 });
});

test("deliver-latest requires authorization", async () => {
  const response = await worker.fetch(new Request("https://example.test/deliver-latest", { method: "POST" }), {
    RUN_TOKEN_REQUIRED: "true",
    RUN_TOKEN: "secret",
    BRIEF_BUCKET: r2({ "reports/latest.md": "stored markdown" }),
  });

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "unauthorized" });
});

test("deliver-latest returns no_report_yet when latest report is missing", async () => {
  const response = await worker.fetch(new Request("https://example.test/deliver-latest", {
    method: "POST",
    headers: { authorization: "Bearer secret" },
  }), {
    RUN_TOKEN_REQUIRED: "true",
    RUN_TOKEN: "secret",
    BRIEF_BUCKET: r2(),
  });

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: "no_report_yet" });
});

test("deliver-latest sends the latest stored report to Discord", async () => {
  const env = {
    RUN_TOKEN_REQUIRED: "true",
    RUN_TOKEN: "secret",
    DISCORD_WEBHOOK_URL: "https://discord.com/api/webhooks/123/token",
    BRIEF_BUCKET: r2({ "reports/latest.md": "# Stored report" }),
  };

  const response = await withFetchStub((url, init) => {
    assert.equal(url, env.DISCORD_WEBHOOK_URL);
    const body = JSON.parse(init.body);
    assert.doesNotMatch(body.content, /\*\*Growth Tech Morning Brief — 2026-08-05\*\*/);
    assert.match(body.content, /# Stored report/);
    return new Response(null, { status: 204 });
  }, () => worker.fetch(new Request("https://example.test/deliver-latest", {
    method: "POST",
    headers: { authorization: "Bearer secret" },
  }), env));

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.date, "2026-08-05");
  assert.deepEqual(body.webhook, {
    sent: true,
    provider: "discord",
    messages: 1,
    chunks: { expected: 1, delivered: 1, failed: 0 },
  });
  assert.match(env.BRIEF_BUCKET.objects.get("deliveries/2026-08-05.json"), /"sent": true/);
});

test("existing report with no delivery receipt retries Discord on scheduled run", async () => {
  const bucket = r2({ "reports/2026-08-05.md": "stored report" });
  const env = { WATCHLIST: "NVDA", DISCORD_WEBHOOK_URL: "https://discord.com/api/webhooks/123/token", BRIEF_BUCKET: bucket };

  const result = await withFetchStub((url, init) => {
    if (url.startsWith("https://query1.finance.yahoo.com")) return responseJson(yahooChart());
    if (url.startsWith("https://data.sec.gov")) return responseJson({ facts: { "us-gaap": {} } });
    assert.equal(url, env.DISCORD_WEBHOOK_URL);
    assert.match(JSON.parse(init.body).content, /stored report/);
    return new Response(null, { status: 204 });
  }, () => runScheduledBrief(env, new Date("2026-08-05T13:35:00.000Z")));

  assert.equal(result.report.reused, true);
  assert.deepEqual(result.report.webhook, {
    sent: true,
    provider: "discord",
    messages: 1,
    chunks: { expected: 1, delivered: 1, failed: 0 },
  });
});

test("existing successful receipt prevents duplicate scheduled Discord delivery", async () => {
  const bucket = r2({
    "reports/2026-08-05.md": "stored report",
    "deliveries/2026-08-05.json": JSON.stringify({ discord: { sent: true, messages: 1, timestamp: "2026-08-05T13:40:00.000Z" } }),
  });
  const env = { WATCHLIST: "NVDA", DISCORD_WEBHOOK_URL: "https://discord.com/api/webhooks/123/token", BRIEF_BUCKET: bucket };

  const result = await withFetchStub((url) => {
    if (url.startsWith("https://query1.finance.yahoo.com")) return responseJson(yahooChart());
    if (url.startsWith("https://data.sec.gov")) return responseJson({ facts: { "us-gaap": {} } });
    throw new Error(`Unexpected delivery fetch ${url}`);
  }, () => runScheduledBrief(env, new Date("2026-08-05T13:35:00.000Z")));

  assert.deepEqual(result.report.webhook, {
    skipped: true,
    reason: "discord_already_delivered",
    receipt: { sent: true, messages: 1, timestamp: "2026-08-05T13:40:00.000Z" },
  });
});

test("run-report forceDelivery retries delivery without another Gemini API call", async () => {
  const bucket = r2({ "reports/2026-08-05.md": "stored report" });
  const env = {
    RUN_TOKEN_REQUIRED: "true",
    RUN_TOKEN: "secret",
    WATCHLIST: "NVDA",
    GEMINI_API_KEY: "gemini-test-key",
    DISCORD_WEBHOOK_URL: "https://discord.com/api/webhooks/123/token",
    BRIEF_BUCKET: bucket,
  };

  const response = await withFetchStub((url, init) => {
    if (url.startsWith("https://query1.finance.yahoo.com")) return responseJson(yahooChart());
    if (url.startsWith("https://data.sec.gov")) return responseJson({ facts: { "us-gaap": {} } });
    if (url.startsWith("https://generativelanguage.googleapis.com")) throw new Error("Gemini should not be called");
    assert.equal(url, env.DISCORD_WEBHOOK_URL);
    assert.match(JSON.parse(init.body).content, /stored report/);
    return new Response(null, { status: 204 });
  }, () => worker.fetch(new Request("https://example.test/run-report", {
    method: "POST",
    headers: { authorization: "Bearer secret", "content-type": "application/json" },
    body: JSON.stringify({ forceDelivery: true }),
  }), env));

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.report.generated, false);
  assert.equal(body.report.reused, true);
  assert.deepEqual(body.report.webhook, {
    sent: true,
    provider: "discord",
    messages: 1,
    chunks: { expected: 1, delivered: 1, failed: 0 },
  });
  assert.equal(bucket.objects.get("reports/2026-08-05.md"), "stored report");
});

test("Discord errors return useful diagnostics without exposing the webhook URL", async () => {
  const env = {
    RUN_TOKEN_REQUIRED: "true",
    RUN_TOKEN: "secret",
    DISCORD_WEBHOOK_URL: "https://discord.com/api/webhooks/123/secret-token",
    BRIEF_BUCKET: r2({ "reports/latest.md": "stored report" }),
  };

  const response = await withFetchStub((url) => {
    assert.equal(url, env.DISCORD_WEBHOOK_URL);
    return new Response("invalid webhook", { status: 404 });
  }, () => worker.fetch(new Request("https://example.test/deliver-latest", {
    method: "POST",
    headers: { authorization: "Bearer secret" },
  }), env));

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.webhook.failed, true);
  assert.match(body.webhook.error, /Discord webhook delivery failed \(1\/1\) \(404\): invalid webhook/);
  assert.doesNotMatch(JSON.stringify(body), /secret-token/);
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
