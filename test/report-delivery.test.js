import test from "node:test";
import assert from "node:assert/strict";
import worker, { applyThesisMemory, buildTargetAndMispricing, compactSnapshotForReport, earningsLifecycle, normalizeResearchPacket, renderMorningBrief, renderResearchAudit, runScheduledBrief, selectResearchCandidates, sendReportEmail, sendReportWebhook, synthesisContext, validateReportCompleteness, validateResearchBatch, validateResearchConsistency } from "../src/index.js";

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
    "**Engine Version:** 0.5.11.1",
    "**Build Revision:** 0.5.11.1-hf1",
    "**Report ID:** 00000000-0000-4000-8000-000000000000",
    "**Generated At:** 2026-08-05T13:35:00.000Z",
    "",
    "# Executive Summary",
    "- **AI Cycle and Sector Implications:** Insufficient Data; price action cannot establish the cycle. Sector stances are neutral.",
    "- **Market Context:** No current market-context observations available.",
    `- **Key Scheduled Event:** ${detail}`,
    `- **Highest-Ranked Recommendation:** No gate-qualified recommendation; ${symbolText} remains a researched near-miss.`,
    "- **Primary Valuation Risk:** No significant valuation-risk signal identified among researched names.",
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
    "| Symbol | Price | Daily Change | 52-Week Position | Valuation | Trailing 5Y Percentile | Implied Value (Bear/Base/Bull) | Base Upside / Bear-Case Return | Valuation Threshold | Suggested Buy Target / Buy Zone | Valuation Signal | Catalyst | Risk | Final Action | Action Change / Reason | Rerating Path | Recommendation Gate Result | Research Status |",
    "|---|---:|---:|---:|---|---|---|---|---|---|---|---|---|---|---|---|---|",
    ...symbols.map((symbol) => `| ${symbol} | $110 | +10% | 50% | Unavailable | Unavailable | Target unavailable | unavailable | unavailable | unavailable | Unavailable; consensus unavailable | No verified catalyst | Evidence gap | ${watchlistAction} | Unavailable — no comparable action memory | Unavailable | Rejected — evidence gate incomplete | Researched |`),
  ].join("\n");
}

function verboseNoTradeReport(symbols = ["NVDA"]) {
  return completeReport(symbols).replace("**Report Mode:** standard", "**Report Mode:** verbose");
}

test("verbose Morning Brief keeps research audit out of the five-section product", () => {
  const compact = {
    reportMode: "verbose",
    engineVersion: "0.5.11.1",
    opportunityGate: { maximumOpportunities: 8, candidates: [{ symbol: "NVDA", setup: { verifiedCatalyst: false } }] },
    buildRevision: "0.5.11.1-hf1",
    research: { funnel: { screened: 0, admitted: 1, researched: 1, incomplete: 0, gateQualified: 0, recommendedActions: 0, rejectedOrWatch: 1 }, packets: [{ symbol: "NVDA" }] },
  };
  const valid = validateReportCompleteness(verboseNoTradeReport(), ["NVDA"], compact);
  assert.deepEqual(valid, { ok: true, errors: [] });

  const embeddedAudit = `${verboseNoTradeReport()}\n\n## Research Audit\nlegacy audit`;
  assert.match(validateReportCompleteness(embeddedAudit, ["NVDA"], compact).errors.join("; "), /Research Audit must be stored separately/);
});

test("Morning Brief and Research Audit headings use the New York report date", () => {
  const generatedAt = "2026-08-20T00:00:03.256Z";
  const compact = {
    reportMode: "verbose",
    engineVersion: "0.5.11.1",
    buildRevision: "0.5.11.1-hf1",
    generatedAt,
    marketContext: {},
    decisionFramework: { aiCycle: {}, sectorScorecard: {} },
    opportunityGate: { researchCapacity: { filled: 0, target: 0 } },
    discovery: { scanned: 0 },
    dataQuality: {},
    research: { packets: [], batches: [], funnel: {} },
    watchlist: [],
  };
  assert.match(renderMorningBrief(compact, { generatedAt }), /^# Growth Tech Morning Brief — 2026-08-19/m);
  assert.match(renderResearchAudit(compact, { generatedAt }), /^# Growth Tech Research Audit — 2026-08-19/m);
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
    engineVersion: "0.5.11.1",
    buildRevision: "0.5.11.1-hf1",
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

test("auto-watchlist retains the previous research queue across near-identical snapshots", () => {
  const rows = [
    { symbol: "ANET", changePercent: -3.4, positionIn52WeekRange: 75 },
    { symbol: "CRWV", changePercent: -3.6, positionIn52WeekRange: 36 },
  ].map((row) => ({
    ...row, price: 100, valuation: { trailingPE: 20 }, reportedGrowth: { revenueTtmYoY: 10 },
    targetAndMispricing: { valuationAdjustment: 0 }, setup: { eligible: false, score: 0, reasons: [] }, missing: false,
  }));
  const selected = selectResearchCandidates(rows, [], { events: [] }, 1, ["ANET"]);
  assert.equal(selected[0].symbol, "ANET");
  const displaced = selectResearchCandidates(rows, [], { events: [{ symbol: "CRWV", delta: "new" }] }, 1, ["ANET"]);
  assert.equal(displaced[0].symbol, "CRWV");
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
    schemaVersion: 9,
    engineVersion: "0.5.11.1",
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
  const content = JSON.stringify({ candidates: candidates.map((candidate) => researchFixturePacket(candidate)) });
  if (url.includes("generativelanguage.googleapis.com")) return responseJson(geminiReport(content));
  return responseJson({ choices: [{ finish_reason: "stop", message: { content } }] });
}

function researchFixturePacket(candidate, overrides = {}) {
  return {
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
    reratingPath: "No qualified rerating path in the supplied fixture.",
    reratingHorizon: "Unavailable",
    missingEvidence: ["forward estimates"],
    sourceQuality: "mixed",
    gateResult: "fail",
    gateReason: "The absolute action threshold was not cleared.",
    ...overrides,
  };
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
      const generatedAt = body.text.match(/\*\*Generated At:\*\* ([^\n]+)/)?.[1];
      assert.ok(generatedAt);
      const reportDate = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
      }).format(new Date(generatedAt));
      assert.match(body.html, new RegExp(`<h1>Growth Tech Morning Brief — ${reportDate}<\\/h1>`));
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
  assert.match(stored, /\*\*Build Revision:\*\* 0\.5\.11/);
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
  assert.equal(body.report.reportEngineVersion, "0.5.11.1");
  assert.equal(body.report.reportBuildRevision, "0.5.11.1-hf1");
  assert.equal(bucket.putOptions.get("reports/latest.md").customMetadata.reportMode, "verbose");
  assert.equal(bucket.putOptions.get("reports/latest.md").customMetadata.engineVersion, "0.5.11.1");
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

test("strict schema rejects an Executive Summary without the required cycle-and-sector bullet", () => {
  const markdown = completeReport(["NVDA"]).replace("- **AI Cycle and Sector Implications:** Insufficient Data; price action cannot establish the cycle. Sector stances are neutral.\n", "");
  const validation = validateReportCompleteness(markdown, ["NVDA"]);
  assert.equal(validation.ok, false);
  assert.match(validation.errors.join("; "), /missing Executive Summary field: AI Cycle and Sector Implications/);
});

test("strict schema requires the neutral Primary Valuation Risk label", () => {
  const legacy = completeReport().replace(
    "- **Primary Valuation Risk:** No significant valuation-risk signal identified among researched names.",
    "- **Areas to Avoid:** No evidence-backed sector avoid call today.",
  );

  assert.match(validateReportCompleteness(legacy, ["NVDA"]).errors.join("; "), /missing Executive Summary field: Primary Valuation Risk/);
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

test("mixed-validity research retries only failed tickers and preserves valid peers", async () => {
  const bucket = r2();
  const researchPrompts = [];

  await withFetchStub((url, init) => {
    if (url.startsWith("https://query1.finance.yahoo.com")) return responseJson(yahooChart());
    if (url.startsWith("https://data.sec.gov")) return responseJson({ facts: { "us-gaap": {} } });
    if (url.startsWith("https://generativelanguage.googleapis.com")) {
      const prompt = JSON.parse(init.body).contents[0].parts[0].text;
      if (!prompt.startsWith("Research this bounded Growth-Tech candidate batch")) throw new Error("A free-form final synthesis call is forbidden");
      const candidates = JSON.parse(prompt.split("\nCandidates:\n").at(-1));
      researchPrompts.push(prompt);
      const packets = candidates.map((candidate) => researchFixturePacket(candidate,
        ["ORCL", "MSFT"].includes(candidate.symbol) ? { invalidation: "Invalid below $5.83." } : {}));
      return responseJson(geminiReport(JSON.stringify({ candidates: packets })));
    }
    throw new Error(`Unexpected fetch ${url}`);
  }, () => runScheduledBrief({
    WATCHLIST: "ORCL,MSFT,GOOGL",
    GEMINI_API_KEY: "key",
    RESEARCH_BATCH_SIZE: "3",
    BRIEF_BUCKET: bucket,
  }, new Date("2026-08-20T13:35:00.000Z")), { autoResearch: false });

  assert.equal(researchPrompts.length, 2);
  assert.deepEqual(researchPrompts.map((prompt) => JSON.parse(prompt.split("\nCandidates:\n").at(-1)).map((row) => row.symbol)), [
    ["ORCL", "MSFT", "GOOGL"],
    ["ORCL", "MSFT"],
  ]);
  const stored = JSON.parse(bucket.objects.get("research/2026-08-20.json"));
  assert.equal(stored.batches[0].status, "partial");
  assert.equal(stored.packets.find((packet) => packet.symbol === "GOOGL").status, "complete");
  for (const symbol of ["ORCL", "MSFT"]) {
    const packet = stored.packets.find((row) => row.symbol === symbol);
    assert.equal(packet.status, "incomplete");
    assert.equal((packet.gateReason.match(/unsourced price level/g) ?? []).length, 1);
    assert.doesNotMatch(packet.gateReason, new RegExp(symbol === "ORCL" ? "MSFT" : "ORCL"));
  }
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
  assert.match(normalized.gateReason, /catalyst unavailable; qualified rerating path unavailable/);
});

test("verified trade recommendation becomes the packet's single final action", () => {
  const normalized = normalizeResearchPacket({
    symbol: "NVDA", gateResult: "pass", todayAction: "Buy now", gateReason: "verified earnings catalyst", strategicPosition: "Buy", reratingPath: "Unavailable", reratingHorizon: "Unavailable",
  }, {
    symbol: "NVDA", sourceType: "core", valuation: { trailingPE: 20 }, reportedGrowth: { revenueTtmYoY: 20 },
    targetAndMispricing: { status: "available", confidence: "Medium", baseUpsidePercent: 30 },
    setup: { verifiedCatalyst: true, dislocation: true, extremeTrim: false },
  });

  assert.equal(normalized.gateResult, "pass");
  assert.equal(normalized.finalAction, "Buy now");
  assert.equal(normalized.todayAction, normalized.finalAction);
});

test("qualified 1Q rerating path can support a core value call without same-day news", () => {
  const normalized = normalizeResearchPacket({
    symbol: "VRT", gateResult: "pass", todayAction: "Buy now", gateReason: "underappreciated value", strategicPosition: "Buy",
    reratingPath: "Quarterly product revenue must reaccelerate and management must raise next-quarter guidance.", reratingHorizon: "1Q",
  }, {
    symbol: "VRT", sourceType: "core", valuation: { trailingPE: 20 }, reportedGrowth: { revenueTtmYoY: 25 },
    targetAndMispricing: { status: "available", confidence: "Medium", baseUpsidePercent: 32 },
    setup: { verifiedCatalyst: false, dislocation: false, extremeTrim: false },
  });
  assert.equal(normalized.gateResult, "pass");
  assert.equal(normalized.finalAction, "Buy now");
  assert.equal(normalized.gateAudit.reratingPathDetail, "Quarterly product revenue must reaccelerate and management must raise next-quarter guidance.");
});

function thesisCandidate(symbol, price, overrides = {}) {
  return {
    symbol,
    sourceType: "core",
    price,
    changePercent: 0,
    positionIn52WeekRange: 55,
    valuation: { trailingPE: 30, selectedPercentile: 25, fundamentalAsOf: "2026-06-30" },
    reportedGrowth: { asOf: "2026-06-30", revenueTtmYoY: 26 },
    fundamentals: { asOf: "2026-06-30", netDebt: -100 },
    targetAndMispricing: {
      status: "available", confidence: "Medium", inputAsOf: "2026-06-30",
      bearValue: 267.54, baseValue: 319.92, bullValue: 368.54, baseUpsidePercent: 24,
      buyZones: { status: "available", suggested: { low: 265.27, high: 266.6 }, stronger: { low: 248.1, high: 249.35 } },
    },
    setup: { catalystState: { status: "unavailable", direction: null, verified: false }, verifiedCatalyst: false },
    risk: "no quantified risk flag in snapshot",
    ...overrides,
  };
}

function thesisPacket(candidate, overrides = {}) {
  return normalizeResearchPacket({
    symbol: candidate.symbol,
    catalystSummary: "No verified company catalyst.",
    evidenceFor: ["Reported revenue growth remains positive."],
    evidenceAgainst: [],
    missingEvidence: [],
    mispricingThesis: "The supplied valuation range indicates upside.",
    strategicPosition: "Buy",
    todayAction: "Buy now",
    confidence: "Medium",
    entryExitCondition: "Use the supplied executable zone.",
    riskReward: "The supplied base case remains favorable.",
    invalidation: "Reassess if quarterly revenue growth decelerates.",
    reratingPath: "Quarterly product revenue must reaccelerate and management must raise next-quarter guidance.",
    reratingHorizon: "1Q",
    sourceQuality: "primary filings",
    gateResult: "pass",
    gateReason: "qualified core value path",
    ...overrides,
  }, candidate);
}

test("VRT model-only Buy to Watch downgrade is blocked when deterministic evidence is unchanged", () => {
  const priorCandidate = thesisCandidate("VRT", 256.96);
  const currentCandidate = thesisCandidate("VRT", 264.68, {
    targetAndMispricing: { ...priorCandidate.targetAndMispricing, baseUpsidePercent: 20.87 },
  });
  const previous = thesisPacket(priorCandidate);
  const current = thesisPacket(currentCandidate, {
    strategicPosition: "Buy", todayAction: "Watch", gateResult: "fail",
    evidenceAgainst: ["No new company event."], missingEvidence: ["fresh guidance"],
  });
  const stabilized = applyThesisMemory({
    generatedAt: "2026-08-20T20:04:31.468Z",
    funnel: { admitted: 1 }, batches: [], packets: [current],
  }, {
    generatedAt: "2026-08-20T13:35:00.000Z", packets: [previous],
  });
  const packet = stabilized.packets[0];
  assert.equal(packet.finalAction, "Buy now");
  assert.equal(packet.gateResult, "pass");
  assert.equal(packet.actionMemory.status, "model_only_change_blocked");
  assert.equal(packet.actionMemory.modelObservation.finalAction, "Watch");
  assert.match(packet.reratingPath, /Quarterly product revenue/);
  assert.equal(stabilized.funnel.recommendedActions, 1);
  const compact = {
    schemaVersion: 9, engineVersion: "0.5.11.1", buildRevision: "0.5.11.1-hf1", reportMode: "verbose",
    generatedAt: "2026-08-20T20:04:31.468Z", session: "after_hours", marketContext: {}, dataQuality: {},
    decisionFramework: { aiCycle: {}, sectorScorecard: { Cooling: { fundamentals: "Strong", valuation: "Low", momentum: "Positive", stance: "Favorable", symbols: ["VRT"] } } },
    opportunityGate: { researchCapacity: { filled: 1, target: 1 } },
    watchlist: [{ ...currentCandidate, catalyst: "Unavailable", risk: currentCandidate.risk }],
  };
  const synthesis = synthesisContext(compact, stabilized);
  const report = renderMorningBrief(synthesis, { reportId: "00000000-0000-4000-8000-000000000099", generatedAt: compact.generatedAt });
  assert.match(report, /Buy now → Buy now; proposed Watch blocked/);
  assert.match(report, /Qualified \(1Q\) — Quarterly product revenue must reaccelerate and management must raise next-quarter guidance/);
  const audit = renderResearchAudit(synthesis, { generatedAt: compact.generatedAt });
  assert.match(audit, /Blocked model observation:.*"finalAction":"Watch"/);
});

test("AMZN model-only Watch to Buy upgrade is blocked without new evidence", () => {
  const candidate = thesisCandidate("AMZN", 278, {
    targetAndMispricing: {
      status: "available", confidence: "Medium", inputAsOf: "2026-06-30",
      bearValue: 364, baseValue: 483, bullValue: 694, baseUpsidePercent: 85,
      buyZones: { status: "available", suggested: { low: 232, high: 240 }, stronger: { low: 218, high: 220 } },
    },
  });
  const previous = thesisPacket(candidate, { strategicPosition: "Hold", todayAction: "Watch", gateResult: "fail" });
  const current = thesisPacket(candidate, { strategicPosition: "Buy", todayAction: "Buy on weakness", gateResult: "pass" });
  const stabilized = applyThesisMemory({ generatedAt: "2026-08-21T13:35:00.000Z", funnel: { admitted: 1 }, batches: [], packets: [current] }, {
    generatedAt: "2026-08-20T13:35:00.000Z", packets: [previous],
  });
  assert.equal(stabilized.packets[0].finalAction, "Watch");
  assert.equal(stabilized.packets[0].gateResult, "fail");
  assert.equal(stabilized.packets[0].modelGateResult, "pass");
  assert.match(stabilized.packets[0].gateReason, /action change blocked/i);
});

test("active qualified thesis survives an intervening latest Watch observation", () => {
  const candidate = thesisCandidate("VRT", 264.68);
  const active = thesisPacket(candidate);
  const latestWatch = thesisPacket(candidate, { strategicPosition: "Hold", todayAction: "Watch", gateResult: "fail" });
  const currentWatch = thesisPacket(candidate, {
    strategicPosition: "Hold", todayAction: "Watch", gateResult: "fail",
    evidenceAgainst: ["No new company event."], missingEvidence: ["fresh guidance"],
  });
  const stabilized = applyThesisMemory({
    generatedAt: "2026-08-21T13:35:00.000Z", funnel: { admitted: 1 }, batches: [], packets: [currentWatch],
  }, {
    generatedAt: "2026-08-21T12:00:00.000Z",
    packets: [latestWatch],
    thesisMemory: { activeQualifiedTheses: { VRT: { generatedAt: "2026-08-20T13:35:00.000Z", packet: active } } },
  });
  assert.equal(stabilized.packets[0].finalAction, "Buy now");
  assert.equal(stabilized.packets[0].gateResult, "pass");
  assert.equal(stabilized.packets[0].actionMemory.status, "model_only_change_blocked");
  assert.equal(stabilized.thesisMemory.activeQualifiedCount, 1);
  assert.equal(stabilized.thesisMemory.activeQualifiedTheses.VRT.packet.finalAction, "Buy now");
});

test("active qualified thesis clears when current deterministic inputs no longer qualify", () => {
  const priorCandidate = thesisCandidate("VRT", 264.68);
  const currentCandidate = thesisCandidate("VRT", 264.68, {
    targetAndMispricing: { ...priorCandidate.targetAndMispricing, baseUpsidePercent: 4 },
  });
  const active = thesisPacket(priorCandidate);
  const current = thesisPacket(currentCandidate, { strategicPosition: "Hold", todayAction: "Watch", gateResult: "fail" });
  const stabilized = applyThesisMemory({ generatedAt: "2026-08-21T13:35:00.000Z", funnel: { admitted: 1 }, batches: [], packets: [current] }, {
    generatedAt: "2026-08-20T13:35:00.000Z", packets: [current],
    thesisMemory: { activeQualifiedTheses: { VRT: { generatedAt: "2026-08-20T13:35:00.000Z", packet: active } } },
  });
  assert.equal(stabilized.packets[0].finalAction, "Watch");
  assert.equal(stabilized.thesisMemory.activeQualifiedCount, 0);
  assert.equal(stabilized.thesisMemory.activeQualifiedTheses.VRT, undefined);
});

test("new filing evidence permits a Watch to Buy thesis change", () => {
  const priorCandidate = thesisCandidate("VRT", 264.68);
  const currentCandidate = thesisCandidate("VRT", 264.68, {
    valuation: { ...priorCandidate.valuation, fundamentalAsOf: "2026-09-30" },
    reportedGrowth: { asOf: "2026-09-30", revenueTtmYoY: 34 },
    fundamentals: { ...priorCandidate.fundamentals, asOf: "2026-09-30" },
    targetAndMispricing: { ...priorCandidate.targetAndMispricing, inputAsOf: "2026-09-30" },
  });
  const previous = thesisPacket(priorCandidate, { strategicPosition: "Hold", todayAction: "Watch", gateResult: "fail" });
  const current = thesisPacket(currentCandidate);
  const stabilized = applyThesisMemory({ generatedAt: "2026-10-30T13:35:00.000Z", funnel: { admitted: 1 }, batches: [], packets: [current] }, {
    generatedAt: "2026-08-20T13:35:00.000Z", packets: [previous],
  });
  assert.equal(stabilized.packets[0].finalAction, "Buy now");
  assert.equal(stabilized.packets[0].actionMemory.status, "evidence_change");
  assert.match(stabilized.packets[0].actionMemory.reason, /fundamental period changed/);
});

test("price crossing the executable zone permits Buy on weakness to become Buy now", () => {
  const priorCandidate = thesisCandidate("VRT", 278);
  const currentCandidate = thesisCandidate("VRT", 264);
  const previous = thesisPacket(priorCandidate, { todayAction: "Buy on weakness" });
  const current = thesisPacket(currentCandidate);
  const stabilized = applyThesisMemory({ generatedAt: "2026-08-21T13:35:00.000Z", funnel: { admitted: 1 }, batches: [], packets: [current] }, {
    generatedAt: "2026-08-20T13:35:00.000Z", packets: [previous],
  });
  assert.equal(stabilized.packets[0].finalAction, "Buy now");
  assert.equal(stabilized.packets[0].actionMemory.status, "price_location_change");
  assert.match(stabilized.packets[0].actionMemory.reason, /entered the suggested buy zone/);
});

test("rerating path cannot bypass discovery catalyst requirements", () => {
  const normalized = normalizeResearchPacket({
    symbol: "LITE", gateResult: "pass", todayAction: "Buy now", gateReason: "rerating", strategicPosition: "Buy",
    reratingPath: "Quarterly product revenue must reaccelerate and management must raise next-quarter guidance.", reratingHorizon: "1Q",
  }, {
    symbol: "LITE", sourceType: "discovery", valuation: { trailingPE: 20 }, reportedGrowth: { revenueTtmYoY: 25 },
    fundamentalCoverage: { status: "available" }, marketCap: 5_000_000_000, dollarVolume: 50_000_000,
    targetAndMispricing: { status: "available", confidence: "High", baseUpsidePercent: 40 },
    setup: { verifiedCatalyst: false, dislocation: true, extremeTrim: false },
  });
  assert.equal(normalized.gateResult, "fail");
  assert.equal(normalized.finalAction, "Watch");
  assert.match(normalized.gateReason, /discovery evidence incomplete/);
});

test("research validation rejects a vague rerating path", () => {
  const packet = {
    symbol: "NVDA", catalystSummary: "No same-day event.", evidenceFor: [], evidenceAgainst: [], missingEvidence: [],
    mispricingThesis: "Potential value.", strategicPosition: "Buy", todayAction: "Buy now", confidence: "Medium",
    entryExitCondition: "Wait for evidence.", riskReward: "Potentially favorable.", invalidation: "Thesis fails without progress.",
    reratingPath: "The stock might rerate higher soon.", reratingHorizon: "1Q", sourceQuality: "mixed", gateResult: "pass", gateReason: "value",
  };
  const validation = validateResearchBatch({ candidates: [packet] }, [{ symbol: "NVDA", price: 100, yearLow: 70, yearHigh: 120 }]);
  assert.match(validation.errors.join("; "), /reratingPath is not testable/);
});

test("research validation rejects generic earnings or contract rerating language", () => {
  for (const reratingPath of [
    "A fresh earnings report could trigger rerating toward base value.",
    "A major contract announcement could trigger a rerating toward the base case value.",
  ]) {
    const packet = {
      symbol: "VRT", catalystSummary: "No same-day event.", evidenceFor: [], evidenceAgainst: [], missingEvidence: [],
      mispricingThesis: "Potential value.", strategicPosition: "Buy", todayAction: "Buy on weakness", confidence: "Medium",
      entryExitCondition: "Use the supplied zone.", riskReward: "Potentially favorable.", invalidation: "Reassess next quarter.",
      reratingPath, reratingHorizon: "1Q", sourceQuality: "mixed", gateResult: "pass", gateReason: "value",
    };
    assert.match(validateResearchBatch({ candidates: [packet] }, [{ symbol: "VRT", price: 100, yearLow: 70, yearHigh: 120 }]).errors.join("; "), /reratingPath is not testable/);
  }
});

test("research validation accepts a measurable operating rerating path", () => {
  const packet = {
    symbol: "VRT", catalystSummary: "No same-day event.", evidenceFor: [], evidenceAgainst: [], missingEvidence: [],
    mispricingThesis: "Potential value.", strategicPosition: "Buy", todayAction: "Buy on weakness", confidence: "Medium",
    entryExitCondition: "Use the supplied zone.", riskReward: "Potentially favorable.", invalidation: "Reassess next quarter.",
    reratingPath: "Quarterly organic revenue growth must accelerate above 20% while operating margin expands.",
    reratingHorizon: "1Q", sourceQuality: "primary filings", gateResult: "pass", gateReason: "value",
  };
  assert.doesNotMatch(validateResearchBatch({ candidates: [packet] }, [{ symbol: "VRT", price: 100, yearLow: 70, yearHigh: 120 }]).errors.join("; "), /reratingPath is not testable/);
});

test("valuation penalty deterministically downgrades Buy now", () => {
  const normalized = normalizeResearchPacket({
    symbol: "NVDA", gateResult: "pass", todayAction: "Buy now", gateReason: "verified catalyst", strategicPosition: "Buy",
    reratingPath: "Unavailable", reratingHorizon: "Unavailable",
  }, {
    symbol: "NVDA", sourceType: "core", valuation: { trailingPE: 20 }, reportedGrowth: { revenueTtmYoY: 25 },
    targetAndMispricing: { status: "available", confidence: "Medium", baseUpsidePercent: 8, valuationAdjustment: -1 },
    setup: { verifiedCatalyst: true, dislocation: true, extremeTrim: false },
  });
  assert.equal(normalized.gateResult, "pass");
  assert.equal(normalized.finalAction, "Buy on weakness");
});

test("neutral 10-20% upside does not change a catalyst-backed Buy now", () => {
  const normalized = normalizeResearchPacket({
    symbol: "NVDA", gateResult: "pass", todayAction: "Buy now", gateReason: "verified catalyst", strategicPosition: "Buy",
    reratingPath: "Unavailable", reratingHorizon: "Unavailable",
  }, {
    symbol: "NVDA", sourceType: "core", valuation: { trailingPE: 20 }, reportedGrowth: { revenueTtmYoY: 25 },
    targetAndMispricing: { status: "available", confidence: "Medium", baseUpsidePercent: 15, valuationAdjustment: 0 },
    setup: { verifiedCatalyst: true, dislocation: true, extremeTrim: false },
  });
  assert.equal(normalized.gateResult, "pass");
  assert.equal(normalized.finalAction, "Buy now");
});

test("executable buy zones deterministically distinguish Buy now from Buy on weakness", () => {
  const packet = {
    symbol: "AMZN", gateResult: "pass", todayAction: "Buy now", gateReason: "model assessment",
    strategicPosition: "Buy", confidence: "High", reratingPath: "Unavailable", reratingHorizon: "Unavailable",
  };
  const baseCandidate = {
    symbol: "AMZN", sourceType: "core", valuation: { trailingPE: 25 }, reportedGrowth: { revenueTtmYoY: 15 },
    setup: { catalystState: { status: "verified_positive", direction: "positive", verified: true, gateQualified: true } },
    targetAndMispricing: {
      status: "available", confidence: "High", baseUpsidePercent: 25,
      buyZones: { status: "available", suggested: { low: 260, high: 265 }, stronger: { low: 245, high: 255 } },
    },
  };
  const aboveZone = normalizeResearchPacket(packet, { ...baseCandidate, price: 271 });
  const insideZone = normalizeResearchPacket(packet, { ...baseCandidate, price: 263 });
  assert.equal(aboveZone.gateResult, "pass");
  assert.equal(aboveZone.finalAction, "Buy on weakness");
  assert.equal(insideZone.gateResult, "pass");
  assert.equal(insideZone.finalAction, "Buy now");
});

test("a Buy action cannot pass while the strategic position remains Hold", () => {
  const normalized = normalizeResearchPacket({
    symbol: "VRT", gateResult: "pass", todayAction: "Buy now", gateReason: "model assessment",
    strategicPosition: "Hold", confidence: "Medium", reratingPath: "Unavailable", reratingHorizon: "Unavailable",
  }, {
    symbol: "VRT", sourceType: "core", price: 261, valuation: { trailingPE: 59 }, reportedGrowth: { revenueTtmYoY: 26 },
    setup: { catalystState: { status: "verified_positive", direction: "positive", verified: true, gateQualified: true } },
    targetAndMispricing: {
      status: "available", confidence: "Medium", baseUpsidePercent: 22,
      buyZones: { status: "available", suggested: { low: 265.27, high: 266.6 }, stronger: { low: 248.1, high: 249.35 } },
    },
  });
  assert.equal(normalized.gateResult, "fail");
  assert.equal(normalized.finalAction, "Watch");
  assert.equal(normalized.gateAudit.strategicPositionAligned, false);
  assert.match(normalized.gateReason, /strategic position is inconsistent/);
});

test("a displayed valuation buy zone is not actionable when the recommendation gate fails", () => {
  const normalized = normalizeResearchPacket({
    symbol: "MSFT", gateResult: "fail", todayAction: "Buy on weakness", gateReason: "model assessment",
    strategicPosition: "Hold", confidence: "Medium", reratingPath: "Unavailable", reratingHorizon: "Unavailable",
  }, {
    symbol: "MSFT", sourceType: "core", price: 498, valuation: { trailingPE: 28 }, reportedGrowth: { revenueTtmYoY: 12 },
    setup: { catalystState: { status: "unavailable", direction: null, verified: false, gateQualified: false } },
    targetAndMispricing: {
      status: "available", confidence: "High", baseUpsidePercent: 25,
      buyZones: { status: "available", suggested: { low: 475, high: 485 }, stronger: { low: 455, high: 465 } },
    },
  });
  assert.equal(normalized.gateResult, "fail");
  assert.equal(normalized.finalAction, "Watch");
  assert.equal(normalized.gateAudit.catalystStatus, "unavailable");
});

test("renderer uses final action, sector stance, explicit valuation basis, and explicit Dollar change label", () => {
  const compact = {
    schemaVersion: 9,
    engineVersion: "0.5.11.1",
    buildRevision: "0.5.11.1-hf1",
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
        targetAndMispricing: {
          status: "available", bearValue: 190, baseValue: 260, bullValue: 310, baseUpsidePercent: 19.51,
          downsideToBearPercent: 12.66, riskRewardRatio: 1.55, preferredEntryPrice: 216.67,
          valuationAdjustment: 0, valuationLabel: "Neutral", confidence: "Medium", method: "trailing-data implied fair-value range",
          formula: "normalized TTM EPS/share × historical trailing P/E P25/P50/P75",
        },
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
  assert.match(report, /\$190 \/ \$260 \/ \$310; trailing-implied/);
  assert.match(report, /Trailing valuation unavailable; Forward valuation unavailable/);
  assert.match(report, /\| NVDA .*\| Watch \| .* \| Unavailable \| Rejected — .* \| Researched \|/);
  assert.doesNotMatch(report, /\| NVDA .*\| Buy(?: now| on weakness)? \| .* \| Researched \|/);
  assert.match(report, /\*\*Primary Valuation Risk:\*\*/);
  assert.match(report, /\*\*AI Cycle and Sector Implications:\*\*/);
  assert.doesNotMatch(report, /^- \*\*Research Exclusions:\*\*/m);
  const tampered = report.replace("$190 / $260 / $310", "$190 / $280 / $310");
  assert.match(validateReportCompleteness(tampered, ["NVDA"], synthesis).errors.join("; "), /changed deterministic target value for NVDA: \$260/);
});

test("renderer explains rejected recommendations and uses signed bear-case and entry-threshold semantics", () => {
  const compact = {
    schemaVersion: 9, engineVersion: "0.5.11.1", buildRevision: "0.5.11.1-hf1", reportMode: "verbose",
    generatedAt: "2026-08-11T21:44:18.325Z", session: "after_hours", marketContext: {}, calendars: null, news: {},
    decisionFramework: { aiCycle: {}, sectorScorecard: {} }, opportunityGate: { candidates: [] },
    watchlist: [{
      symbol: "AMZN", price: 272.27, changePercent: -2.09, positionIn52WeekRange: 86.21,
      valuation: { selectedMetric: "trailingPE", trailingPE: 21.9, selectedPercentile: 20.18 },
      targetAndMispricing: {
        status: "available", currentPrice: 272.27, bearValue: 365.32, baseValue: 503.35, bullValue: 694.06,
        baseUpsidePercent: 84.87, downsideToBearPercent: -34.18, riskRewardRatio: null, preferredEntryPrice: 419.46,
        buyZones: { status: "available", suggested: { low: 260, high: 265 }, stronger: { low: 245, high: 255 }, method: "fixture" },
        valuationAdjustment: 2, valuationLabel: "Opportunity Bonus", confidence: "Medium",
      },
      catalyst: "n/a — no company-specific catalyst in snapshot", risk: "no quantified risk flag in snapshot",
    }],
  };
  const research = {
    funnel: { admitted: 1, researched: 1, incomplete: 0, gateQualified: 0, recommendedActions: 0, rejectedOrWatch: 1 },
    packets: [{
      symbol: "AMZN", status: "complete", modelGateResult: "fail", gateResult: "fail", strategicPosition: "Hold",
      todayAction: "Watch", finalAction: "Watch", confidence: "Medium",
      gateReason: "passes the action gate with Medium confidence because earnings beat expectations", sourceSnapshot: { sourceType: "core", targetAndMispricing: { baseUpsidePercent: 84.87 } },
    }],
    batches: [],
  };
  const synthesis = synthesisContext(compact, research);
  const report = renderMorningBrief(synthesis, { reportId: "00000000-0000-4000-8000-000000000000", generatedAt: compact.generatedAt });

  assert.match(report, /Base Upside \/ Bear-Case Return/);
  assert.match(report, /\+84\.87% \/ \+34\.18%; No modeled downside to Bear value/);
  assert.match(report, /Valuation threshold satisfied \(\$419\.46\); not an executable buy target/);
  assert.match(report, /Valuation-derived suggested \$260–\$265; stronger \$245–\$255; not actionable — recommendation gate rejected/);
  assert.match(report, /Rejected — target confidence Medium; catalyst unavailable; qualified rerating path unavailable; strategic position Hold/);
  assert.match(report, /Highest-Ranked Recommendation:\*\* No recommendation qualified\. Closest setup: AMZN — Medium target confidence, but no verified catalyst or qualified rerating path; strategic position remains Hold\./);
  assert.doesNotMatch(report, /passes the action gate|earnings beat expectations/);
  const changedBearReturn = report.replace("+84.87% / +34.18%", "+84.87% / -34.18%");
  assert.match(validateReportCompleteness(changedBearReturn, ["AMZN"], synthesis).errors.join("; "), /changed deterministic bear-case return: AMZN/);
  const changedGate = report.replace("Rejected — target confidence Medium", "Passed — target confidence Medium");
  assert.match(validateReportCompleteness(changedGate, ["AMZN"], synthesis).errors.join("; "), /changed Recommendation Gate Result: AMZN/);
});

test("earnings lifecycle does not characterize results before verification", () => {
  const event = { symbol: "CRWV", time: "time-after-hours", date: "2026-08-11" };
  const scheduled = earningsLifecycle(event, "2026-08-11T19:00:00.000Z", []);
  const pending = earningsLifecycle(event, "2026-08-11T22:38:00.000Z", []);
  const reported = earningsLifecycle(event, "2026-08-11T22:38:00.000Z", [{
    title: "CoreWeave reports second-quarter results",
    publishedAt: "2026-08-11T22:05:00.000Z",
    source: "Company release",
    url: "https://example.test/crwv-results",
    symbols: ["CRWV"],
    verified: true,
  }]);
  const unsupportedVerified = earningsLifecycle({ ...event, lifecycle: { status: "verified_result", evidence: { sourceUrl: "https://example.test/results" } } }, "2026-08-11T22:38:00.000Z", []);
  const verified = earningsLifecycle({ ...event, lifecycle: { status: "verified_result", evidence: { actual: 1.2, consensus: 1.1, sourceUrl: "https://example.test/results" } } }, "2026-08-11T22:38:00.000Z", []);

  assert.equal(scheduled.status, "scheduled");
  assert.equal(pending.status, "pending_verification");
  assert.equal(reported.status, "reported_pending_verification");
  assert.equal(unsupportedVerified.status, "reported_pending_verification");
  assert.equal(verified.status, "verified_result");
  assert.doesNotMatch(`${pending.label}; ${reported.label}`, /beat|miss|verified result/i);
});

test("valuation scenario prices cannot become recommendation invalidation levels", () => {
  const normalized = normalizeResearchPacket({
    symbol: "VRT", gateResult: "pass", todayAction: "Buy on weakness", gateReason: "passes",
    strategicPosition: "Buy", confidence: "Medium", reratingPath: "Unavailable", reratingHorizon: "Unavailable",
    invalidation: "Thesis invalid below the $266.57 bear value.",
  }, {
    symbol: "VRT", sourceType: "core", price: 281.81,
    setup: { verifiedCatalyst: true }, valuation: { trailingPE: 63.76 }, reportedGrowth: { revenueTtmYoY: 26.23 },
    targetAndMispricing: { status: "available", confidence: "Medium", baseUpsidePercent: 13.52, bearValue: 266.57, preferredEntryPrice: 266.6 },
  });

  assert.equal(normalized.gateResult, "pass");
  assert.equal(normalized.modelInvalidation, "Thesis invalid below the $266.57 bear value.");
  assert.doesNotMatch(normalized.invalidation, /266\.57|bear value/i);
  assert.match(normalized.invalidation, /valuation scenario prices are not stop levels/i);
});

test("renderer excludes expired SEC fundamentals and surfaces their symbols and as-of dates", () => {
  const compact = {
    schemaVersion: 9,
    engineVersion: "0.5.11.1",
    buildRevision: "0.5.11.1-hf1",
    reportMode: "verbose",
    generatedAt: "2026-08-11T05:54:44.315Z",
    session: "closed",
    marketContext: {},
    calendars: null,
    news: {},
    decisionFramework: {
      aiCycle: {},
      sectorScorecard: {
        GPU: {
          fundamentals: "Stale", valuation: "High", momentum: "Mixed", stance: "Neutral", symbols: ["NVDA", "TSM"],
          metrics: {
            medianReportedRevenueTtmYoY: null,
            medianHistoricalValuationPercentile: 82.1,
            freshFundamentals: [],
            staleFundamentals: [
              { symbol: "NVDA", asOf: "2026-05-28" },
              { symbol: "TSM", asOf: "2026-05-20" },
            ],
            unknownFundamentals: [{ symbol: "TSM", asOf: null }],
          },
        },
      },
    },
    opportunityGate: { candidates: [] },
    watchlist: [
      {
        symbol: "NVDA", price: 217.55, changePercent: -2.86, positionIn52WeekRange: 74.58,
        valuation: { selectedMetric: "trailingPE", trailingPE: 33.32, selectedPercentile: 82.1 },
        reportedGrowth: { revenueTtmYoY: 32.29 }, fundamentalCacheStatus: "stale", fundamentalAsOf: "2026-05-28",
        catalyst: "n/a — no company-specific catalyst in snapshot", risk: "expired cache",
      },
      {
        symbol: "TSM", price: 418.47, changePercent: -0.37, positionIn52WeekRange: 76.62,
        valuation: null, reportedGrowth: null, fundamentalCacheStatus: "stale", fundamentalAsOf: "2026-05-20",
        catalyst: "n/a — no company-specific catalyst in snapshot", risk: "expired cache",
      },
    ],
  };
  const research = {
    funnel: { admitted: 1, researched: 1, incomplete: 0, gateQualified: 0, recommendedActions: 0, rejectedOrWatch: 1 },
    packets: [{
      symbol: "NVDA", status: "complete", modelGateResult: "fail", gateResult: "fail", strategicPosition: "Avoid",
      todayAction: "Watch", finalAction: "Watch", sourceSnapshot: { setup: { verifiedCatalyst: false } },
    }],
    batches: [],
  };

  const report = renderMorningBrief(synthesisContext(compact, research), {
    reportId: "00000000-0000-4000-8000-000000000000",
    generatedAt: "2026-08-11T05:55:05.623Z",
  });

  assert.match(report, /\*\*Primary Valuation Risk:\*\* NVDA — historical valuation percentile 82\.1%; 52-week range position 74\.58%; sector exposure: GPU\./);
  assert.doesNotMatch(report, /\*\*Principal Risk:\*\*/);
  assert.match(report, /\| GPU \| Stale \| High \| Mixed \| Neutral \|/);
  assert.match(report, /stale fundamentals excluded NVDA \(as of 2026-05-28\), TSM \(as of 2026-05-20\)/);
  assert.match(report, /TSM fundamentals date unavailable/);
  assert.doesNotMatch(report, /TSM \(as of unavailable\)/);
  assert.doesNotMatch(report, /\| GPU \| Strong \|/);
  const scopeErrors = validateReportCompleteness(report, ["NVDA"], synthesisContext(compact, research)).errors.join("; ");
  assert.doesNotMatch(scopeErrors, /ticker reference outside research universe in Executive Summary/);
});

test("Executive Summary prioritizes core scheduled events, gate-approved recommendations, and researched valuation risk", () => {
  const compact = {
    schemaVersion: 9,
    engineVersion: "0.5.11.1",
    buildRevision: "0.5.11.1-hf1",
    reportMode: "verbose",
    generatedAt: "2026-08-11T13:00:00.000Z",
    session: "premarket",
    marketContext: {
      futures: { status: "available", items: [{ label: "Nasdaq 100", changePercent: -0.45 }] },
      rates: { status: "available", items: [{ label: "U.S. 10Y yield", change: -0.01 }] },
      usd: { status: "available", items: [{ label: "U.S. Dollar Index", changePercent: 0.12 }] },
      oil: { status: "available", items: [{ label: "WTI crude", changePercent: 1.33 }] },
    },
    calendars: {
      earnings: {
        status: "available",
        events: [
          { symbol: "KOPN", time: "time-pre-market", marketCap: "$300,000,000" },
          { symbol: "CRWV", time: "time-after-hours", marketCap: "$50,000,000,000" },
        ],
        watchlistMatches: ["CRWV"],
      },
    },
    news: {},
    decisionFramework: {
      aiCycle: {
        "GPU Demand": { rating: "Positive", trend: "Accelerating", evidence: "two official indicators", limitation: "definitions differ" },
      },
      sectorScorecard: {
        "AI Cloud": { fundamentals: "Strong", valuation: "Low", momentum: "Positive", stance: "Favorable", symbols: ["AMZN"] },
        "GPU Cloud": { fundamentals: "Strong", valuation: "Moderate", momentum: "Negative", stance: "Neutral", symbols: ["CRWV"] },
        Networking: { fundamentals: "Strong", valuation: "High", momentum: "Positive", stance: "Neutral", symbols: ["ANET"] },
      },
    },
    opportunityGate: { candidates: [] },
    discovery: { candidates: [{ symbol: "KOPN" }] },
    watchlist: [
      { symbol: "AMZN", price: 278, changePercent: 1, positionIn52WeekRange: 70, valuation: { selectedMetric: "trailingPE", trailingPE: 22, selectedPercentile: 25 }, targetAndMispricing: { status: "available", confidence: "High", baseUpsidePercent: 30 }, catalyst: "n/a", risk: "execution risk" },
      { symbol: "ANET", price: 191, changePercent: 1.5, positionIn52WeekRange: 98.8, valuation: { selectedMetric: "trailingPE", trailingPE: 60, selectedPercentile: 97.8 }, targetAndMispricing: { status: "available", confidence: "High", baseUpsidePercent: -20 }, catalyst: "n/a", risk: "valuation risk" },
      { symbol: "CRWV", price: 88, changePercent: -2.7, positionIn52WeekRange: 31, valuation: { selectedMetric: "trailingPS", trailingPS: 7, selectedPercentile: 43 }, targetAndMispricing: { status: "unavailable", reason: "insufficient history" }, catalystState: { status: "scheduled", sourceType: "earnings", verified: false, display: "Earnings scheduled today (time-after-hours)" }, catalyst: "Earnings scheduled today", risk: "financing risk" },
    ],
  };
  const research = {
    funnel: { admitted: 4, researched: 4, incomplete: 0, gateQualified: 1, recommendedActions: 1, rejectedOrWatch: 3 },
    packets: [
      { symbol: "KOPN", status: "complete", modelGateResult: "fail", gateResult: "fail", finalAction: "Watch", catalystSummary: "CES product announcement", sourceSnapshot: { sourceType: "discovery", setup: { verifiedCatalyst: true } } },
      { symbol: "CRWV", status: "complete", modelGateResult: "fail", gateResult: "fail", finalAction: "Watch", sourceSnapshot: { sourceType: "core", setup: { catalystState: { status: "scheduled", sourceType: "earnings", verified: false, display: "Earnings scheduled today (time-after-hours)" } } } },
      { symbol: "AMZN", status: "complete", modelGateResult: "pass", gateResult: "pass", confidence: "High", todayAction: "Buy on weakness", finalAction: "Buy on weakness", reratingPath: "Quarterly revenue growth must accelerate while management raises next-quarter guidance.", gateReason: "target confidence High; catalyst unavailable; qualified rerating path 1Q; strategic position Buy; final action Buy on weakness", gateAudit: { result: "pass", researchAssessment: "pass", strategicPosition: "Buy", strategicPositionAligned: true, targetConfidence: "High", freshCatalyst: false, reratingPath: "1Q", reratingPathDetail: "Quarterly revenue growth must accelerate while management raises next-quarter guidance.", finalAction: "Buy on weakness" }, invalidation: "Reassess if the stated 1Q fundamental rerating path does not materialize; valuation scenario prices are not stop levels.", sourceSnapshot: { sourceType: "core", setup: { score: 2 }, targetAndMispricing: { baseUpsidePercent: 30, buyZones: { status: "available", suggested: { low: 260, high: 265 }, stronger: { low: 245, high: 255 } } } } },
      { symbol: "ANET", status: "complete", modelGateResult: "fail", gateResult: "fail", finalAction: "Watch", sourceSnapshot: { sourceType: "core", setup: {} } },
    ],
    batches: [],
  };

  const report = renderMorningBrief(synthesisContext(compact, research), {
    reportId: "00000000-0000-4000-8000-000000000000",
    generatedAt: "2026-08-11T13:01:00.000Z",
  });

  assert.match(report, /\*\*AI Cycle and Sector Implications:\*\* Positive; 1 segment\(s\).*Favorable sector stance: AI Cloud; high valuation: Networking/);
  assert.match(report, /\*\*Market Context:\*\* Nasdaq 100 futures -0\.45%; U\.S\. 10Y yield -1 bps; U\.S\. Dollar Index \+0\.12%; WTI crude \+1\.33%/);
  assert.match(report, /\*\*Key Scheduled Event:\*\* CRWV Earnings scheduled today \(time-after-hours\); relevant scorecard exposure: GPU Cloud\./);
  assert.doesNotMatch(report.split("# Overnight and Market Context")[0], /KOPN|CES product announcement/);
  assert.match(report, /\*\*Highest-Ranked Recommendation:\*\* AMZN — Buy on weakness; suggested \$260–\$265; stronger \$245–\$255; target confidence High; qualified rerating path within 1 quarter; rerating trigger: Quarterly revenue growth must accelerate while management raises next-quarter guidance\./);
  assert.match(report, /\*\*Primary Valuation Risk:\*\* ANET — historical valuation percentile 97\.8%; 52-week range position 98\.8%; sector exposure: Networking\./);

  compact.calendars.earnings.events[1].lifecycle = { status: "pending_verification" };
  compact.watchlist[2].catalystState = { status: "reported_pending_verification", sourceType: "earnings", verified: false, display: "Earnings scheduled window opened; event status pending verification" };
  research.packets[1].sourceSnapshot.setup.catalystState = compact.watchlist[2].catalystState;
  const pendingReport = renderMorningBrief(synthesisContext(compact, research), {
    reportId: "00000000-0000-4000-8000-000000000001", generatedAt: "2026-08-11T22:38:00.000Z",
  });
  assert.match(pendingReport, /\*\*Key Event Status:\*\* CRWV Earnings scheduled window opened; event status pending verification/);
  assert.doesNotMatch(pendingReport, /\*\*Key Scheduled Event:\*\* CRWV/);

  compact.calendars.earnings.events[1].lifecycle = { status: "reported_pending_verification" };
  compact.watchlist[2].catalystState = { status: "reported_pending_verification", sourceType: "earnings", verified: false, display: "Earnings reported; result pending verification" };
  research.packets[1].sourceSnapshot.setup.catalystState = compact.watchlist[2].catalystState;
  const reportedReport = renderMorningBrief(synthesisContext(compact, research), {
    reportId: "00000000-0000-4000-8000-000000000002", generatedAt: "2026-08-11T22:40:00.000Z",
  });
  assert.match(reportedReport, /\*\*Key Reported Event:\*\* CRWV Earnings reported; result pending verification/);
  assert.doesNotMatch(reportedReport, /earnings beat/i);
  assert.doesNotMatch(reportedReport, /verified_positive|reported_pending_verification|after_hours/);
});

test("company analysis remains visible as context but is excluded from Key Reported Event", () => {
  const analysisTitle = "Arista Benefits From AI Networking Surge: Will Momentum Persist?";
  const compact = {
    schemaVersion: 9, engineVersion: "0.5.11.1", buildRevision: "0.5.11.1-hf1", reportMode: "verbose",
    generatedAt: "2026-08-19T23:12:33.774Z", session: "after_hours", marketContext: {}, calendars: null, news: {},
    decisionFramework: { aiCycle: {}, sectorScorecard: {} }, opportunityGate: { candidates: [] },
    researchSymbols: ["ANET"],
    watchlist: [{
      symbol: "ANET", price: 186.45, changePercent: 0, positionIn52WeekRange: 50,
      valuation: {}, targetAndMispricing: { status: "unavailable", reason: "insufficient evidence" },
      catalystState: { status: "unavailable", sourceType: "company_analysis", verified: false, gateQualified: false, display: `Unavailable — company analysis/commentary is not a reportable company event — ${analysisTitle}` },
      catalyst: analysisTitle, risk: "valuation risk",
    }],
    research: { funnel: {}, batches: [], packets: [{ symbol: "ANET", gateResult: "fail", finalAction: "Watch", confidence: "Low", sourceSnapshot: { sourceType: "core", setup: {} } }] },
  };
  const report = renderMorningBrief(compact, { reportId: "00000000-0000-4000-8000-000000000010", generatedAt: compact.generatedAt });
  const summary = report.split("# Overnight and Market Context")[0];
  assert.match(summary, /Key Event Status.*No material company event identified/);
  assert.doesNotMatch(summary, /Momentum Persist/);
  assert.match(report, /analysis\/commentary is not a reportable company event/);
});

test("watchlist catalyst validation uses the same canonical text as rendering", () => {
  const display = "Unavailable — company analysis/commentary is not a reportable company event — ANET outlook | MarketWatch";
  const report = completeReport(["ANET"]).replace("No verified catalyst", display.replace("|", " "));
  const compact = {
    reportMode: "standard", engineVersion: "0.5.11.1", buildRevision: "0.5.11.1-hf1",
    researchSymbols: ["ANET"],
    research: { funnel: { recommendedActions: 0 }, packets: [{ symbol: "ANET" }] },
    watchlist: [{
      symbol: "ANET", finalAction: "Watch",
      targetAndMispricing: { status: "unavailable", reason: "insufficient inputs" },
      catalystState: { status: "unavailable", sourceType: "company_analysis", verified: false, display },
      recommendationGateResult: "Rejected — evidence gate incomplete",
    }],
  };
  assert.deepEqual(validateReportCompleteness(report, ["ANET"], compact), { ok: true, errors: [] });
});

test("recommendedActions=0 rejects any Buy or Sell leaked into Watchlist Final Action", () => {
  const compact = {
    researchSymbols: ["NVDA"],
    research: { funnel: { recommendedActions: 0 }, packets: [{ symbol: "NVDA" }] },
    watchlist: [{ symbol: "NVDA", finalAction: "Watch" }],
  };
  const leaked = completeReport(["NVDA"]).replace("| Watch | Unavailable — no comparable action memory | Unavailable | Rejected — evidence gate incomplete | Researched |", "| Buy now | Unavailable — no comparable action memory | Unavailable | Rejected — evidence gate incomplete | Researched |");
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

test("extreme valuation without holdings remains Watch-only", () => {
  const normalized = normalizeResearchPacket({
    symbol: "ANET", gateResult: "pass", todayAction: "Trim", gateReason: "extreme valuation", strategicPosition: "Hold",
  }, { symbol: "ANET", sourceType: "core", setup: { verifiedCatalyst: false, dislocation: false, extremeTrim: true } });
  assert.equal(normalized.gateResult, "fail");
  assert.equal(normalized.todayAction, "Watch");
  assert.equal(normalized.finalAction, "Watch");
  assert.match(normalized.gateReason, /portfolio inputs unavailable/);
});

test("final validation rejects position-size advice without portfolio input", () => {
  const leaked = completeReport(["ANET"]).replace("| Watch | Unavailable — no comparable action memory | Unavailable | Rejected — evidence gate incomplete | Researched |", "| Review position size | Unavailable — no comparable action memory | Unavailable | Rejected — evidence gate incomplete | Researched |");
  const errors = validateReportCompleteness(leaked, ["ANET"], { watchlist: [{ symbol: "ANET", finalAction: "Review position size" }] }).errors.join("; ");

  assert.match(errors, /Review position size is forbidden without portfolio holdings and target weights/);
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
    reratingPath: "No qualified rerating path in the supplied evidence.", reratingHorizon: "Unavailable",
    sourceQuality: "primary filing", gateResult: "fail", gateReason: "Threshold not cleared.",
  };
  const invalid = validateResearchBatch({ candidates: [packet] }, [candidate]);
  assert.match(invalid.errors.join("; "), /CEVA unsourced price level in entryExitCondition: \$30/);
  packet.entryExitCondition = "Reassess at the supplied 52-week low of $25.";
  assert.deepEqual(validateResearchBatch({ candidates: [packet] }, [candidate]), { ok: true, errors: [] });
});

test("separate research audit deterministically renders negative net debt as net cash", () => {
  const audit = renderResearchAudit({
    engineVersion: "0.5.11.1", buildRevision: "0.5.11.1-hf1",
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
  assert.equal(result.report.reportEngineVersion, "0.5.11.1");
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
    engineVersion: "0.5.11.1",
    buildRevision: "0.5.11.1-hf1",
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
