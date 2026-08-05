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
    "# Today's Verdict",
    "- **Verdict:** No high-conviction trade today.",
    "- **Confidence:** Medium.",
    `- **Why Today:** ${detail}`,
    "",
    "# Decision Reasoning",
    "**Universe Searched:** The core watchlist and configured discovery screens were checked with liquidity and relevance filters.",
    "**Opportunity Gate:** Candidates require a fresh event, earnings, a meaningful dislocation, or an extreme trim setup; ranking alone is insufficient.",
    "**Conclusion:** The strongest setup lacks enough verified evidence and asymmetric risk/reward to justify action today.",
    "",
    "# Opportunities",
    "No actionable opportunity clears the threshold.",
    "",
    "# Rejected Candidates",
    `${symbolText} reached review, but the fixture contains no verified catalyst or evidence of a durable market mispricing. A confirmed event and favorable entry would promote it.`,
    "",
    "# Market and AI-Cycle Context",
    "- **AI Cycle:** Insufficient data; price action cannot establish the cycle.",
    `- **Market Regime:** ${symbolText} price action is supplied, but no broad regime shift is verified.`,
    "- **Material News:** No verified fresh event changes conviction in this fixture.",
    "",
    "# What Could Change the Call",
    "- A verified company catalyst with a measurable price reaction.",
    "- A material Fed decision or yield reversal.",
    "- Better fundamental, valuation, and liquidity evidence could change the conclusion.",
  ].join("\n");
}

function verboseNoTradeReport(symbols = ["NVDA"]) {
  const symbolText = symbols.join(", ");
  return [
    "# Growth Tech Morning Brief",
    "**Report Mode:** verbose",
    "**Engine Version:** 0.5.5",
    "",
    "# Today's Verdict",
    "- **Verdict:** No high-conviction trade today.",
    "- **Confidence:** High because the screened candidates lack a verified, asymmetric setup.",
    `- **Why Today:** ${symbolText} reached review, but the evidence does not support an actionable entry or exit.`,
    "",
    "# Decision Reasoning",
    "**Universe Searched:** The core watchlist and broad discovery universe were screened for events, earnings, dislocations, valuation extremes, and liquidity.",
    `**Opportunity Gate:** ${symbolText} entered through a material price move, then faced catalyst, valuation, evidence-quality, and risk/reward checks.`,
    "**Conclusion:** The move was not tied to verified new fundamental information, so treating it as mispricing would be speculation rather than an evidence-backed trade.",
    "",
    "# Opportunities",
    "- **Threshold Result:** No actionable opportunity clears the absolute trade threshold.",
    `- **Best Near-Miss:** ${symbolText} was the strongest near-miss because its move was large enough to require investigation.`,
    "- **Why It Failed:** No verified catalyst, fresh estimate change, or measurable valuation dislocation established favorable expected value.",
    "- **Portfolio Action:** Hold existing exposure and wait for verified information or a price level that creates asymmetric risk/reward.",
    "",
    "# Rejected Candidates",
    "### NVDA — Watch",
    "- **Admission Signal:** The daily move exceeded the dislocation threshold.",
    "- **Evidence Supporting:** Positive price momentum made the move relevant for same-day review.",
    "- **Evidence Missing or Conflicting:** No direct company catalyst or demand evidence was verified, and valuation evidence does not establish a bargain.",
    "- **Rejection Reason:** Momentum alone cannot justify a Buy or Sell action.",
    "- **Promotion Trigger:** Verified company news plus a favorable entry and explicit invalidation level.",
    "",
    "# Data and Pipeline Audit",
    "**Available Evidence:** Current price, daily change, range position, screened news, and available historical valuation were reviewed.",
    "**Missing Evidence:** Forward estimates, direct demand indicators, and a verified company catalyst are unavailable.",
    "**Source Failures:** No source failure is hidden; missing items are absent from configured feeds rather than silently treated as negative evidence.",
    "**Confidence Impact:** Missing catalyst and forward-estimate data raises confidence in No Trade but lowers confidence in any directional thesis.",
    "",
    "# Market and AI-Cycle Context",
    "- **AI Cycle:** Direct CapEx, backlog, utilization, and estimate-revision evidence remains insufficient.",
    "- **Market Regime:** Price action is mixed and does not independently create a trade signal.",
    "- **Material News:** No verified event changes the candidate conclusion.",
    "",
    "# What Could Change the Call",
    "- A verified earnings, guidance, contract, regulatory, or estimate-revision event.",
    "- A larger price dislocation that creates favorable risk/reward with a defined invalidation level.",
  ].join("\n");
}

test("verbose validation requires an auditable no-trade explanation", () => {
  const compact = {
    reportMode: "verbose",
    engineVersion: "0.5.5",
    opportunityGate: { maximumOpportunities: 8, candidates: [{ symbol: "NVDA", setup: { verifiedCatalyst: false } }] },
  };
  const valid = validateReportCompleteness(verboseNoTradeReport(), ["NVDA"], compact);
  assert.deepEqual(valid, { ok: true, errors: [] });

  const silent = validateReportCompleteness(verboseNoTradeReport().replace(/NVDA/g, "the candidate"), ["NVDA"], compact);
  assert.equal(silent.ok, false);
  assert.match(silent.errors.join("; "), /silently omitted gated candidate: NVDA/);
});

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
      assert.match(body.contents[0].parts[0].text, /decision-focused Growth Tech Morning Brief/);
      assert.match(body.contents[0].parts[0].text, /No high-conviction trade today/);
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
    assert.match(body.messages[0].content, /Today's Verdict/);
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

test("authenticated run-report can route a forced verbose regeneration to a selected DeepSeek model", async () => {
  const bucket = r2({ "reports/2026-08-05.md": "old report", "reports/latest.md": "old report" });
  const markdown = verboseNoTradeReport(["NVDA"]);
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
    const requestBody = JSON.parse(init.body);
    assert.equal(requestBody.model, "deepseek-v4-pro");
    assert.match(requestBody.messages[0].content, /Verbose mode is an audit trail/);
    assert.match(requestBody.messages[0].content, /Data and Pipeline Audit/);
    return responseJson({ choices: [{ finish_reason: "stop", message: { content: markdown } }] });
  }, () => worker.fetch(new Request("https://example.test/run-report", {
    method: "POST",
    headers: { authorization: "Bearer secret", "content-type": "application/json" },
    body: JSON.stringify({ forceRegenerate: true, provider: "deepseek", model: "deepseek-v4-pro", reportMode: "verbose" }),
  }), env));

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.report.aiProvider, "deepseek");
  assert.equal(body.report.aiModel, "deepseek-v4-pro");
  assert.equal(body.report.reportMode, "verbose");
  assert.equal(body.report.reportEngineVersion, "0.5.5");
  assert.equal(bucket.putOptions.get("reports/latest.md").customMetadata.reportMode, "verbose");
  assert.equal(bucket.putOptions.get("reports/latest.md").customMetadata.engineVersion, "0.5.5");
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
    message: "provider/model/reportMode overrides require forceRegenerate=true",
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

test("strict schema rejects a verdict without required confidence", () => {
  const markdown = completeReport(["NVDA"]).replace("- **Confidence:** Medium.\n", "");
  const validation = validateReportCompleteness(markdown, ["NVDA"]);
  assert.equal(validation.ok, false);
  assert.match(validation.errors.join("; "), /missing Today's Verdict field: Confidence/);
});

test("strict schema rejects a recap that only has the four section names", () => {
  const recap = [
    "# Today's Verdict", "Market action is mixed.",
    "# Opportunities", "NVDA moved higher.",
    "# Market and AI-Cycle Context", "Hardware is mixed.",
    "# What Could Change the Call", "More data.",
  ].join("\n\n");
  const validation = validateReportCompleteness(recap, ["NVDA"]);
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.includes("missing Today's Verdict field: Verdict"));
  assert.ok(validation.errors.includes("missing Market Context field: Material News"));
  assert.ok(validation.errors.includes("Opportunities must state that no setup clears the threshold"));
});

test("semantic validation rejects unsupported demand and CapEx conclusions", () => {
  const markdown = completeReport(["NVDA"])
    .replace("Insufficient data; price action cannot establish the cycle.", "GPU demand remains robust and the CapEx cycle is intact.");
  const validation = validateReportCompleteness(markdown, ["NVDA"]);
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.includes("unsupported demand claim"));
  assert.ok(validation.errors.includes("unsupported CapEx-cycle claim"));
});

test("actionable calls require the symbol to clear the absolute setup gate", () => {
  const markdown = completeReport(["NVDA"]).replace(
    "No actionable opportunity clears the threshold.",
    [
      "### NVDA — Buy now",
      "- **Strategic Position:** Buy.",
      "- **Today's Action:** Buy now.",
      "- **Confidence:** High.",
      "- **Entry/Exit Condition:** Enter at market.",
      "- **Verified Catalyst:** None.",
      "- **Downside:** Valuation compression.",
      "- **Invalidation:** Exit below support.",
    ].join("\n"),
  );
  const validation = validateReportCompleteness(markdown, ["NVDA"], { opportunityGate: { candidates: [] } });
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.includes("opportunity did not clear absolute setup gate: NVDA"));
});

test("a large move without verified news can be Watch but not Buy now", () => {
  const markdown = completeReport(["NVDA"]).replace(
    "No actionable opportunity clears the threshold.",
    [
      "### NVDA — Buy now",
      "- **Strategic Position:** Hold.",
      "- **Today's Action:** Buy now.",
      "- **Confidence:** Low.",
      "- **Entry/Exit Condition:** Wait for confirmation.",
      "- **Verified Catalyst:** No verified catalyst.",
      "- **Downside:** Move may be noise.",
      "- **Invalidation:** Reversal below prior close.",
    ].join("\n"),
  );
  const compact = { opportunityGate: { candidates: [{ symbol: "NVDA", setup: { eligible: true, verifiedCatalyst: false, dislocation: true, extremeTrim: false } }] } };
  const validation = validateReportCompleteness(markdown, ["NVDA"], compact);
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.includes("actionable call lacks verified catalyst: NVDA"));
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
      assert.match(request.contents[0].parts[0].text, /previous response failed validation/);
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

  assert.match(result.report.error, /missing section: Today's Verdict/);
  assert.equal(bucket.objects.has("reports/2026-08-05.md"), false);
});

test("short report may omit covered symbols when none merits a setup", async () => {
  const bucket = r2();
  const markdown = completeReport(["NVDA"], "This intentionally omits the second symbol.");

  const result = await withFetchStub((url) => {
    if (url.startsWith("https://query1.finance.yahoo.com")) return responseJson(yahooChart(url.includes("AMZN") ? "AMZN" : "NVDA"));
    if (url.startsWith("https://data.sec.gov")) return responseJson({ facts: { "us-gaap": {} } });
    if (url.startsWith("https://generativelanguage.googleapis.com")) return responseJson(geminiReport(markdown));
    throw new Error(`Unexpected fetch ${url}`);
  }, () => runScheduledBrief({ WATCHLIST: "NVDA,AMZN", GEMINI_API_KEY: "key", BRIEF_BUCKET: bucket }, new Date("2026-08-05T13:35:00.000Z")));

  assert.equal(result.report.generated, true);
  assert.equal(bucket.objects.get("reports/2026-08-05.md"), markdown);
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
    engineVersion: "0.5.5",
    generated: false,
    stored: true,
    email: null,
    webhook: { skipped: true, reason: "webhook_not_configured" },
    reused: true,
    reportMode: "unknown",
    reportEngineVersion: "unknown",
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


test("compact report payload excludes raw history and keeps only gated candidates", () => {
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

  assert.equal("watchlist" in compact, false);
  assert.equal(compact.opportunityGate.candidates[0].symbol, "NVDA");
  assert.equal(compact.opportunityGate.candidates[0].setup.dislocation, true);
});
