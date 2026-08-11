import test from "node:test";
import assert from "node:assert/strict";
import worker, { compactSnapshotForReport, normalizeResearchPacket, renderMorningBrief, renderResearchAudit, runScheduledBrief, selectResearchCandidates, sendReportEmail, sendReportWebhook, synthesisContext, validateReportCompleteness, validateResearchBatch, validateResearchConsistency } from "../src/index.js";

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

function currentNewYorkDate() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function completeReport(symbols = ["NVDA"], detail = "Balanced action is to monitor positioning and catalyst timing.", watchlistAction = "Watch") {
  const symbolText = symbols.join(", ");
  const covered = new Set(symbols);
  const sectorRow = (sector, members) => {
    const hasMember = members.some((symbol) => covered.has(symbol));
    return `| ${sector} | Unavailable | Unavailable | ${hasMember ? "Positive" : "Unavailable"} | Neutral | ${hasMember ? "Covered price data only" : "No covered symbols"} |`;
  };
  return [
    "# Growth Tech Morning Brief",
    "",
    "**Report Mode:** standard",
    "**Engine Version:** 0.5.7",
    "**Build Revision:** 0.5.7-hf4",
    "**Report ID:** 00000000-0000-4000-8000-000000000000",
    "**Generated At:** 2026-08-05T13:35:00.000Z",
    "",
    "# Executive Summary",
    "- **AI Cycle:** Insufficient Data; price action cannot establish the cycle.",
    `- **Key Catalyst:** ${detail}`,
    "- **Principal Risk:** Missing forward estimates limit directional confidence.",
    `- **Best Opportunity:** None clears the action gate; ${symbolText} remains a researched near-miss.`,
    "- **Avoid:** Avoid treating unverified price movement as a fundamental signal.",
    "",
    "# Overnight and Market Context",
    "- **As Of:** 2026-08-05T13:35:00.000Z; regular trading session.",
    "- **Global Markets:** Mixed; only supplied point-in-time data are used.",
    "- **Futures:** Available and current in the supplied snapshot.",
    "- **Rates:** Available; changes should be expressed in basis points.",
    "- **Dollar:** Available in the supplied snapshot.",
    "- **Oil:** Available in the supplied snapshot.",
    "",
    "# AI Cycle Dashboard",
    "| Segment | Rating | Trend | Evidence | Limitation |",
    "|---|---|---|---|---|",
    "| Hyperscaler AI CapEx | Insufficient Data | Unclear | No direct guidance evidence | Price does not measure CapEx |",
    "| GPU Demand | Insufficient Data | Unclear | No direct demand evidence | Price does not measure demand |",
    "| AI Cloud | Insufficient Data | Unclear | No utilization evidence | Coverage unavailable |",
    "| Enterprise AI | Insufficient Data | Unclear | No adoption evidence | Coverage unavailable |",
    "| Inference | Insufficient Data | Unclear | No utilization evidence | Coverage unavailable |",
    "",
    "# Sector Scorecard",
    "| Sector | Fundamentals | Valuation | Momentum | Sector Stance | Evidence |",
    "|---|---|---|---|---|---|",
    sectorRow("GPU", ["NVDA", "TSM", "AVGO"]),
    sectorRow("AI Cloud", ["AMZN", "MSFT", "GOOGL", "ORCL"]),
    sectorRow("GPU Cloud", ["CRWV"]),
    sectorRow("Networking", ["ANET", "AVGO"]),
    sectorRow("Cooling", ["VRT"]),
    sectorRow("Power", ["CEG"]),
    sectorRow("Cybersecurity", ["FTNT"]),
    sectorRow("Cloud Software", ["MSFT", "AMZN", "GOOGL", "META", "ORCL"]),
    "",
    "# Watchlist",
    "| Symbol | Price | Daily Change | 52-Week Position | Valuation | Trailing 5Y Percentile | Catalyst | Risk | Final Action | Research Status |",
    "|---|---:|---:|---:|---|---|---|---|---|---|",
    ...symbols.map((symbol) => `| ${symbol} | $110 | +10% | 50% | Unavailable | Unavailable | No verified catalyst | Evidence gap | ${watchlistAction} | Researched |`),
  ].join("\n");
}

function verboseNoTradeReport(symbols = ["NVDA"]) {
  return completeReport(symbols).replace("**Report Mode:** standard", "**Report Mode:** verbose");
}

test("verbose Morning Brief keeps research audit out of the five-section product", () => {
  const compact = {
    reportMode: "verbose",
    engineVersion: "0.5.7",
    opportunityGate: { maximumOpportunities: 8, candidates: [{ symbol: "NVDA", setup: { verifiedCatalyst: false } }] },
    buildRevision: "0.5.7-hf4",
    research: { funnel: { screened: 0, admitted: 1, researched: 1, incomplete: 0, gateQualified: 0, recommendedActions: 0, rejectedOrWatch: 1 }, packets: [{ symbol: "NVDA" }] },
  };
  const valid = validateReportCompleteness(verboseNoTradeReport(), ["NVDA"], compact);
  assert.deepEqual(valid, { ok: true, errors: [] });

  const embeddedAudit = `${verboseNoTradeReport()}\n\n## Research Audit\nlegacy audit`;
  assert.match(validateReportCompleteness(embeddedAudit, ["NVDA"], compact).errors.join("; "), /Research Audit must be stored separately/);
});

test("available market context permits an unavailable child change metric", () => {
  const compact = { marketContext: { usd: { status: "available" } } };
  const report = completeReport().replace(
    "- **Dollar:** Available in the supplied snapshot.",
    "- **Dollar:** available as of 2026-08-05T13:35:00.000Z: U.S. Dollar Index 98.5 (daily change unavailable).",
  );

  assert.deepEqual(validateReportCompleteness(report, ["NVDA"], compact), { ok: true, errors: [] });
});

test("unavailable market context must be marked unavailable at category level", () => {
  const compact = { marketContext: { usd: { status: "unavailable" } } };
  const validation = validateReportCompleteness(completeReport(), ["NVDA"], compact);

  assert.match(validation.errors.join("; "), /unavailable context not flagged unavailable: Dollar/);
});

test("verbose validation applies section-aware research and context-only ticker scopes", () => {
  const compact = {
    reportMode: "verbose",
    engineVersion: "0.5.7",
    buildRevision: "0.5.7-hf4",
    opportunityGate: { maximumOpportunities: 8, candidates: [{ symbol: "NVDA", setup: { verifiedCatalyst: false } }] },
    discovery: { admittedSymbols: [] },
    research: { funnel: { screened: 0, admitted: 1, researched: 1, incomplete: 0, gateQualified: 0, recommendedActions: 0, rejectedOrWatch: 1 }, packets: [{ symbol: "NVDA" }] },
    researchSymbols: ["NVDA"],
    contextOnlySymbols: ["GOOGL"],
  };
  const foreignTicker = validateReportCompleteness(verboseNoTradeReport().replace("NVDA remains a researched near-miss", "GOOGL remains a researched near-miss"), ["NVDA"], compact);
  assert.match(foreignTicker.errors.join("; "), /ticker reference outside research universe in Executive Summary: GOOGL/);

  const factualContext = verboseNoTradeReport().replace(
    "Mixed; only supplied point-in-time data are used.",
    "GOOGL fell 1% in the supplied market data; this does not independently create a trade signal.",
  );
  assert.deepEqual(validateReportCompleteness(factualContext, ["NVDA"], compact), { ok: true, errors: [] });

  const judgedContext = factualContext.replace("GOOGL fell 1%", "GOOGL is undervalued after falling 1%");
  assert.match(validateReportCompleteness(judgedContext, ["NVDA"], compact).errors.join("; "), /context-only ticker received investment judgment: GOOGL/);
});

test("auto-watchlist fills unused research capacity without clearing the action gate", () => {
  const symbols = ["NVDA", "AMZN", "MSFT", "ANET", "CRWV", "AVGO", "META", "GOOGL", "ORCL", "TSM", "VRT", "CEG", "FTNT"];
  const rows = symbols.map((symbol, index) => ({
    symbol,
    price: 100 + index,
    changePercent: index === 0 ? 4 : 0,
    positionIn52WeekRange: 50,
    valuation: { trailingPE: 20 },
    reportedGrowth: { revenueTtmYoY: 10 },
    setup: { eligible: index === 0, score: index === 0 ? 2 : 0, reasons: index === 0 ? ["+4% price dislocation"] : [], verifiedCatalyst: false, dislocation: index === 0, extremeTrim: false },
    missing: false,
  }));
  const selected = selectResearchCandidates(rows, [], { events: [] });
  assert.equal(selected.length, 12);
  assert.equal(selected[0].symbol, "NVDA");
  assert.equal(selected[0].admissionType, "setup_gate");
  assert.equal(selected.filter((row) => row.admissionType === "auto_watchlist").length, 11);
  assert.ok(selected.slice(1).every((row) => row.setup.eligible === false && row.setup.autoWatchlist === true));
});

test("snapshot-to-report integration fills all 12 research slots from the full core watchlist", () => {
  const coreSymbols = ["NVDA", "AMZN", "MSFT", "ANET", "CRWV", "AVGO", "META", "GOOGL", "ORCL", "TSM", "VRT", "CEG", "FTNT"];
  const watchlist = coreSymbols.map((symbol, index) => ({
    symbol,
    name: symbol,
    price: 100 + index,
    changePercent: index < 3 ? 4 : 0,
    yearLow: 80,
    yearHigh: 120,
    positionIn52WeekRange: 50,
    valuation: null,
    reportedGrowth: null,
    fundamentals: { cacheStatus: "fresh" },
    missing: false,
  }));
  const discovery = ["FSLY", "VREX", "AIOT", "NABL", "AXTI", "CEVA"].map((symbol, index) => ({
    symbol,
    name: symbol,
    price: 20 + index,
    changePercent: 5 + index,
    yearLow: 10,
    yearHigh: 40,
    positionIn52WeekRange: 50,
    marketCap: 1_000_000_000,
    dollarVolume: 30_000_000,
    discoveryScore: 5,
    fundamentalCoverage: { status: "available" },
    missing: false,
  }));
  const compact = compactSnapshotForReport({
    generatedAt: "2026-08-10T20:00:00.000Z",
    session: "after_hours",
    coverage: { requested: 13, succeeded: 13, failed: 0 },
    watchlist,
    discovery: { status: "available", scanned: 7148, candidates: discovery },
    eventLedger: { events: [] },
  });

  assert.equal(compact.opportunityGate.candidates.length, 12);
  assert.deepEqual(compact.opportunityGate.researchCapacity, {
    maximum: 12,
    eligibleUniverse: 19,
    target: 12,
    filled: 12,
    unfilled: 0,
    excludedCore: [],
  });
  assert.equal(compact.opportunityGate.candidates.filter((row) => row.admissionType === "setup_gate").length, 9);
  assert.equal(compact.opportunityGate.candidates.filter((row) => row.admissionType === "auto_watchlist").length, 3);
});

test("synthesis exposes a filtered two-level ticker universe while preserving source ledger input", () => {
  const fullLedger = {
    schemaVersion: "event-ledger-v1",
    events: [
      { id: "nvda", symbol: "NVDA", delta: "new", title: "NVDA event" },
      { id: "msft", symbol: "MSFT", delta: "new", title: "MSFT event" },
      { id: "lite", symbol: "LITE", delta: "new", title: "LITE event" },
    ],
    delta: { new: ["nvda", "msft", "lite"], unchanged: [], resolved: [] },
  };
  const compact = {
    schemaVersion: 7,
    engineVersion: "0.5.7",
    reportMode: "verbose",
    calendars: { earnings: { events: [{ symbol: "NVDA" }, { symbol: "MSFT" }, { symbol: "LITE" }], watchlistMatches: ["NVDA", "MSFT"] } },
    decisionFramework: { aiCycle: { GPU: { evidence: "NVDA +1%, MSFT -1%" } } },
    opportunityGate: { candidates: [] },
    discovery: { candidates: [{ symbol: "LITE" }] },
    eventLedger: fullLedger,
  };
  const research = { packets: [{ symbol: "NVDA", sourceSnapshot: { sourceType: "core", setup: {} } }], funnel: {}, batches: [] };
  const synthesis = synthesisContext(compact, research);
  assert.deepEqual(synthesis.researchSymbols, ["NVDA"]);
  assert.deepEqual(synthesis.contextOnlySymbols, ["MSFT"]);
  assert.deepEqual(synthesis.eventLedger.events.map((event) => event.symbol), ["NVDA", "MSFT"]);
  assert.deepEqual(synthesis.calendars.earnings.events.map((event) => event.symbol), ["NVDA", "MSFT"]);
  assert.deepEqual(fullLedger.events.map((event) => event.symbol), ["NVDA", "MSFT", "LITE"]);
});

test("research consistency rejects duplicate, missing, and inconsistent packets", () => {
  const candidates = [{ symbol: "NVDA" }, { symbol: "ANET" }];
  const result = validateResearchConsistency({
    packets: [{ symbol: "NVDA" }, { symbol: "NVDA" }],
    funnel: { admitted: 3, researched: 2, incomplete: 0, gateQualified: 0, recommendedActions: 0, rejectedOrWatch: 2 },
  }, candidates);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("; "), /duplicate research packet symbol/);
  assert.match(result.errors.join("; "), /missing research packet: ANET/);
  assert.match(result.errors.join("; "), /admitted 3 != packets 2/);
});

test("research consistency binds recommended count to gate-approved final actions", () => {
  const candidates = [{ symbol: "NVDA" }];
  const leaked = validateResearchConsistency({
    packets: [{ symbol: "NVDA", status: "complete", gateResult: "fail", finalAction: "Buy now" }],
    funnel: { admitted: 1, researched: 1, incomplete: 0, gateQualified: 1, recommendedActions: 0, rejectedOrWatch: 1 },
  }, candidates);

  assert.equal(leaked.ok, false);
  assert.match(leaked.errors.join("; "), /trade finalAction requires a passed deterministic gate: NVDA/);
});

function geminiReport(text, finishReason = "STOP", usageMetadata = {}, parts = null) {
  return {
    candidates: [{ finishReason, content: { parts: parts ?? [{ text }] } }],
    usageMetadata,
  };
}

function researchFixtureResponse(url, init) {
  if (!url.includes("generativelanguage.googleapis.com") && !url.endsWith("/chat/completions")) return null;
  const request = JSON.parse(init.body);
  const prompt = request.contents?.[0]?.parts?.[0]?.text ?? request.messages?.[0]?.content ?? "";
  if (!prompt.startsWith("Research this bounded Growth-Tech candidate batch")) return null;
  const candidates = JSON.parse(prompt.split("\nCandidates:\n").at(-1));
  const content = JSON.stringify({ candidates: candidates.map((candidate) => ({
    symbol: candidate.symbol,
    catalystSummary: "No verified direct catalyst in the fixture.",
    evidenceFor: ["The price move admitted the candidate for review."],
    evidenceAgainst: ["No verified causal event or complete valuation evidence."],
    mispricingThesis: "The fixture does not establish a mispricing.",
    strategicPosition: "Hold",
    todayAction: "Watch",
    confidence: "Medium",
    entryExitCondition: "Wait for verified evidence and a defined price level.",
    riskReward: "Not asymmetric on supplied evidence.",
    invalidation: "A verified fundamental catalyst would require reassessment.",
    missingEvidence: ["forward estimates"],
    sourceQuality: "mixed",
    gateResult: "fail",
    gateReason: "The absolute action threshold was not cleared.",
  })) });
  if (url.includes("generativelanguage.googleapis.com")) return responseJson(geminiReport(content));
  return responseJson({ choices: [{ finish_reason: "stop", message: { content } }] });
}

function discordForm(init) {
  assert.ok(init.body instanceof FormData);
  return {
    payload: JSON.parse(init.body.get("payload_json")),
    file: init.body.get("files[0]"),
  };
}

async function withFetchStub(handler, run, options = {}) {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    calls.push({ url, init });
    const research = options.autoResearch === false ? null : researchFixtureResponse(url, init);
    if (research) return research;
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
  let webhookMarkdown = "";
  const env = {
    WATCHLIST: "NVDA",
    GEMINI_API_KEY: "gemini-test-key",
    RESEND_API_KEY: "resend-test-key",
    REPORT_TO_EMAIL: "pm@example.com",
    REPORT_FROM_EMAIL: "brief@example.com",
    WEBHOOK_URL: "https://hooks.example.test/brief",
    BRIEF_BUCKET: bucket,
  };

  const result = await withFetchStub(async (url, init) => {
    if (url.startsWith("https://query1.finance.yahoo.com")) return responseJson(yahooChart());
    if (url.startsWith("https://data.sec.gov")) return responseJson({ entityName: "NVIDIA", facts: { "us-gaap": {} } });
    if (url === "https://api.resend.com/emails") {
      assert.equal(init.headers.authorization, "Bearer resend-test-key");
      assert.equal(init.headers["idempotency-key"], "growth-tech-morning-brief-2026-08-05");
      const body = JSON.parse(init.body);
      assert.equal(body.to[0], "pm@example.com");
      const generatedDate = body.text.match(/\*\*Generated At:\*\* (\d{4}-\d{2}-\d{2})/)?.[1];
      assert.ok(generatedDate);
      assert.match(body.html, new RegExp(`<h1>Growth Tech Morning Brief — ${generatedDate}<\\/h1>`));
      assert.match(body.text, /# Executive Summary/);
      assert.doesNotMatch(body.text, /# Today's Verdict/);
      return responseJson({ id: "email_123" });
    }
    if (url === "https://hooks.example.test/brief") {
      const body = JSON.parse(init.body);
      assert.equal(body.date, "2026-08-05");
      webhookMarkdown = body.markdown;
      return new Response(null, { status: 204 });
    }
    throw new Error(`Unexpected fetch ${url}`);
  }, () => runScheduledBrief(env, new Date("2026-08-05T13:35:00.000Z")));

  assert.equal(result.report.generated, true);
  assert.equal(result.report.geminiModel, "gemini-3.5-flash");
  assert.equal(result.report.stored, true);
  assert.deepEqual(result.report.email, { sent: true, id: "email_123" });
  assert.deepEqual(result.report.webhook, { sent: true, provider: "generic" });
  const stored = bucket.objects.get("reports/2026-08-05.md");
  assert.equal(stored, webhookMarkdown);
  assert.equal(bucket.objects.get("reports/latest.md"), stored);
  assert.match(stored, /\*\*Build Revision:\*\* 0\.5\.7-hf4/);
  assert.doesNotMatch(stored, /Research Audit/);
  assert.ok(bucket.objects.has("research-audit/2026-08-05.md"));
  assert.equal(bucket.putOptions.get("reports/latest.md").customMetadata.reportDate, "2026-08-05");
  assert.equal(bucket.putOptions.get("reports/latest.md").customMetadata.geminiModel, "gemini-3.5-flash");
  assert.equal(bucket.putOptions.get("reports/latest.md").customMetadata.finishReason, "DETERMINISTIC_RENDER");
  assert.equal(bucket.putOptions.get("reports/latest.md").customMetadata.generationAttempts, "0");
  assert.equal(bucket.putOptions.get("reports/latest.md").customMetadata.validation, "passed");
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
    if (url === "https://api.resend.com/emails") return responseJson({ message: "quota exceeded" }, 429);
    if (url === "https://hooks.example.test/brief") return new Response("bad gateway", { status: 502 });
    throw new Error(`Unexpected fetch ${url}`);
  }, () => runScheduledBrief(env, new Date("2026-08-05T13:35:00.000Z")));

  assert.match(bucket.objects.get("reports/2026-08-05.md"), /# Executive Summary/);
  assert.equal(result.report.stored, true);
  assert.equal(result.report.email.failed, true);
  assert.match(result.report.email.error, /Resend email failed \(429\)/);
  assert.equal(result.report.webhook.failed, true);
  assert.match(result.report.webhook.error, /Webhook delivery failed \(502\)/);
});

test("Gemini model can be overridden with GEMINI_MODEL", async () => {
  const bucket = r2();
  const env = {
    WATCHLIST: "NVDA",
    GEMINI_API_KEY: "gemini-test-key",
    GEMINI_MODEL: "gemini-3.5-flash-preview",
    BRIEF_BUCKET: bucket,
  };

  const result = await withFetchStub((url) => {
    if (url.startsWith("https://query1.finance.yahoo.com")) return responseJson(yahooChart());
    if (url.startsWith("https://data.sec.gov")) return responseJson({ facts: { "us-gaap": {} } });
    throw new Error(`Unexpected fetch ${url}`);
  }, () => runScheduledBrief(env, new Date("2026-08-05T13:35:00.000Z")));

  assert.equal(result.report.generated, true);
  assert.equal(result.report.geminiModel, "gemini-3.5-flash-preview");
  assert.match(bucket.objects.get("reports/2026-08-05.md"), /# Watchlist/);
});

test("DeepSeek route sets an explicit research-packet output budget", async () => {
  const bucket = r2();
  const env = {
    WATCHLIST: "NVDA",
    AI_PROVIDER: "deepseek",
    DEEPSEEK_API_KEY: "deepseek-test-key",
    BRIEF_BUCKET: bucket,
  };

  const result = await withFetchStub(async (url, init) => {
    if (url.startsWith("https://query1.finance.yahoo.com")) return responseJson(yahooChart());
    if (url.startsWith("https://data.sec.gov")) return responseJson({ facts: { "us-gaap": {} } });
    assert.equal(url, "https://api.deepseek.com/chat/completions");
    assert.equal(init.headers.authorization, "Bearer deepseek-test-key");
    const body = JSON.parse(init.body);
    assert.equal(body.model, "deepseek-v4-flash");
    assert.deepEqual(body.thinking, { type: "disabled" });
    assert.equal(body.max_tokens, 4000);
    assert.match(body.messages[0].content, /Research this bounded Growth-Tech candidate batch/);
    return researchFixtureResponse(url, init);
  }, () => runScheduledBrief(env, new Date("2026-08-05T13:35:00.000Z")), { autoResearch: false });

  assert.equal(result.report.generated, true);
  assert.equal(result.report.aiProvider, "deepseek");
  assert.equal(result.report.aiModel, "deepseek-v4-flash");
  assert.equal(bucket.putOptions.get("reports/latest.md").customMetadata.aiProvider, "deepseek");
  assert.equal(bucket.putOptions.get("reports/latest.md").customMetadata.aiModel, "deepseek-v4-flash");
  assert.equal(bucket.putOptions.get("reports/latest.md").customMetadata.finishReason, "DETERMINISTIC_RENDER");
});

test("authenticated run-report can route a forced verbose regeneration to a selected DeepSeek model", async () => {
  const bucket = r2({ "reports/2026-08-05.md": "old report", "reports/latest.md": "old report" });
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
    assert.match(requestBody.messages[0].content, /Research this bounded Growth-Tech candidate batch/);
    return researchFixtureResponse(url, init);
  }, () => worker.fetch(new Request("https://example.test/run-report", {
    method: "POST",
    headers: { authorization: "Bearer secret", "content-type": "application/json" },
    body: JSON.stringify({ forceRegenerate: true, provider: "deepseek", model: "deepseek-v4-pro", reportMode: "verbose" }),
  }), env), { autoResearch: false });

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.report.aiProvider, "deepseek");
  assert.equal(body.report.aiModel, "deepseek-v4-pro");
  assert.equal(body.report.reportMode, "verbose");
  assert.equal(body.report.reportEngineVersion, "0.5.7");
  assert.equal(body.report.reportBuildRevision, "0.5.7-hf4");
  assert.equal(bucket.putOptions.get("reports/latest.md").customMetadata.reportMode, "verbose");
  assert.equal(bucket.putOptions.get("reports/latest.md").customMetadata.engineVersion, "0.5.7");
  assert.match(bucket.objects.get("reports/latest.md"), /# Executive Summary/);
  assert.doesNotMatch(bucket.objects.get("reports/latest.md"), /Research Audit/);
  assert.ok(bucket.objects.has("research-audit/latest.md"));
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
  const result = await withFetchStub(async (url, init) => {
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
  }, new Date("2026-08-05T13:35:00.000Z")), { autoResearch: false });

  assert.equal(result.report.aiProvider, "openai-compatible");
  assert.equal(result.report.aiModel, "research-model");
});

test("strict schema rejects an Executive Summary without the required AI Cycle bullet", () => {
  const markdown = completeReport(["NVDA"]).replace("- **AI Cycle:** Insufficient Data; price action cannot establish the cycle.\n", "");
  const validation = validateReportCompleteness(markdown, ["NVDA"]);
  assert.equal(validation.ok, false);
  assert.match(validation.errors.join("; "), /missing Executive Summary field: AI Cycle/);
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
  assert.ok(validation.errors.includes("missing section: Executive Summary"));
  assert.ok(validation.errors.includes("missing section: Watchlist"));
});

test("semantic validation rejects unsupported demand and CapEx conclusions", () => {
  const markdown = completeReport(["NVDA"])
    .replace("Insufficient Data; price action cannot establish the cycle.", "GPU demand remains robust and the CapEx cycle is intact.");
  const validation = validateReportCompleteness(markdown, ["NVDA"]);
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.includes("unsupported demand claim"));
  assert.ok(validation.errors.includes("unsupported CapEx-cycle claim"));
});

test("semantic no-trade validation accepts equivalent threshold wording", () => {
  const markdown = completeReport(["NVDA"]).replace(
    "No actionable opportunity clears the threshold.",
    "No setup met the action threshold today; NVDA remains the best near-miss but lacks a verified catalyst.",
  );
  assert.deepEqual(validateReportCompleteness(markdown, ["NVDA"]), { ok: true, errors: [] });
});

test("candidate research runs in bounded batches and feeds the deterministic renderer", async () => {
  const bucket = r2();
  const symbols = ["NVDA", "AMZN", "MSFT", "ANET"];
  const researchPrompts = [];

  const result = await withFetchStub((url, init) => {
    if (url.startsWith("https://query1.finance.yahoo.com")) return responseJson(yahooChart());
    if (url.startsWith("https://data.sec.gov")) return responseJson({ facts: { "us-gaap": {} } });
    if (url.startsWith("https://generativelanguage.googleapis.com")) {
      const request = JSON.parse(init.body);
      const prompt = request.contents[0].parts[0].text;
      if (prompt.startsWith("Research this bounded Growth-Tech candidate batch")) {
        researchPrompts.push(prompt);
        assert.equal(request.generationConfig.maxOutputTokens, 4000);
        return researchFixtureResponse(url, init);
      }
      throw new Error("A free-form final synthesis call is forbidden");
    }
    throw new Error(`Unexpected fetch ${url}`);
  }, () => runScheduledBrief({
    WATCHLIST: symbols.join(","),
    GEMINI_API_KEY: "key",
    RESEARCH_BATCH_SIZE: "2",
    BRIEF_BUCKET: bucket,
  }, new Date("2026-08-05T13:35:00.000Z")), { autoResearch: false });

  assert.equal(researchPrompts.length, 2);
  assert.ok(researchPrompts.every((prompt) => /Analyze only these batch symbols:/.test(prompt)));
  assert.deepEqual(researchPrompts.map((prompt) => JSON.parse(prompt.split("\nCandidates:\n").at(-1)).length), [2, 2]);
  assert.deepEqual(result.report.research, { screened: 0, admitted: 4, researched: 4, incomplete: 0, gateQualified: 0, recommendedActions: 0, rejectedOrWatch: 4 });
  assert.match(bucket.objects.get("reports/2026-08-05.md"), /# Executive Summary/);
  assert.doesNotMatch(bucket.objects.get("reports/2026-08-05.md"), /# Decision Reasoning/);
  const stored = JSON.parse(bucket.objects.get("research/2026-08-05.json"));
  assert.equal(stored.packets.length, 4);
  assert.equal(bucket.objects.get("research/latest.json"), bucket.objects.get("research/2026-08-05.json"));
  assert.match(bucket.objects.get("research-audit/2026-08-05.md"), /gateQualified=0; recommendedActions=0; rejectedOrWatch=4/);
});

test("an exhausted research batch becomes visible incomplete evidence in the separate audit", async () => {
  const bucket = r2();
  let researchCalls = 0;

  const result = await withFetchStub((url, init) => {
    if (url.startsWith("https://query1.finance.yahoo.com")) return responseJson(yahooChart());
    if (url.startsWith("https://data.sec.gov")) return responseJson({ facts: { "us-gaap": {} } });
    if (url.startsWith("https://generativelanguage.googleapis.com")) {
      const prompt = JSON.parse(init.body).contents[0].parts[0].text;
      if (prompt.startsWith("Research this bounded Growth-Tech candidate batch")) {
        researchCalls += 1;
        return responseJson(geminiReport("{}"));
      }
      throw new Error("A free-form final synthesis call is forbidden");
    }
    throw new Error(`Unexpected fetch ${url}`);
  }, () => runScheduledBrief({ WATCHLIST: "NVDA", GEMINI_API_KEY: "key", BRIEF_BUCKET: bucket }, new Date("2026-08-05T13:35:00.000Z")), { autoResearch: false });

  assert.equal(researchCalls, 2);
  assert.equal(result.report.generated, true);
  assert.deepEqual(result.report.research, { screened: 0, admitted: 1, researched: 0, incomplete: 1, gateQualified: 0, recommendedActions: 0, rejectedOrWatch: 1 });
  assert.match(bucket.objects.get("research-audit/2026-08-05.md"), /Status: incomplete/);
  assert.equal(JSON.parse(bucket.objects.get("research/2026-08-05.json")).packets[0].status, "incomplete");
});

test("structured research blocks Buy now without a verified catalyst", () => {
  const normalized = normalizeResearchPacket({
    symbol: "NVDA", gateResult: "pass", todayAction: "Buy now", gateReason: "price move", strategicPosition: "Buy",
  }, { symbol: "NVDA", sourceType: "core", setup: { verifiedCatalyst: false, dislocation: true, extremeTrim: false } });
  assert.equal(normalized.gateResult, "fail");
  assert.equal(normalized.todayAction, "Watch");
  assert.equal(normalized.finalAction, "Watch");
  assert.match(normalized.gateReason, /lacks deterministic catalyst eligibility/);
});

test("verified trade recommendation becomes the packet's single final action", () => {
  const normalized = normalizeResearchPacket({
    symbol: "NVDA", gateResult: "pass", todayAction: "Buy now", gateReason: "verified earnings catalyst", strategicPosition: "Buy",
  }, { symbol: "NVDA", sourceType: "core", setup: { verifiedCatalyst: true, dislocation: true, extremeTrim: false } });

  assert.equal(normalized.gateResult, "pass");
  assert.equal(normalized.finalAction, "Buy now");
  assert.equal(normalized.todayAction, normalized.finalAction);
});

test("renderer uses final action, sector stance, explicit valuation basis, and explicit Dollar change label", () => {
  const compact = {
    schemaVersion: 7,
    engineVersion: "0.5.7",
    buildRevision: "0.5.7-hf4",
    reportMode: "verbose",
    generatedAt: "2026-08-10T23:45:11.044Z",
    session: "after_hours",
    marketContext: {
      futures: { status: "unavailable", reason: "not in fixture" },
      rates: { status: "unavailable", reason: "not in fixture" },
      usd: { status: "available", asOf: "2026-08-10T23:30:38.000Z", items: [{ label: "U.S. Dollar Index", value: 99.8, changePercent: null }] },
      oil: { status: "unavailable", reason: "not in fixture" },
    },
    calendars: null,
    news: {},
    decisionFramework: {
      aiCycle: {},
      sectorScorecard: { GPU: { fundamentals: "Strong", valuation: "Moderate", momentum: "Positive", stance: "Favorable", symbols: ["NVDA"], metrics: {} } },
    },
    opportunityGate: { candidates: [] },
    watchlist: [
      {
        symbol: "NVDA", price: 217.55, changePercent: -2.86, positionIn52WeekRange: 74.58,
        valuation: { selectedMetric: "trailingPE", trailingPE: 33.32, selectedPercentile: 82.1 },
        catalyst: "n/a — no company-specific catalyst in snapshot", risk: "valuation risk",
      },
      {
        symbol: "TSM", price: 418.47, changePercent: -0.37, positionIn52WeekRange: 76.62,
        valuation: null, catalyst: "n/a — no company-specific catalyst in snapshot", risk: "no quantified risk flag",
      },
    ],
  };
  const research = {
    funnel: { admitted: 1, researched: 1, incomplete: 0, gateQualified: 1, recommendedActions: 0, rejectedOrWatch: 1 },
    packets: [{ symbol: "NVDA", status: "complete", modelGateResult: "pass", gateResult: "fail", strategicPosition: "Buy", todayAction: "Watch", finalAction: "Watch", sourceSnapshot: { setup: { verifiedCatalyst: false } } }],
    batches: [],
  };

  const synthesis = synthesisContext(compact, research);
  const report = renderMorningBrief(synthesis, { reportId: "00000000-0000-4000-8000-000000000000", generatedAt: "2026-08-10T23:45:43.501Z" });

  assert.equal(synthesis.watchlist[0].finalAction, "Watch");
  assert.match(report, /\| Sector Stance \|/);
  assert.match(report, /\| GPU \| Strong \| Moderate \| Positive \| Favorable \|/);
  assert.match(report, /U\.S\. Dollar Index 99\.8 \(daily change unavailable\)/);
  assert.match(report, /Trailing P\/E 33\.32; Forward P\/E unavailable/);
  assert.match(report, /Trailing valuation unavailable; Forward valuation unavailable/);
  assert.match(report, /\| NVDA .*\| Watch \| Researched \|/);
  assert.doesNotMatch(report, /\| NVDA .*\| Buy(?: now| on weakness)? \| Researched \|/);
});

test("recommendedActions=0 rejects any Buy or Sell leaked into Watchlist Final Action", () => {
  const compact = {
    researchSymbols: ["NVDA"],
    research: { funnel: { recommendedActions: 0 }, packets: [{ symbol: "NVDA" }] },
    watchlist: [{ symbol: "NVDA", finalAction: "Watch" }],
  };
  const leaked = completeReport(["NVDA"]).replace("| Watch | Researched |", "| Buy now | Researched |");
  const errors = validateReportCompleteness(leaked, ["NVDA"], compact).errors.join("; ");

  assert.match(errors, /Final Action changed deterministic gate result: NVDA/);
  assert.match(errors, /recommendedActions=0 forbids Buy\/Sell/);
});

test("a gate-approved Buy now survives exact Final Action validation", () => {
  const compact = {
    researchSymbols: ["NVDA"],
    research: { funnel: { recommendedActions: 1 }, packets: [{ symbol: "NVDA" }] },
    watchlist: [{ symbol: "NVDA", finalAction: "Buy now" }],
  };

  assert.deepEqual(validateReportCompleteness(completeReport(["NVDA"], undefined, "Buy now"), ["NVDA"], compact), { ok: true, errors: [] });
});

test("extreme valuation without holdings becomes a position-size review, not Trim", () => {
  const normalized = normalizeResearchPacket({
    symbol: "ANET", gateResult: "pass", todayAction: "Trim", gateReason: "extreme valuation", strategicPosition: "Hold",
  }, { symbol: "ANET", sourceType: "core", setup: { verifiedCatalyst: false, dislocation: false, extremeTrim: true } });
  assert.equal(normalized.gateResult, "fail");
  assert.equal(normalized.todayAction, "Review position size");
  assert.equal(normalized.finalAction, "Review position size");
  assert.match(normalized.gateReason, /no holdings or target allocation were supplied/);
});

test("research packets reject unsourced support, resistance, target, and stop prices", () => {
  const candidate = { symbol: "CEVA", price: 40, yearLow: 25, yearHigh: 45 };
  const packet = {
    symbol: "CEVA",
    catalystSummary: "Verified earnings event.",
    evidenceFor: [], evidenceAgainst: [], missingEvidence: [],
    mispricingThesis: "Wait for evidence.",
    strategicPosition: "Hold", todayAction: "Watch", confidence: "Medium",
    entryExitCondition: "Wait for support near $30.",
    riskReward: "Not asymmetric.", invalidation: "Reassess on new evidence.",
    sourceQuality: "primary filing", gateResult: "fail", gateReason: "Threshold not cleared.",
  };
  const invalid = validateResearchBatch({ candidates: [packet] }, [candidate]);
  assert.match(invalid.errors.join("; "), /CEVA unsourced price level in entryExitCondition: \$30/);
  packet.entryExitCondition = "Reassess at the supplied 52-week low of $25.";
  assert.deepEqual(validateResearchBatch({ candidates: [packet] }, [candidate]), { ok: true, errors: [] });
});

test("separate research audit deterministically renders negative net debt as net cash", () => {
  const audit = renderResearchAudit({
    engineVersion: "0.5.7", buildRevision: "0.5.7-hf4",
    opportunityGate: { researchCapacity: { filled: 1, target: 1 } },
    dataQuality: { discoveryFundamentals: { sourceFailures: 0 } },
    research: {
      funnel: { screened: 1, admitted: 1, researched: 1, incomplete: 0, gateQualified: 0, recommendedActions: 0, rejectedOrWatch: 1 },
      packets: [{
        symbol: "VREX", status: "complete", modelGateResult: "fail", gateResult: "fail", todayAction: "Watch",
        catalystSummary: "No verified catalyst", evidenceAgainst: ["high debt"], missingEvidence: [],
        sourceSnapshot: { fundamentals: { netDebt: -262_300_000 }, valuation: { trailingPS: 1 }, reportedGrowth: { revenueTtmYoY: 3 } },
      }],
    },
  }, { reportId: "00000000-0000-4000-8000-000000000000", generatedAt: "2026-08-10T22:00:00.000Z", contentHash: "abc" });
  assert.match(audit, /\$262\.3M net cash/);
  assert.doesNotMatch(audit, /high debt|significant net debt|debt load/i);
});

test("final validation rejects negative net debt as debt load and portfolio-specific Trim assumptions", () => {
  const compact = {
    researchSymbols: ["ANET"],
    research: { packets: [{
      symbol: "ANET",
      sourceSnapshot: {
        fundamentals: { netDebt: -500_000_000, netDebtStatus: "net_cash" },
        setup: { verifiedCatalyst: false, extremeTrim: true },
      },
    }] },
  };
  const invalid = completeReport(["ANET"], "ANET has a debt load and is likely overweight, so sell a portion.");
  const errors = validateReportCompleteness(invalid, ["ANET"], compact).errors.join("; ");
  assert.match(errors, /negative netDebt misclassified instead of net cash: ANET/);
  assert.match(errors, /portfolio-specific Trim assumption without holdings: ANET/);
});

test("research-provider failures become incomplete packets without exposing the API key", async () => {
  const bucket = r2();
  const env = {
    WATCHLIST: "NVDA",
    GEMINI_API_KEY: "gemini-secret-key",
    BRIEF_BUCKET: bucket,
  };

  const result = await withFetchStub((url) => {
    if (url.startsWith("https://query1.finance.yahoo.com")) return responseJson(yahooChart());
    if (url.startsWith("https://data.sec.gov")) return responseJson({ facts: { "us-gaap": {} } });
    if (url.startsWith("https://generativelanguage.googleapis.com")) {
      return responseJson({ error: { message: "models/gemini-old is unavailable for gemini-secret-key" } }, 404);
    }
    throw new Error(`Unexpected fetch ${url}`);
  }, () => runScheduledBrief(env, new Date("2026-08-05T13:35:00.000Z")), { autoResearch: false });

  assert.equal(result.report.generated, true);
  assert.equal(result.report.research.incomplete, 1);
  const audit = bucket.objects.get("research-audit/2026-08-05.md");
  assert.match(audit, /Status: incomplete/);
  assert.doesNotMatch(audit, /gemini-secret-key/);
  assert.equal(result.report.aiProvider, "gemini");
  assert.equal(result.report.aiModel, "gemini-3.5-flash");
  assert.equal(result.report.reportMode, "standard");
  assert.equal(result.report.reportEngineVersion, "0.5.7");
  assert.equal(result.report.generation.validation, "passed");
  assert.equal(result.report.storage.stored, true);
});

test("successful Gemini generation stores the report and delivers Discord", async () => {
  const bucket = r2();
  const env = {
    WATCHLIST: "NVDA",
    GEMINI_API_KEY: "gemini-test-key",
    DISCORD_WEBHOOK_URL: "https://discord.com/api/webhooks/123/token",
    BRIEF_BUCKET: bucket,
  };

  const discordFiles = [];
  const result = await withFetchStub(async (url, init) => {
    if (url.startsWith("https://query1.finance.yahoo.com")) return responseJson(yahooChart());
    if (url.startsWith("https://data.sec.gov")) return responseJson({ facts: { "us-gaap": {} } });
    assert.equal(url, env.DISCORD_WEBHOOK_URL);
    const { payload, file } = discordForm(init);
    assert.match(payload.content, /ID: `/);
    discordFiles.push(await file.text());
    return new Response(null, { status: 204 });
  }, () => runScheduledBrief(env, new Date("2026-08-05T13:35:00.000Z")));

  assert.equal(result.report.generated, true);
  assert.equal(result.report.geminiModel, "gemini-3.5-flash");
  const markdown = bucket.objects.get("reports/2026-08-05.md");
  assert.deepEqual(discordFiles, [markdown]);
  assert.equal(result.report.webhook.sent, true);
  assert.equal(result.report.webhook.provider, "discord");
  assert.equal(result.report.webhook.messages, 1);
  assert.equal(result.report.contentHash, result.report.storage.contentHash);
  assert.equal(result.report.contentHash, result.report.webhook.fingerprint);
  assert.deepEqual(result.report.webhook.chunks, { expected: 1, delivered: 1, failed: 0 });
});

test("Gemini research joins multiple non-thought JSON parts and excludes thought parts", async () => {
  const bucket = r2();

  const result = await withFetchStub(async (url, init) => {
    if (url.startsWith("https://query1.finance.yahoo.com")) return responseJson(yahooChart());
    if (url.startsWith("https://data.sec.gov")) return responseJson({ facts: { "us-gaap": {} } });
    if (url.startsWith("https://generativelanguage.googleapis.com")) {
      const fixture = await researchFixtureResponse(url, init).json();
      const content = fixture.candidates[0].content.parts[0].text;
      const splitAt = Math.floor(content.length / 2);
      return responseJson(geminiReport("", "STOP", {}, [
        { text: "internal thinking summary", thought: true },
        { text: content.slice(0, splitAt) },
        { text: content.slice(splitAt) },
      ]));
    }
    throw new Error(`Unexpected fetch ${url}`);
  }, () => runScheduledBrief({ WATCHLIST: "NVDA", GEMINI_API_KEY: "key", BRIEF_BUCKET: bucket }, new Date("2026-08-05T13:35:00.000Z")), { autoResearch: false });

  assert.equal(result.report.generated, true);
  assert.doesNotMatch(bucket.objects.get("reports/2026-08-05.md"), /internal thinking/);
});

test("MAX_TOKENS in candidate research triggers exactly one bounded retry", async () => {
  const bucket = r2();
  let geminiCalls = 0;

  const result = await withFetchStub((url, init) => {
    if (url.startsWith("https://query1.finance.yahoo.com")) return responseJson(yahooChart());
    if (url.startsWith("https://data.sec.gov")) return responseJson({ facts: { "us-gaap": {} } });
    if (url.startsWith("https://generativelanguage.googleapis.com")) {
      geminiCalls += 1;
      const request = JSON.parse(init.body);
      if (geminiCalls === 1) return responseJson(geminiReport("truncated", "MAX_TOKENS"));
      assert.match(request.contents[0].parts[0].text, /Repair the previous failure exactly/);
      return researchFixtureResponse(url, init);
    }
    throw new Error(`Unexpected fetch ${url}`);
  }, () => runScheduledBrief({ WATCHLIST: "NVDA", GEMINI_API_KEY: "key", BRIEF_BUCKET: bucket }, new Date("2026-08-05T13:35:00.000Z")), { autoResearch: false });

  assert.equal(geminiCalls, 2);
  assert.equal(result.report.generated, true);
  assert.equal(JSON.parse(bucket.objects.get("research/2026-08-05.json")).batches[0].attempts, 2);
  assert.equal(bucket.putOptions.get("reports/latest.md").customMetadata.generationAttempts, "0");
});

test("a second truncated research response becomes incomplete while the conservative report is stored", async () => {
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
  }, () => runScheduledBrief({ WATCHLIST: "NVDA", GEMINI_API_KEY: "key", BRIEF_BUCKET: bucket }, new Date("2026-08-05T13:35:00.000Z")), { autoResearch: false });

  assert.equal(geminiCalls, 2);
  assert.equal(result.report.research.incomplete, 1);
  assert.equal(bucket.objects.has("reports/2026-08-05.md"), true);
  assert.match(bucket.objects.get("research-audit/2026-08-05.md"), /Status: incomplete/);
});

test("free-form research output cannot replace deterministic report sections", async () => {
  const bucket = r2();
  const result = await withFetchStub((url) => {
    if (url.startsWith("https://query1.finance.yahoo.com")) return responseJson(yahooChart());
    if (url.startsWith("https://data.sec.gov")) return responseJson({ facts: { "us-gaap": {} } });
    if (url.startsWith("https://generativelanguage.googleapis.com")) return responseJson(geminiReport("NVDA has a short note."));
    throw new Error(`Unexpected fetch ${url}`);
  }, () => runScheduledBrief({ WATCHLIST: "NVDA", GEMINI_API_KEY: "key", BRIEF_BUCKET: bucket }, new Date("2026-08-05T13:35:00.000Z")));

  assert.equal(result.report.generated, true);
  assert.match(bucket.objects.get("reports/2026-08-05.md"), /# Executive Summary/);
  assert.doesNotMatch(bucket.objects.get("reports/2026-08-05.md"), /# Today's Verdict/);
});

test("deterministic Watchlist cannot omit a covered core symbol", async () => {
  const bucket = r2();

  const result = await withFetchStub((url) => {
    if (url.startsWith("https://query1.finance.yahoo.com")) return responseJson(yahooChart(url.includes("AMZN") ? "AMZN" : "NVDA"));
    if (url.startsWith("https://data.sec.gov")) return responseJson({ facts: { "us-gaap": {} } });
    throw new Error(`Unexpected fetch ${url}`);
  }, () => runScheduledBrief({ WATCHLIST: "NVDA,AMZN", GEMINI_API_KEY: "key", BRIEF_BUCKET: bucket }, new Date("2026-08-05T13:35:00.000Z")));

  assert.equal(result.report.generated, true);
  const report = bucket.objects.get("reports/2026-08-05.md");
  assert.match(report, /\| NVDA \|/);
  assert.match(report, /\| AMZN \|/);
});

test("incomplete research is disclosed and cannot block the deterministic report", async () => {
  const bucket = r2();
  const result = await withFetchStub((url) => {
    if (url.startsWith("https://query1.finance.yahoo.com")) return responseJson(yahooChart());
    if (url.startsWith("https://data.sec.gov")) return responseJson({ facts: { "us-gaap": {} } });
    if (url.startsWith("https://generativelanguage.googleapis.com")) return responseJson(geminiReport("## Executive Summary\nNVDA starts but"));
    if (url.startsWith("https://discord.com")) return new Response(null, { status: 204 });
    throw new Error(`Unexpected fetch ${url}`);
  }, () => runScheduledBrief({
    WATCHLIST: "NVDA",
    GEMINI_API_KEY: "key",
    DISCORD_WEBHOOK_URL: "https://discord.com/api/webhooks/123/token",
    BRIEF_BUCKET: bucket,
  }, new Date("2026-08-05T13:35:00.000Z")), { autoResearch: false });

  assert.equal(result.report.research.incomplete, 1);
  assert.equal(bucket.objects.has("reports/2026-08-05.md"), true);
  assert.match(bucket.objects.get("research-audit/2026-08-05.md"), /Status: incomplete/);
});

test("forceRegenerate replaces an existing incomplete report after validation succeeds", async () => {
  const reportDate = currentNewYorkDate();
  const bucket = r2({ [`reports/${reportDate}.md`]: "old incomplete", "reports/latest.md": "old incomplete" });
  const env = {
    RUN_TOKEN_REQUIRED: "true",
    RUN_TOKEN: "secret",
    WATCHLIST: "NVDA",
    GEMINI_API_KEY: "key",
    DISCORD_WEBHOOK_URL: "https://discord.com/api/webhooks/123/token",
    BRIEF_BUCKET: bucket,
  };

  const discordFiles = [];
  const response = await withFetchStub(async (url, init) => {
    if (url.startsWith("https://query1.finance.yahoo.com")) return responseJson(yahooChart());
    if (url.startsWith("https://data.sec.gov")) return responseJson({ facts: { "us-gaap": {} } });
    assert.equal(url, env.DISCORD_WEBHOOK_URL);
    const { file } = discordForm(init);
    discordFiles.push(await file.text());
    return new Response(null, { status: 204 });
  }, () => worker.fetch(new Request("https://example.test/run-report", {
    method: "POST",
    headers: { authorization: "Bearer secret", "content-type": "application/json" },
    body: JSON.stringify({ forceRegenerate: true, forceDelivery: true }),
  }), env));

  assert.equal(response.status, 200);
  assert.match(discordFiles.join("\n"), /# Executive Summary/);
  const body = await response.json();
  assert.equal(body.report.replaced, true);
  assert.match(bucket.objects.get(`reports/${reportDate}.md`), /\*\*Report ID:\*\*/);
  assert.equal(bucket.objects.get("reports/latest.md"), bucket.objects.get(`reports/${reportDate}.md`));
  assert.equal(JSON.parse(bucket.objects.get(`deliveries/${reportDate}.json`)).discord.sent, true);
});

test("failed report storage preserves the previous stored report", async () => {
  const bucket = r2({ "reports/2026-08-05.md": "previous report", "reports/latest.md": "previous report" });
  const originalPut = bucket.put;
  bucket.put = async (key, value, options) => {
    if (key.startsWith("reports/")) throw new Error("simulated report storage failure");
    return originalPut(key, value, options);
  };
  const response = await withFetchStub((url) => {
    if (url.startsWith("https://query1.finance.yahoo.com")) return responseJson(yahooChart());
    if (url.startsWith("https://data.sec.gov")) return responseJson({ facts: { "us-gaap": {} } });
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
  assert.match(body.report.error, /simulated report storage failure/);
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
    engineVersion: "0.5.7",
    buildRevision: "0.5.7-hf4",
    generated: false,
    stored: true,
    storage: null,
    email: null,
    webhook: { skipped: true, reason: "webhook_not_configured" },
    reused: true,
    reportMode: "unknown",
    reportEngineVersion: "unknown",
    reportBuildRevision: "unknown",
    reportId: "unknown",
    contentHash: "unknown",
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

test("Discord webhooks receive a concise verdict plus the complete Markdown attachment", async () => {
  const longMarkdown = `# Report\n\n${"AI-cycle signal. ".repeat(150)}`;
  const env = { DISCORD_WEBHOOK_URL: "https://discord.com/api/webhooks/123/token" };

  const result = await withFetchStub(async (url, init) => {
    assert.equal(url, env.DISCORD_WEBHOOK_URL);
    const { payload, file } = discordForm(init);
    assert.equal(payload.username, "Stock Analyst Bot");
    assert.equal(payload.avatar_url, "https://i.imgur.com/4M34hi2.png");
    assert.match(payload.content, /Full verbose report attached/);
    assert.ok(payload.content.length <= 1800);
    assert.equal(file.name, "growth-tech-morning-brief-2026-08-05.md");
    assert.equal(await file.text(), longMarkdown);
    return new Response(null, { status: 204 });
  }, () => sendReportWebhook(env, "2026-08-05", longMarkdown));

  assert.equal(result.sent, true);
  assert.equal(result.provider, "discord");
  assert.equal(result.messages, 1);
  assert.equal(result.attachment, "growth-tech-morning-brief-2026-08-05.md");
  assert.match(result.fingerprint, /^[a-f0-9]{64}$/);
});

test("Discord webhook delivery also supports Discord URLs in WEBHOOK_URL", async () => {
  const env = { WEBHOOK_URL: "https://discordapp.com/api/webhooks/123/token" };
  const result = await withFetchStub(async (url, init) => {
    assert.equal(url, env.WEBHOOK_URL);
    const { payload, file } = discordForm(init);
    assert.match(payload.content, /Full verbose report attached/);
    assert.equal(await file.text(), "Discord fallback");
    return new Response(null, { status: 204 });
  }, () => sendReportWebhook(env, "2026-08-05", "Discord fallback"));

  assert.equal(result.sent, true);
  assert.equal(result.provider, "discord");
  assert.equal(result.messages, 1);
  assert.deepEqual(result.chunks, { expected: 1, delivered: 1, failed: 0 });
});

test("complete Discord reports use one attachment rather than many chunks", async () => {
  const markdown = `${completeReport(["NVDA"], "Chunked delivery remains complete.")}\n\n${"Additional context line for chunking.\n".repeat(120)}`;
  const env = { DISCORD_WEBHOOK_URL: "https://discord.com/api/webhooks/123/token" };
  const files = [];

  const result = await withFetchStub(async (url, init) => {
    assert.equal(url, env.DISCORD_WEBHOOK_URL);
    const { payload, file } = discordForm(init);
    files.push(await file.text());
    assert.ok(payload.content.length < 2000);
    return new Response(null, { status: 204 });
  }, () => sendReportWebhook(env, "2026-08-05", markdown));

  assert.equal(result.sent, true);
  assert.equal(result.messages, 1);
  assert.deepEqual(files, [markdown]);
  assert.deepEqual(result.chunks, { expected: 1, delivered: 1, failed: 0 });
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

  assert.equal(calls, 2);
  assert.deepEqual(result.chunks, { expected: result.messages, delivered: result.messages, failed: 0 });
});

test("Discord transient server failures receive bounded retries", async () => {
  const env = { DISCORD_WEBHOOK_URL: "https://discord.com/api/webhooks/123/token" };
  let calls = 0;
  const result = await withFetchStub((url) => {
    assert.equal(url, env.DISCORD_WEBHOOK_URL);
    calls += 1;
    if (calls < 3) return new Response("temporary", { status: 502, headers: { "retry-after": "0" } });
    return new Response(null, { status: 204 });
  }, () => sendReportWebhook(env, "2026-08-05", completeReport(["NVDA"])));

  assert.equal(calls, 3);
  assert.equal(result.sent, true);
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

  const response = await withFetchStub(async (url, init) => {
    assert.equal(url, env.DISCORD_WEBHOOK_URL);
    const { payload, file } = discordForm(init);
    assert.match(payload.content, /Full verbose report attached/);
    assert.equal(await file.text(), "# Stored report");
    return new Response(null, { status: 204 });
  }, () => worker.fetch(new Request("https://example.test/deliver-latest", {
    method: "POST",
    headers: { authorization: "Bearer secret" },
  }), env));

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.date, "2026-08-05");
  assert.equal(body.webhook.sent, true);
  assert.equal(body.webhook.provider, "discord");
  assert.equal(body.webhook.messages, 1);
  assert.deepEqual(body.webhook.chunks, { expected: 1, delivered: 1, failed: 0 });
  assert.match(env.BRIEF_BUCKET.objects.get("deliveries/2026-08-05.json"), /"sent": true/);
});

test("existing report with no delivery receipt retries Discord on scheduled run", async () => {
  const bucket = r2({ "reports/2026-08-05.md": "stored report" });
  const env = { WATCHLIST: "NVDA", DISCORD_WEBHOOK_URL: "https://discord.com/api/webhooks/123/token", BRIEF_BUCKET: bucket };

  const result = await withFetchStub(async (url, init) => {
    if (url.startsWith("https://query1.finance.yahoo.com")) return responseJson(yahooChart());
    if (url.startsWith("https://data.sec.gov")) return responseJson({ facts: { "us-gaap": {} } });
    assert.equal(url, env.DISCORD_WEBHOOK_URL);
    const { file } = discordForm(init);
    assert.match(await file.text(), /stored report/);
    return new Response(null, { status: 204 });
  }, () => runScheduledBrief(env, new Date("2026-08-05T13:35:00.000Z")));

  assert.equal(result.report.reused, true);
  assert.equal(result.report.webhook.sent, true);
  assert.equal(result.report.webhook.messages, 1);
  assert.deepEqual(result.report.webhook.chunks, { expected: 1, delivered: 1, failed: 0 });
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
  const reportDate = currentNewYorkDate();
  const bucket = r2({ [`reports/${reportDate}.md`]: "stored report" });
  const env = {
    RUN_TOKEN_REQUIRED: "true",
    RUN_TOKEN: "secret",
    WATCHLIST: "NVDA",
    GEMINI_API_KEY: "gemini-test-key",
    DISCORD_WEBHOOK_URL: "https://discord.com/api/webhooks/123/token",
    BRIEF_BUCKET: bucket,
  };

  const response = await withFetchStub(async (url, init) => {
    if (url.startsWith("https://query1.finance.yahoo.com")) return responseJson(yahooChart());
    if (url.startsWith("https://data.sec.gov")) return responseJson({ facts: { "us-gaap": {} } });
    if (url.startsWith("https://generativelanguage.googleapis.com")) throw new Error("Gemini should not be called");
    assert.equal(url, env.DISCORD_WEBHOOK_URL);
    const { file } = discordForm(init);
    assert.match(await file.text(), /stored report/);
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
  assert.equal(body.report.webhook.sent, true);
  assert.equal(body.report.webhook.messages, 1);
  assert.deepEqual(body.report.webhook.chunks, { expected: 1, delivered: 1, failed: 0 });
  assert.equal(bucket.objects.get(`reports/${reportDate}.md`), "stored report");
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
  assert.match(body.webhook.error, /Discord report attachment delivery failed \(404\): invalid webhook/);
  assert.doesNotMatch(JSON.stringify(body), /secret-token/);
});


test("compact report payload excludes raw history while retaining the core watchlist", () => {
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

  assert.equal(compact.watchlist.length, 1);
  assert.equal("history" in compact.watchlist[0], false);
  assert.equal(compact.opportunityGate.candidates[0].symbol, "NVDA");
  assert.equal(compact.opportunityGate.candidates[0].setup.dislocation, true);
});
