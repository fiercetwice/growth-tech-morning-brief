const YAHOO_CHART = "https://query1.finance.yahoo.com/v8/finance/chart";
const NASDAQ_API_BASE = "https://api.nasdaq.com/api/calendar";
const FED_MONETARY_RSS = "https://www.federalreserve.gov/feeds/press_monetary.xml";
const YAHOO_SEARCH = "https://query2.finance.yahoo.com/v1/finance/search";
const NASDAQ_STOCK_SCREENER = "https://api.nasdaq.com/api/screener/stocks";
const SEC_FACTS = "https://data.sec.gov/api/xbrl/companyfacts";
const SEC_COMPANY_TICKERS = "https://www.sec.gov/files/company_tickers.json";
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash";
const DEEPSEEK_API_BASE = "https://api.deepseek.com";
const DEFAULT_DEEPSEEK_MODEL = "deepseek-v4-flash";
const DEFAULT_AI_PROVIDER = "gemini";
const SERVICE_VERSION = "0.5.11.1";
const BUILD_REVISION = "0.5.11.1-hf1";
const RESEND_EMAILS = "https://api.resend.com/emails";
const HISTORY_YEARS = 5;
const REQUIRED_REPORT_SECTIONS = [
  "Executive Summary",
  "Overnight and Market Context",
  "AI Cycle Dashboard",
  "Sector Scorecard",
  "Watchlist",
];
const REQUIRED_EXECUTIVE_LABELS = [
  "AI Cycle and Sector Implications",
  "Market Context",
  "Highest-Ranked Recommendation",
  "Primary Valuation Risk",
];
const EXECUTIVE_EVENT_LABELS = ["Key Scheduled Event", "Key Reported Event", "Key Event Status"];
const REQUIRED_CONTEXT_LABELS = ["As Of", "Global Markets", "Futures", "Rates", "Dollar", "Oil"];
const TODAY_ACTIONS = ["Buy now", "Buy on weakness", "Sell", "Review position size", "Watch", "No action"];
const REPORT_MODES = new Set(["standard", "verbose"]);
const DEFAULT_DISCOVERY_LIMIT = 6;
const DEFAULT_MIN_MARKET_CAP = 250_000_000;
const DEFAULT_MIN_DOLLAR_VOLUME = 5_000_000;
const DEFAULT_SEC_REFRESH_LIMIT = 2;
const DEFAULT_DISCOVERY_SEC_REFRESH_LIMIT = 6;
const DEFAULT_CORE_NEWS_LIMIT = 3;
const DEFAULT_RESEARCH_BATCH_SIZE = 3;
const MAX_RESEARCH_CANDIDATES = 12;
const DEFAULT_RESEARCH_MAX_TOKENS = 4_000;
const MAX_AI_ATTEMPTS = 2;
const MAX_DISCORD_ATTEMPTS = 4;
const ALLOWED_AI_PROVIDERS = new Set(["gemini", "deepseek", "openai-compatible"]);
const MARKET_CONTEXT_GROUPS = {
  futures: [
    { symbol: "ES=F", label: "S&P 500" },
    { symbol: "NQ=F", label: "Nasdaq 100" },
  ],
  rates: [{ symbol: "^TNX", label: "U.S. 10Y yield", unit: "%" }],
  usd: [{ symbol: "DX-Y.NYB", label: "U.S. Dollar Index" }],
  oil: [{ symbol: "CL=F", label: "WTI crude" }],
};
const SECTOR_MEMBERS = {
  GPU: ["NVDA", "TSM", "AVGO"],
  "AI Cloud": ["AMZN", "MSFT", "GOOGL", "ORCL"],
  "GPU Cloud": ["CRWV"],
  Networking: ["ANET", "AVGO"],
  Cooling: ["VRT"],
  Power: ["CEG"],
  Cybersecurity: ["FTNT"],
  "Cloud Software": ["MSFT", "AMZN", "GOOGL", "META", "ORCL"],
};
const AI_CYCLE_SEGMENTS = {
  "Hyperscaler AI CapEx": ["MSFT", "AMZN", "GOOGL", "META"],
  "GPU Demand": ["NVDA", "TSM", "AVGO"],
  "AI Cloud": ["CRWV"],
  "Enterprise AI": ["MSFT", "ORCL"],
  Inference: ["NVDA", "ANET", "AVGO"],
};
const AI_CYCLE_OFFICIAL_HOSTS = {
  MSFT: ["microsoft.com"], GOOGL: ["abc.xyz"], NVDA: ["nvidia.com"], AVGO: ["broadcom.com"],
  AMZN: ["amazon.com", "aboutamazon.com"], META: ["investor.fb.com", "meta.com"], ORCL: ["oracle.com"], TSM: ["tsmc.com"], CRWV: ["coreweave.com"], ANET: ["arista.com"],
};

const BUILTIN_AI_CYCLE_OBSERVATIONS = [
  { segment: "Hyperscaler AI CapEx", company: "MSFT", metric: "Quarterly property and equipment additions", value: 30.876, unit: "USD bn", changePercent: 84.39, direction: "positive", periodEnd: "2026-03-31", publishedAt: "2026-04-29", freshnessDays: 120, sourceType: "company_earnings_release", sourceUrl: "https://www.microsoft.com/en-us/Investor/earnings/FY-2026-Q3/press-release-webcast" },
  { segment: "Hyperscaler AI CapEx", company: "GOOGL", metric: "Quarterly CapEx, primarily AI infrastructure", value: 44.9, unit: "USD bn", changePercent: null, direction: "positive", periodEnd: "2026-06-30", publishedAt: "2026-07-23", freshnessDays: 120, sourceType: "company_earnings_release", sourceUrl: "https://abc.xyz/investor/events/event-details/2026/2026-Q2-Earnings-Call-2026-GgTAq7Is0z/default.aspx" },
  { segment: "GPU Demand", company: "NVDA", metric: "Data Center revenue growth", value: 92, unit: "% YoY", changePercent: 92, direction: "positive", periodEnd: "2026-04-26", publishedAt: "2026-05-20", freshnessDays: 120, sourceType: "company_earnings_release", sourceUrl: "https://investor.nvidia.com/news/press-release-details/2026/NVIDIA-Announces-Financial-Results-for-First-Quarter-Fiscal-2027/default.aspx" },
  { segment: "GPU Demand", company: "AVGO", metric: "AI semiconductor revenue growth", value: 143, unit: "% YoY", changePercent: 143, direction: "positive", periodEnd: "2026-05-03", publishedAt: "2026-06-03", freshnessDays: 120, sourceType: "company_earnings_release", sourceUrl: "https://investors.broadcom.com/news-releases/news-release-details/broadcom-inc-announces-second-quarter-fiscal-year-2026-financial" },
  { segment: "AI Cloud", company: "MSFT", metric: "Azure and other cloud services revenue growth", value: 40, unit: "% YoY", changePercent: 40, direction: "positive", periodEnd: "2026-03-31", publishedAt: "2026-04-29", freshnessDays: 120, sourceType: "company_earnings_release", sourceUrl: "https://www.microsoft.com/en-us/Investor/earnings/FY-2026-Q3/press-release-webcast" },
  { segment: "AI Cloud", company: "GOOGL", metric: "Google Cloud revenue growth", value: 82, unit: "% YoY", changePercent: 82, direction: "positive", periodEnd: "2026-06-30", publishedAt: "2026-07-23", freshnessDays: 120, sourceType: "company_earnings_release", sourceUrl: "https://abc.xyz/investor/events/event-details/2026/2026-Q2-Earnings-Call-2026-GgTAq7Is0z/default.aspx" },
  { segment: "Enterprise AI", company: "MSFT", metric: "AI business annual revenue run-rate growth", value: 123, unit: "% YoY", changePercent: 123, direction: "positive", periodEnd: "2026-03-31", publishedAt: "2026-04-29", freshnessDays: 120, sourceType: "company_earnings_release", sourceUrl: "https://www.microsoft.com/en-us/Investor/earnings/FY-2026-Q3/press-release-webcast" },
  { segment: "Inference", company: "GOOGL", metric: "Model API tokens processed per minute", value: 22, unit: "bn tokens/min", changePercent: 37.5, direction: "positive", periodEnd: "2026-06-30", publishedAt: "2026-07-23", freshnessDays: 120, sourceType: "company_earnings_release", sourceUrl: "https://abc.xyz/investor/events/event-details/2026/2026-Q2-Earnings-Call-2026-GgTAq7Is0z/default.aspx" },
];

const CIKS = {
  NVDA: "0001045810", AMZN: "0001018724", MSFT: "0000789019",
  ANET: "0001596532", CRWV: "0001769628", AVGO: "0001730168",
  META: "0001326801", GOOGL: "0001652044", ORCL: "0001341439",
  TSM: "0001046179", VRT: "0001674101", CEG: "0001868275",
  FTNT: "0001262039",
};

const COMPANY_HEADLINE_ALIASES = {
  NVDA: ["NVIDIA"],
  AMZN: ["Amazon", "AWS"],
  MSFT: ["Microsoft", "Azure"],
  ANET: ["Arista Networks", "Arista"],
  CRWV: ["CoreWeave"],
  AVGO: ["Broadcom"],
  META: ["Meta Platforms", "Meta", "Facebook"],
  GOOGL: ["Alphabet", "Google"],
  ORCL: ["Oracle"],
  TSM: ["Taiwan Semiconductor", "TSMC"],
  VRT: ["Vertiv"],
  CEG: ["Constellation Energy"],
  FTNT: ["Fortinet"],
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, "") : url.pathname;
    if (path === "/health") return json({ ok: true, service: "growth-tech-morning-brief", version: SERVICE_VERSION, buildRevision: BUILD_REVISION });
    if (path === "/latest" && request.method === "GET") {
      if (!authorized(request, env)) return json({ error: "unauthorized" }, 401);
      if (!env.BRIEF_BUCKET?.get) return json({ error: "r2_not_configured" }, 503);
      const latest = await env.BRIEF_BUCKET.get("briefs/latest.json");
      return latest
        ? new Response(latest.body, { headers: { "content-type": "application/json; charset=utf-8" } })
        : json({ error: "no_brief_yet" }, 404);
    }
    if (path === "/run" && request.method === "POST") {
      if (!authorized(request, env)) return json({ error: "unauthorized" }, 401);
      try {
        const snapshot = await buildSnapshot(env, new Date(), { force: true });
        return json(toBrief(snapshot));
      } catch (error) {
        console.error(error);
        return json({ error: "snapshot_failed", message: error instanceof Error ? error.message : String(error) }, 502);
      }
    }
    if (path === "/deliver-latest" && request.method === "POST") {
      if (!authorized(request, env)) return json({ error: "unauthorized" }, 401);
      try {
        return json(await deliverLatestReport(env, new Date()));
      } catch (error) {
        if (error?.code === "NO_REPORT_YET") return json({ error: "no_report_yet" }, 404);
        console.error(error);
        return json({ error: "delivery_failed", message: errorMessage(error) }, 502);
      }
    }
    const buildSpecificReportPath = `/run-report/v${SERVICE_VERSION}/build/${BUILD_REVISION}`;
    if ((path === "/run-report" || path === buildSpecificReportPath) && request.method === "POST") {
      if (!authorized(request, env)) return json({ error: "unauthorized" }, 401);
      try {
        const options = await request.json().catch(() => ({}));
        const routeOverride = requestedAiRoute(options);
        const reportMode = requestedReportMode(options);
        if ((routeOverride || reportMode) && options?.forceRegenerate !== true) {
          return json({ error: "force_regenerate_required", message: "provider/model/reportMode overrides require forceRegenerate=true" }, 400);
        }
        return json(await runReportNow(env, new Date(), {
          forceDelivery: options?.forceDelivery === true,
          forceRegenerate: options?.forceRegenerate === true,
          aiRoute: routeOverride,
          reportMode,
        }));
      } catch (error) {
        console.error(error);
        return json({ error: "run_report_failed", message: errorMessage(error) }, 502);
      }
    }
    return json({ error: "not_found" }, 404);
  },

  async scheduled(controller, env, ctx) {
    ctx.waitUntil(runScheduledBrief(env, new Date(controller.scheduledTime)).catch((error) => console.error(error)));
  },
};

export async function runScheduledBrief(env, now = new Date()) {
  const snapshot = await buildSnapshot(env, now);
  if (snapshot.skipped) return snapshot;
  const report = await generateOrDeliverReport(env, now, { retryPendingDelivery: true });
  return { snapshot, report };
}

export async function runReportNow(env, now = new Date(), options = {}) {
  const snapshot = await buildSnapshot(env, now, { force: true });
  const report = await generateOrDeliverReport(env, now, {
    forceDelivery: options.forceDelivery === true,
    forceRegenerate: options.forceRegenerate === true,
    aiRoute: options.aiRoute,
    reportMode: options.reportMode,
  });
  return { snapshot, report };
}

async function generateOrDeliverReport(env, now, options = {}) {
  if (!env.BRIEF_BUCKET?.get || !env.BRIEF_BUCKET?.put) return { skipped: true, reason: "r2_not_configured" };

  const reportDate = zonedParts(now, "America/New_York").date;
  const reportObject = await env.BRIEF_BUCKET.get(`reports/${reportDate}.md`);
  const reportResults = { date: reportDate, engineVersion: SERVICE_VERSION, buildRevision: BUILD_REVISION, generated: false, stored: false, storage: null, email: null, webhook: null };
  try {
    let reportMarkdown;
    if (reportObject && !options.forceRegenerate) {
      reportMarkdown = await reportObject.text();
      reportResults.reused = true;
      reportResults.reportMode = reportObject.customMetadata?.reportMode ?? "unknown";
      reportResults.reportEngineVersion = reportObject.customMetadata?.engineVersion ?? "unknown";
      reportResults.reportBuildRevision = reportObject.customMetadata?.buildRevision ?? "unknown";
      reportResults.reportId = reportObject.customMetadata?.reportId ?? "unknown";
      reportResults.contentHash = reportObject.customMetadata?.contentHash ?? "unknown";
      reportResults.stored = true;
    } else {
      const latestObject = await env.BRIEF_BUCKET.get("snapshots/latest.json");
      if (!latestObject) throw new Error("snapshots/latest.json was not found after snapshot creation");
      const latestSnapshot = await latestObject.json();
      const generatedReport = await generateAiReport(env, latestSnapshot, options.aiRoute, { reportMode: options.reportMode });
      reportMarkdown = generatedReport.markdown;
      reportResults.aiProvider = generatedReport.provider;
      reportResults.aiModel = generatedReport.model;
      reportResults.reportMode = generatedReport.reportMode;
      reportResults.reportEngineVersion = SERVICE_VERSION;
      reportResults.reportBuildRevision = BUILD_REVISION;
      reportResults.reportId = generatedReport.metadata.reportId;
      reportResults.contentHash = generatedReport.metadata.contentHash;
      reportResults.research = generatedReport.research?.funnel ?? null;
      if (generatedReport.provider === "gemini") reportResults.geminiModel = generatedReport.model;
      reportResults.generation = generatedReport.metadata;
      reportResults.generated = true;
      reportResults.storage = await storeReport(env, reportDate, reportMarkdown, generatedReport.metadata);
      reportResults.stored = reportResults.storage.stored === true;
      if (options.forceRegenerate) {
        reportResults.replaced = Boolean(reportObject);
        await resetDeliveryReceipt(env, reportDate, generatedReport.metadata);
      }
    }
    if (!reportObject || options.forceRegenerate) {
      reportResults.email = await settleDelivery(() => sendReportEmail(env, reportDate, reportMarkdown));
    }
    reportResults.webhook = await deliverReportWebhookOnce(env, reportDate, reportMarkdown, {
      force: options.forceDelivery === true,
      retryPending: options.retryPendingDelivery === true,
    });
  } catch (error) {
    reportResults.error = errorMessage(error);
    const metadata = error?.reportMetadata;
    if (metadata) {
      reportResults.aiProvider = metadata.aiProvider;
      reportResults.aiModel = metadata.aiModel;
      reportResults.reportMode = metadata.reportMode;
      reportResults.reportEngineVersion = metadata.engineVersion ?? SERVICE_VERSION;
      reportResults.generation = metadata;
      reportResults.research = {
        batches: metadata.researchBatches ?? null,
        researched: metadata.researchComplete ?? null,
        incomplete: metadata.researchIncomplete ?? null,
      };
    }
    const failureStage = reportResults.generated ? "report_storage_failed" : "generation_failed";
    reportResults.storage = { skipped: true, reason: failureStage };
    reportResults.email = { skipped: true, reason: failureStage };
    reportResults.webhook = { skipped: true, reason: failureStage };
    console.error(error);
  }
  return reportResults;
}

export async function buildSnapshot(env, now = new Date(), options = {}) {
  const ny = zonedParts(now, "America/New_York");
  if (!options.force && (ny.hour !== 9 || ny.minute !== 35)) {
    return { skipped: true, reason: "not_09_35_ET", observed: ny };
  }

  const symbols = parseSymbols(env.WATCHLIST);
  const secNetworkBudget = { remaining: Math.min(10, Math.round(nonNegativeNumber(env.SEC_REFRESH_LIMIT, DEFAULT_SEC_REFRESH_LIMIT))) };
  const [results, marketContext, calendars, discovery, aiCycleObservations] = await Promise.all([
    Promise.allSettled(symbols.map(async (symbol) => {
    const chart = await fetchYahooChart(symbol, now, env);
    const fundamentals = await fetchSecFundamentals(symbol, env, now, { networkBudget: secNetworkBudget }).catch((error) => ({
      available: false, reason: error.message,
    }));
    return assembleSymbol(symbol, chart, fundamentals);
    })),
    buildMarketContext(env, now),
    buildCalendarContext(env, now, symbols),
    buildDiscoveryContext(env, now, symbols),
    loadAiCycleObservations(env, now),
  ]);

  const watchlist = results.map((result, index) => result.status === "fulfilled"
    ? result.value
    : { symbol: symbols[index], missing: true, error: result.reason?.message ?? String(result.reason) });
  const succeeded = watchlist.filter((row) => !row.missing).length;
  if (!succeeded) throw new Error("All Yahoo chart requests failed");

  const emailConfigured = Boolean(env.RESEND_API_KEY && env.REPORT_TO_EMAIL && env.REPORT_FROM_EMAIL);
  const coldTickerMapReserve = emailConfigured && ["refreshed", "failed"].includes(discovery.fundamentalsCoverage?.tickerMapCacheStatus) ? 1 : 0;
  const coreNewsSymbols = selectCoreNewsSymbols(watchlist, calendars, Math.min(
    symbols.length,
    Math.max(0, Math.round(nonNegativeNumber(env.CORE_NEWS_LIMIT, DEFAULT_CORE_NEWS_LIMIT)) - coldTickerMapReserve),
  ));
  const coreNews = await buildNewsContext(env, now, coreNewsSymbols);

  const discoverySymbols = (discovery.candidates ?? []).map((row) => row.symbol);
  const discoveryNews = discovery.news?.items ?? [];
  const news = {
    ...coreNews,
    company: {
      ...coreNews.company,
      items: [...(coreNews.company?.items ?? []), ...discoveryNews]
        .filter((item, index, all) => all.findIndex((candidate) => candidate.url === item.url) === index)
        .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)).slice(0, 50),
    },
  };

  const snapshot = {
    schemaVersion: 9,
    generatedAt: now.toISOString(),
    session: marketSession(now),
    sources: {
      price: "Yahoo Finance chart endpoint (unofficial)",
      fundamentals: "SEC EDGAR CompanyFacts",
      marketContext: "Yahoo Finance chart endpoint (unofficial)",
      calendars: "Nasdaq public calendar endpoints (unofficial)",
      monetaryPolicyNews: "Federal Reserve monetary policy RSS (official)",
      companyNews: "Yahoo Finance search news (unofficial)",
      aiCycle: "Official company disclosures; structured point-in-time observations",
      discovery: "Nasdaq full-market stock screener (unofficial public endpoint)",
      methodology: "Point-in-time TTM multiples use only filings available by each price date",
    },
    coverage: { requested: symbols.length, succeeded, failed: symbols.length - succeeded },
    marketContext,
    calendars,
    news,
    discovery: { ...discovery, symbols: discoverySymbols },
    aiCycleObservations,
    watchlist,
  };

  snapshot.eventLedger = await buildEventLedger(snapshot, env, ny.date);

  if (env.BRIEF_BUCKET?.put) {
    const body = JSON.stringify(snapshot, null, 2);
    const briefBody = JSON.stringify(toBrief(snapshot), null, 2);
    await Promise.all([
      env.BRIEF_BUCKET.put(`snapshots/${ny.date}.json`, body, { httpMetadata: { contentType: "application/json" } }),
      env.BRIEF_BUCKET.put("snapshots/latest.json", body, { httpMetadata: { contentType: "application/json" } }),
      env.BRIEF_BUCKET.put(`briefs/${ny.date}.json`, briefBody, { httpMetadata: { contentType: "application/json" } }),
      env.BRIEF_BUCKET.put("briefs/latest.json", briefBody, { httpMetadata: { contentType: "application/json" } }),
      env.BRIEF_BUCKET.put(`events/${ny.date}.json`, JSON.stringify(snapshot.eventLedger, null, 2), { httpMetadata: { contentType: "application/json" } }),
      env.BRIEF_BUCKET.put("events/latest.json", JSON.stringify(snapshot.eventLedger, null, 2), { httpMetadata: { contentType: "application/json" } }),
    ]);
  }
  return snapshot;
}

export async function buildMarketContext(env, now = new Date()) {
  const groups = await Promise.all(Object.entries(MARKET_CONTEXT_GROUPS).map(async ([category, instruments]) => {
    const settled = await Promise.allSettled(instruments.map(async (instrument) => {
      const chart = await fetchYahooChart(instrument.symbol, now, env, { historyDays: 10 });
      return marketContextRow(instrument, chart, now);
    }));
    const items = settled.filter((result) => result.status === "fulfilled").map((result) => result.value);
    const failures = settled.filter((result) => result.status === "rejected");
    const stale = items.some((item) => item.stale);
    return [category, {
      status: items.length ? (stale ? "stale" : "available") : "unavailable",
      source: "Yahoo Finance chart endpoint (unofficial)",
      asOf: latestTimestamp(items.map((item) => item.asOf)),
      items,
      ...(failures.length ? { failed: failures.length, reason: failures.map((result) => errorMessage(result.reason)).join("; ") } : {}),
    }];
  }));
  return Object.fromEntries(groups);
}

export async function buildCalendarContext(env, now = new Date(), symbols = []) {
  const date = zonedParts(now, "America/New_York").date;
  const [macro, earnings] = await Promise.all([
    fetchNasdaqCalendar("economicevents", date, env).then((body) => normalizeNasdaqMacroCalendar(body, date, now))
      .catch((error) => unavailableCalendar("Nasdaq public economic calendar (unofficial)", date, error)),
    fetchNasdaqCalendar("earnings", date, env).then((body) => normalizeNasdaqEarningsCalendar(body, date, symbols, now))
      .catch((error) => unavailableCalendar("Nasdaq public earnings calendar (unofficial)", date, error)),
  ]);
  return { macroEvents: macro, earnings };
}

export async function buildNewsContext(env, now = new Date(), symbols = []) {
  const [monetaryPolicy, companySettled] = await Promise.all([
    fetchFedMonetaryPolicy(env).then((xml) => normalizeFedMonetaryNews(xml, now))
      .catch((error) => unavailableNews("Federal Reserve monetary policy RSS (official)", error)),
    Promise.allSettled(symbols.map(async (symbol) => {
      const body = await fetchYahooNews(symbol, env);
      return normalizeYahooNews(body, symbol, now);
    })),
  ]);
  const companyItems = companySettled.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  const failures = companySettled.filter((result) => result.status === "rejected");
  const deduped = companyItems.filter((item, index, all) => all.findIndex((candidate) => candidate.url === item.url) === index)
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)).slice(0, 30);
  return {
    monetaryPolicy,
    company: {
      status: deduped.length ? "available" : failures.length === symbols.length ? "unavailable" : "available",
      source: "Yahoo Finance search news (unofficial)",
      asOf: now.toISOString(),
      items: deduped,
      ...(failures.length ? { failed: failures.length, reason: failures.map((result) => errorMessage(result.reason)).join("; ") } : {}),
    },
  };
}

function selectCoreNewsSymbols(watchlist, calendars, limit) {
  if (!limit) return [];
  const earnings = new Set(calendars?.earnings?.watchlistMatches ?? []);
  return [...watchlist].filter((row) => !row.missing).sort((a, b) => {
    const earningsDelta = Number(earnings.has(b.symbol)) - Number(earnings.has(a.symbol));
    return earningsDelta || Math.abs(b.changePercent ?? 0) - Math.abs(a.changePercent ?? 0);
  }).slice(0, limit).map((row) => row.symbol);
}

export async function buildEventLedger(snapshot, env, date = snapshot.generatedAt?.slice(0, 10)) {
  const events = [];
  for (const item of snapshot.news?.company?.items ?? []) {
    for (const symbol of item.symbols ?? [null]) events.push(eventRecord(item.sourceType ?? item.kind ?? "company_analysis", symbol, item.title, item.publishedAt, item.url, item.source));
  }
  for (const item of snapshot.calendars?.earnings?.events ?? []) {
    events.push(eventRecord("earnings", item.symbol, `${item.symbol} earnings${item.time ? ` ${item.time}` : ""}`, date, null, snapshot.calendars.earnings.source));
  }
  for (const item of snapshot.news?.monetaryPolicy?.items ?? []) {
    events.push(eventRecord(item.kind ?? "monetary_policy", null, item.title, item.publishedAt, item.url, item.source));
  }
  const deduped = events.filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index);
  let previous = null;
  if (env.BRIEF_BUCKET?.get) {
    try {
      const object = await env.BRIEF_BUCKET.get("events/latest.json");
      if (object) previous = await object.json();
    } catch (error) {
      console.warn(`Event ledger history unavailable: ${errorMessage(error)}`);
    }
  }
  const previousIds = new Set((previous?.events ?? []).map((item) => item.id));
  const currentIds = new Set(deduped.map((item) => item.id));
  return {
    schemaVersion: "event-ledger-v1",
    asOf: snapshot.generatedAt,
    events: deduped.map((item) => ({ ...item, delta: previousIds.has(item.id) ? "unchanged" : "new" })),
    delta: {
      new: deduped.filter((item) => !previousIds.has(item.id)).map((item) => item.id),
      unchanged: deduped.filter((item) => previousIds.has(item.id)).map((item) => item.id),
      resolved: (previous?.events ?? []).filter((item) => !currentIds.has(item.id)).map((item) => item.id),
    },
  };
}

function eventRecord(type, symbol, title, occurredAt, url, source) {
  const identity = [type, symbol ?? "market", url ?? title ?? "untitled", occurredAt ?? "undated"].join("|");
  return { id: `evt_${stableHash(identity)}`, type, symbol, title, occurredAt, url, source };
}

function stableHash(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export async function buildDiscoveryContext(env, now = new Date(), coreSymbols = []) {
  if (String(env.DISCOVERY_ENABLED ?? "true").toLowerCase() === "false") {
    return { status: "disabled", source: "Nasdaq full-market stock screener (unofficial public endpoint)", asOf: null, scanned: 0, candidates: [], news: { items: [] } };
  }
  try {
    const body = await fetchNasdaqStockUniverse(env);
    const rows = normalizeNasdaqStockUniverse(body);
    const core = new Set(coreSymbols);
    const minMarketCap = positiveNumber(env.DISCOVERY_MIN_MARKET_CAP, DEFAULT_MIN_MARKET_CAP);
    const minDollarVolume = positiveNumber(env.DISCOVERY_MIN_DOLLAR_VOLUME, DEFAULT_MIN_DOLLAR_VOLUME);
    const limit = Math.min(25, Math.max(1, Math.round(positiveNumber(env.DISCOVERY_LIMIT, DEFAULT_DISCOVERY_LIMIT))));
    const candidates = rows.filter((row) => !core.has(row.symbol))
      .filter((row) => row.marketCap >= minMarketCap && row.dollarVolume >= minDollarVolume)
      .filter(growthTechDiscoveryRelevant)
      .filter((row) => Math.abs(row.changePercent ?? 0) >= 3)
      .map((row) => ({ ...row, discoveryScore: discoveryScore(row), sourceType: "discovery" }))
      .sort((a, b) => b.discoveryScore - a.discoveryScore).slice(0, limit);
    const newsSettled = await Promise.allSettled(candidates.map(async (row) => normalizeYahooNews(await fetchYahooNews(row.symbol, env), row.symbol, now, row.name).slice(0, 3)));
    const newsItems = newsSettled.flatMap((result) => result.status === "fulfilled" ? result.value : []);
    for (const row of candidates) row.news = newsItems.filter((item) => item.symbols?.includes(row.symbol)).slice(0, 3);
    const fundamentalsCoverage = await enrichDiscoveryCandidates(candidates, env, now);
    return {
      status: "available",
      source: "Nasdaq full-market stock screener (unofficial public endpoint)",
      asOf: body?.data?.asOf ?? now.toISOString(),
      scanned: rows.length,
      eligibleAfterLiquidityAndRelevance: candidates.length,
      filters: { minMarketCap, minDollarVolume, maximumCandidates: limit },
      candidates,
      fundamentalsCoverage,
      news: { items: newsItems },
    };
  } catch (error) {
    return { status: "unavailable", source: "Nasdaq full-market stock screener (unofficial public endpoint)", asOf: null, scanned: 0, candidates: [], news: { items: [] }, reason: errorMessage(error) };
  }
}

async function enrichDiscoveryCandidates(candidates, env, now) {
  const coverage = { total: candidates.length, available: 0, unavailable: 0, sourceFailures: 0, mappingMissing: 0, tickerMapCacheStatus: "not_required" };
  if (!candidates.length) return coverage;
  let cikByTicker;
  try {
    const tickerMap = await fetchSecTickerMap(env, now);
    cikByTicker = tickerMap.values;
    coverage.tickerMapCacheStatus = tickerMap.cacheStatus;
  } catch (error) {
    for (const row of candidates) row.fundamentalCoverage = { status: "source_failure", reason: errorMessage(error) };
    coverage.sourceFailures = candidates.length;
    coverage.tickerMapCacheStatus = "failed";
    return coverage;
  }
  const networkBudget = { remaining: Math.min(25, Math.round(nonNegativeNumber(env.DISCOVERY_SEC_REFRESH_LIMIT, DEFAULT_DISCOVERY_SEC_REFRESH_LIMIT))) };
  const results = await Promise.allSettled(candidates.map(async (row) => {
    const cik = cikByTicker.get(row.symbol);
    if (!cik) return { row, status: "mapping_missing", reason: "SEC ticker-to-CIK mapping unavailable" };
    try {
      const facts = await fetchSecFundamentals(row.symbol, env, now, { cik, networkBudget });
      if (!facts.available) {
        const status = /budget exhausted/i.test(facts.reason ?? "") ? "source_failure" : "extraction_gap";
        return { row, status, reason: facts.reason ?? "SEC filing lacks usable revenue/EPS facts", facts };
      }
      return { row, status: "available", facts };
    } catch (error) {
      return { row, status: "source_failure", reason: errorMessage(error) };
    }
  }));
  for (const settled of results) {
    const result = settled.status === "fulfilled" ? settled.value : null;
    if (!result) continue;
    const { row, facts, status, reason } = result;
    const growth = facts?.available ? reportedGrowth(facts) : null;
    row.fundamentalCoverage = { status, source: "SEC EDGAR CompanyFacts", reason: reason ?? null, asOf: latestTimestamp([facts?.balanceSheet?.asOf, growth?.asOf]) };
    if (status === "available") {
      const ttmRevenue = sumLastFour(facts.quarterlyRevenue);
      const ttmEps = sumLastFour(facts.quarterlyEps);
      row.valuation = {
        trailingPE: ttmEps > 0 ? round(row.price / ttmEps) : null,
        trailingPS: ttmRevenue > 0 && row.marketCap > 0 ? round(row.marketCap / ttmRevenue) : null,
        selectedMetric: ttmEps > 0 ? "trailingPE" : "trailingPS",
        selectedPercentile: null,
        fundamentalAsOf: row.fundamentalCoverage.asOf,
        basis: "current Nasdaq screened price/market cap with trailing SEC filings; no historical percentile",
      };
      row.reportedGrowth = growth;
      const netDebt = finitePair(facts.balanceSheet?.cash, facts.balanceSheet?.debt)
        ? round(facts.balanceSheet.debt - facts.balanceSheet.cash)
        : null;
      row.fundamentals = {
        ttmRevenue: round(ttmRevenue),
        ttmEps: round(ttmEps),
        cash: facts.balanceSheet?.cash ?? null,
        debt: facts.balanceSheet?.debt ?? null,
        netDebt,
        netDebtStatus: !Number.isFinite(netDebt) ? "unavailable" : netDebt > 0 ? "net_debt" : netDebt < 0 ? "net_cash" : "neutral",
        netDebtDefinition: "total debt minus cash; a negative value means net cash",
        asOf: row.fundamentalCoverage.asOf,
        cacheStatus: facts.cacheStatus ?? null,
      };
      coverage.available += 1;
    } else if (status === "source_failure") coverage.sourceFailures += 1;
    else if (status === "mapping_missing") coverage.mappingMissing += 1;
    else coverage.unavailable += 1;
  }
  return coverage;
}

async function fetchSecTickerMap(env, now) {
  const cacheKey = "sec/company_tickers.json";
  if (env.BRIEF_BUCKET?.get) {
    const cached = await env.BRIEF_BUCKET.get(cacheKey);
    if (cached && (!cached.uploaded || now.getTime() - new Date(cached.uploaded).getTime() < 30 * 86400_000)) {
      return { values: normalizeSecTickerMap(await cached.json()), cacheStatus: "fresh" };
    }
  }
  const response = await fetch(SEC_COMPANY_TICKERS, { headers: { accept: "application/json", "user-agent": env.SEC_USER_AGENT || "growth-tech-morning-brief research@example.com" } });
  if (!response.ok) throw new Error(`SEC ticker map failed (${response.status})`);
  const body = await response.json();
  if (env.BRIEF_BUCKET?.put) await env.BRIEF_BUCKET.put(cacheKey, JSON.stringify(body), { httpMetadata: { contentType: "application/json" } });
  return { values: normalizeSecTickerMap(body), cacheStatus: "refreshed" };
}

export function normalizeSecTickerMap(body) {
  return new Map(Object.values(body ?? {}).filter((row) => row?.ticker && Number.isFinite(Number(row?.cik_str)))
    .map((row) => [String(row.ticker).toUpperCase(), String(row.cik_str).padStart(10, "0")]));
}

function sumLastFour(rows = []) {
  return rows.length >= 4 ? rows.slice(-4).reduce((sum, row) => sum + row.value, 0) : null;
}

async function fetchNasdaqStockUniverse(env) {
  const url = new URL(NASDAQ_STOCK_SCREENER);
  url.searchParams.set("tableonly", "true");
  url.searchParams.set("limit", "10000");
  url.searchParams.set("offset", "0");
  url.searchParams.set("download", "true");
  const response = await fetch(url, { headers: nasdaqHeaders(env) });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.data?.rows) throw new Error(`Nasdaq stock discovery failed (${response.status})`);
  return body;
}

export function normalizeNasdaqStockUniverse(body) {
  const rows = Array.isArray(body?.data?.rows) ? body.data.rows : [];
  return rows.map((row) => {
    const price = marketNumber(row.lastsale);
    const volume = marketNumber(row.volume);
    return {
      symbol: cleanText(row.symbol)?.toUpperCase() ?? null,
      name: cleanText(row.name),
      country: cleanText(row.country),
      sector: cleanText(row.sector),
      industry: cleanText(row.industry),
      price: round(price),
      changePercent: round(marketNumber(row.pctchange)),
      marketCap: marketNumber(row.marketCap),
      volume,
      dollarVolume: finitePair(price, volume) ? round(price * volume) : null,
      relativeVolume: null,
      screen: "nasdaq_full_market",
      valuation: null,
      reportedGrowth: null,
      missing: false,
    };
  }).filter((row) => row.symbol && Number.isFinite(row.price));
}

function growthTechDiscoveryRelevant(row) {
  const text = `${row.sector ?? ""} ${row.industry ?? ""} ${row.name ?? ""}`;
  if (/technology/i.test(row.sector ?? "")) return true;
  return /semiconductor|software|cloud|cyber|network|optical|photon|data.?center|server|comput|electronic|power|energy storage|cooling|thermal|automation|robot|digital|AI\b|artificial intelligence/i.test(text);
}

function discoveryScore(row) {
  const move = Math.min(20, Math.abs(row.changePercent ?? 0));
  const liquidity = Math.min(5, Math.log10(Math.max(1, row.dollarVolume ?? 1) / 1_000_000 + 1));
  const smallCompanyBonus = row.marketCap < 10_000_000_000 ? 2 : 0;
  return round(move + liquidity + smallCompanyBonus);
}

function positiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function nonNegativeNumber(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function marketNumber(value) {
  if (value === undefined || value === null) return null;
  const parsed = Number(String(value).replace(/[$,%\s]/g, "").replaceAll(",", ""));
  return Number.isFinite(parsed) ? parsed : null;
}

async function fetchFedMonetaryPolicy(env) {
  const response = await fetch(FED_MONETARY_RSS, { headers: { "user-agent": env.NEWS_USER_AGENT || `growth-tech-morning-brief/${SERVICE_VERSION}` } });
  if (!response.ok) throw new Error(`Federal Reserve feed failed (${response.status})`);
  return response.text();
}

async function fetchYahooNews(symbol, env) {
  const url = new URL(YAHOO_SEARCH);
  url.searchParams.set("q", symbol);
  url.searchParams.set("quotesCount", "1");
  url.searchParams.set("newsCount", "5");
  const response = await fetch(url, { headers: yahooHeaders(env) });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body) throw new Error(`Yahoo news failed for ${symbol} (${response.status})`);
  return body;
}

export function normalizeFedMonetaryNews(xml, now = new Date()) {
  const cutoff = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  const items = [...String(xml).matchAll(/<item>([\s\S]*?)<\/item>/gi)].map((match) => {
    const item = match[1];
    const title = xmlValue(item, "title");
    const url = xmlValue(item, "link");
    const publishedAt = isoDate(xmlValue(item, "pubDate"));
    return {
      title,
      url,
      publishedAt,
      source: "Federal Reserve",
      kind: fedEventKind(title),
      symbols: [],
      verified: true,
    };
  }).filter((item) => item.title && item.url && item.publishedAt && Date.parse(item.publishedAt) >= cutoff);
  return { status: "available", source: "Federal Reserve monetary policy RSS (official)", asOf: now.toISOString(), items };
}

export function normalizeYahooNews(body, symbol, now = new Date(), companyName = null) {
  const cutoff = now.getTime() - 48 * 60 * 60 * 1000;
  return (Array.isArray(body?.news) ? body.news : []).map((item) => {
    const title = cleanText(item.title);
    const entityMatch = headlineNamesCompany(title, symbol, companyName) ? "direct" : "indirect";
    const sourceType = companyNewsSourceType(title, entityMatch);
    return {
      title,
      url: cleanText(item.link),
      publishedAt: isoDate(item.providerPublishTime),
      source: cleanText(item.publisher) || "Yahoo Finance",
      kind: sourceType,
      sourceType,
      symbols: [symbol],
      verified: Boolean(item.link && item.title),
      entityMatch,
      relationship: entityMatch === "direct" ? "company_specific" : "sector_or_competitor_read_through",
      material: materialCompanyHeadline(item.title),
    };
  }).filter((item) => item.title && item.url && item.publishedAt && Date.parse(item.publishedAt) >= cutoff);
}

function headlineNamesCompany(title, symbol, companyName = null) {
  const aliases = new Set([symbol, ...(COMPANY_HEADLINE_ALIASES[symbol] ?? [])]);
  const normalizedName = cleanText(companyName)?.replace(/\b(?:incorporated|inc\.?|corp(?:oration)?\.?|co\.?|company|holdings?|plc|ltd\.?)\b.*$/i, "").trim();
  if (normalizedName?.length >= 4) aliases.add(normalizedName);
  return [...aliases].filter(Boolean).some((alias) => new RegExp(`(^|[^A-Za-z0-9])${escapeRegExp(alias)}(?:['’]s)?(?=$|[^A-Za-z0-9])`, "i").test(title ?? ""));
}

function materialCompanyHeadline(title = "") {
  return /earnings|revenue|profit|guidance|forecast|outlook|contract|customer|partnership|acqui|merger|offering|buyback|dividend|layoff|restructur|FDA|SEC|investigation|lawsuit|regulat|ban|export|launch|announc|order|backlog|capacity|data.?center|AI\b|artificial intelligence/i.test(title);
}

function companyNewsSourceType(title = "", entityMatch = "indirect") {
  if (entityMatch !== "direct") return "sector_read_through";
  return companyEventHeadline(title) ? "company_event" : "company_analysis";
}

function companyEventHeadline(title = "") {
  return /\b(?:reports?|posts?|releases?|announces?)\b.*\b(?:earnings|results?|revenue|profit|quarter)\b|\b(?:earnings|revenue|profit)\b.*\b(?:beats?|misses?)\b|\b(?:earnings|quarterly|financial)\s+results?\b|\b(?:raises?|cuts?|lowers?|withdraws?|reaffirms?|updates?)\b.*\b(?:guidance|forecast|outlook)\b|\b(?:wins?|secures?|signs?|awarded?)\b.*\b(?:contract|customer|partnership|order)\b|\b(?:announces?|launches?|unveils?|acquires?|merges?|completes?)\b.*\b(?:platform|product|service|contract|partnership|acquisition|merger|offering|buyback|dividend|facility|capacity|data.?center)\b|\b(?:acquisition|merger|offering|buyback|dividend|layoffs?|restructuring|bankruptcy|investigation|lawsuit|settlement|approval|recall|export ban|regulatory action)\b/i.test(title);
}

function xmlValue(xml, tag) {
  const match = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i").exec(xml);
  return match ? cleanText(match[1].replace(/^<!\[CDATA\[|\]\]>$/g, "")) : null;
}

function isoDate(value) {
  const date = typeof value === "number" ? new Date(value * 1000) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function fedEventKind(title = "") {
  if (/federal funds|interest rate|monetary policy|FOMC statement/i.test(title)) return "rate_decision";
  if (/projection|summary of economic projections|dot plot/i.test(title)) return "projections";
  if (/press conference|Powell/i.test(title)) return "chair_commentary";
  return "monetary_policy";
}

function unavailableNews(source, error) {
  return { status: "unavailable", source, asOf: null, items: [], reason: errorMessage(error) };
}

function marketContextRow(instrument, chart, now) {
  const scale = instrument.scale ?? 1;
  const asOf = chart.asOf;
  return {
    symbol: instrument.symbol,
    label: instrument.label,
    value: round(Number.isFinite(chart.price) ? chart.price * scale : null),
    previousClose: round(Number.isFinite(chart.previousClose) ? chart.previousClose * scale : null),
    change: round(Number.isFinite(chart.change) ? chart.change * scale : null),
    changePercent: round(chart.changePercent),
    unit: instrument.unit ?? chart.currency ?? null,
    asOf,
    stale: !asOf || now.getTime() - Date.parse(asOf) > 4 * 60 * 60 * 1000,
  };
}

async function fetchNasdaqCalendar(kind, date, env) {
  const url = new URL(`${NASDAQ_API_BASE}/${kind}`);
  url.searchParams.set("date", date);
  const response = await fetch(url, { headers: nasdaqHeaders(env) });
  const body = await response.json().catch(() => null);
  const providerError = body?.status?.bCodeMessage?.[0]?.errorMessage;
  if (!response.ok || providerError || !body?.data) {
    throw new Error(`Nasdaq ${kind} calendar failed (${response.status}): ${providerError || "missing data"}`);
  }
  return body;
}

export function normalizeNasdaqMacroCalendar(body, date, now = new Date()) {
  const rows = Array.isArray(body?.data?.rows) ? body.data.rows : [];
  const events = rows.map((row) => ({
    time: cleanText(row.time ?? row.releaseTime),
    country: cleanText(row.country),
    event: cleanText(row.eventName ?? row.event ?? row.name),
    actual: cleanText(row.actual),
    consensus: cleanText(row.consensus ?? row.forecast),
    previous: cleanText(row.previous),
  })).filter((row) => row.event && growthTechMacroRelevant(row)).slice(0, 15);
  return {
    status: "available",
    source: "Nasdaq public economic calendar (unofficial)",
    date,
    asOf: now.toISOString(),
    events,
    empty: events.length === 0,
  };
}

export function normalizeNasdaqEarningsCalendar(body, date, symbols = [], now = new Date()) {
  const rows = Array.isArray(body?.data?.rows) ? body.data.rows : [];
  const wanted = new Set(symbols.map((symbol) => symbol.toUpperCase()));
  const normalized = rows.map((row) => ({
    symbol: cleanText(row.symbol)?.toUpperCase() ?? null,
    name: cleanText(row.name),
    time: cleanText(row.time),
    epsForecast: cleanText(row.epsForecast ?? row.epsEstimate),
    fiscalQuarterEnding: cleanText(row.fiscalQuarterEnding),
    marketCap: cleanText(row.marketCap),
  })).filter((row) => row.symbol);
  const events = [...normalized.filter((row) => wanted.has(row.symbol)), ...normalized.filter((row) => !wanted.has(row.symbol))]
    .filter((row, index, all) => all.findIndex((candidate) => candidate.symbol === row.symbol) === index)
    .slice(0, 25);
  return {
    status: "available",
    source: "Nasdaq public earnings calendar (unofficial)",
    date: body?.data?.asOf ?? date,
    asOf: now.toISOString(),
    events,
    watchlistMatches: events.filter((row) => wanted.has(row.symbol)).map((row) => row.symbol),
    empty: events.length === 0,
  };
}

function unavailableCalendar(source, date, error) {
  return { status: "unavailable", source, date, asOf: null, events: [], reason: errorMessage(error) };
}

function unavailableMarketContext(reason) {
  return Object.fromEntries(Object.keys(MARKET_CONTEXT_GROUPS).map((category) => [category, {
    status: "unavailable", source: "Yahoo Finance chart endpoint (unofficial)", asOf: null, items: [], reason,
  }]));
}

function unavailableCalendars(reason) {
  return {
    macroEvents: unavailableCalendar("Nasdaq public economic calendar (unofficial)", null, reason),
    earnings: unavailableCalendar("Nasdaq public earnings calendar (unofficial)", null, reason),
  };
}

function snapshotDataQuality(snapshot) {
  const categories = {
    futures: snapshot.marketContext?.futures?.status ?? "unavailable",
    rates: snapshot.marketContext?.rates?.status ?? "unavailable",
    usd: snapshot.marketContext?.usd?.status ?? "unavailable",
    oil: snapshot.marketContext?.oil?.status ?? "unavailable",
    macroEvents: snapshot.calendars?.macroEvents?.status ?? "unavailable",
    earnings: snapshot.calendars?.earnings?.status ?? "unavailable",
    discovery: snapshot.discovery?.status ?? "unavailable",
  };
  const available = Object.values(categories).filter((status) => status === "available").length;
  const fundamentalCache = { fresh: 0, refreshed: 0, stale: 0, missing: 0 };
  for (const row of snapshot.watchlist ?? []) {
    const status = row.fundamentals?.cacheStatus;
    if (status && status in fundamentalCache) fundamentalCache[status] += 1;
    else fundamentalCache.missing += 1;
  }
  const discoveryFundamentals = snapshot.discovery?.fundamentalsCoverage ?? { total: 0, available: 0, unavailable: 0, sourceFailures: 0, mappingMissing: 0 };
  const discoveryCoverageStatus = discoveryFundamentals.total === 0 ? "not_applicable"
    : discoveryFundamentals.available === discoveryFundamentals.total ? "complete"
      : discoveryFundamentals.sourceFailures > 0 ? "source_failure"
        : "coverage_gap";
  return { categories, available, total: Object.keys(categories).length, complete: available === Object.keys(categories).length, fundamentalCache, discoveryFundamentals: { ...discoveryFundamentals, status: discoveryCoverageStatus } };
}

function latestTimestamp(values) {
  return values.filter(Boolean).sort().at(-1) ?? null;
}

function cleanText(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
  return text && text !== "--" && text.toLowerCase() !== "n/a" ? text : null;
}

function growthTechMacroRelevant(row) {
  const country = (row.country ?? "").toUpperCase().replace(/[^A-Z]/g, "");
  if (["US", "USA", "UNITEDSTATES"].includes(country)) return true;
  return /fed|fomc|ecb|boj|pboc|inflation|cpi|ppi|payroll|employment|gdp|pmi|interest rate/i.test(row.event)
    && /EU|EURO|CHINA|CN|JAPAN|JP|GLOBAL|WORLD/.test(country);
}

export function marketSession(now = new Date()) {
  const ny = zonedParts(now, "America/New_York");
  const minutes = ny.hour * 60 + ny.minute;
  if (minutes < 4 * 60) return "closed";
  if (minutes < 9 * 60 + 30) return "premarket";
  if (minutes < 16 * 60) return "regular_trading";
  if (minutes < 20 * 60) return "after_hours";
  return "closed";
}

function buildDecisionFramework(rows, aiCycleObservations = []) {
  const sectorScorecard = Object.fromEntries(Object.entries(SECTOR_MEMBERS).map(([sector, symbols]) => {
    const members = rows.filter((row) => symbols.includes(row.symbol));
    return [sector, aggregateDecision(members)];
  }));
  const aiCycle = Object.fromEntries(Object.keys(AI_CYCLE_SEGMENTS).map((segment) => [segment, aggregateAiCycle(segment, aiCycleObservations)]));
  return {
    methodology: "Deterministic rules; the AI explains but must not change supplied ratings or actions.",
    aiCycle,
    sectorScorecard,
  };
}

export async function loadAiCycleObservations(env, now = new Date()) {
  let supplied = null;
  if (env.AI_CYCLE_OBSERVATIONS_JSON) {
    try { supplied = JSON.parse(env.AI_CYCLE_OBSERVATIONS_JSON); } catch { supplied = null; }
  }
  if (!supplied && env.BRIEF_BUCKET?.get) {
    const object = await env.BRIEF_BUCKET.get("ai-cycle/latest.json").catch(() => null);
    if (object) supplied = await object.json().catch(() => null);
  }
  const rows = Array.isArray(supplied) ? supplied : Array.isArray(supplied?.observations) ? supplied.observations : BUILTIN_AI_CYCLE_OBSERVATIONS;
  return normalizeAiCycleObservations(rows, now);
}

export function normalizeAiCycleObservations(rows, now = new Date()) {
  return rows.map((row) => {
    const published = Date.parse(row?.publishedAt);
    const periodEnd = Date.parse(row?.periodEnd);
    const freshnessDays = row?.freshnessDays !== null && row?.freshnessDays !== undefined && Number.isFinite(Number(row.freshnessDays)) ? Number(row.freshnessDays) : 120;
    const ageDays = Number.isFinite(published) ? Math.max(0, (now.getTime() - published) / 86400_000) : null;
    const valid = Object.hasOwn(AI_CYCLE_SEGMENTS, row?.segment)
      && /^[A-Z][A-Z0-9.-]{0,9}$/.test(row?.company ?? "")
      && cleanText(row?.metric) && Number.isFinite(Number(row?.value)) && cleanText(row?.unit)
      && /^\d{4}-\d{2}-\d{2}$/.test(row?.periodEnd ?? "") && Number.isFinite(periodEnd)
      && periodEnd <= published
      && Number.isFinite(published) && published <= now.getTime() + 86400_000 && officialAiCycleUrl(row?.company, row?.sourceUrl)
      && row?.sourceType === "company_earnings_release";
    return valid ? {
      segment: row.segment, company: row.company, metric: cleanText(row.metric), value: Number(row.value), unit: cleanText(row.unit),
      changePercent: row.changePercent !== null && row.changePercent !== undefined && Number.isFinite(Number(row.changePercent)) ? Number(row.changePercent) : null,
      direction: ["positive", "stable", "negative"].includes(row.direction) ? row.direction : null,
      periodEnd: row.periodEnd ?? null, publishedAt: new Date(published).toISOString().slice(0, 10), freshnessDays,
      freshness: ageDays <= freshnessDays ? "available" : "stale", sourceType: row.sourceType, sourceUrl: row.sourceUrl,
    } : null;
  }).filter(Boolean);
}

function officialAiCycleUrl(company, sourceUrl) {
  try {
    const hostname = new URL(sourceUrl).hostname.toLowerCase();
    return (AI_CYCLE_OFFICIAL_HOSTS[company] ?? []).some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

function aggregateAiCycle(segment, observations) {
  const all = observations.filter((row) => row.segment === segment);
  const fresh = all.filter((row) => row.freshness === "available");
  const companies = new Set(fresh.map((row) => row.company));
  const evidence = fresh.map((row) => `${row.company} ${row.metric} ${fmt(row.value)} ${row.unit}${Number.isFinite(row.changePercent) ? ` (${signed(round(row.changePercent))}%)` : ""}; period ended ${row.periodEnd}; published ${row.publishedAt}`).join("; ");
  if (companies.size < 2) return {
    rating: fresh.length ? "Partial Coverage" : "Insufficient Data",
    trend: fresh.length ? aiCycleTrend(fresh) : "Unclear",
    evidence: evidence || "No fresh direct indicators",
    limitation: fresh.length ? `Only ${companies.size} independent company source; two are required for a full rating.` : all.length ? "Direct indicators are stale." : "Direct CapEx, demand, utilization, or adoption indicators are unavailable.",
    coverage: { fresh: fresh.length, stale: all.length - fresh.length, independentCompanies: companies.size },
  };
  return {
    rating: aiCycleRating(fresh), trend: aiCycleTrend(fresh), evidence,
    limitation: "Company definitions differ; indicators are evaluated directionally and are not summed.",
    coverage: { fresh: fresh.length, stale: all.length - fresh.length, independentCompanies: companies.size },
  };
}

function aiCycleDirection(row) {
  if (row.direction === "positive" || row.changePercent >= 15) return 1;
  if (row.direction === "negative" || row.changePercent <= -5) return -1;
  return 0;
}

function aiCycleRating(rows) {
  const score = median(rows.map(aiCycleDirection));
  return score > 0 ? "Positive" : score < 0 ? "Negative" : "Stable";
}

function aiCycleTrend(rows) {
  const score = median(rows.map(aiCycleDirection));
  return score > 0 ? "Accelerating" : score < 0 ? "Deteriorating" : "Stable";
}

function aggregateDecision(rows) {
  if (!rows.length) return { fundamentals: "Unavailable", valuation: "Unavailable", momentum: "Unavailable", stance: "Neutral", symbols: [] };
  const hasDatedFundamentals = (row) => {
    const asOf = row.fundamentalAsOf ?? row.reportedGrowth?.asOf ?? "";
    return /^\d{4}-\d{2}-\d{2}$/.test(asOf) && Number.isFinite(Date.parse(asOf));
  };
  const staleFundamentalRows = rows.filter((row) => row.fundamentalCacheStatus === "stale" && hasDatedFundamentals(row));
  const freshFundamentalRows = rows.filter((row) => ["fresh", "refreshed"].includes(row.fundamentalCacheStatus) && hasDatedFundamentals(row) && Number.isFinite(row.reportedGrowth?.revenueTtmYoY));
  const freshWithoutGrowthRows = rows.filter((row) => ["fresh", "refreshed"].includes(row.fundamentalCacheStatus) && hasDatedFundamentals(row) && !Number.isFinite(row.reportedGrowth?.revenueTtmYoY));
  const knownFundamentalRows = new Set([...staleFundamentalRows, ...freshFundamentalRows, ...freshWithoutGrowthRows]);
  const unknownFundamentalRows = rows.filter((row) => !knownFundamentalRows.has(row));
  const growth = median(freshFundamentalRows.map((row) => row.reportedGrowth.revenueTtmYoY));
  const valuation = median(rows.map((row) => row.valuation?.selectedPercentile).filter(Number.isFinite));
  const momentum = median(rows.map(momentumScore).filter(Number.isFinite));
  const fundamentalsLabel = growth === null
    ? staleFundamentalRows.length ? "Stale" : "Unavailable"
    : growth >= 15 ? "Strong" : growth >= 5 ? "Moderate" : growth >= 0 ? "Stable" : "Weak";
  const valuationLabel = valuation === null ? "Unavailable" : valuation >= 80 ? "High" : valuation <= 30 ? "Low" : "Moderate";
  const momentumLabel = momentum > 0 ? "Positive" : momentum < 0 ? "Negative" : "Mixed";
  return {
    fundamentals: fundamentalsLabel,
    valuation: valuationLabel,
    momentum: momentumLabel,
    stance: sectorStance(fundamentalsLabel, valuationLabel, momentumLabel),
    symbols: rows.map((row) => row.symbol),
    metrics: {
      medianReportedRevenueTtmYoY: growth,
      medianHistoricalValuationPercentile: valuation,
      freshFundamentals: freshFundamentalRows.map(fundamentalEvidence),
      freshFundamentalsWithoutGrowth: freshWithoutGrowthRows.map(fundamentalEvidence),
      staleFundamentals: staleFundamentalRows.map(fundamentalEvidence),
      unknownFundamentals: unknownFundamentalRows.map(fundamentalEvidence),
    },
  };
}

function fundamentalEvidence(row) {
  return {
    symbol: row.symbol,
    asOf: row.fundamentalAsOf ?? row.reportedGrowth?.asOf ?? null,
  };
}

function sectorStance(fundamentals, valuation, momentum) {
  if (fundamentals === "Weak" || (valuation === "High" && momentum === "Negative")) return "Cautious";
  if (fundamentals === "Strong" && valuation !== "High" && momentum === "Positive") return "Favorable";
  return "Neutral";
}

function stockAction(row) {
  const growth = row.reportedGrowth?.revenueTtmYoY;
  const fundamentals = !Number.isFinite(growth) ? "Unavailable" : growth >= 15 ? "Strong" : growth >= 5 ? "Moderate" : growth >= 0 ? "Stable" : "Weak";
  const percentile = row.valuation?.selectedPercentile;
  const valuation = !Number.isFinite(percentile) ? "Unavailable" : percentile >= 80 ? "High" : percentile <= 30 ? "Low" : "Moderate";
  const score = momentumScore(row);
  const momentum = score > 0 ? "Positive" : score < 0 ? "Negative" : "Mixed";
  return decisionAction(fundamentals, valuation, momentum);
}

function decisionAction(fundamentals, valuation, momentum) {
  if (fundamentals === "Weak" && valuation === "High") return "Avoid";
  if (momentum === "Negative") return fundamentals === "Strong" && valuation !== "High" ? "Hold" : "Wait";
  if (fundamentals === "Strong" && valuation !== "High" && momentum === "Positive") return "Buy";
  return "Hold";
}

function momentumScore(row) {
  if (!Number.isFinite(row.changePercent) && !Number.isFinite(row.positionIn52WeekRange)) return null;
  const daily = Number.isFinite(row.changePercent) ? (row.changePercent >= 1 ? 1 : row.changePercent <= -1 ? -1 : 0) : 0;
  const range = Number.isFinite(row.positionIn52WeekRange) ? (row.positionIn52WeekRange >= 70 ? 1 : row.positionIn52WeekRange <= 30 ? -1 : 0) : 0;
  return daily + range;
}

function catalystFor(state) {
  return state?.display ?? "Unavailable — no company-specific catalyst in snapshot";
}

export function catalystStateFor(row, earnings) {
  const allMaterialNews = (row?.news ?? [])
    .filter((item) => item.verified && item.material !== false)
    .sort((a, b) => Date.parse(b.publishedAt ?? 0) - Date.parse(a.publishedAt ?? 0));
  const materialNews = allMaterialNews.filter((item) => item.entityMatch !== "indirect" && item.sourceType !== "company_analysis");
  const analysisNews = allMaterialNews.filter((item) => item.entityMatch !== "indirect" && item.sourceType === "company_analysis");
  const indirectNews = allMaterialNews.filter((item) => item.entityMatch === "indirect" || item.sourceType === "sector_read_through");
  const directionalNews = materialNews.find((item) => catalystDirection(item.title));
  if (directionalNews) {
    const direction = catalystDirection(directionalNews.title);
    return {
      status: direction === "positive" ? "verified_positive" : "verified_negative",
      direction,
      verified: true,
      gateQualified: true,
      sourceType: "company_event",
      evidence: directionalNews,
      display: `Verified ${direction} catalyst — ${directionalNews.title}`,
    };
  }
  if (earnings?.lifecycle?.status === "verified_result" && verifiedEarningsEvidence(earnings.lifecycle.evidence)) {
    const evidence = earnings.lifecycle.evidence;
    const direction = evidence.actual > evidence.consensus ? "positive" : evidence.actual < evidence.consensus ? "negative" : null;
    if (direction) return {
      status: direction === "positive" ? "verified_positive" : "verified_negative",
      direction,
      verified: true,
      gateQualified: true,
      sourceType: "earnings",
      evidence,
      display: `Verified ${direction} earnings catalyst from structured actual-versus-consensus evidence`,
    };
  }
  if (earnings?.lifecycle?.status === "reported_pending_verification") return {
    status: "reported_pending_verification", direction: null, verified: false, gateQualified: false,
    sourceType: "earnings", evidence: earnings.lifecycle.evidence ?? null,
    display: "Earnings reported; result pending verification",
  };
  if (earnings?.lifecycle?.status === "pending_verification") return {
    status: "reported_pending_verification", direction: null, verified: false, gateQualified: false,
    sourceType: "earnings", evidence: null,
    display: "Earnings scheduled window opened; event status pending verification",
  };
  if (earnings) return {
    status: "scheduled", direction: null, verified: false, gateQualified: false,
    sourceType: "earnings", evidence: null,
    display: `Earnings scheduled today${earnings.time ? ` (${earnings.time})` : ""}`,
  };
  if (materialNews.length) return {
    status: "reported_pending_verification", direction: null, verified: false, gateQualified: false,
    sourceType: "company_event", evidence: materialNews[0],
    display: `Material company event pending directional verification — ${materialNews[0].title}`,
  };
  if (analysisNews.length) return {
    status: "unavailable", direction: null, verified: false, gateQualified: false,
    sourceType: "company_analysis", evidence: analysisNews[0],
    display: `Unavailable — company analysis/commentary is not a reportable company event — ${analysisNews[0].title}`,
  };
  if (indirectNews.length) return {
    status: "unavailable", direction: null, verified: false, gateQualified: false,
    sourceType: "sector_read_through", evidence: indirectNews[0],
    display: `Unavailable — indirect sector/competitor read-through is not a company-specific catalyst — ${indirectNews[0].title}`,
  };
  return {
    status: "unavailable", direction: null, verified: false, gateQualified: false,
    sourceType: null, evidence: null,
    display: "Unavailable — no company-specific catalyst in snapshot",
  };
}

function catalystDirection(title = "") {
  if (/\b(?:miss(?:es|ed)?|cuts?|lowers?|reduces?|withdraws?|investigation|lawsuit|probe|ban|recall|downgrade|default|bankrupt|layoffs?|offering)\b/i.test(title)) return "negative";
  if (/\b(?:beats?|raises?|increases?|wins?|awarded?|approval|approved|buyback|record\s+(?:revenue|profit|orders?|backlog)|upgrades?)\b|\b(?:announces?|secures?|signs?)\b.*\b(?:contract|customer|partnership)\b/i.test(title)) return "positive";
  return null;
}

export function earningsLifecycle(event, generatedAt, companyNews = []) {
  if (!event) return null;
  if (event.lifecycle?.status === "verified_result") {
    return verifiedEarningsEvidence(event.lifecycle.evidence)
      ? event.lifecycle
      : { status: "reported_pending_verification", label: "Reported; result pending verification", evidence: event.lifecycle.evidence ?? null };
  }
  if (["reported_pending_verification", "pending_verification", "scheduled"].includes(event.lifecycle?.status)) return event.lifecycle;
  const now = new Date(generatedAt);
  const ny = zonedParts(Number.isNaN(now.getTime()) ? new Date() : now, "America/New_York");
  const eventDate = event.date ?? ny.date;
  const resultNews = companyNews
    .filter((item) => item.symbols?.includes(event.symbol) && item.verified && item.sourceType !== "company_analysis" && isEarningsResultHeadline(item.title)
      && item.publishedAt && zonedParts(new Date(item.publishedAt), "America/New_York").date === eventDate)
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))[0];
  if (resultNews) {
    return {
      status: "reported_pending_verification",
      label: "Reported; result pending verification",
      evidence: { title: resultNews.title, publishedAt: resultNews.publishedAt, source: resultNews.source, url: resultNews.url },
    };
  }
  const time = String(event.time ?? "").toLowerCase();
  const minutes = ny.hour * 60 + ny.minute;
  const expectedWindowOpened = eventDate < ny.date
    || (eventDate === ny.date && (time.includes("pre") ? minutes >= 9 * 60 + 30 : time.includes("after") ? minutes >= 16 * 60 : minutes >= 16 * 60));
  return expectedWindowOpened
    ? { status: "pending_verification", label: "Scheduled window opened; event status pending verification", evidence: null }
    : { status: "scheduled", label: "Scheduled", evidence: null };
}

function isEarningsResultHeadline(title = "") {
  return /\b(?:reports?|announces?|posts?|releases?)\b.*\b(?:earnings|results?|revenue|quarter)\b|\b(?:earnings|quarterly)\s+results?\b/i.test(title);
}

function verifiedEarningsEvidence(evidence) {
  return Number.isFinite(evidence?.actual) && Number.isFinite(evidence?.consensus) && Boolean(evidence?.sourceUrl);
}

function riskFor(row) {
  const risks = [];
  if ((row.valuation?.selectedPercentile ?? 0) >= 80) risks.push("valuation at/above 80th historical percentile");
  if ((row.reportedGrowth?.revenueTtmYoY ?? 0) < 0) risks.push("reported TTM revenue contraction");
  if ((row.positionIn52WeekRange ?? 0) >= 90) risks.push("price near 52-week high");
  if (momentumScore(row) < 0) risks.push("negative rule-based momentum");
  if (row.fundamentalCacheStatus === "stale") risks.push("SEC fundamentals are from an expired cache entry pending refresh");
  return risks.join("; ") || "no quantified risk flag in snapshot";
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : round((sorted[middle - 1] + sorted[middle]) / 2);
}

export function toBrief(snapshot, options = {}) {
  const rows = snapshot.watchlist.map(compactRow);
  const discoveredRows = (snapshot.discovery?.candidates ?? []).map(compactDiscoveryRow);
  const companyNews = snapshot.news?.company?.items ?? [];
  const earningsBySymbol = new Map((snapshot.calendars?.earnings?.events ?? []).map((event) => [event.symbol, {
    ...event,
    date: snapshot.calendars?.earnings?.date ?? snapshot.generatedAt?.slice(0, 10),
    lifecycle: earningsLifecycle(event, snapshot.generatedAt, companyNews),
  }]));
  const calendars = snapshot.calendars ? {
    ...snapshot.calendars,
    earnings: snapshot.calendars.earnings ? { ...snapshot.calendars.earnings, events: [...earningsBySymbol.values()] } : snapshot.calendars.earnings,
  } : snapshot.calendars;
  for (const row of rows) {
    if (row.missing) continue;
    row.news = companyNews.filter((item) => item.symbols?.includes(row.symbol)).slice(0, 3);
    row.catalystState = catalystStateFor(row, earningsBySymbol.get(row.symbol));
    row.catalyst = catalystFor(row.catalystState);
    row.risk = riskFor(row);
    row.strategicAction = stockAction(row);
    row.action = row.strategicAction;
    row.setup = todaySetup(row);
  }
  for (const row of discoveredRows) {
    row.catalystState = catalystStateFor(row, earningsBySymbol.get(row.symbol));
    row.catalyst = catalystFor(row.catalystState);
    row.risk = discoveryRiskFor(row);
    row.strategicAction = "Research pending";
    row.action = "Watch";
    row.setup = todaySetup(row);
    row.setup.reasons.unshift(`discovered by ${row.screen}`);
    row.setup.score = round(row.setup.score + Math.min(10, row.discoveryScore ?? 0) / 2);
  }
  const valid = [...rows, ...discoveredRows].filter((row) => !row.missing);
  const dataQuality = snapshotDataQuality(snapshot);
  const candidates = selectResearchCandidates(rows, discoveredRows, snapshot.eventLedger, MAX_RESEARCH_CANDIDATES, options.previousResearchSymbols);
  const validResearchUniverse = [...rows, ...discoveredRows].filter((row) => !row.missing);
  const targetResearchCount = Math.min(MAX_RESEARCH_CANDIDATES, validResearchUniverse.length);
  if (candidates.length !== targetResearchCount) {
    throw new Error(`Research capacity invariant failed: expected ${targetResearchCount}, selected ${candidates.length}`);
  }
  const brief = {
    schemaVersion: 9,
    generatedAt: snapshot.generatedAt,
    session: snapshot.session,
    coverage: snapshot.coverage,
    dataQuality,
    marketContext: snapshot.marketContext ?? unavailableMarketContext("not in snapshot"),
    calendars: calendars ?? unavailableCalendars("not in snapshot"),
    news: snapshot.news ?? {
      monetaryPolicy: unavailableNews("Federal Reserve monetary policy RSS (official)", "not in snapshot"),
      company: unavailableNews("Yahoo Finance search news (unofficial)", "not in snapshot"),
    },
    decisionFramework: buildDecisionFramework(valid, snapshot.aiCycleObservations ?? []),
    discovery: {
      status: snapshot.discovery?.status ?? "unavailable",
      source: snapshot.discovery?.source ?? "Nasdaq full-market stock screener (unofficial public endpoint)",
      scanned: snapshot.discovery?.scanned ?? 0,
      eligibleAfterLiquidityAndRelevance: snapshot.discovery?.eligibleAfterLiquidityAndRelevance ?? 0,
      filters: snapshot.discovery?.filters ?? null,
      fundamentalsCoverage: snapshot.discovery?.fundamentalsCoverage ?? null,
      candidates: discoveredRows,
    },
    eventLedger: snapshot.eventLedger ?? null,
    opportunityGate: {
      rule: "No actionable trade merely because it ranks highest. Research admission may come from a verified fresh event, same-day earnings, a >=3% dislocation, or an extreme valuation/range risk flag. Buy/Sell still require a verified catalyst; discovery names require explicit liquidity and data-quality review.",
      maximumOpportunities: 8,
      allowedTodayActions: TODAY_ACTIONS,
      defaultVerdict: "No high-conviction trade today",
      candidates,
      researchCapacity: {
        maximum: MAX_RESEARCH_CANDIDATES,
        eligibleUniverse: validResearchUniverse.length,
        target: targetResearchCount,
        filled: candidates.length,
        unfilled: Math.max(0, targetResearchCount - candidates.length),
        excludedCore: rows.filter((row) => row.missing).map((row) => ({ symbol: row.symbol, reason: row.error || "price snapshot unavailable" })),
      },
    },
    watchlist: rows,
  };
  brief.markdown = renderMarkdown(brief);
  return brief;
}

export function selectResearchCandidates(coreRows, discoveryRows, eventLedger, maximum = MAX_RESEARCH_CANDIDATES, previousResearchSymbols = []) {
  const valid = [...coreRows, ...discoveryRows].filter((row) => !row.missing);
  const previousSymbols = new Set(previousResearchSymbols ?? []);
  const admitted = valid.filter((row) => row.setup?.eligible)
    .sort((a, b) => (b.setup?.score ?? 0) - (a.setup?.score ?? 0)
      || Number(previousSymbols.has(b.symbol)) - Number(previousSymbols.has(a.symbol)))
    .slice(0, maximum)
    .map((row) => ({ ...row, admissionType: "setup_gate", setup: { ...row.setup, admissionType: "setup_gate" } }));
  if (admitted.length >= maximum) return admitted;

  const selected = new Set(admitted.map((row) => row.symbol));
  const newEventSymbols = new Set((eventLedger?.events ?? [])
    .filter((event) => event.delta === "new" && event.symbol)
    .map((event) => event.symbol));
  const fillers = coreRows.filter((row) => !row.missing && !selected.has(row.symbol))
    .sort((a, b) => autoWatchlistPriority(b, newEventSymbols, previousSymbols) - autoWatchlistPriority(a, newEventSymbols, previousSymbols))
    .slice(0, maximum - admitted.length)
    .map((row) => ({
      ...row,
      admissionType: "auto_watchlist",
      setup: {
        ...row.setup,
        admissionType: "auto_watchlist",
        autoWatchlist: true,
        reasons: [...(row.setup?.reasons ?? []), "auto-watchlist coverage slot"],
      },
    }));
  return [...admitted, ...fillers];
}

function autoWatchlistPriority(row, newEventSymbols, previousSymbols = new Set()) {
  const newEvent = newEventSymbols.has(row.symbol) ? 100 : 0;
  const continuity = previousSymbols.has(row.symbol) ? 3 : 0;
  const move = Math.min(20, Math.abs(row.changePercent ?? 0) * 4);
  const financialCoverage = row.valuation && row.reportedGrowth ? 6 : row.valuation || row.reportedGrowth ? 3 : 0;
  const rangeExtreme = Number.isFinite(row.positionIn52WeekRange)
    ? Math.abs(row.positionIn52WeekRange - 50) / 25
    : 0;
  const valuationOpportunity = (row.targetAndMispricing?.valuationAdjustment ?? 0) * 2;
  return newEvent + continuity + move + financialCoverage + rangeExtreme + valuationOpportunity;
}

export function compactSnapshotForReport(snapshot, options = {}) {
  const brief = toBrief(snapshot, options);
  return {
    schemaVersion: brief.schemaVersion,
    generatedAt: brief.generatedAt,
    session: brief.session,
    coverage: brief.coverage,
    dataQuality: brief.dataQuality,
    marketContext: brief.marketContext,
    calendars: brief.calendars,
    news: brief.news,
    decisionFramework: brief.decisionFramework,
    opportunityGate: brief.opportunityGate,
    discovery: brief.discovery,
    eventLedger: brief.eventLedger,
    watchlist: brief.watchlist,
  };
}

function compactDiscoveryRow(row) {
  return {
    symbol: row.symbol,
    name: row.name,
    price: row.price,
    changePercent: row.changePercent,
    yearLow: row.yearLow,
    yearHigh: row.yearHigh,
    positionIn52WeekRange: row.positionIn52WeekRange,
    marketCap: row.marketCap,
    dollarVolume: row.dollarVolume,
    relativeVolume: row.relativeVolume,
    sector: row.sector,
    industry: row.industry,
    screen: row.screen,
    discoveryScore: row.discoveryScore,
    sourceType: "discovery",
    valuation: row.valuation ?? null,
    reportedGrowth: row.reportedGrowth ?? null,
    fundamentals: row.fundamentals ?? null,
    targetAndMispricing: unavailableTarget(row, "historical valuation series unavailable for discovery candidate"),
    fundamentalCoverage: row.fundamentalCoverage ?? { status: "unavailable", reason: "discovery enrichment not run" },
    news: row.news ?? [],
    missing: false,
  };
}

function discoveryRiskFor(row) {
  const risks = ["discovery candidate; independent action-gate review required"];
  if (row.fundamentalCoverage?.status !== "available") risks.push(`fundamental coverage ${row.fundamentalCoverage?.status ?? "unavailable"}`);
  if (!row.valuation) risks.push("valuation unavailable");
  if ((row.marketCap ?? Infinity) < 1_000_000_000) risks.push("sub-$1B market capitalization");
  if ((row.dollarVolume ?? Infinity) < 20_000_000) risks.push("limited daily dollar liquidity");
  if (!row.news?.length) risks.push("no fresh verified headline");
  return risks.join("; ");
}

function todaySetup(row) {
  const catalystState = row.catalystState ?? catalystStateFor(row, null);
  const verifiedNews = catalystState.sourceType === "company_event" && catalystState.verified ? [catalystState.evidence] : [];
  const dislocation = Number.isFinite(row.changePercent) && Math.abs(row.changePercent) >= 3;
  const extremeTrim = (row.valuation?.selectedPercentile ?? 0) >= 90 && (row.positionIn52WeekRange ?? 0) >= 90;
  const earningsToday = catalystState.sourceType === "earnings";
  const reasons = [];
  if (verifiedNews.length) reasons.push(`${verifiedNews.length} fresh company headline(s)`);
  if (catalystState.status === "scheduled") reasons.push("earnings scheduled today");
  if (catalystState.status === "reported_pending_verification") reasons.push(catalystState.display);
  if (catalystState.verified) reasons.push(`catalyst verified ${catalystState.direction}`);
  if (dislocation) reasons.push(`${signed(row.changePercent)}% price dislocation`);
  if (extremeTrim) reasons.push("valuation-risk flag: valuation and range position both at/above 90th threshold");
  return {
    eligible: reasons.length > 0,
    score: verifiedNews.length * 3 + (earningsToday ? 3 : 0) + (dislocation ? 2 : 0) + (extremeTrim ? 2 : 0)
      + (row.targetAndMispricing?.valuationAdjustment ?? 0),
    reasons,
    verifiedCatalyst: catalystState.verified,
    catalystState,
    eventStatus: catalystState.status,
    dislocation,
    extremeTrim,
  };
}

export async function generateAiReport(env, snapshot, override = null, options = {}) {
  const route = selectedAiRoute(env, override);
  const { provider, model } = route;
  const previousResearch = await loadPreviousResearch(env);
  const compact = compactSnapshotForReport(snapshot, {
    previousResearchSymbols: (previousResearch?.packets ?? []).map((packet) => packet.symbol),
  });
  compact.reportMode = selectedReportMode(env, options.reportMode);
  compact.engineVersion = SERVICE_VERSION;
  compact.buildRevision = BUILD_REVISION;
  const research = applyThesisMemory(await researchCandidates(env, route, compact, previousResearch), previousResearch);
  const researchConsistency = validateResearchConsistency(research, compact.opportunityGate?.candidates ?? []);
  if (!researchConsistency.ok) throw new Error(`Research funnel consistency failed: ${researchConsistency.errors.join("; ")}`);
  research.storage = await storeResearchPackets(env, compact, research);
  const synthesis = synthesisContext(compact, research);
  const requiredSymbols = research.packets.map((packet) => packet.symbol);
  const reportId = crypto.randomUUID();
  const generatedAt = new Date().toISOString();
  const markdown = renderMorningBrief(synthesis, { reportId, generatedAt });
  const validation = validateReportCompleteness(markdown, requiredSymbols, synthesis);
  const contentHash = await reportFingerprint(markdown);
  const auditMarkdown = renderResearchAudit(synthesis, { reportId, generatedAt, contentHash });
  research.auditStorage = await storeResearchAudit(env, compact, auditMarkdown, { reportId, contentHash });
  const metadata = {
    aiProvider: provider,
    aiModel: model,
    ...(provider === "gemini" ? { geminiModel: model } : {}),
    finishReason: "DETERMINISTIC_RENDER",
    outputCharacters: markdown.length,
    outputTokenCount: null,
    thoughtsTokenCount: null,
    totalTokenCount: null,
    generationAttempts: 0,
    generatedAt,
    validation: validation.ok ? "passed" : "failed",
    validationErrors: validation.errors.join("; "),
    pipeline: "staged-research-deterministic-render-v2-thesis-memory",
    researchBatches: research.batches.length,
    researchComplete: research.funnel.researched,
    researchIncomplete: research.funnel.incomplete,
    researchPacketStorage: research.storage?.stored === true ? "stored" : research.storage?.reason ?? "failed",
    researchAuditStorage: research.auditStorage?.stored === true ? "stored" : research.auditStorage?.reason ?? "failed",
    reportMode: synthesis.reportMode,
    engineVersion: SERVICE_VERSION,
    buildRevision: BUILD_REVISION,
    reportId,
    contentHash,
  };
  if (!validation.ok) {
    const error = new Error(`Deterministic report validation failed: ${validation.errors.join("; ")}`);
    error.reportMetadata = metadata;
    throw error;
  }
  return { markdown, auditMarkdown, provider, model, reportMode: synthesis.reportMode, research, metadata };
}

async function researchCandidates(env, route, compact, previousResearch = null) {
  const candidates = (compact.opportunityGate?.candidates ?? []).slice(0, MAX_RESEARCH_CANDIDATES);
  const batchSize = Math.max(1, Math.min(5, Math.round(nonNegativeNumber(env.RESEARCH_BATCH_SIZE, DEFAULT_RESEARCH_BATCH_SIZE)) || DEFAULT_RESEARCH_BATCH_SIZE));
  const batches = [];
  for (let index = 0; index < candidates.length; index += batchSize) batches.push(candidates.slice(index, index + batchSize));
  const previousBySymbol = new Map((previousResearch?.packets ?? []).map((packet) => [packet.symbol, packet]));
  for (const [symbol, entry] of Object.entries(previousResearch?.thesisMemory?.activeQualifiedTheses ?? {})) {
    const packet = activeThesisPacket(entry);
    if (packet) previousBySymbol.set(symbol, { ...packet, memoryType: "active_qualified_thesis" });
  }
  const results = await Promise.all(batches.map((batch, index) => researchCandidateBatch(
    env, route, compact, batch, index + 1, batch.map((candidate) => previousBySymbol.get(candidate.symbol)).filter(Boolean),
  )));
  const packets = results.flatMap((result) => result.packets);
  return {
    schemaVersion: "candidate-research-v2",
    generatedAt: new Date().toISOString(),
    provider: route.provider,
    model: route.model,
    batchSize,
    batches: results.map(({ packets: ignored, ...result }) => result),
    funnel: {
      screened: compact.discovery?.scanned ?? null,
      admitted: candidates.length,
      researched: packets.filter((packet) => packet.status === "complete").length,
      incomplete: packets.filter((packet) => packet.status !== "complete").length,
      gateQualified: packets.filter((packet) => packet.modelGateResult === "pass").length,
      recommendedActions: packets.filter((packet) => packet.gateResult === "pass").length,
      rejectedOrWatch: packets.filter((packet) => packet.gateResult !== "pass").length,
    },
    packets,
  };
}

export function validateResearchConsistency(research, candidates) {
  const errors = [];
  const tradeActions = new Set(["Buy now", "Buy on weakness", "Sell"]);
  const expected = candidates.slice(0, MAX_RESEARCH_CANDIDATES).map((row) => row.symbol);
  const actual = research.packets.map((packet) => packet.symbol);
  if (new Set(actual).size !== actual.length) errors.push("duplicate research packet symbol");
  for (const symbol of expected) if (!actual.includes(symbol)) errors.push(`missing research packet: ${symbol}`);
  for (const symbol of actual) if (!expected.includes(symbol)) errors.push(`research packet outside admitted universe: ${symbol}`);
  if (research.funnel.admitted !== actual.length) errors.push(`admitted ${research.funnel.admitted} != packets ${actual.length}`);
  if (research.funnel.researched + research.funnel.incomplete !== research.funnel.admitted) errors.push("researched + incomplete != admitted");
  if (research.funnel.recommendedActions + research.funnel.rejectedOrWatch !== research.funnel.admitted) errors.push("recommendedActions + rejectedOrWatch != admitted");
  if (research.funnel.gateQualified < research.funnel.recommendedActions) errors.push("gateQualified cannot be lower than recommendedActions");
  const recommendedPackets = research.packets.filter((packet) => packet.gateResult === "pass" && tradeActions.has(packet.finalAction ?? packet.todayAction));
  if (recommendedPackets.length !== research.funnel.recommendedActions) errors.push("recommendedActions does not match gate-approved final actions");
  for (const packet of research.packets) {
    if (packet.gateResult !== "pass" && tradeActions.has(packet.finalAction ?? packet.todayAction)) {
      errors.push(`trade finalAction requires a passed deterministic gate: ${packet.symbol}`);
    }
  }
  return { ok: errors.length === 0, errors };
}

async function researchCandidateBatch(env, route, compact, candidates, batchNumber, previousPackets = []) {
  const originalSymbols = candidates.map((row) => row.symbol);
  const packetBySymbol = new Map();
  const failuresBySymbol = new Map(candidates.map((candidate) => [candidate.symbol, []]));
  let pending = [...candidates];
  let attempts = 0;
  for (let attempt = 1; attempt <= MAX_AI_ATTEMPTS && pending.length; attempt += 1) {
    attempts = attempt;
    const validationErrors = uniqueMessages(pending.flatMap((candidate) => failuresBySymbol.get(candidate.symbol) ?? []));
    const prompt = candidateResearchPrompt(compact, pending, {
      batchNumber,
      retry: attempt > 1,
      validationErrors: validationErrors.join("; "),
      previousPackets: previousPackets.filter((packet) => pending.some((candidate) => candidate.symbol === packet.symbol)),
    });
    const response = await requestAiReport(env, route, prompt, {
      maxTokens: positiveInteger(env.RESEARCH_MAX_TOKENS, DEFAULT_RESEARCH_MAX_TOKENS),
    });
    const extracted = extractAiReport(response.body, route, env);
    if (!response.ok || extracted.finishReason !== "STOP" || !extracted.markdown) {
      const failure = aiFailureDiagnostic(response.status, route, extracted, env);
      for (const candidate of pending) appendUnique(failuresBySymbol.get(candidate.symbol), failure);
      continue;
    }
    const parsed = parseJsonObject(extracted.markdown);
    if (!parsed || !Array.isArray(parsed.candidates)) {
      for (const candidate of pending) appendUnique(failuresBySymbol.get(candidate.symbol), "response must contain candidates array");
      continue;
    }
    const rowsBySymbol = new Map();
    for (const row of parsed.candidates) {
      if (!rowsBySymbol.has(row?.symbol)) rowsBySymbol.set(row?.symbol, []);
      rowsBySymbol.get(row?.symbol).push(row);
    }
    const nextPending = [];
    for (const candidate of pending) {
      const rows = rowsBySymbol.get(candidate.symbol) ?? [];
      const errors = rows.length === 0
        ? [`missing candidate: ${candidate.symbol}`]
        : rows.length > 1
          ? [`duplicate candidate: ${candidate.symbol}`]
          : validateResearchPacket(rows[0], candidate).errors;
      if (errors.length) {
        for (const error of errors) appendUnique(failuresBySymbol.get(candidate.symbol), error);
        nextPending.push(candidate);
      } else {
        packetBySymbol.set(candidate.symbol, normalizeResearchPacket(rows[0], candidate));
      }
    }
    pending = nextPending;
  }
  const failures = uniqueMessages([...failuresBySymbol.values()].flat());
  const completeCount = packetBySymbol.size;
  return {
    batchNumber,
    symbols: originalSymbols,
    attempts,
    status: completeCount === candidates.length ? "complete" : completeCount > 0 ? "partial" : "incomplete",
    failures,
    packets: candidates.map((candidate) => packetBySymbol.get(candidate.symbol)
      ?? incompleteResearchPacket(candidate, uniqueMessages(failuresBySymbol.get(candidate.symbol)).join("; ") || "unknown research failure")),
  };
}

function appendUnique(values, value) {
  if (value && !values.includes(value)) values.push(value);
}

function uniqueMessages(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function previousThesisPromptPacket(packet) {
  return {
    symbol: packet.symbol,
    status: packet.status,
    strategicPosition: packet.strategicPosition,
    finalAction: packet.finalAction ?? packet.todayAction,
    reratingPath: packet.reratingPath,
    reratingHorizon: packet.reratingHorizon,
    invalidation: packet.invalidation,
    gateResult: packet.gateResult,
    targetConfidence: packet.sourceSnapshot?.targetAndMispricing?.confidence,
    targetInputAsOf: packet.sourceSnapshot?.targetAndMispricing?.inputAsOf,
    catalystState: packet.sourceSnapshot?.setup?.catalystState,
  };
}

async function loadPreviousResearch(env) {
  if (!env.BRIEF_BUCKET?.get) return null;
  try {
    const object = await env.BRIEF_BUCKET.get("research/latest.json");
    if (!object) return null;
    const parsed = typeof object.json === "function" ? await object.json() : JSON.parse(await object.text());
    return Array.isArray(parsed?.packets) ? parsed : null;
  } catch {
    return null;
  }
}

export function applyThesisMemory(research, previousResearch) {
  const previousBySymbol = new Map((previousResearch?.packets ?? []).map((packet) => [packet.symbol, packet]));
  const priorActive = previousResearch?.thesisMemory?.activeQualifiedTheses ?? {};
  const activeBySymbol = new Map(Object.entries(priorActive).map(([symbol, entry]) => [symbol, activeThesisPacket(entry)]));
  for (const packet of previousResearch?.packets ?? []) {
    if (!activeBySymbol.has(packet.symbol) && isQualifiedTradePacket(packet)) activeBySymbol.set(packet.symbol, packet);
  }
  const packets = research.packets.map((current) => stabilizeResearchPacket(
    current,
    activeBySymbol.get(current.symbol) ?? previousBySymbol.get(current.symbol),
    research.generatedAt,
    activeThesisGeneratedAt(priorActive[current.symbol]) ?? previousResearch?.generatedAt,
  ));
  const activeQualifiedTheses = { ...priorActive };
  for (const packet of packets) {
    if (isQualifiedTradePacket(packet)) {
      activeQualifiedTheses[packet.symbol] = {
        generatedAt: research.generatedAt,
        packet: activeThesisSnapshot(packet),
      };
    } else if (activeBySymbol.has(packet.symbol)) {
      delete activeQualifiedTheses[packet.symbol];
    }
  }
  const researched = packets.filter((packet) => packet.status === "complete").length;
  const incomplete = packets.length - researched;
  const gateQualified = packets.filter((packet) => packet.modelGateResult === "pass").length;
  const recommendedActions = packets.filter((packet) => packet.gateResult === "pass" && ["Buy now", "Buy on weakness", "Sell"].includes(packet.finalAction)).length;
  return {
    ...research,
    thesisMemory: {
      status: previousResearch ? "available" : "unavailable",
      previousGeneratedAt: previousResearch?.generatedAt ?? null,
      stabilized: packets.filter((packet) => packet.actionMemory?.status === "model_only_change_blocked").length,
      latestObservationCount: packets.length,
      activeQualifiedCount: Object.keys(activeQualifiedTheses).length,
      activeQualifiedTheses,
    },
    funnel: {
      ...research.funnel,
      researched,
      incomplete,
      gateQualified,
      recommendedActions,
      rejectedOrWatch: packets.length - recommendedActions,
    },
    packets,
  };
}

function activeThesisPacket(entry) {
  return entry?.packet ?? entry ?? null;
}

function activeThesisGeneratedAt(entry) {
  return entry?.generatedAt ?? null;
}

function isQualifiedTradePacket(packet) {
  return packet?.status === "complete" && packet?.gateResult === "pass"
    && ["Buy now", "Buy on weakness", "Sell"].includes(packet.finalAction ?? packet.todayAction);
}

function activeThesisSnapshot(packet) {
  const { actionMemory: ignoredActionMemory, ...snapshot } = packet;
  return snapshot;
}

function stabilizeResearchPacket(current, previous, currentGeneratedAt, previousGeneratedAt) {
  const currentAction = current.finalAction ?? current.todayAction ?? "No action";
  if (current.status !== "complete" || previous?.status !== "complete") {
    return { ...current, actionMemory: initialActionMemory(currentAction, previous, previousGeneratedAt) };
  }
  const previousAction = previous.finalAction ?? previous.todayAction ?? "No action";
  const changes = materialThesisChanges(previous, current);
  if (reratingWindowExpired(previous, previousGeneratedAt, currentGeneratedAt)) changes.push("previous rerating window expired");
  const priceChanges = priceEligibilityChanges(previous, current);
  const baseMemory = {
    previousGeneratedAt: previousGeneratedAt ?? null,
    previousAction,
    modelAction: currentAction,
    finalAction: currentAction,
    materialChanges: changes,
    priceEligibilityChanges: priceChanges,
  };
  if (currentAction === previousAction) {
    return { ...current, actionMemory: { ...baseMemory, status: "unchanged", reason: "Action unchanged from the previous comparable research packet." } };
  }
  if (isBuyAction(currentAction) && isBuyAction(previousAction)) {
    return { ...current, actionMemory: { ...baseMemory, status: "price_location_change", reason: priceChanges.join("; ") || "Executable price location changed within an unchanged Buy thesis." } };
  }
  const buyWatchTransition = (isBuyAction(previousAction) && isWatchAction(currentAction))
    || (isWatchAction(previousAction) && isBuyAction(currentAction));
  if (!buyWatchTransition || changes.length || priceChanges.length) {
    const reason = [...changes, ...priceChanges].join("; ") || "Action changed outside the Buy/Watch stability rule.";
    return { ...current, actionMemory: { ...baseMemory, status: "evidence_change", reason } };
  }
  if (isBuyAction(previousAction)) {
    const remembered = normalizeResearchPacket({
      ...previous,
      gateResult: previous.modelGateResult ?? previous.gateResult,
      todayAction: previousAction,
    }, current.sourceSnapshot);
    if (remembered.gateResult === "pass" && isBuyAction(remembered.finalAction)) {
      const reason = "Model-only downgrade blocked because no new company event, filing, target-input, risk, or price-eligibility evidence was supplied.";
      const actionMemory = {
        ...baseMemory,
        status: "model_only_change_blocked",
        finalAction: remembered.finalAction,
        reason,
        modelObservation: modelObservation(current),
      };
      return {
        ...remembered,
        actionMemory,
        gateAudit: { ...remembered.gateAudit, actionStability: "blocked", actionStabilityReason: reason },
      };
    }
    return {
      ...current,
      actionMemory: {
        ...baseMemory,
        status: "deterministic_gate_change",
        reason: "Previous Buy thesis no longer clears the current deterministic valuation or evidence gate.",
      },
    };
  }
  const reason = "Model-only upgrade blocked because no new company event, filing, target-input, risk, or price-eligibility evidence was supplied.";
  const gateAudit = {
    ...current.gateAudit,
    result: "fail",
    finalAction: "Watch",
    actionStability: "blocked",
    actionStabilityReason: reason,
  };
  return {
    ...current,
    gateResult: "fail",
    todayAction: "Watch",
    finalAction: "Watch",
    gateAudit,
    gateReason: structuredGateReason(gateAudit),
    actionMemory: { ...baseMemory, status: "model_only_change_blocked", finalAction: "Watch", reason, modelObservation: modelObservation(current) },
  };
}

function initialActionMemory(currentAction, previous, previousGeneratedAt) {
  return {
    previousGeneratedAt: previousGeneratedAt ?? null,
    previousAction: previous ? previous.finalAction ?? previous.todayAction ?? "No action" : "Unavailable",
    modelAction: currentAction,
    finalAction: currentAction,
    materialChanges: [],
    priceEligibilityChanges: [],
    status: previous ? "not_comparable" : "initial",
    reason: previous ? "Previous research packet was incomplete and is not comparable." : "No previous comparable research packet.",
  };
}

function modelObservation(packet) {
  return {
    strategicPosition: packet.strategicPosition,
    modelGateResult: packet.modelGateResult,
    gateResult: packet.gateResult,
    finalAction: packet.finalAction ?? packet.todayAction,
    reratingPath: packet.reratingPath,
    reratingHorizon: packet.reratingHorizon,
    evidenceAgainstCount: packet.evidenceAgainst?.length ?? 0,
    missingEvidenceCount: packet.missingEvidence?.length ?? 0,
  };
}

function isBuyAction(action) {
  return ["Buy now", "Buy on weakness"].includes(action);
}

function isWatchAction(action) {
  return ["Watch", "No action"].includes(action);
}

function materialThesisChanges(previous, current) {
  const changes = [];
  const prior = previous.sourceSnapshot ?? {};
  const next = current.sourceSnapshot ?? {};
  const priorCatalyst = prior.setup?.catalystState ?? legacyCatalystState(prior.setup);
  const nextCatalyst = next.setup?.catalystState ?? legacyCatalystState(next.setup);
  if (JSON.stringify(catalystSignature(priorCatalyst)) !== JSON.stringify(catalystSignature(nextCatalyst))) changes.push("company-event or catalyst state changed");
  const priorAsOf = fundamentalAsOf(prior);
  const nextAsOf = fundamentalAsOf(next);
  if (priorAsOf !== nextAsOf && (priorAsOf || nextAsOf)) changes.push(`fundamental period changed (${priorAsOf ?? "unavailable"} → ${nextAsOf ?? "unavailable"})`);
  if (JSON.stringify(growthSignature(prior.reportedGrowth)) !== JSON.stringify(growthSignature(next.reportedGrowth))) changes.push("reported growth inputs changed");
  const priorTarget = prior.targetAndMispricing ?? {};
  const nextTarget = next.targetAndMispricing ?? {};
  if (priorTarget.status !== nextTarget.status) changes.push(`target availability changed (${priorTarget.status ?? "unavailable"} → ${nextTarget.status ?? "unavailable"})`);
  if (priorTarget.confidence !== nextTarget.confidence) changes.push(`target confidence changed (${priorTarget.confidence ?? "Unavailable"} → ${nextTarget.confidence ?? "Unavailable"})`);
  if (priorTarget.inputAsOf !== nextTarget.inputAsOf && (priorTarget.inputAsOf || nextTarget.inputAsOf)) changes.push("target input period changed");
  if (["bearValue", "baseValue", "bullValue"].some((field) => materiallyDifferent(priorTarget[field], nextTarget[field], 0.05))) changes.push("modeled valuation range changed by at least 5%");
  const priorRisk = stableRisk(prior.risk);
  const nextRisk = stableRisk(next.risk);
  if (priorRisk !== nextRisk && (priorRisk || nextRisk)) changes.push("non-momentum risk flags changed");
  return uniqueMessages(changes);
}

function priceEligibilityChanges(previous, current) {
  const changes = [];
  const prior = previous.sourceSnapshot ?? {};
  const next = current.sourceSnapshot ?? {};
  const priorTarget = prior.targetAndMispricing;
  const nextTarget = next.targetAndMispricing;
  if (upsideTier(priorTarget?.baseUpsidePercent) !== upsideTier(nextTarget?.baseUpsidePercent)) changes.push("base-upside eligibility tier changed");
  const priorInZone = inSuggestedZone(prior.price, priorTarget?.buyZones);
  const nextInZone = inSuggestedZone(next.price, nextTarget?.buyZones);
  if (priorInZone !== null && nextInZone !== null && priorInZone !== nextInZone) changes.push(nextInZone ? "price entered the suggested buy zone" : "price moved above the suggested buy zone");
  return changes;
}

function catalystSignature(state = {}) {
  return { status: state.status ?? null, direction: state.direction ?? null, verified: state.verified === true, evidence: state.evidence?.id ?? state.evidence?.url ?? state.evidence?.title ?? null };
}

function fundamentalAsOf(snapshot) {
  return snapshot.reportedGrowth?.asOf ?? snapshot.valuation?.fundamentalAsOf ?? snapshot.fundamentals?.asOf ?? null;
}

function growthSignature(growth = {}) {
  return Object.fromEntries(["revenueTtmYoY", "revenueLatestQuarterYoY", "epsTtmYoY", "epsLatestQuarterYoY"].map((field) => [field, growth?.[field] ?? null]));
}

function materiallyDifferent(left, right, threshold) {
  if (!Number.isFinite(left) || !Number.isFinite(right)) return Number.isFinite(left) !== Number.isFinite(right);
  return Math.abs(left - right) / Math.max(Math.abs(left), 1) >= threshold;
}

function stableRisk(value) {
  return String(value ?? "").split(";").map((part) => part.trim()).filter((part) => part && !/momentum/i.test(part)).sort().join("; ");
}

function upsideTier(value) {
  if (!Number.isFinite(value)) return "unavailable";
  if (value >= 30) return "30+";
  if (value >= 20) return "20-30";
  if (value >= 10) return "10-20";
  if (value >= 5) return "5-10";
  return "below-5";
}

function inSuggestedZone(price, zones) {
  return Number.isFinite(price) && zones?.status === "available" && Number.isFinite(zones.suggested?.high) ? price <= zones.suggested.high : null;
}

function reratingWindowExpired(packet, previousGeneratedAt, currentGeneratedAt) {
  const maximumDays = packet.reratingHorizon === "1Q" ? 100 : packet.reratingHorizon === "2Q" ? 190 : null;
  const previous = new Date(previousGeneratedAt ?? NaN).getTime();
  const current = new Date(currentGeneratedAt ?? NaN).getTime();
  return Number.isFinite(maximumDays) && Number.isFinite(previous) && Number.isFinite(current)
    && current - previous > maximumDays * 86_400_000;
}

function candidateResearchPrompt(compact, candidates, options = {}) {
  const candidateSymbols = new Set(candidates.map((candidate) => candidate.symbol));
  const earnings = compact.calendars?.earnings;
  const companyNews = compact.news?.company;
  return [
    "Research this bounded Growth-Tech candidate batch. Return JSON only, without Markdown fences.",
    "Use only the supplied evidence. Do not infer that a headline caused a move unless the linkage is direct.",
    "Treat sourceType literally: company_event may enter the catalyst lifecycle; company_analysis and sector_read_through are context only and can never verify a catalyst, clear the action gate, or be described as a Key Reported Event.",
    "Treat earnings lifecycle fields literally. Scheduled and pending-verification events are not reported results; never describe them as a beat, miss, result, or verified catalyst. A reported_pending_verification event confirms only that a report exists, not its direction or magnitude.",
    `Analyze only these batch symbols: ${[...candidateSymbols].join(", ")}. Do not place any other equity ticker in candidate fields; non-candidate market facts are context only.`,
    "Discovery names cannot pass the action gate when valuation, fundamentals, liquidity context, or a directionally verified fresh company catalyst is missing.",
    "Price movement alone may support Watch, never Buy/Sell. A core name without same-day news may support a value call only when the supplied target engine has Medium/High confidence, at least 20% base upside, complete financial evidence, and you state a testable rerating path within 1Q or 2Q. Discovery names still require a directionally verified fresh catalyst.",
    "A testable rerating path must name an operating metric and an observable direction, threshold, or result within the stated horizon. Generic statements such as a fresh earnings report, contract announcement, catalyst, or move toward base value could trigger rerating do not qualify.",
    "Previous research is thesis memory, not new evidence. If strategicPosition, todayAction, or gateResult changes, the change must be supported by new supplied company-event, filing, target-input, risk, or executable price-location evidence; different wording alone is not evidence.",
    "Use the supplied deterministic trailing-implied target values exactly. They are not analyst targets. The valuation adjustment may affect ranking and action preference but cannot bypass financial, risk, liquidity, catalyst, or rerating-path gates.",
    "Without supplied portfolio holdings and target weights, extremeTrim is a valuation-risk flag only: use Watch, never Review position size or Trim.",
    "Return {\"candidates\":[...]} with exactly one object per supplied symbol and these fields:",
    "symbol, catalystSummary, evidenceFor (array), evidenceAgainst (array), mispricingThesis, strategicPosition (Buy/Hold/Avoid), todayAction (Buy now/Buy on weakness/Sell/Review position size/Watch/No action), confidence (High/Medium/Low), entryExitCondition, riskReward, invalidation, reratingPath, reratingHorizon (1Q/2Q/Unavailable), missingEvidence (array), sourceQuality, gateResult (pass/fail), gateReason.",
    "Do not invent target, support, resistance, stop, or entry prices. A dollar-denominated price may appear in entryExitCondition, invalidation, riskReward, or mispricingThesis only when it exactly matches a supplied current, 52-week, bear/base/bull, valuation-threshold, suggested-zone, or stronger-zone price.",
    options.retry ? `Repair the previous failure exactly: ${options.validationErrors}` : "",
    options.previousPackets?.length ? "Previous research memory:" : "",
    options.previousPackets?.length ? JSON.stringify(options.previousPackets.map(previousThesisPromptPacket)) : "",
    `Batch: ${options.batchNumber}`,
    "Market context:",
    JSON.stringify({
      session: compact.session,
      marketContext: compact.marketContext,
      calendars: compact.calendars ? {
        ...compact.calendars,
        earnings: earnings ? {
          ...earnings,
          events: (earnings.events ?? []).filter((event) => candidateSymbols.has(event.symbol)),
          watchlistMatches: (earnings.watchlistMatches ?? []).filter((symbol) => candidateSymbols.has(symbol)),
        } : earnings,
      } : compact.calendars,
      materialNews: compact.news ? {
        ...compact.news,
        company: companyNews ? {
          ...companyNews,
          items: (companyNews.items ?? []).filter((item) => (item.symbols ?? []).some((symbol) => candidateSymbols.has(symbol))),
        } : companyNews,
      } : compact.news,
    }),
    "Candidates:",
    JSON.stringify(candidates),
  ].filter(Boolean).join("\n");
}

export function validateResearchBatch(parsed, candidates) {
  const errors = [];
  if (!parsed || !Array.isArray(parsed.candidates)) return { ok: false, errors: ["response must contain candidates array"] };
  const expected = candidates.map((row) => row.symbol);
  const actual = parsed.candidates.map((row) => row?.symbol);
  for (const symbol of expected) if (!actual.includes(symbol)) errors.push(`missing candidate: ${symbol}`);
  for (const symbol of actual) if (!expected.includes(symbol)) errors.push(`unexpected candidate: ${symbol}`);
  if (actual.length !== expected.length) errors.push(`expected ${expected.length} candidate objects, received ${actual.length}`);
  for (const symbol of expected) {
    const rows = parsed.candidates.filter((row) => row?.symbol === symbol);
    if (rows.length > 1) errors.push(`duplicate candidate: ${symbol}`);
    if (rows.length === 1) errors.push(...validateResearchPacket(rows[0], candidates.find((candidate) => candidate.symbol === symbol)).errors);
  }
  return { ok: errors.length === 0, errors: uniqueMessages(errors) };
}

export function validateResearchPacket(row, candidate) {
  const errors = [];
  const requiredStrings = ["catalystSummary", "mispricingThesis", "strategicPosition", "todayAction", "confidence", "entryExitCondition", "riskReward", "invalidation", "reratingPath", "reratingHorizon", "sourceQuality", "gateResult", "gateReason"];
  if (!row || row.symbol !== candidate?.symbol) errors.push(`${candidate?.symbol ?? "unknown"} invalid symbol`);
  for (const field of requiredStrings) if (typeof row?.[field] !== "string" || !row[field].trim()) errors.push(`${row?.symbol ?? candidate?.symbol ?? "unknown"} missing ${field}`);
  for (const field of ["evidenceFor", "evidenceAgainst", "missingEvidence"]) if (!Array.isArray(row?.[field])) errors.push(`${row?.symbol ?? candidate?.symbol ?? "unknown"} ${field} must be an array`);
  if (!["Buy", "Hold", "Avoid"].includes(row?.strategicPosition)) errors.push(`${row?.symbol ?? "unknown"} invalid strategicPosition`);
  if (!TODAY_ACTIONS.includes(row?.todayAction)) errors.push(`${row?.symbol ?? "unknown"} invalid todayAction`);
  if (!["High", "Medium", "Low"].includes(row?.confidence)) errors.push(`${row?.symbol ?? "unknown"} invalid confidence`);
  if (!["1Q", "2Q", "Unavailable"].includes(row?.reratingHorizon)) errors.push(`${row?.symbol ?? "unknown"} invalid reratingHorizon`);
  if (["1Q", "2Q"].includes(row?.reratingHorizon) && !isTestableReratingPath(row?.reratingPath)) errors.push(`${row?.symbol ?? "unknown"} reratingPath is not testable within the stated horizon`);
  if (!["pass", "fail"].includes(row?.gateResult)) errors.push(`${row?.symbol ?? "unknown"} invalid gateResult`);
  validatePacketPriceLevels(row, candidate, errors);
  return { ok: errors.length === 0, errors: uniqueMessages(errors) };
}

export function normalizeResearchPacket(packet, candidate) {
  const catalystState = candidate?.setup?.catalystState ?? legacyCatalystState(candidate?.setup);
  const discoveryBlocked = candidate?.sourceType === "discovery"
    && (!discoveryFinancialsComplete(candidate) || !catalystState.verified);
  const target = candidate?.targetAndMispricing;
  const targetUsable = target?.status === "available" && ["High", "Medium"].includes(target.confidence);
  const baseUpside = target?.baseUpsidePercent;
  const financialEvidenceComplete = Boolean(candidate?.valuation && candidate?.reportedGrowth);
  const reratingEligible = candidate?.sourceType !== "discovery"
    && targetUsable && Number.isFinite(baseUpside) && baseUpside >= 20
    && financialEvidenceComplete && ["1Q", "2Q"].includes(packet.reratingHorizon)
    && isTestableReratingPath(packet.reratingPath);
  let valuationAdjustedAction = packet.todayAction;
  if (packet.todayAction === "Buy now" && (!targetUsable || !Number.isFinite(baseUpside) || baseUpside < 10)) {
    valuationAdjustedAction = targetUsable && baseUpside >= 5 ? "Buy on weakness" : "Watch";
  }
  if (packet.todayAction === "Buy on weakness" && (!targetUsable || !Number.isFinite(baseUpside) || baseUpside < 5)) valuationAdjustedAction = "Watch";
  const buyZones = target?.buyZones;
  if (["Buy now", "Buy on weakness"].includes(valuationAdjustedAction) && buyZones?.status === "available") {
    valuationAdjustedAction = candidate.price <= buyZones.suggested.high ? "Buy now" : "Buy on weakness";
  } else if (["Buy now", "Buy on weakness"].includes(valuationAdjustedAction) && buyZones?.status === "unavailable") {
    valuationAdjustedAction = "Watch";
  }
  const recommendedAction = ["Buy now", "Buy on weakness", "Sell"].includes(valuationAdjustedAction)
    ? (valuationAdjustedAction === "Sell" ? catalystState.direction === "negative" : catalystState.direction === "positive" || reratingEligible)
    : false;
  const strategicPositionAligned = valuationAdjustedAction === "Sell"
    ? packet.strategicPosition === "Avoid"
    : ["Buy now", "Buy on weakness"].includes(valuationAdjustedAction)
      ? packet.strategicPosition === "Buy"
      : true;
  const gateResult = packet.gateResult === "pass" && recommendedAction && strategicPositionAligned && !discoveryBlocked ? "pass" : "fail";
  const portfolioInput = candidate?.portfolio?.holding === true && Number.isFinite(candidate?.portfolio?.targetWeight);
  const portfolioReview = ["Trim", "Review position size"].includes(packet.todayAction) && candidate?.setup?.extremeTrim && portfolioInput;
  const unsupportedPortfolioAction = ["Trim", "Review position size"].includes(valuationAdjustedAction) && !portfolioInput;
  const finalAction = gateResult === "pass"
    ? valuationAdjustedAction
    : portfolioReview
      ? "Review position size"
      : unsupportedPortfolioAction
        ? "Watch"
        : (["Review position size", "Watch", "No action"].includes(valuationAdjustedAction) ? valuationAdjustedAction : "Watch");
  const gateAudit = {
    result: gateResult,
    researchAssessment: packet.gateResult,
    strategicPosition: packet.strategicPosition,
    targetConfidence: target?.status === "available" ? (target.confidence ?? "Unavailable") : "Unavailable",
    catalystStatus: catalystState.status,
    catalystDirection: catalystState.direction,
    freshCatalyst: catalystState.verified,
    reratingPath: reratingEligible ? packet.reratingHorizon : "Unavailable",
    reratingPathDetail: reratingEligible ? packet.reratingPath : "Unavailable",
    evidenceAgainstCount: packet.evidenceAgainst?.length ?? 0,
    missingEvidenceCount: packet.missingEvidence?.length ?? 0,
    strategicPositionAligned,
    finalAction,
  };
  return {
    ...packet,
    status: "complete",
    modelGateResult: packet.gateResult,
    gateResult,
    todayAction: finalAction,
    finalAction,
    modelGateReason: packet.gateReason,
    gateAudit,
    gateReason: structuredGateReason(gateAudit, { discoveryBlocked, unsupportedPortfolioAction }),
    modelInvalidation: packet.invalidation,
    invalidation: deterministicInvalidation(candidate, reratingEligible ? packet.reratingHorizon : null, gateResult),
    sourceSnapshot: {
      symbol: candidate.symbol,
      sourceType: candidate.sourceType,
      admissionType: candidate.admissionType ?? candidate.setup?.admissionType ?? "setup_gate",
      price: candidate.price,
      changePercent: candidate.changePercent,
      positionIn52WeekRange: candidate.positionIn52WeekRange,
      marketCap: candidate.marketCap,
      dollarVolume: candidate.dollarVolume,
      relativeVolume: candidate.relativeVolume,
      valuation: candidate.valuation,
      targetAndMispricing: candidate.targetAndMispricing,
      reportedGrowth: candidate.reportedGrowth,
    fundamentals: candidate.fundamentals,
    fundamentalCoverage: candidate.fundamentalCoverage,
      fundamentalCacheStatus: candidate.fundamentalCacheStatus,
      setup: candidate.setup,
      news: candidate.news,
      risk: candidate.risk,
    },
  };
}

function structuredGateReason(audit, flags = {}) {
  const evidenceAgainstCount = audit.evidenceAgainstCount ?? 0;
  const missingEvidenceCount = audit.missingEvidenceCount ?? 0;
  const researchEvidence = audit.researchAssessment !== "pass" && (evidenceAgainstCount > 0 || missingEvidenceCount > 0)
    ? `research evidence rejected (${evidenceAgainstCount} conflicting; ${missingEvidenceCount} missing)`
    : audit.researchAssessment !== "pass" && audit.strategicPosition === "Buy"
      ? "research packet rejected without an enumerated evidence gap"
      : null;
  const reasons = [
    `target confidence ${audit.targetConfidence}`,
    audit.freshCatalyst ? `catalyst ${humanizeToken(audit.catalystStatus ?? "verified")}` : `catalyst ${humanizeToken(audit.catalystStatus ?? "unavailable")}`,
    audit.reratingPath !== "Unavailable" ? `qualified rerating path ${reratingHorizonLabel(audit.reratingPath)}` : "qualified rerating path unavailable",
    researchEvidence,
    audit.strategicPosition ? `strategic position ${audit.strategicPosition}` : null,
    audit.strategicPositionAligned === false ? "strategic position is inconsistent with the requested trade action" : null,
    audit.actionStability === "blocked" ? `action change blocked: ${audit.actionStabilityReason}` : null,
    flags.discoveryBlocked ? "discovery evidence incomplete" : null,
    flags.unsupportedPortfolioAction ? "portfolio inputs unavailable" : null,
    audit.result === "pass" ? `action ${audit.finalAction}` : null,
  ].filter(Boolean);
  return reasons.join("; ");
}

function reratingHorizonLabel(horizon) {
  return horizon === "1Q" ? "within 1 quarter" : horizon === "2Q" ? "within 2 quarters" : "unavailable";
}

function deterministicInvalidation(candidate, reratingHorizon, gateResult) {
  if (gateResult !== "pass") return "No actionable recommendation; valuation scenario prices are not stop levels.";
  if (reratingHorizon) return `Reassess if the stated ${reratingHorizon} fundamental rerating path does not materialize; valuation scenario prices are not stop levels.`;
  if ((candidate?.setup?.catalystState ?? legacyCatalystState(candidate?.setup)).verified) return "Reassess if subsequent company disclosure contradicts the verified catalyst; valuation scenario prices are not stop levels.";
  return "Thesis invalidation unavailable; valuation scenario prices are not stop levels.";
}

function legacyCatalystState(setup) {
  return setup?.verifiedCatalyst
    ? { status: "verified_positive", direction: "positive", verified: true, gateQualified: true }
    : { status: setup?.eventStatus ?? "unavailable", direction: null, verified: false, gateQualified: false };
}

function validatePacketPriceLevels(packet, candidate, errors) {
  if (!candidate) return;
  const target = candidate.targetAndMispricing;
  const supplied = [
    candidate.price, candidate.yearLow, candidate.yearHigh,
    target?.bearValue, target?.baseValue, target?.bullValue, target?.preferredEntryPrice,
    target?.buyZones?.suggested?.low, target?.buyZones?.suggested?.high,
    target?.buyZones?.stronger?.low, target?.buyZones?.stronger?.high,
  ].filter(Number.isFinite);
  for (const field of ["entryExitCondition", "invalidation", "riskReward", "mispricingThesis", "reratingPath"]) {
    const values = [...String(packet?.[field] ?? "").matchAll(/\$\s*([0-9]+(?:\.[0-9]+)?)/g)].map((match) => Number(match[1]));
    for (const value of values) {
      const sourced = supplied.some((known) => Math.abs(known - value) <= Math.max(0.01, Math.abs(known) * 0.001));
      if (!sourced) errors.push(`${packet?.symbol ?? "unknown"} unsourced price level in ${field}: $${value}`);
    }
  }
}

function isTestableReratingPath(value) {
  const text = String(value ?? "").trim();
  const operatingMetric = /\b(?:revenue|sales|eps|margin|guidance|backlog|bookings|capex|cash flow|free cash flow|customer(?:s)?|contract(?:s)?|utilization|estimate(?:s)?|shipment(?:s)?|adoption)\b/i.test(text);
  const observableOutcome = /\b(?:grow(?:th)?|increase|accelerat(?:e|ion)|reaccelerat(?:e|ion)|improv(?:e|ement)|expand|raise|beat|exceed|maintain|hold|declin(?:e|ing)|decelerat(?:e|ion)|compress|fall|convert|reach|above|below)\b|(?:>=|<=|>|<)\s*\d|\d+(?:\.\d+)?\s*%/i.test(text);
  const valuationOnly = /\b(?:toward|to)\s+(?:the\s+)?(?:base|bull|bear)(?:\s+case)?\s+value\b/i.test(text) && !observableOutcome;
  return text.length >= 30 && operatingMetric && observableOutcome && !valuationOnly;
}

function discoveryFinancialsComplete(candidate) {
  const valuationAvailable = Number.isFinite(candidate?.valuation?.trailingPE) || Number.isFinite(candidate?.valuation?.trailingPS);
  const growthAvailable = ["revenueTtmYoY", "revenueLatestQuarterYoY", "epsTtmYoY", "epsLatestQuarterYoY"]
    .some((field) => Number.isFinite(candidate?.reportedGrowth?.[field]));
  return candidate?.fundamentalCoverage?.status === "available" && valuationAvailable && growthAvailable;
}

function incompleteResearchPacket(candidate, failure) {
  return {
    symbol: candidate.symbol,
    status: "incomplete",
    modelGateResult: "fail",
    gateResult: "fail",
    todayAction: "No action",
    finalAction: "No action",
    confidence: "Low",
    catalystSummary: "Research incomplete",
    evidenceFor: [],
    evidenceAgainst: [],
    mispricingThesis: "Unavailable because the candidate research batch did not complete.",
    strategicPosition: "Avoid",
    entryExitCondition: "Research must complete before action.",
    riskReward: "Not assessed.",
    invalidation: "Not assessed.",
    missingEvidence: [failure],
    sourceQuality: "incomplete",
    gateReason: `research incomplete: ${failure}`,
    sourceSnapshot: { symbol: candidate.symbol, sourceType: candidate.sourceType, setup: candidate.setup },
  };
}

export function synthesisContext(compact, research) {
  const researchSymbols = research.packets.map((packet) => packet.symbol);
  const researchSet = new Set(researchSymbols);
  const packetBySymbol = new Map(research.packets.map((packet) => [packet.symbol, packet]));
  const knownSymbols = new Set(Object.keys(CIKS));
  const contextOnlySymbols = [...symbolsInValue({
    calendars: compact.calendars,
    aiCycle: compact.decisionFramework?.aiCycle,
    eventLedger: compact.eventLedger,
  })].filter((symbol) => knownSymbols.has(symbol) && !researchSet.has(symbol));
  const synthesisSymbols = new Set([...researchSymbols, ...contextOnlySymbols]);
  const eventLedger = filterEventLedgerForSynthesis(compact.eventLedger, synthesisSymbols);
  const earnings = compact.calendars?.earnings;
  return {
    schemaVersion: compact.schemaVersion,
    engineVersion: compact.engineVersion,
    buildRevision: compact.buildRevision,
    reportMode: compact.reportMode,
    generatedAt: compact.generatedAt,
    session: compact.session,
    coverage: compact.coverage,
    dataQuality: compact.dataQuality,
    marketContext: compact.marketContext,
    calendars: compact.calendars ? {
      ...compact.calendars,
      earnings: earnings ? {
        ...earnings,
        events: (earnings.events ?? []).filter((event) => synthesisSymbols.has(event.symbol)),
        watchlistMatches: (earnings.watchlistMatches ?? []).filter((symbol) => synthesisSymbols.has(symbol)),
      } : earnings,
    } : compact.calendars,
    news: {
      monetaryPolicy: compact.news?.monetaryPolicy,
      company: compact.news?.company ? { ...compact.news.company, items: undefined } : undefined,
    },
    decisionFramework: {
      methodology: compact.decisionFramework?.methodology,
      aiCycle: compact.decisionFramework?.aiCycle,
      sectorScorecard: compact.decisionFramework?.sectorScorecard,
    },
    opportunityGate: {
      ...compact.opportunityGate,
      candidates: research.packets.map((packet) => ({
        symbol: packet.symbol,
        setup: packet.sourceSnapshot?.setup,
        researchStatus: packet.status,
        researchGateResult: packet.gateResult,
      })),
    },
    discovery: compact.discovery ? {
      status: compact.discovery.status,
      source: compact.discovery.source,
      scanned: compact.discovery.scanned,
      eligibleAfterLiquidityAndRelevance: compact.discovery.eligibleAfterLiquidityAndRelevance,
      filters: compact.discovery.filters,
      fundamentalsCoverage: compact.discovery.fundamentalsCoverage,
      admittedSymbols: research.packets
        .filter((packet) => packet.sourceSnapshot?.sourceType === "discovery")
        .map((packet) => packet.symbol),
    } : null,
    eventLedger,
    researchSymbols,
    contextOnlySymbols,
    research: {
      schemaVersion: research.schemaVersion,
      thesisMemory: research.thesisMemory,
      funnel: research.funnel,
      batches: research.batches,
      packets: research.packets,
      storage: research.storage,
    },
    watchlist: (compact.watchlist ?? []).map((row) => ({
      symbol: row.symbol,
      name: row.name,
      price: row.price,
      changePercent: row.changePercent,
      yearLow: row.yearLow,
      yearHigh: row.yearHigh,
      positionIn52WeekRange: row.positionIn52WeekRange,
      valuation: row.valuation,
      targetAndMispricing: researchSet.has(row.symbol)
        ? row.targetAndMispricing
        : unavailableTarget(row, "not researched today; context-only names cannot receive targets"),
      reportedGrowth: row.reportedGrowth,
      fundamentalCacheStatus: row.fundamentalCacheStatus,
      fundamentalAsOf: row.fundamentalAsOf,
      catalystState: row.catalystState,
      catalyst: row.catalyst,
      risk: row.risk,
      finalAction: !researchSet.has(row.symbol)
        ? "Wait"
        : packetBySymbol.get(row.symbol)?.status !== "complete"
          ? "Wait"
          : packetBySymbol.get(row.symbol)?.finalAction ?? packetBySymbol.get(row.symbol)?.todayAction ?? "Wait",
      recommendationGateResult: recommendationGateResult(packetBySymbol.get(row.symbol), researchSet.has(row.symbol)),
      actionMemory: packetBySymbol.get(row.symbol)?.actionMemory,
      gateAudit: packetBySymbol.get(row.symbol)?.gateAudit,
      reratingPath: packetBySymbol.get(row.symbol)?.reratingPath,
      reratingHorizon: packetBySymbol.get(row.symbol)?.reratingHorizon,
      researchStatus: researchSet.has(row.symbol) ? "researched" : "not_researched_today",
    })),
  };
}

function recommendationGateResult(packet, researched) {
  if (!researched) return "Not evaluated — not researched today";
  if (!packet || packet.status !== "complete") return `Unavailable — ${cleanReportText(packet?.gateReason || "research incomplete")}`;
  const audit = gateAuditForPacket(packet);
  return `${audit.result === "pass" ? "Passed" : "Rejected"} — ${structuredGateReason(audit)}`;
}

function gateAuditForPacket(packet) {
  const catalystState = packet.sourceSnapshot?.setup?.catalystState ?? legacyCatalystState(packet.sourceSnapshot?.setup);
  return packet.gateAudit ?? {
    result: packet.gateResult,
    researchAssessment: packet.modelGateResult,
    strategicPosition: packet.strategicPosition,
    targetConfidence: packet.sourceSnapshot?.targetAndMispricing?.confidence ?? packet.confidence ?? "Unavailable",
    catalystStatus: catalystState.status,
    catalystDirection: catalystState.direction,
    freshCatalyst: catalystState.verified,
    reratingPath: ["1Q", "2Q"].includes(packet.reratingHorizon) && packet.gateResult === "pass" ? packet.reratingHorizon : "Unavailable",
    reratingPathDetail: ["1Q", "2Q"].includes(packet.reratingHorizon) && packet.gateResult === "pass" ? packet.reratingPath : "Unavailable",
    evidenceAgainstCount: packet.evidenceAgainst?.length ?? 0,
    missingEvidenceCount: packet.missingEvidence?.length ?? 0,
    strategicPositionAligned: packet.strategicPosition === "Buy"
      ? ["Buy now", "Buy on weakness"].includes(packet.finalAction ?? packet.todayAction)
      : packet.strategicPosition === "Avoid"
        ? (packet.finalAction ?? packet.todayAction) === "Sell"
        : !["Buy now", "Buy on weakness", "Sell"].includes(packet.finalAction ?? packet.todayAction),
    finalAction: packet.finalAction ?? packet.todayAction ?? "No action",
  };
}

export function renderMorningBrief(compact, identity = {}) {
  const reportId = identity.reportId ?? "unavailable";
  const generatedAt = identity.generatedAt ?? new Date().toISOString();
  const packets = compact.research?.packets ?? [];
  const recommended = packets.filter((packet) => packet.status === "complete" && packet.gateResult === "pass");
  const gateQualified = packets.filter((packet) => packet.status === "complete" && packet.modelGateResult === "pass");
  const cycleRows = Object.entries(compact.decisionFramework?.aiCycle ?? {});
  const sectorRows = Object.entries(compact.decisionFramework?.sectorScorecard ?? {});
  const best = highestRankedRecommendation(recommended);
  const keyEvent = keyCompanyEvent(compact);
  const valuationRisk = primaryValuationRisk(compact.watchlist ?? [], sectorRows);
  const lines = [
    `# Growth Tech Morning Brief — ${reportDateFor(generatedAt)}`,
    "",
    `**Report Mode:** ${compact.reportMode}`,
    `**Engine Version:** ${compact.engineVersion}`,
    `**Build Revision:** ${compact.buildRevision ?? BUILD_REVISION}`,
    `**Report ID:** ${reportId}`,
    `**Generated At:** ${generatedAt}`,
    "",
    "# Executive Summary",
    `- **AI Cycle and Sector Implications:** ${summarizeCycleAndSectors(cycleRows, sectorRows)}`,
    `- **Market Context:** ${summarizeMarketContext(compact.marketContext)}`,
    `- **${keyEvent.label}:** ${keyEvent.text}`,
    `- **Highest-Ranked Recommendation:** ${best ? formatHighestRankedRecommendation(best) : formatRecommendationAbsence(packets, gateQualified.length, recommended.length)}`,
    `- **Primary Valuation Risk:** ${valuationRisk}`,
    "",
    "# Overnight and Market Context",
    `- **As Of:** ${compact.generatedAt ?? generatedAt}; session=${humanizeToken(compact.session ?? "unavailable")}.`,
    `- **Global Markets:** Point-in-time Growth Tech context only; source status is preserved below and no broad-market conclusion is inferred.`,
    `- **Futures:** ${formatMarketGroup(compact.marketContext?.futures, "futures")}`,
    `- **Rates:** ${formatMarketGroup(compact.marketContext?.rates, "rates")}`,
    `- **Dollar:** ${formatMarketGroup(compact.marketContext?.usd, "usd")}`,
    `- **Oil:** ${formatMarketGroup(compact.marketContext?.oil, "oil")}`,
    "",
    "# AI Cycle Dashboard",
    "| Segment | Rating | Trend | Evidence | Limitation |",
    "|---|---|---|---|---|",
    ...cycleRows.map(([segment, row]) => `| ${tableCell(segment)} | ${tableCell(row.rating)} | ${tableCell(row.trend)} | ${tableCell(row.evidence)} | ${tableCell(row.limitation)} |`),
    "",
    "# Sector Scorecard",
    "| Sector | Fundamentals | Valuation | Momentum | Sector Stance | Evidence |",
    "|---|---|---|---|---|---|",
    ...sectorRows.map(([sector, row]) => `| ${tableCell(sector)} | ${tableCell(row.fundamentals)} | ${tableCell(row.valuation)} | ${tableCell(row.momentum)} | ${tableCell(row.stance)} | ${tableCell(sectorEvidence(row))} |`),
    "",
    "# Watchlist",
    "| Symbol | Price | Daily Change | 52-Week Position | Valuation | Trailing 5Y Percentile | Implied Value (Bear/Base/Bull) | Base Upside / Bear-Case Return | Valuation Threshold | Suggested Buy Target / Buy Zone | Valuation Signal | Catalyst | Risk | Final Action | Action Change / Reason | Rerating Path | Recommendation Gate Result | Research Status |",
    "|---|---:|---:|---:|---|---:|---|---|---|---|---|---|---|---|---|---|---|---|",
    ...(compact.watchlist ?? []).map((row) => renderWatchlistRow(row)),
  ];
  return lines.join("\n");
}

function summarizeCycleAndSectors(cycleRows, sectorRows) {
  const cycle = summarizeAiCycle(cycleRows);
  const favorable = sectorRows.filter(([, row]) => row.stance === "Favorable").map(([sector]) => sector);
  const cautious = sectorRows.filter(([, row]) => row.stance === "Cautious").map(([sector]) => sector);
  const highValuation = sectorRows.filter(([, row]) => row.valuation === "High").map(([sector]) => sector);
  const implications = [
    favorable.length ? `Favorable sector stance: ${favorable.join(", ")}` : null,
    cautious.length ? `Cautious sector stance: ${cautious.join(", ")}` : null,
    highValuation.length ? `high valuation: ${highValuation.join(", ")}` : null,
  ].filter(Boolean);
  return `${cycle}${implications.length ? ` ${implications.join("; ")}.` : " Sector stances are neutral."}`;
}

function summarizeMarketContext(context = {}) {
  const observations = [];
  const nasdaq = context.futures?.items?.find((item) => item.label === "Nasdaq 100");
  const tenYear = context.rates?.items?.find((item) => item.label === "U.S. 10Y yield");
  const dollar = context.usd?.items?.find((item) => item.label === "U.S. Dollar Index");
  const oil = context.oil?.items?.find((item) => item.label === "WTI crude");
  if (Number.isFinite(nasdaq?.changePercent)) observations.push(`Nasdaq 100 futures ${percent(nasdaq.changePercent, true)}`);
  if (Number.isFinite(tenYear?.change)) observations.push(`U.S. 10Y yield ${tenYear.change >= 0 ? "+" : ""}${round(tenYear.change * 100)} bps`);
  if (Number.isFinite(dollar?.changePercent)) observations.push(`U.S. Dollar Index ${percent(dollar.changePercent, true)}`);
  if (Number.isFinite(oil?.changePercent)) observations.push(`WTI crude ${percent(oil.changePercent, true)}`);
  const stale = Object.entries(context).filter(([, group]) => group?.status === "stale").map(([name]) => marketGroupLabel(name));
  const unavailable = Object.entries(context).filter(([, group]) => group?.status === "unavailable").map(([name]) => marketGroupLabel(name));
  const qualifications = [
    stale.length ? `stale: ${stale.join(", ")}` : null,
    unavailable.length ? `unavailable: ${unavailable.join(", ")}` : null,
  ].filter(Boolean);
  if (!observations.length) return `No current market-context observations available${qualifications.length ? `; ${qualifications.join("; ")}` : ""}.`;
  return `${observations.join("; ")}${qualifications.length ? `; ${qualifications.join("; ")}` : ""}.`;
}

function marketGroupLabel(name) {
  return ({ futures: "futures", rates: "rates", usd: "dollar", oil: "oil" })[name] ?? name;
}

function keyCompanyEvent(compact) {
  const researchSymbols = new Set(compact.researchSymbols ?? (compact.research?.packets ?? []).map((packet) => packet.symbol));
  const packetBySymbol = new Map((compact.research?.packets ?? []).map((packet) => [packet.symbol, packet]));
  const statusRank = { verified_positive: 5, verified_negative: 5, reported_pending_verification: 4, scheduled: 3 };
  const rows = (compact.watchlist ?? [])
    .filter((row) => researchSymbols.has(row.symbol) && Object.hasOwn(CIKS, row.symbol) && (statusRank[row.catalystState?.status] ?? 0) > 0)
    .sort((a, b) => {
      const gateDelta = Number(packetBySymbol.get(b.symbol)?.gateResult === "pass") - Number(packetBySymbol.get(a.symbol)?.gateResult === "pass");
      return gateDelta || (statusRank[b.catalystState?.status] ?? 0) - (statusRank[a.catalystState?.status] ?? 0);
    });
  const row = rows[0];
  if (!row) return { label: "Key Event Status", text: "No material company event identified among researched core-watchlist names." };
  const state = row.catalystState;
  const sectors = Object.entries(SECTOR_MEMBERS).filter(([, symbols]) => symbols.includes(row.symbol)).map(([sector]) => sector);
  const exposure = sectors.length ? `; relevant scorecard exposure: ${sectors.join(", ")}` : "";
  if (["verified_positive", "verified_negative"].includes(state.status)) {
    return { label: "Key Reported Event", text: `${row.symbol} ${cleanReportText(state.display)}${exposure}.` };
  }
  if (state.status === "reported_pending_verification") {
    if (/scheduled window opened/i.test(state.display ?? "")) {
      return { label: "Key Event Status", text: `${row.symbol} ${cleanReportText(state.display)}${exposure}.` };
    }
    return { label: "Key Reported Event", text: `${row.symbol} ${cleanReportText(state.display)}${exposure}.` };
  }
  return { label: "Key Scheduled Event", text: `${row.symbol} ${cleanReportText(state.display)}${exposure}.` };
}

function highestRankedRecommendation(packets) {
  return [...packets].sort((a, b) => recommendationRank(b) - recommendationRank(a))[0] ?? null;
}

function recommendationRank(packet) {
  const action = { "Buy now": 30, Sell: 30, "Buy on weakness": 20 }[packet.finalAction ?? packet.todayAction] ?? 0;
  const confidence = { High: 3, Medium: 2, Low: 1 }[packet.confidence] ?? 0;
  const setup = packet.sourceSnapshot?.setup?.score ?? 0;
  const upside = Math.max(-100, Math.min(100, packet.sourceSnapshot?.targetAndMispricing?.baseUpsidePercent ?? 0));
  return action * 10_000 + confidence * 1_000 + setup * 10 + upside;
}

function formatHighestRankedRecommendation(packet) {
  const action = packet.finalAction ?? packet.todayAction;
  const audit = gateAuditForPacket(packet);
  const basis = [
    `target confidence ${audit.targetConfidence}`,
    audit.freshCatalyst ? `catalyst ${humanizeToken(audit.catalystStatus)}` : null,
    audit.reratingPath !== "Unavailable" ? `qualified rerating path ${reratingHorizonLabel(audit.reratingPath)}` : null,
  ].filter(Boolean).join("; ");
  const zones = packet.sourceSnapshot?.targetAndMispricing?.buyZones;
  const buyZone = ["Buy now", "Buy on weakness"].includes(action) && zones?.status === "available" ? executableBuyZoneSummary(zones) : null;
  const reratingTrigger = !audit.freshCatalyst && audit.reratingPath !== "Unavailable"
    && typeof audit.reratingPathDetail === "string" && audit.reratingPathDetail !== "Unavailable"
    ? `; rerating trigger: ${cleanReportText(audit.reratingPathDetail)}`
    : "";
  return `${packet.symbol} — ${action}${buyZone ? `; ${buyZone}` : ""}; ${basis}${reratingTrigger}.`;
}

function formatRecommendationAbsence(packets, _modelQualifiedCount, _recommendedCount) {
  const closest = [...packets]
    .filter((packet) => packet.status === "complete" && packet.gateResult !== "pass")
    .sort((a, b) => recommendationNearMissRank(b) - recommendationNearMissRank(a))
    .at(0);
  if (!closest) return "No recommendation qualified.";
  const audit = gateAuditForPacket(closest);
  const blockers = [
    !audit.freshCatalyst && audit.reratingPath === "Unavailable" ? "no verified catalyst or qualified rerating path" : null,
    audit.strategicPosition && audit.strategicPosition !== "Buy" ? `strategic position remains ${audit.strategicPosition}` : null,
    audit.researchAssessment !== "pass" && ((audit.evidenceAgainstCount ?? 0) > 0 || (audit.missingEvidenceCount ?? 0) > 0)
      ? `research evidence rejected (${audit.evidenceAgainstCount ?? 0} conflicting; ${audit.missingEvidenceCount ?? 0} missing)` : null,
  ].filter(Boolean);
  return `No recommendation qualified. Closest setup: ${closest.symbol} — ${audit.targetConfidence} target confidence${blockers.length ? `, but ${blockers.join("; ")}` : ", but the recommendation gate was rejected"}.`;
}

function recommendationNearMissRank(packet) {
  const target = packet.sourceSnapshot?.targetAndMispricing;
  const upside = Number.isFinite(target?.baseUpsidePercent) ? target.baseUpsidePercent : -100;
  const confidence = { High: 3, Medium: 2, Low: 1 }[packet.confidence] ?? 0;
  const core = packet.sourceSnapshot?.sourceType === "core" ? 1 : 0;
  return core * 1_000_000 + confidence * 10_000 + Math.max(-100, Math.min(500, upside));
}

function primaryValuationRisk(watchlist, sectorRows) {
  const researched = watchlist.filter((row) => row.researchStatus !== "not_researched_today");
  const ranked = researched.map((row) => {
    const valuation = row.valuation?.selectedPercentile;
    const range = row.positionIn52WeekRange;
    const score = (Number.isFinite(valuation) ? valuation : -100) + (Number.isFinite(range) ? range : -100);
    return { row, valuation, range, score };
  }).filter(({ valuation, range }) => (valuation ?? -Infinity) >= 80 || (range ?? -Infinity) >= 90)
    .sort((a, b) => b.score - a.score);
  const selected = ranked[0];
  if (!selected) return "No significant valuation-risk signal identified among researched names.";
  const sectors = sectorRows.filter(([, sector]) => sector.symbols?.includes(selected.row.symbol)).map(([sector]) => sector);
  const measures = [
    Number.isFinite(selected.valuation) ? `historical valuation percentile ${percent(selected.valuation)}` : null,
    Number.isFinite(selected.range) ? `52-week range position ${percent(selected.range)}` : null,
  ].filter(Boolean);
  return `${selected.row.symbol} — ${measures.join("; ")}${sectors.length ? `; sector exposure: ${sectors.join(", ")}` : ""}.`;
}

function summarizeAiCycle(rows) {
  if (!rows.length || rows.every(([, row]) => row.rating === "Insufficient Data")) return "Insufficient Data; direct-indicator coverage unavailable.";
  const positive = rows.filter(([, row]) => row.rating === "Positive").map(([segment]) => segment);
  const negative = rows.filter(([, row]) => row.rating === "Negative").map(([segment]) => segment);
  const partial = rows.filter(([, row]) => row.rating === "Partial Coverage").map(([segment]) => segment);
  if (negative.length) return `Mixed; negative direct indicators in ${negative.join(", ")}; ${positive.length} positive segment(s), ${partial.length} partial-coverage segment(s).`;
  if (positive.length) return `Positive; ${positive.length} segment(s) supported by fresh direct indicators${partial.length ? `; partial coverage in ${partial.join(", ")}` : ""}.`;
  return `Stable; no negative direct-indicator segment${partial.length ? `; partial coverage in ${partial.join(", ")}` : ""}.`;
}

export function renderResearchAudit(compact, identity = {}) {
  const funnel = compact.research?.funnel ?? {};
  const packets = compact.research?.packets ?? [];
  const capacity = compact.opportunityGate?.researchCapacity ?? {};
  const missing = materialMissingFields(packets);
  const sourceFailures = compact.dataQuality?.discoveryFundamentals?.sourceFailures ?? 0;
  const thesisMemory = compact.research?.thesisMemory ?? {};
  const lines = [
    `# Growth Tech Research Audit — ${reportDateFor(identity.generatedAt ?? compact.generatedAt)}`,
    "",
    `**Engine Version:** ${compact.engineVersion}`,
    `**Build Revision:** ${compact.buildRevision ?? BUILD_REVISION}`,
    `**Report ID:** ${identity.reportId ?? "unavailable"}`,
    `**Report Content SHA-256:** ${identity.contentHash ?? "unavailable"}`,
    "",
    `**Funnel:** screened=${funnel.screened ?? "unavailable"}; admitted=${funnel.admitted ?? 0}; researched=${funnel.researched ?? 0}; incomplete=${funnel.incomplete ?? 0}; gateQualified=${funnel.gateQualified ?? 0}; recommendedActions=${funnel.recommendedActions ?? 0}; rejectedOrWatch=${funnel.rejectedOrWatch ?? 0}`,
    `**Thesis Memory:** ${thesisMemory.status ?? "unavailable"}; previous=${thesisMemory.previousGeneratedAt ?? "unavailable"}; latest observations=${thesisMemory.latestObservationCount ?? packets.length}; active qualified theses=${thesisMemory.activeQualifiedCount ?? 0}; model-only action changes blocked=${thesisMemory.stabilized ?? 0}.`,
    `**Packet Completion:** capacity=${capacity.filled ?? packets.length}/${capacity.target ?? packets.length}; generated packets are not described as complete fields.`,
    `**Field Completeness:** ${fieldCompletenessSummary(packets)}`,
    `**Material Missing Fields:** ${missing.length ? missing.join("; ") : "None in the deterministic required-field set."}`,
    `**Source Failures:** discovery fundamentals=${sourceFailures}; extraction gaps remain separate from provider failures.`,
    `**Research Avoids:** ${packets.filter((packet) => packet.status === "complete" && packet.strategicPosition === "Avoid").map((packet) => packet.symbol).join(", ") || "None"}; these are post-research model positions, not screening exclusions or portfolio recommendations.`,
    "",
    "## Research Packets",
  ];
  for (const packet of packets) {
    lines.push(...[
      `### ${packet.symbol} — ${packet.todayAction ?? "No action"}`,
      `- Status: ${packet.status}; model gate=${packet.modelGateResult ?? "unavailable"}; recommended action=${packet.gateResult === "pass" ? "yes" : "no"}.`,
      `- Deterministic gate: ${cleanReportText(recommendationGateResult(packet, true))}.`,
      `- Action memory: ${cleanReportText(actionMemoryDisplay(packet.actionMemory))}.`,
      `- Rerating path: ${cleanReportText(reratingPathDisplay(packet))}.`,
      packet.actionMemory?.modelObservation ? `- Blocked model observation: ${cleanReportText(JSON.stringify(packet.actionMemory.modelObservation))}.` : null,
      `- Model catalyst analysis: ${cleanReportText(packet.catalystSummary)}`,
      `- Deterministic invalidation: ${cleanReportText(packet.invalidation)}`,
      `- Model invalidation (non-authoritative): ${cleanReportText(packet.modelInvalidation)}`,
      `- Balance sheet: ${balanceSheetDisplay(packet.sourceSnapshot?.fundamentals)}.`,
      `- Target & mispricing: ${targetAuditDisplay(packet.sourceSnapshot?.targetAndMispricing)}.`,
      `- Evidence against: ${normalizedEvidenceAgainst(packet).join("; ") || "unavailable"}.`,
      `- Missing evidence: ${(packet.missingEvidence ?? []).map(cleanReportText).join("; ") || "none stated"}.`,
      "",
    ].filter((line) => line !== null));
  }
  return lines.join("\n").trim();
}

function renderWatchlistRow(row) {
  const valuation = row.valuation;
  const metric = valuation?.selectedMetric === "trailingPE" ? "P/E" : valuation?.selectedMetric === "trailingPS" ? "P/S" : null;
  const selected = metric === "P/E" ? valuation?.trailingPE : metric === "P/S" ? valuation?.trailingPS : null;
  const trailing = metric && Number.isFinite(selected) ? `Trailing ${metric} ${round(selected)}` : "Trailing valuation unavailable";
  const forward = metric ? `Forward ${metric} unavailable` : "Forward valuation unavailable";
  const finalAction = [...TODAY_ACTIONS, "Wait"].includes(row.finalAction) ? row.finalAction : "Wait";
  const target = row.targetAndMispricing;
  const availableTarget = target?.status === "available";
  const values = availableTarget ? `${money(target.bearValue)} / ${money(target.baseValue)} / ${money(target.bullValue)}; trailing-implied` : `Target unavailable — ${target?.reason ?? "insufficient inputs"}`;
  const upsideRisk = availableTarget ? `${percent(target.baseUpsidePercent, true)} / ${percent(bearCaseReturnPercent(target), true)}; ${riskRewardDisplay(target)}` : "unavailable";
  const preferredEntry = availableTarget ? preferredEntryDisplay(row, target) : "unavailable";
  const buyZone = availableTarget ? executableBuyZoneDisplay(row, target) : "unavailable";
  const signal = availableTarget ? `${target.valuationAdjustment >= 0 ? "+" : ""}${target.valuationAdjustment} ${target.valuationLabel}; ${target.confidence}; consensus unavailable` : `${target?.confidence ?? "Unavailable"}; consensus unavailable`;
  const catalyst = row.catalystState ? catalystFor(row.catalystState) : row.catalyst;
  return `| ${tableCell(row.symbol)} | ${money(row.price)} | ${percent(row.changePercent, true)} | ${percent(row.positionIn52WeekRange)} | ${trailing}; ${forward} | ${percent(valuation?.selectedPercentile)} | ${tableCell(values)} | ${tableCell(upsideRisk)} | ${tableCell(preferredEntry)} | ${tableCell(buyZone)} | ${tableCell(signal)} | ${tableCell(catalyst)} | ${tableCell(row.risk)} | ${finalAction} | ${tableCell(actionMemoryDisplay(row.actionMemory))} | ${tableCell(reratingPathDisplay(row))} | ${tableCell(row.recommendationGateResult)} | ${row.researchStatus === "not_researched_today" ? "Not researched today" : "Researched"} |`;
}

function actionMemoryDisplay(memory) {
  if (!memory) return "Unavailable — no comparable action memory";
  const transition = memory.previousAction && memory.previousAction !== "Unavailable"
    ? `${memory.previousAction} → ${memory.finalAction}`
    : `Initial → ${memory.finalAction}`;
  if (memory.status === "model_only_change_blocked") return `${transition}; proposed ${memory.modelAction} blocked — ${memory.reason}`;
  if (memory.status === "unchanged") return `${transition}; unchanged`;
  return `${transition}; ${memory.reason}`;
}

function reratingPathDisplay(row) {
  const path = String(row?.reratingPath ?? "").trim();
  if (!path || path === "Unavailable" || !["1Q", "2Q"].includes(row?.reratingHorizon)) return "Unavailable";
  const qualified = row?.gateAudit?.reratingPath !== "Unavailable" && ["1Q", "2Q"].includes(row?.gateAudit?.reratingPath);
  return qualified
    ? `Qualified (${row.reratingHorizon}) — ${path}`
    : `Model-proposed, not qualified (${row.reratingHorizon}) — ${path}`;
}

function targetAuditDisplay(target) {
  if (target?.status !== "available") return `Target unavailable — ${target?.reason ?? "insufficient inputs"}`;
  return `current ${money(target.currentPrice)} (price as of ${target.priceAsOf ?? "unavailable"}; inputs as of ${target.inputAsOf ?? "unavailable"}); ${money(target.bearValue)} bear / ${money(target.baseValue)} base / ${money(target.bullValue)} bull; ${percent(target.baseUpsidePercent, true)} base upside; ${percent(bearCaseReturnPercent(target), true)} bear-case return; ${riskRewardDisplay(target)}; ${preferredEntryDisplay({ price: target.currentPrice }, target)}; ${executableBuyZoneSummary(target.buyZones)}; method ${target.method}; buy-zone method ${target.buyZones?.method ?? target.buyZones?.reason ?? "unavailable"}; formula ${target.formula}; split basis ${target.splitBasis ?? "unavailable"} with ${target.splitEventsApplied ?? 0} event(s); current-input difference ${percent(target.currentInputDifferencePercent)}; vintage dispersion ${percent(target.vintageDispersionPercent)}; assumptions ${target.assumptions}; confidence ${target.confidence}; consensus cross-check unavailable`;
}

function bearCaseReturnPercent(target) {
  if (Number.isFinite(target?.currentPrice) && target.currentPrice !== 0 && Number.isFinite(target?.bearValue)) {
    return round(((target.bearValue - target.currentPrice) / target.currentPrice) * 100);
  }
  return Number.isFinite(target?.downsideToBearPercent) ? round(-target.downsideToBearPercent) : null;
}

function riskRewardDisplay(target) {
  if (Number.isFinite(target?.riskRewardRatio)) return `R/R ${round(target.riskRewardRatio)}`;
  const bearReturn = bearCaseReturnPercent(target);
  return Number.isFinite(bearReturn) && bearReturn >= 0 ? "No modeled downside to Bear value" : "R/R not meaningful";
}

function preferredEntryDisplay(row, target) {
  if (!Number.isFinite(target?.preferredEntryPrice)) return "Valuation threshold unavailable";
  const currentPrice = Number.isFinite(row?.price) ? row.price : target.currentPrice;
  return Number.isFinite(currentPrice) && currentPrice <= target.preferredEntryPrice
    ? `Valuation threshold satisfied (${money(target.preferredEntryPrice)}); not an executable buy target`
    : `At or below ${money(target.preferredEntryPrice)}`;
}

function executableBuyZoneSummary(zones) {
  if (zones?.status !== "available") return `Buy zone unavailable — ${zones?.reason ?? "insufficient inputs"}`;
  return `suggested ${money(zones.suggested.low)}–${money(zones.suggested.high)}; stronger ${money(zones.stronger.low)}–${money(zones.stronger.high)}`;
}

function executableBuyZoneDisplay(row, target) {
  const zones = target?.buyZones;
  if (zones?.status !== "available") return `Buy zone unavailable — ${zones?.reason ?? "insufficient inputs"}`;
  const summary = executableBuyZoneSummary(zones);
  if (row.finalAction === "Buy on weakness") return summary;
  if (row.finalAction === "Buy now") return `Current price qualifies; ${summary}`;
  if (row.researchStatus === "researched") return `Valuation-derived ${summary}; not actionable — recommendation gate rejected`;
  return `Reference only — ${summary}`;
}

function formatMarketGroup(group, category) {
  if (!group || group.status === "unavailable") return `Unavailable${group?.reason ? ` — ${cleanReportText(group.reason)}` : ""}.`;
  const items = (group.items ?? []).map((item) => {
    if (category === "rates") return `${item.label} ${fmt(item.value)}${item.unit ?? "%"} (${Number.isFinite(item.change) ? `${item.change >= 0 ? "+" : ""}${round(item.change * 100)} bps` : "change unavailable"})`;
    const unit = category === "oil" && item.unit === "USD" ? "$" : "";
    const change = Number.isFinite(item.changePercent) ? percent(item.changePercent, true) : "daily change unavailable";
    return `${item.label} ${unit}${fmt(item.value)} (${change})`;
  });
  return `${group.status}${group.asOf ? ` as of ${group.asOf}` : ""}: ${items.join(", ") || "no instruments"}.`;
}

function sectorEvidence(row) {
  const symbols = row?.symbols?.join(", ") || "no covered symbols";
  const growth = row?.metrics?.medianReportedRevenueTtmYoY;
  const valuation = row?.metrics?.medianHistoricalValuationPercentile;
  const fresh = formatFundamentalEvidence(row?.metrics?.freshFundamentals);
  const freshWithoutGrowth = formatFundamentalEvidence(row?.metrics?.freshFundamentalsWithoutGrowth);
  const stale = formatFundamentalEvidence(row?.metrics?.staleFundamentals);
  const unknown = formatFundamentalEvidence(row?.metrics?.unknownFundamentals);
  return [
    symbols,
    `median fresh reported revenue growth ${percent(growth)}`,
    fresh ? `fresh fundamentals ${fresh}` : null,
    freshWithoutGrowth ? `fresh fundamentals but reported revenue growth unavailable ${freshWithoutGrowth}` : null,
    stale ? `stale fundamentals excluded ${stale}` : null,
    unknown ? `${unknown} fundamentals date unavailable` : null,
    `median valuation percentile ${percent(valuation)}`,
  ].filter(Boolean).join("; ");
}

function formatFundamentalEvidence(rows) {
  if (!rows?.length) return null;
  return rows.map((row) => row.asOf ? `${row.symbol} (as of ${row.asOf})` : row.symbol).join(", ");
}

function balanceSheetDisplay(fundamentals) {
  const netDebt = fundamentals?.netDebt;
  if (!Number.isFinite(netDebt)) return "unavailable";
  const amount = compactMoney(Math.abs(netDebt));
  if (netDebt < 0) return `${amount} net cash (debt minus cash = ${compactMoney(netDebt)})`;
  if (netDebt > 0) return `${amount} net debt (debt minus cash)`;
  return "neutral net debt position";
}

function normalizedEvidenceAgainst(packet) {
  const netDebt = packet.sourceSnapshot?.fundamentals?.netDebt;
  return (packet.evidenceAgainst ?? []).map(cleanReportText).filter((item) => {
    if (!(Number.isFinite(netDebt) && netDebt < 0)) return true;
    return !/\b(?:debt load|high debt|significant net debt|balance[- ]sheet weakness|net debt position)\b/i.test(item);
  });
}

function materialMissingFields(packets) {
  const missing = [];
  for (const packet of packets) {
    const source = packet.sourceSnapshot ?? {};
    if (!source.valuation) missing.push(`${packet.symbol}: valuation`);
    if (!source.reportedGrowth) missing.push(`${packet.symbol}: reported growth`);
    for (const field of packet.missingEvidence ?? []) missing.push(`${packet.symbol}: ${cleanReportText(field)}`);
  }
  return [...new Set(missing)];
}

function fieldCompletenessSummary(packets) {
  if (!packets.length) return "0/0 packets; no fields available.";
  const required = packets.length * 3;
  const populated = packets.reduce((count, packet) => count
    + Number(Boolean(packet.catalystSummary))
    + Number(Boolean(packet.sourceSnapshot?.valuation))
    + Number(Boolean(packet.sourceSnapshot?.reportedGrowth)), 0);
  return `${populated}/${required} deterministic required fields populated across ${packets.length} packets; forward-data coverage is not implied.`;
}

function cleanReportText(value) {
  return String(value ?? "unavailable").replace(/[\r\n|]+/g, " ").replace(/\s+/g, " ").trim();
}

function humanizeToken(value) {
  return cleanReportText(value).replaceAll("_", " ");
}

function tableCell(value) {
  return cleanReportText(value).replaceAll("|", "\\|");
}

function percent(value, signedValue = false) {
  if (!Number.isFinite(value)) return "unavailable";
  return `${signedValue && value >= 0 ? "+" : ""}${round(value)}%`;
}

function money(value) {
  return Number.isFinite(value) ? `$${round(value)}` : "unavailable";
}

function compactMoney(value) {
  if (!Number.isFinite(value)) return "unavailable";
  const abs = Math.abs(value);
  const scaled = abs >= 1e9 ? `${round(abs / 1e9)}B` : abs >= 1e6 ? `${round(abs / 1e6)}M` : abs >= 1e3 ? `${round(abs / 1e3)}K` : String(round(abs));
  return `${value < 0 ? "-" : ""}$${scaled}`;
}

function symbolsInValue(value) {
  return new Set(JSON.stringify(value ?? {}).match(/\b[A-Z.]{2,8}\b/g) ?? []);
}

function filterEventLedgerForSynthesis(eventLedger, allowedSymbols) {
  if (!eventLedger) return eventLedger;
  const events = (eventLedger.events ?? []).filter((event) => !event.symbol || allowedSymbols.has(event.symbol));
  const retainedIds = new Set(events.map((event) => event.id));
  return {
    ...eventLedger,
    events,
    delta: Object.fromEntries(Object.entries(eventLedger.delta ?? {})
      .map(([key, ids]) => [key, (ids ?? []).filter((id) => retainedIds.has(id))])),
  };
}

async function storeResearchPackets(env, compact, research) {
  if (!env.BRIEF_BUCKET?.put) return { stored: false, reason: "r2_not_configured" };
  const reportDate = compact.generatedAt ? zonedParts(new Date(compact.generatedAt), "America/New_York").date : "unknown-date";
  const body = JSON.stringify(research, null, 2);
  const options = { httpMetadata: { contentType: "application/json; charset=utf-8" } };
  try {
    await Promise.all([
      env.BRIEF_BUCKET.put(`research/${reportDate}.json`, body, options),
      env.BRIEF_BUCKET.put("research/latest.json", body, options),
    ]);
    return { stored: true, datedKey: `research/${reportDate}.json`, latestKey: "research/latest.json" };
  } catch (error) {
    return { stored: false, reason: `research_packet_storage_failed: ${errorMessage(error)}` };
  }
}

async function storeResearchAudit(env, compact, markdown, identity = {}) {
  if (!env.BRIEF_BUCKET?.put) return { stored: false, reason: "r2_not_configured" };
  const reportDate = compact.generatedAt ? zonedParts(new Date(compact.generatedAt), "America/New_York").date : "unknown-date";
  const options = {
    httpMetadata: { contentType: "text/markdown; charset=utf-8" },
    customMetadata: stringifyMetadata({
      reportDate,
      reportId: identity.reportId,
      reportContentHash: identity.contentHash,
      engineVersion: SERVICE_VERSION,
      buildRevision: BUILD_REVISION,
    }),
  };
  try {
    await Promise.all([
      env.BRIEF_BUCKET.put(`research-audit/${reportDate}.md`, markdown, options),
      env.BRIEF_BUCKET.put("research-audit/latest.md", markdown, options),
    ]);
    return { stored: true, datedKey: `research-audit/${reportDate}.md`, latestKey: "research-audit/latest.md" };
  } catch (error) {
    return { stored: false, reason: `research_audit_storage_failed: ${errorMessage(error)}` };
  }
}

function parseJsonObject(text) {
  const cleaned = String(text ?? "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try { return JSON.parse(cleaned); } catch { return null; }
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

// Backward-compatible export for callers that explicitly expect Gemini.
export async function generateGeminiReport(env, snapshot) {
  return generateAiReport(env, snapshot, { provider: "gemini" });
}

async function requestAiReport(env, route, prompt, options = {}) {
  if (route.provider === "gemini") return requestGeminiReport(env, route, prompt, options);
  return requestOpenAiCompatibleReport(env, route, prompt, options);
}

async function requestGeminiReport(env, route, prompt, options = {}) {
  const endpoint = `${GEMINI_API_BASE}/${encodeURIComponent(route.model)}:generateContent?key=${encodeURIComponent(route.apiKey)}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(geminiRequestBody(prompt, options)),
  });
  return { ok: response.ok, status: response.status, body: await response.json().catch(() => null) };
}

async function requestOpenAiCompatibleReport(env, route, prompt, options = {}) {
  const response = await fetch(`${route.baseUrl}/chat/completions`, {
    method: "POST",
    headers: { authorization: `Bearer ${route.apiKey}`, "content-type": "application/json" },
    body: JSON.stringify(openAiCompatibleRequestBody(route, prompt, options)),
  });
  return { ok: response.ok, status: response.status, body: await response.json().catch(() => null) };
}

function openAiCompatibleRequestBody(route, prompt, options = {}) {
  return {
    model: route.model,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.25,
    stream: false,
    ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
    ...(route.provider === "deepseek" ? { thinking: { type: "disabled" } } : {}),
  };
}

function geminiRequestBody(prompt, options = {}) {
  return {
    contents: [{
      role: "user",
      parts: [{ text: prompt }],
    }],
    generationConfig: {
      temperature: 0.25,
      ...(options.maxTokens ? { maxOutputTokens: options.maxTokens } : {}),
      thinkingConfig: { thinkingLevel: "low" },
    },
  };
}

function extractAiReport(body, route, env) {
  if (route.provider !== "gemini") return extractOpenAiCompatibleReport(body, route, env);
  const candidate = body?.candidates?.[0];
  if (!candidate) {
    return { finishReason: null, markdown: "", error: sanitizeAiMessage(body?.error?.message || "missing candidates[0]", env) };
  }
  const finishReason = candidate.finishReason ?? null;
  const parts = candidate.content?.parts ?? [];
  const markdown = parts
    .filter((part) => typeof part.text === "string" && !part.thought)
    .map((part) => part.text)
    .join("")
    .trim();
  return {
    finishReason,
    markdown,
    error: markdown ? null : `missing non-thought text for model ${route.model}`,
  };
}

function extractOpenAiCompatibleReport(body, route, env) {
  const choice = body?.choices?.[0];
  if (!choice) {
    return { finishReason: null, markdown: "", error: sanitizeAiMessage(body?.error?.message || "missing choices[0]", env) };
  }
  const markdown = typeof choice.message?.content === "string" ? choice.message.content.trim() : "";
  const finishReason = normalizeFinishReason(choice.finish_reason);
  return {
    finishReason,
    markdown,
    error: markdown ? null : `missing assistant content for model ${route.model}`,
  };
}

function normalizeFinishReason(reason) {
  if (typeof reason !== "string") return reason ?? null;
  if (reason.toLowerCase() === "stop") return "STOP";
  if (["length", "max_tokens"].includes(reason.toLowerCase())) return "MAX_TOKENS";
  return reason.toUpperCase();
}

function aiFailureDiagnostic(status, route, extracted, env) {
  const finish = extracted.finishReason || "missing";
  const message = extracted.error ? `: ${sanitizeAiMessage(extracted.error, env)}` : "";
  return `AI report failed (${status}, provider: ${route.provider}, model: ${route.model}, finishReason: ${finish})${message}`;
}

function reportMetadata(route, body, extracted, attempts) {
  const usage = route.provider === "gemini" ? (body?.usageMetadata ?? {}) : (body?.usage ?? {});
  return {
    aiProvider: route.provider,
    aiModel: route.model,
    ...(route.provider === "gemini" ? { geminiModel: route.model } : {}),
    finishReason: extracted.finishReason || "missing",
    outputCharacters: extracted.markdown.length,
    outputTokenCount: usage.candidatesTokenCount ?? usage.outputTokenCount ?? usage.completion_tokens ?? null,
    thoughtsTokenCount: usage.thoughtsTokenCount ?? usage.completion_tokens_details?.reasoning_tokens ?? usage.reasoning_tokens ?? null,
    totalTokenCount: usage.totalTokenCount ?? usage.total_tokens ?? null,
    generationAttempts: attempts,
    generatedAt: new Date().toISOString(),
    validation: "not_run",
  };
}

export function validateReportCompleteness(markdown, symbols, compact = null) {
  const errors = [];
  validateTopLevelSections(markdown, errors);
  for (const section of REQUIRED_REPORT_SECTIONS) {
    if (!sectionBody(markdown, section)) errors.push(`missing section: ${section}`);
  }

  const executive = sectionBody(markdown, "Executive Summary");
  const executiveBullets = executive.split("\n").filter((line) => /^\s*[-*]\s+/.test(line));
  if (executiveBullets.length !== 5) errors.push(`Executive Summary must contain exactly five bullets, received ${executiveBullets.length}`);
  for (const label of REQUIRED_EXECUTIVE_LABELS) {
    if (!new RegExp(`\\*{0,2}${escapeRegExp(label)}\\*{0,2}\\s*:`, "i").test(executive)) errors.push(`missing Executive Summary field: ${label}`);
  }
  const eventLabels = EXECUTIVE_EVENT_LABELS.filter((label) => new RegExp(`\\*{0,2}${escapeRegExp(label)}\\*{0,2}\\s*:`, "i").test(executive));
  if (eventLabels.length !== 1) errors.push(`Executive Summary must contain exactly one event field: ${EXECUTIVE_EVENT_LABELS.join(" or ")}`);
  const context = sectionBody(markdown, "Overnight and Market Context");
  for (const label of REQUIRED_CONTEXT_LABELS) {
    if (!new RegExp(`(?:\\*{0,2})${escapeRegExp(label)}(?:\\*{0,2})\\s*:`, "i").test(context)) {
      errors.push(`missing Overnight and Market Context field: ${label}`);
    }
  }
  validateAvailableContextIsUsed(context, compact, errors);
  validateDashboardTable(sectionBody(markdown, "AI Cycle Dashboard"), Object.keys(AI_CYCLE_SEGMENTS), "AI Cycle Dashboard", compact?.decisionFramework?.aiCycle, errors);
  validateDashboardTable(sectionBody(markdown, "Sector Scorecard"), Object.keys(SECTOR_MEMBERS), "Sector Scorecard", compact?.decisionFramework?.sectorScorecard, errors);
  validateWatchlistTable(sectionBody(markdown, "Watchlist"), compact, errors);
  validateReportIdentity(markdown, compact, errors);
  validateTickerScope(markdown, compact, errors, symbols);
  validatePortfolioAndBalanceSheetClaims(markdown, compact, errors);
  validateUnsupportedClaims(markdown, compact, errors);
  if (markdown.length < 700) errors.push("report is shorter than the minimum insight length");
  if (endsIncomplete(markdown)) errors.push("report ends with an incomplete sentence");
  return { ok: errors.length === 0, errors };
}

function validateTopLevelSections(markdown, errors) {
  const headings = [...markdown.matchAll(/^#\s+(.+)$/gm)].map((match) => match[1].trim());
  const sections = headings.filter((heading) => !/^Growth Tech Morning Brief\b/i.test(heading));
  if (sections.length !== REQUIRED_REPORT_SECTIONS.length || sections.some((section, index) => section !== REQUIRED_REPORT_SECTIONS[index])) {
    errors.push(`top-level sections must be exactly: ${REQUIRED_REPORT_SECTIONS.join("; ")}`);
  }
}

function validateDashboardTable(section, requiredRows, label, expected, errors) {
  if (!/\|\s*(?:Segment|Sector)\s*\|/i.test(section)) errors.push(`${label} must contain a Markdown table`);
  const table = parseMarkdownTable(section);
  const headers = table.headers.map(normalizeCell);
  const labelIndex = label === "AI Cycle Dashboard" ? headers.indexOf("segment") : headers.indexOf("sector");
  for (const rowLabel of requiredRows) {
    const row = table.rows.find((candidate) => normalizeCell(candidate[labelIndex]) === normalizeCell(rowLabel));
    if (!row) {
      errors.push(`${label} missing row: ${rowLabel}`);
      continue;
    }
    const fields = label === "AI Cycle Dashboard" ? ["rating", "trend", "evidence", "limitation"] : ["fundamentals", "valuation", "momentum", "stance"];
    for (const field of fields) {
      const header = field === "stance" ? "Sector Stance" : field;
      const index = headers.indexOf(normalizeCell(header));
      if (expected?.[rowLabel]?.[field] !== undefined && normalizeCell(row[index]) !== normalizeCell(expected[rowLabel][field])) {
        errors.push(`${label} ${rowLabel} changed deterministic ${field}`);
      }
    }
  }
}

function parseMarkdownTable(section) {
  const lines = section.split("\n").filter((line) => /^\s*\|.*\|\s*$/.test(line));
  if (lines.length < 2) return { headers: [], rows: [] };
  const cells = (line) => line.split("|").slice(1, -1).map((cell) => cell.trim());
  const headers = cells(lines[0]);
  const rows = lines.slice(1).filter((line) => !/^\s*\|(?:\s*:?-+:?\s*\|)+\s*$/.test(line)).map(cells);
  return { headers, rows };
}

function validateWatchlistTable(section, compact, errors) {
  const expectedHeaders = ["Symbol", "Price", "Daily Change", "52-Week Position", "Valuation", "Trailing 5Y Percentile", "Implied Value (Bear/Base/Bull)", "Base Upside / Bear-Case Return", "Valuation Threshold", "Suggested Buy Target / Buy Zone", "Valuation Signal", "Catalyst", "Risk", "Final Action", "Action Change / Reason", "Rerating Path", "Recommendation Gate Result", "Research Status"];
  const table = parseMarkdownTable(section);
  const normalizedHeaders = table.headers.map(normalizeCell);
  for (const header of expectedHeaders) if (!normalizedHeaders.includes(normalizeCell(header))) errors.push(`Watchlist missing column: ${header}`);
  const symbolIndex = normalizedHeaders.indexOf(normalizeCell("Symbol"));
  const actionIndex = normalizedHeaders.indexOf(normalizeCell("Final Action"));
  const statusIndex = normalizedHeaders.indexOf(normalizeCell("Research Status"));
  const targetIndex = normalizedHeaders.indexOf(normalizeCell("Implied Value (Bear/Base/Bull)"));
  const researchSymbols = new Set(compact?.researchSymbols ?? (compact?.research?.packets ?? []).map((packet) => packet.symbol));
  for (const expected of compact?.watchlist ?? []) {
    const row = table.rows.find((candidate) => normalizeCell(candidate[symbolIndex]) === normalizeCell(expected.symbol));
    if (!row) {
      errors.push(`Watchlist missing core symbol: ${expected.symbol}`);
      continue;
    }
    const actionText = String(row[actionIndex] ?? "").replace(/[*`_]/g, "").trim();
    const action = actionText.replace(/\s/g, "");
    if (!/^(Buynow|Buyonweakness|Sell|Reviewpositionsize|Watch|Noaction|Wait)$/i.test(action)) errors.push(`Watchlist invalid Final Action for ${expected.symbol}`);
    if (!researchSymbols.has(expected.symbol)) {
      if (!/^Wait$/i.test(action)) errors.push(`unresearched watchlist symbol must be Wait: ${expected.symbol}`);
      if (!/not\s+researched/i.test(row[statusIndex] ?? "")) errors.push(`unresearched watchlist symbol must disclose research status: ${expected.symbol}`);
      if (!/target\s+unavailable/i.test(row[targetIndex] ?? "")) errors.push(`unresearched watchlist symbol cannot receive target: ${expected.symbol}`);
    } else if (expected.finalAction && normalizeCell(actionText) !== normalizeCell(expected.finalAction)) {
      errors.push(`Watchlist Final Action changed deterministic gate result: ${expected.symbol}`);
    }
    if (expected.recommendationGateResult && normalizeCell(row[normalizedHeaders.indexOf(normalizeCell("Recommendation Gate Result"))]) !== normalizeCell(expected.recommendationGateResult)) {
      errors.push(`Watchlist changed Recommendation Gate Result: ${expected.symbol}`);
    }
    if (normalizeCell(row[normalizedHeaders.indexOf(normalizeCell("Action Change / Reason"))]) !== normalizeCell(actionMemoryDisplay(expected.actionMemory))) {
      errors.push(`Watchlist changed Action Change / Reason: ${expected.symbol}`);
    }
    if (normalizeCell(row[normalizedHeaders.indexOf(normalizeCell("Rerating Path"))]) !== normalizeCell(reratingPathDisplay(expected))) {
      errors.push(`Watchlist changed Rerating Path: ${expected.symbol}`);
    }
    const expectedCatalyst = expected.catalystState ? catalystFor(expected.catalystState) : expected.catalyst;
    if (expectedCatalyst && normalizeCell(row[normalizedHeaders.indexOf(normalizeCell("Catalyst"))]) !== normalizeCell(tableCell(expectedCatalyst))) {
      errors.push(`Watchlist changed deterministic catalyst state: ${expected.symbol}`);
    }
    validateRenderedTarget(row, normalizedHeaders, expected, errors);
  }
  const recommendedActions = compact?.research?.funnel?.recommendedActions;
  if (recommendedActions === 0) {
    const tradeActions = table.rows.filter((row) => /^(Buynow|Buyonweakness|Sell)$/i.test(String(row[actionIndex] ?? "").replace(/[\s*`_]/g, "")));
    if (tradeActions.length) errors.push("recommendedActions=0 forbids Buy/Sell in Watchlist Final Action");
  }
}

function validateRenderedTarget(row, headers, expected, errors) {
  const target = expected.targetAndMispricing;
  const cell = (name) => row[headers.indexOf(normalizeCell(name))] ?? "";
  if (target?.status !== "available") {
    if (!/target\s+unavailable/i.test(cell("Implied Value (Bear/Base/Bull)"))) errors.push(`Watchlist must mark target unavailable: ${expected.symbol}`);
    return;
  }
  const expectedValues = [target.bearValue, target.baseValue, target.bullValue].map(money);
  for (const value of expectedValues) if (!cell("Implied Value (Bear/Base/Bull)").includes(value)) errors.push(`Watchlist changed deterministic target value for ${expected.symbol}: ${value}`);
  if (!cell("Base Upside / Bear-Case Return").includes(percent(target.baseUpsidePercent, true))) errors.push(`Watchlist changed deterministic base upside: ${expected.symbol}`);
  if (!cell("Base Upside / Bear-Case Return").includes(percent(bearCaseReturnPercent(target), true))) errors.push(`Watchlist changed deterministic bear-case return: ${expected.symbol}`);
  if (!cell("Base Upside / Bear-Case Return").includes(riskRewardDisplay(target))) errors.push(`Watchlist changed deterministic risk/reward: ${expected.symbol}`);
  if (!cell("Valuation Threshold").includes(preferredEntryDisplay(expected, target))) errors.push(`Watchlist changed deterministic valuation threshold: ${expected.symbol}`);
  if (!cell("Suggested Buy Target / Buy Zone").includes(executableBuyZoneDisplay(expected, target))) errors.push(`Watchlist changed deterministic buy zone: ${expected.symbol}`);
  if (!cell("Valuation Signal").includes(String(target.valuationAdjustment))) errors.push(`Watchlist changed deterministic valuation adjustment: ${expected.symbol}`);
  if (!cell("Valuation Signal").includes(target.confidence)) errors.push(`Watchlist changed deterministic target confidence: ${expected.symbol}`);
}

function validatePortfolioAndBalanceSheetClaims(markdown, compact, errors) {
  if (!compact?.portfolio && /\btrim\b/i.test(markdown)) errors.push("Trim is forbidden without portfolio holdings and target weights");
  if (!compact?.portfolio && /\breview position size\b/i.test(markdown)) errors.push("Review position size is forbidden without portfolio holdings and target weights");
  for (const packet of compact?.research?.packets ?? []) {
    const symbol = packet.symbol;
    const lines = markdown.split("\n").filter((line) => new RegExp(`\\b${escapeRegExp(symbol)}\\b`).test(line));
    const netDebt = packet.sourceSnapshot?.fundamentals?.netDebt;
    if (Number.isFinite(netDebt) && netDebt < 0) for (const line of lines) {
      if (/\b(?:debt load|high debt|significant net debt|balance[- ]sheet weakness|net debt position)\b/i.test(line) && !/\bnet cash\b/i.test(line)) {
        errors.push(`negative netDebt misclassified instead of net cash: ${symbol}`);
      }
    }
    const setup = packet.sourceSnapshot?.setup;
    const catalystState = setup?.catalystState ?? legacyCatalystState(setup);
    if (setup?.extremeTrim && !catalystState.verified) for (const line of lines) {
      if (/\b(?:overweight|lock(?:ing)? in gains|sell a portion|trim (?:the |your |an? )?position|position is likely|benchmark weight)\b/i.test(line)) {
        errors.push(`portfolio-specific Trim assumption without holdings: ${symbol}`);
      }
    }
  }
}

function validateReportIdentity(markdown, compact, errors) {
  const expectedMode = compact?.reportMode ?? "standard";
  if (!new RegExp(`\\*{0,2}Report Mode\\*{0,2}\\s*:\\*{0,2}\\s*${escapeRegExp(expectedMode)}\\b`, "i").test(markdown)) errors.push(`report must identify Report Mode: ${expectedMode}`);
  const expectedVersion = compact?.engineVersion ?? SERVICE_VERSION;
  if (!new RegExp(`\\*{0,2}Engine Version\\*{0,2}\\s*:\\*{0,2}\\s*${escapeRegExp(expectedVersion)}\\b`, "i").test(markdown)) errors.push("verbose report must identify the current engine version");
  const expectedBuild = compact?.buildRevision ?? BUILD_REVISION;
  if (!new RegExp(`\\*{0,2}Build Revision\\*{0,2}\\s*:\\*{0,2}\\s*${escapeRegExp(expectedBuild)}\\b`, "i").test(markdown)) errors.push("report must identify the current build revision");
  if (!/\*{0,2}Report ID\*{0,2}\s*:\*{0,2}\s*[0-9a-f-]{16,}\b/i.test(markdown)) errors.push("report must identify a unique report ID");
  if (/^##\s+Research Audit\s*$/mi.test(markdown)) errors.push("Research Audit must be stored separately from the Morning Brief");
}

function validateTickerScope(markdown, compact, errors, fallbackSymbols = []) {
  const packetSymbols = (compact?.research?.packets ?? []).map((packet) => packet.symbol);
  const researchSymbols = new Set(compact?.researchSymbols ?? (packetSymbols.length ? packetSymbols : fallbackSymbols ?? []));
  const contextOnlySymbols = new Set(compact?.contextOnlySymbols ?? []);
  const knownEquities = new Set([...Object.keys(CIKS), ...(compact?.discovery?.admittedSymbols ?? []), ...contextOnlySymbols]);
  const executive = sectionBody(markdown, "Executive Summary");
  for (const token of new Set(executive.match(/\b[A-Z.]{2,8}\b/g) ?? [])) {
    if (knownEquities.has(token) && token !== "SPY" && !researchSymbols.has(token)) {
      errors.push(`ticker reference outside research universe in Executive Summary: ${token}`);
    }
  }

  for (const line of sectionBody(markdown, "Overnight and Market Context").split("\n")) {
    const symbols = [...contextOnlySymbols].filter((symbol) => new RegExp(`\\b${escapeRegExp(symbol)}\\b`).test(line));
    if (symbols.length && /\b(?:buy(?: now| on weakness)?|sell|trim|hold|avoid|under(?:valued|rated)|overvalued|mispriced|target price|preferred entry|rating)\b/i.test(line)) {
      for (const symbol of symbols) errors.push(`context-only ticker received investment judgment: ${symbol}`);
    }
  }
}

function validateUnsupportedClaims(markdown, compact, errors) {
  const unsupported = [
    [/\b(?:GPU|AI|inference) demand (?:is |remains |looks )?(?:robust|strong|accelerating|rising)\b/i, "unsupported demand claim"],
    [/\b(?:capex|capital expenditure) cycle (?:is |remains )?(?:intact|accelerating|rising|strong)\b/i, "unsupported CapEx-cycle claim"],
    [/\binstitutional (?:buying|selling|volume|flows?)\b/i, "unsupported institutional-flow claim"],
  ];
  for (const [pattern, label] of unsupported) if (pattern.test(markdown)) errors.push(label);
}

function normalizeCell(value) {
  return String(value ?? "").replace(/[\s*`_]/g, "").toLowerCase();
}

function sectionBody(markdown, section) {
  const pattern = new RegExp(`^#{1,2}\\s+${escapeRegExp(section)}\\s*$`, "im");
  const match = pattern.exec(markdown);
  if (!match) return "";
  const start = match.index + match[0].length;
  const rest = markdown.slice(start);
  const next = /^#{1,2}\s+/m.exec(rest);
  return (next ? rest.slice(0, next.index) : rest).trim();
}

function validateAvailableContextIsUsed(overnight, compact, errors) {
  if (!compact) return;
  const categories = [
    ["Futures", compact.marketContext?.futures],
    ["Rates", compact.marketContext?.rates],
    ["Dollar", compact.marketContext?.usd],
    ["Oil", compact.marketContext?.oil],
  ];
  for (const [label, context] of categories) {
    const line = overnight.split("\n").find((candidate) => new RegExp(`${escapeRegExp(label)}(?:\\*{0,2})\\s*:`, "i").test(candidate));
    const renderedStatus = contextCategoryStatus(line, label);
    if (context?.status === "available" && renderedStatus !== "available") {
      errors.push(`available context incorrectly marked unavailable: ${label}`);
    }
    if (context?.status === "unavailable" && renderedStatus !== "unavailable") {
      errors.push(`unavailable context not flagged unavailable: ${label}`);
    }
  }
}

function contextCategoryStatus(line, label) {
  if (!line) return null;
  const match = line.match(new RegExp(`${escapeRegExp(label)}(?:\\*{0,2})\\s*:\\s*(?:\\*{0,2})?\\s*(available|unavailable)\\b`, "i"));
  return match?.[1]?.toLowerCase() ?? null;
}

function validAction(value) {
  return /^(Buy|Hold|Wait|Avoid)$/i.test(value.replace(/[\s*`_]/g, ""));
}

function endsIncomplete(markdown) {
  const text = markdown.trim();
  if (!text) return true;
  if (/[.!?)|]$/.test(text)) return false;
  const lastLine = text.split("\n").filter(Boolean).at(-1) || "";
  return !/^\s*[-*]?\s*[A-Z0-9.]+[:|]/.test(lastLine);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function requestedReportMode(options) {
  if (options?.reportMode !== undefined) return cleanReportMode(options.reportMode);
  if (options?.verbose === true) return "verbose";
  if (options?.verbose === false) return "standard";
  return null;
}

function selectedReportMode(env, override = null) {
  return cleanReportMode(override ?? env.REPORT_MODE ?? "standard");
}

function cleanReportMode(value) {
  const mode = String(value ?? "").trim().toLowerCase();
  if (!REPORT_MODES.has(mode)) throw new Error("reportMode must be standard or verbose");
  return mode;
}

function requestedAiRoute(options) {
  const provider = cleanRouteValue(options?.provider, "provider");
  const model = cleanRouteValue(options?.model, "model");
  return provider || model ? { ...(provider ? { provider } : {}), ...(model ? { model } : {}) } : null;
}

function cleanRouteValue(value, field) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.length > 128 || !/^[a-zA-Z0-9._:/-]+$/.test(value)) {
    throw new Error(`Invalid AI ${field}`);
  }
  return value;
}

function selectedAiRoute(env, override = null) {
  const provider = (override?.provider || env.AI_PROVIDER || DEFAULT_AI_PROVIDER).toLowerCase();
  if (!ALLOWED_AI_PROVIDERS.has(provider)) throw new Error(`Unsupported AI provider: ${provider}`);
  if (provider === "gemini") {
    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");
    return { provider, model: override?.model || env.AI_MODEL || env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL, apiKey };
  }
  if (provider === "deepseek") {
    const apiKey = env.DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error("DEEPSEEK_API_KEY is not configured");
    return {
      provider,
      model: override?.model || env.AI_MODEL || env.DEEPSEEK_MODEL || DEFAULT_DEEPSEEK_MODEL,
      apiKey,
      baseUrl: validatedBaseUrl(env.DEEPSEEK_BASE_URL || DEEPSEEK_API_BASE, "DEEPSEEK_BASE_URL"),
    };
  }
  const apiKey = env.OPENAI_COMPAT_API_KEY;
  if (!apiKey) throw new Error("OPENAI_COMPAT_API_KEY is not configured");
  if (!env.OPENAI_COMPAT_BASE_URL) throw new Error("OPENAI_COMPAT_BASE_URL is not configured");
  const model = override?.model || env.AI_MODEL || env.OPENAI_COMPAT_MODEL;
  if (!model) throw new Error("OPENAI_COMPAT_MODEL is not configured");
  return {
    provider,
    model,
    apiKey,
    baseUrl: validatedBaseUrl(env.OPENAI_COMPAT_BASE_URL, "OPENAI_COMPAT_BASE_URL"),
  };
}

function validatedBaseUrl(value, name) {
  let url;
  try { url = new URL(value); } catch { throw new Error(`${name} must be a valid HTTPS URL`); }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw new Error(`${name} must be a credential-free HTTPS URL without query or fragment`);
  }
  return url.toString().replace(/\/$/, "");
}

function sanitizeAiMessage(message, env) {
  const fallback = "unknown error";
  let text = typeof message === "string" && message.trim() ? message : fallback;
  for (const secret of [env.GEMINI_API_KEY, env.DEEPSEEK_API_KEY, env.OPENAI_COMPAT_API_KEY]) {
    if (secret) text = text.replaceAll(secret, "[redacted]");
  }
  return text;
}

async function storeReport(env, reportDate, markdown, metadata = {}) {
  const options = {
    httpMetadata: { contentType: "text/markdown; charset=utf-8" },
    customMetadata: stringifyMetadata({
      reportDate,
      aiProvider: metadata.aiProvider,
      aiModel: metadata.aiModel,
      geminiModel: metadata.geminiModel,
      finishReason: metadata.finishReason,
      outputCharacters: metadata.outputCharacters,
      outputTokenCount: metadata.outputTokenCount,
      thoughtsTokenCount: metadata.thoughtsTokenCount,
      totalTokenCount: metadata.totalTokenCount,
      generationAttempts: metadata.generationAttempts,
      generatedAt: metadata.generatedAt,
      validation: metadata.validation,
      validationErrors: metadata.validationErrors,
      pipeline: metadata.pipeline,
      researchBatches: metadata.researchBatches,
      researchComplete: metadata.researchComplete,
      researchIncomplete: metadata.researchIncomplete,
      researchPacketStorage: metadata.researchPacketStorage,
      reportMode: metadata.reportMode,
      engineVersion: metadata.engineVersion ?? SERVICE_VERSION,
      buildRevision: metadata.buildRevision ?? BUILD_REVISION,
      reportId: metadata.reportId,
      contentHash: metadata.contentHash,
    }),
  };
  await Promise.all([
    env.BRIEF_BUCKET.put(`reports/${reportDate}.md`, markdown, options),
    env.BRIEF_BUCKET.put("reports/latest.md", markdown, options),
  ]);
  return {
    stored: true,
    datedKey: `reports/${reportDate}.md`,
    latestKey: "reports/latest.md",
    reportId: metadata.reportId ?? null,
    contentHash: metadata.contentHash ?? null,
    buildRevision: metadata.buildRevision ?? BUILD_REVISION,
  };
}

function stringifyMetadata(metadata) {
  return Object.fromEntries(Object.entries(metadata)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => [key, String(value)]));
}

async function deliverLatestReport(env, now) {
  if (!env.BRIEF_BUCKET?.get) return { skipped: true, reason: "r2_not_configured" };
  const latestObject = await env.BRIEF_BUCKET.get("reports/latest.md");
  if (!latestObject) {
    const error = new Error("reports/latest.md was not found");
    error.code = "NO_REPORT_YET";
    throw error;
  }
  const markdown = await latestObject.text();
  const reportDate = reportDateFromObject(latestObject) || zonedParts(now, "America/New_York").date;
  const webhook = await settleDelivery(() => sendReportWebhook(env, reportDate, markdown));
  if (env.BRIEF_BUCKET?.put) await storeDeliveryReceipt(env, reportDate, webhook);
  return { date: reportDate, webhook };
}

async function deliverReportWebhookOnce(env, reportDate, markdown, options = {}) {
  const receipt = await readDeliveryReceipt(env, reportDate);
  if (!options.force && receipt?.discord?.sent) {
    return { skipped: true, reason: "discord_already_delivered", receipt: receipt.discord };
  }
  if (!options.force && !options.retryPending && receipt) {
    return { skipped: true, reason: "delivery_retry_not_requested" };
  }
  const webhook = await settleDelivery(() => sendReportWebhook(env, reportDate, markdown));
  await storeDeliveryReceipt(env, reportDate, webhook);
  return webhook;
}

async function readDeliveryReceipt(env, reportDate) {
  const object = await env.BRIEF_BUCKET?.get?.(`deliveries/${reportDate}.json`);
  if (!object) return null;
  return object.json().catch(() => null);
}

async function storeDeliveryReceipt(env, reportDate, webhook) {
  if (!env.BRIEF_BUCKET?.put) return;
  const payload = {
    date: reportDate,
    updatedAt: new Date().toISOString(),
    discord: {
      sent: webhook?.provider === "discord" && webhook?.sent === true,
      failed: webhook?.failed === true,
      skipped: webhook?.skipped === true,
      reason: webhook?.reason,
      error: webhook?.error,
      messages: webhook?.messages ?? null,
      attachment: webhook?.attachment ?? null,
      fingerprint: webhook?.fingerprint ?? null,
      expectedChunks: webhook?.chunks?.expected ?? null,
      deliveredChunks: webhook?.chunks?.delivered ?? null,
      failedChunks: webhook?.chunks?.failed ?? null,
      timestamp: new Date().toISOString(),
    },
  };
  await env.BRIEF_BUCKET.put(`deliveries/${reportDate}.json`, JSON.stringify(payload, null, 2), {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
  });
}

async function resetDeliveryReceipt(env, reportDate, metadata = {}) {
  if (!env.BRIEF_BUCKET?.put) return;
  const payload = {
    date: reportDate,
    updatedAt: new Date().toISOString(),
    report: stringifyMetadata({
      aiProvider: metadata.aiProvider,
      aiModel: metadata.aiModel,
      geminiModel: metadata.geminiModel,
      generatedAt: metadata.generatedAt,
      engineVersion: metadata.engineVersion,
      buildRevision: metadata.buildRevision,
      reportId: metadata.reportId,
      contentHash: metadata.contentHash,
    }),
    discord: {
      sent: false,
      skipped: true,
      reason: "report_regenerated",
      timestamp: new Date().toISOString(),
    },
  };
  await env.BRIEF_BUCKET.put(`deliveries/${reportDate}.json`, JSON.stringify(payload, null, 2), {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
  });
}

function reportDateFromObject(object) {
  const metadataDate = object?.customMetadata?.reportDate || object?.httpMetadata?.reportDate;
  if (/^\d{4}-\d{2}-\d{2}$/.test(metadataDate)) return metadataDate;
  if (object?.uploaded instanceof Date) return zonedParts(object.uploaded, "America/New_York").date;
  return null;
}

export async function sendReportEmail(env, reportDate, markdown) {
  if (!env.RESEND_API_KEY || !env.REPORT_TO_EMAIL || !env.REPORT_FROM_EMAIL) {
    return { skipped: true, reason: "email_not_configured" };
  }
  const response = await fetch(RESEND_EMAILS, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json",
      "idempotency-key": `growth-tech-morning-brief-${reportDate}`,
    },
    body: JSON.stringify({
      from: env.REPORT_FROM_EMAIL,
      to: [env.REPORT_TO_EMAIL],
      subject: `Growth Tech Morning Brief — ${reportDate}`,
      text: markdown,
      html: markdownToHtml(markdown),
    }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`Resend email failed (${response.status}): ${body?.message ?? body?.error ?? "unknown error"}`);
  return { sent: true, id: body?.id ?? null };
}

export async function sendReportWebhook(env, reportDate, markdown) {
  const discordUrl = env.DISCORD_WEBHOOK_URL || (isDiscordWebhook(env.WEBHOOK_URL) ? env.WEBHOOK_URL : null);
  if (discordUrl) {
    const fingerprint = await reportFingerprint(markdown);
    try {
      await postDiscordReport(discordUrl, reportDate, markdown, fingerprint);
    } catch (error) {
      error.chunks = { expected: 1, delivered: 0, failed: 1 };
      error.fingerprint = fingerprint;
      throw error;
    }
    return {
      sent: true,
      provider: "discord",
      messages: 1,
      attachment: `growth-tech-morning-brief-${reportDate}.md`,
      fingerprint,
      chunks: { expected: 1, delivered: 1, failed: 0 },
    };
  }
  if (!env.WEBHOOK_URL) return { skipped: true, reason: "webhook_not_configured" };
  await postWebhookJson(env.WEBHOOK_URL, { date: reportDate, markdown }, "Webhook delivery failed");
  return { sent: true, provider: "generic" };
}

function discordPayload(content) {
  return {
    username: "Stock Analyst Bot",
    avatar_url: "https://i.imgur.com/4M34hi2.png",
    content,
  };
}

async function postDiscordReport(url, reportDate, markdown, fingerprint) {
  const summary = discordReportSummary(reportDate, markdown, fingerprint);
  const filename = `growth-tech-morning-brief-${reportDate}.md`;
  await postWithRetry(async () => {
    const form = new FormData();
    form.append("payload_json", JSON.stringify(discordPayload(summary)));
    form.append("files[0]", new Blob([markdown], { type: "text/markdown; charset=utf-8" }), filename);
    return fetch(url, { method: "POST", body: form });
  }, "Discord report attachment delivery failed");
}

function discordReportSummary(reportDate, markdown, fingerprint) {
  const title = markdown.split("\n").find((line) => /^#\s+/.test(line))?.replace(/^#\s+/, "")
    || `Growth Tech Morning Brief — ${reportDate}`;
  const verdict = sectionBody(markdown, "Executive Summary") || "The complete report is attached.";
  const summary = `**${title}**\n${verdict}\n\nFull verbose report attached. ID: \`${fingerprint.slice(0, 12)}\``;
  return summary.length <= 1800 ? summary : `${summary.slice(0, 1740).trim()}…\n\nFull verbose report attached. ID: \`${fingerprint.slice(0, 12)}\``;
}

async function reportFingerprint(markdown) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(markdown));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function postWebhookJson(url, payload, label) {
  await postWithRetry(() => postJson(url, payload), label, 1);
}

async function postWithRetry(request, label, maxAttempts = MAX_DISCORD_ATTEMPTS) {
  let response;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    response = await request();
    if (response.ok) return response;
    if (attempt >= maxAttempts || (response.status !== 429 && response.status < 500)) break;
    await sleep(await discordRetryDelayMs(response, attempt));
  }
  const body = await response?.text().catch(() => "");
  throw new Error(`${label} (${response?.status ?? "unknown"})${body ? `: ${body}` : ""}`);
}

function postJson(url, payload) {
  return fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

async function discordRetryDelayMs(response, attempt = 1) {
  const header = Number(response.headers.get("retry-after"));
  if (Number.isFinite(header)) return Math.max(0, header * 1000);
  const body = await response.clone().json().catch(() => null);
  const retryAfter = Number(body?.retry_after);
  if (Number.isFinite(retryAfter)) return Math.max(0, retryAfter * 1000);
  return Math.min(8000, 500 * (2 ** (attempt - 1)));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isDiscordWebhook(url) {
  try {
    const { hostname, pathname } = new URL(url);
    return (hostname === "discord.com" || hostname === "discordapp.com")
      && pathname.startsWith("/api/webhooks/");
  } catch {
    return false;
  }
}

async function settleDelivery(delivery) {
  try {
    return await delivery();
  } catch (error) {
    console.error(error);
    return { failed: true, error: errorMessage(error), ...(error?.chunks ? { chunks: error.chunks } : {}), ...(error?.fingerprint ? { fingerprint: error.fingerprint } : {}) };
  }
}

function markdownToHtml(markdown) {
  return markdown.split("\n").map((line) => {
    const escaped = escapeHtml(line);
    if (line.startsWith("# ")) return `<h1>${escaped.slice(2)}</h1>`;
    if (line.startsWith("## ")) return `<h2>${escaped.slice(3)}</h2>`;
    if (line.startsWith("### ")) return `<h3>${escaped.slice(4)}</h3>`;
    if (/^\s*[-*]\s+/.test(line)) return `<p>${escaped.replace(/^\s*[-*]\s+/, "• ")}</p>`;
    return line ? `<p>${escaped}</p>` : "";
  }).filter(Boolean).join("\n");
}

function escapeHtml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function compactRow(row) {
  if (row.missing) return { symbol: row.symbol, missing: true, error: row.error };
  const pe = row.valuation?.trailingPE;
  const ps = row.valuation?.trailingPS;
  const usePe = Number.isFinite(pe) && pe > 0;
  return {
    symbol: row.symbol,
    name: row.name,
    price: row.price,
    changePercent: row.changePercent,
    yearLow: row.yearLow,
    yearHigh: row.yearHigh,
    positionIn52WeekRange: row.positionIn52WeekRange,
    valuation: row.valuation ? {
      trailingPE: pe,
      trailingPS: ps,
      trailingPEPercentile5Y: row.valuation.trailingPEPercentile5Y,
      trailingPSPercentile5Y: row.valuation.trailingPSPercentile5Y,
      selectedMetric: usePe ? "trailingPE" : "trailingPS",
      selectedPercentile: usePe ? row.valuation.trailingPEPercentile5Y : row.valuation.trailingPSPercentile5Y,
      fundamentalAsOf: row.valuation.fundamentalAsOf,
    } : null,
    targetAndMispricing: row.targetAndMispricing ?? buildTargetAndMispricing(row),
    reportedGrowth: row.reportedGrowth ?? null,
    fundamentalCacheStatus: row.fundamentals?.cacheStatus ?? null,
    fundamentalCachedAt: row.fundamentals?.cachedAt ?? null,
    fundamentalAsOf: row.valuation?.fundamentalAsOf ?? row.reportedGrowth?.asOf ?? row.fundamentals?.asOf ?? null,
    missing: false,
  };
}

function renderMarkdown(brief) {
  const candidates = brief.opportunityGate.candidates;
  const lines = [
    `# Growth Tech Morning Brief — ${reportDateFor(brief.generatedAt)}`,
    "",
    `Coverage: ${brief.coverage.succeeded}/${brief.coverage.requested}. Session: ${brief.session}.`,
    "",
    candidates.length ? "Candidate setups requiring AI review:" : "No stock cleared the absolute setup gate.",
  ];
  for (const row of candidates) lines.push(`- ${row.symbol}: ${row.setup.reasons.join("; ")}`);
  lines.push("", "This diagnostic is not the AI trade verdict; use the generated report for the final call.");
  return lines.join("\n");
}

function authorized(request, env) {
  return env.RUN_TOKEN_REQUIRED !== "true" || request.headers.get("authorization") === `Bearer ${env.RUN_TOKEN}`;
}

function fmt(value) { return Number.isFinite(value) ? String(value) : "n/a"; }
function signed(value) { return Number.isFinite(value) ? `${value >= 0 ? "+" : ""}${value}` : "n/a"; }

async function fetchYahooChart(symbol, now, env, options = {}) {
  const end = Math.floor(now.getTime() / 1000) + 86400;
  const start = options.historyDays
    ? end - Math.round(options.historyDays * 86400)
    : end - Math.round(HISTORY_YEARS * 365.25 * 86400);
  const url = new URL(`${YAHOO_CHART}/${encodeURIComponent(symbol)}`);
  Object.entries({ period1: start, period2: end, interval: "1d", events: "div,splits", includeAdjustedClose: "true" })
    .forEach(([key, value]) => url.searchParams.set(key, String(value)));
  const response = await fetch(url, { headers: yahooHeaders(env) });
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.chart?.error) {
    throw new Error(`Yahoo chart failed (${response.status}): ${body?.chart?.error?.description ?? symbol}`);
  }
  const result = body?.chart?.result?.[0];
  if (!result) throw new Error(`Yahoo chart returned no data for ${symbol}`);
  return normalizeYahooChart(result);
}

export function normalizeYahooChart(result) {
  const timestamps = result.timestamp ?? [];
  const quote = result.indicators?.quote?.[0] ?? {};
  const adjusted = result.indicators?.adjclose?.[0]?.adjclose ?? quote.close ?? [];
  const history = timestamps.map((timestamp, index) => ({
    date: new Date(timestamp * 1000).toISOString().slice(0, 10),
    close: number(quote.close?.[index]),
    adjustedClose: number(adjusted[index]),
    splitAdjustedClose: number(quote.close?.[index]) ?? number(adjusted[index]),
    volume: number(quote.volume?.[index]),
  })).filter((row) => row.adjustedClose !== null);
  const meta = result.meta ?? {};
  const splits = Object.values(result.events?.splits ?? {}).map((event) => ({
    date: new Date(Number(event.date) * 1000).toISOString().slice(0, 10),
    ratio: Number(event.numerator) > 0 && Number(event.denominator) > 0
      ? Number(event.numerator) / Number(event.denominator)
      : Number(String(event.splitRatio ?? "").split(":")[0]) / Number(String(event.splitRatio ?? "").split(":")[1]),
  })).filter((event) => event.date && Number.isFinite(event.ratio) && event.ratio > 0).sort((a, b) => a.date.localeCompare(b.date));
  const closes = history.map((row) => row.adjustedClose);
  const latest = number(meta.regularMarketPrice) ?? closes.at(-1) ?? null;
  // For multi-year chart requests, chartPreviousClose is the close immediately
  // before the requested range, not the previous trading day's close.
  const rawCloses = history.map((row) => row.close).filter((value) => value !== null);
  const previous = number(meta.regularMarketPreviousClose ?? meta.previousClose) ?? rawCloses.at(-2) ?? null;
  return {
    currency: meta.currency ?? null,
    exchange: meta.exchangeName ?? null,
    name: meta.longName ?? meta.shortName ?? null,
    asOf: Number.isFinite(Number(meta.regularMarketTime)) ? new Date(Number(meta.regularMarketTime) * 1000).toISOString() : null,
    price: latest,
    previousClose: previous,
    change: finitePair(latest, previous) ? latest - previous : null,
    changePercent: finitePair(latest, previous) && previous !== 0 ? ((latest - previous) / previous) * 100 : null,
    history,
    splits,
  };
}

async function fetchSecFundamentals(symbol, env, now, options = {}) {
  const cik = options.cik ?? CIKS[symbol];
  if (!cik) return { available: false, reason: "CIK not configured" };
  const cacheKey = `sec/companyfacts/${cik}.json`;
  let body = null;
  let cachedBody = null;
  let cacheStatus = "miss";
  let cachedAt = null;
  if (env.BRIEF_BUCKET?.get) {
    const cached = await env.BRIEF_BUCKET.get(cacheKey);
    if (cached) {
      const uploaded = cached.uploaded ? new Date(cached.uploaded).getTime() : 0;
      cachedAt = uploaded ? new Date(uploaded).toISOString() : null;
      cachedBody = await cached.json();
      if (now.getTime() - uploaded < 7 * 86400_000) {
        body = cachedBody;
        cacheStatus = "fresh";
      } else {
        cacheStatus = "stale";
      }
    }
  }
  if (!body) {
    const budget = options.networkBudget;
    if (budget && budget.remaining <= 0) {
      if (cachedBody) body = cachedBody;
      else return { available: false, reason: "SEC refresh budget exhausted; no cached CompanyFacts", cacheStatus: "miss" };
    } else {
      if (budget) budget.remaining -= 1;
      const response = await fetch(`${SEC_FACTS}/CIK${cik}.json`, {
        headers: { accept: "application/json", "user-agent": env.SEC_USER_AGENT || "growth-tech-morning-brief research@example.com" },
      });
      if (!response.ok) {
        if (cachedBody) body = cachedBody;
        else throw new Error(`SEC CompanyFacts failed (${response.status})`);
      } else {
        body = await response.json();
        cacheStatus = "refreshed";
        cachedAt = now.toISOString();
        if (env.BRIEF_BUCKET?.put) await env.BRIEF_BUCKET.put(cacheKey, JSON.stringify(body), { httpMetadata: { contentType: "application/json" } });
      }
    }
  }
  return { ...extractSecFundamentals(body), cacheStatus, cachedAt };
}

export function extractSecFundamentals(body) {
  const gaap = body?.facts?.["us-gaap"] ?? {};
  const revenue = factUnits(gaap, ["RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues", "SalesRevenueNet"], "USD");
  const eps = factUnits(gaap, ["EarningsPerShareDiluted"], "USD/shares");
  const shares = factUnits(gaap, ["WeightedAverageNumberOfDilutedSharesOutstanding", "CommonStocksIncludingAdditionalPaidInCapitalMember"], "shares");
  const quarterlyRevenue = quarterlyFacts(revenue, { deriveFourthQuarter: true });
  const quarterlyEps = quarterlyFacts(eps, { deriveFourthQuarter: true });
  const quarterlyShares = quarterlyFacts(shares);
  const cash = latestInstantFact(factUnits(gaap, ["CashAndCashEquivalentsAtCarryingValue", "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents"], "USD"));
  const debtCurrent = latestInstantFact(factUnits(gaap, ["ShortTermBorrowings", "LongTermDebtCurrent"], "USD"));
  const debtLongTerm = latestInstantFact(factUnits(gaap, ["LongTermDebtNoncurrent", "LongTermDebt"], "USD"));
  const debt = [debtCurrent?.value, debtLongTerm?.value].filter(Number.isFinite).reduce((sum, value) => sum + value, 0);
  return {
    available: Boolean(quarterlyRevenue.length || quarterlyEps.length),
    entityName: body?.entityName ?? null,
    quarterlyRevenue,
    quarterlyEps,
    quarterlyShares,
    balanceSheet: {
      cash: cash?.value ?? null,
      debt: debtCurrent || debtLongTerm ? debt : null,
      asOf: [cash?.filed, debtCurrent?.filed, debtLongTerm?.filed].filter(Boolean).sort().at(-1) ?? null,
      basis: "latest reported SEC balance-sheet facts",
    },
  };
}

function latestInstantFact(rows) {
  return rows.filter((row) => row.end && row.filed && Number.isFinite(Number(row.val)))
    .sort((a, b) => a.filed.localeCompare(b.filed) || a.end.localeCompare(b.end))
    .map((row) => ({ end: row.end, filed: row.filed, value: Number(row.val), form: row.form }))
    .at(-1) ?? null;
}

function factUnits(gaap, tags, unit) {
  for (const tag of tags) {
    const units = gaap?.[tag]?.units;
    if (units?.[unit]?.length) return units[unit];
  }
  return [];
}

export function quarterlyFacts(rows, options = {}) {
  const clean = rows.filter((row) => row.form === "10-Q" || row.form === "10-K" || row.form === "20-F" || row.form === "6-K")
    .filter((row) => row.end && row.filed && Number.isFinite(Number(row.val)))
    .sort((a, b) => a.filed.localeCompare(b.filed));
  const byPeriod = new Map();
  const annual = new Map();
  for (const row of clean) {
    const duration = row.start ? (Date.parse(row.end) - Date.parse(row.start)) / 86400_000 : null;
    if (duration !== null && duration > 125) {
      if ((row.form === "10-K" || row.form === "20-F") && options.deriveFourthQuarter) annual.set(String(row.fy), row);
      else if (row.form === "10-K" || row.form === "20-F") {
        byPeriod.set(`${row.fy}-FY`, { end: row.end, filed: row.filed, value: Number(row.val), form: row.form, durationDays: duration });
      }
      continue;
    }
    const key = `${row.fy ?? ""}-${row.fp ?? row.end}`;
    byPeriod.set(key, { end: row.end, filed: row.filed, value: Number(row.val), form: row.form, durationDays: duration });
  }
  if (options.deriveFourthQuarter) {
    for (const [fy, row] of annual) {
      const firstThree = [...byPeriod.entries()].filter(([key]) => key.startsWith(`${fy}-Q`)).map(([, value]) => value).sort((a, b) => a.end.localeCompare(b.end)).slice(0, 3);
      if (firstThree.length === 3) {
        byPeriod.set(`${fy}-Q4`, {
          end: row.end, filed: row.filed,
          value: Number(row.val) - firstThree.reduce((sum, item) => sum + item.value, 0),
          form: row.form, durationDays: null, derivedFromAnnual: true,
        });
      }
    }
  }
  return [...byPeriod.values()].sort((a, b) => a.end.localeCompare(b.end));
}

function assembleSymbol(symbol, chart, fundamentals) {
  const closes = chart.history.map((row) => row.splitAdjustedClose ?? row.close ?? row.adjustedClose).filter(Number.isFinite);
  const window = closes.slice(-252);
  const yearLow = window.length ? Math.min(...window) : null;
  const yearHigh = window.length ? Math.max(...window) : null;
  const valuationHistory = fundamentals.available ? buildValuationHistory(chart.history, fundamentals, chart.splits ?? []) : [];
  const latestValuation = valuationHistory.at(-1) ?? null;
  const currentTrailingPE = latestValuation?.trailingEpsPerShare > 0 ? round(chart.price / latestValuation.trailingEpsPerShare) : null;
  const currentTrailingPS = latestValuation?.trailingRevenuePerShare > 0 ? round(chart.price / latestValuation.trailingRevenuePerShare) : null;
  const row = {
    symbol,
    name: chart.name ?? fundamentals.entityName ?? null,
    currency: chart.currency,
    exchange: chart.exchange,
    price: round(chart.price),
    priceAsOf: chart.asOf ?? chart.history.at(-1)?.date ?? null,
    previousClose: round(chart.previousClose),
    change: round(chart.change),
    changePercent: round(chart.changePercent),
    yearHigh: round(yearHigh),
    yearLow: round(yearLow),
    positionIn52WeekRange: round(rangePosition(chart.price, yearLow, yearHigh)),
    valuation: latestValuation ? {
      trailingPE: currentTrailingPE,
      trailingPS: currentTrailingPS,
      trailingPEPercentile5Y: percentile(currentTrailingPE, valuationHistory.map((x) => x.trailingPE)),
      trailingPSPercentile5Y: percentile(currentTrailingPS, valuationHistory.map((x) => x.trailingPS)),
      fundamentalAsOf: latestValuation.fundamentalAsOf,
    } : null,
    reportedGrowth: fundamentals.available ? reportedGrowth(fundamentals) : null,
    history: chart.history,
    fundamentals: fundamentals.available ? {
      quarterlyRevenue: fundamentals.quarterlyRevenue,
      quarterlyEps: fundamentals.quarterlyEps,
      quarterlyShares: fundamentals.quarterlyShares,
      cacheStatus: fundamentals.cacheStatus ?? null,
      cachedAt: fundamentals.cachedAt ?? null,
    } : fundamentals,
    splits: chart.splits ?? [],
    valuationHistory,
    missing: false,
  };
  row.targetAndMispricing = buildTargetAndMispricing(row);
  return row;
}

export function reportedGrowth(fundamentals) {
  const revenue = fundamentals.quarterlyRevenue ?? [];
  const eps = fundamentals.quarterlyEps ?? [];
  return {
    revenueTtmYoY: ttmGrowth(revenue),
    revenueLatestQuarterYoY: latestQuarterGrowth(revenue),
    epsTtmYoY: ttmGrowth(eps),
    epsLatestQuarterYoY: latestQuarterGrowth(eps),
    asOf: [...revenue, ...eps].map((row) => row.filed).filter(Boolean).sort().at(-1) ?? null,
    basis: "reported SEC filings; not analyst estimates",
  };
}

function ttmGrowth(rows) {
  if (rows.length < 8) return null;
  const current = rows.slice(-4).reduce((sum, row) => sum + row.value, 0);
  const prior = rows.slice(-8, -4).reduce((sum, row) => sum + row.value, 0);
  return prior !== 0 ? round(((current - prior) / Math.abs(prior)) * 100) : null;
}

function latestQuarterGrowth(rows) {
  if (rows.length < 5) return null;
  const latest = rows.at(-1)?.value;
  const priorYear = rows.at(-5)?.value;
  return Number.isFinite(latest) && Number.isFinite(priorYear) && priorYear !== 0
    ? round(((latest - priorYear) / Math.abs(priorYear)) * 100)
    : null;
}

export function buildValuationHistory(prices, fundamentals, splits = []) {
  return prices.map((price) => {
    const splitAdjustedClose = price.splitAdjustedClose ?? price.close ?? price.adjustedClose;
    const availableRevenue = fundamentals.quarterlyRevenue.filter((x) => x.filed <= price.date).slice(-4);
    const availableEps = fundamentals.quarterlyEps.filter((x) => x.filed <= price.date).slice(-4);
    const availableShares = fundamentals.quarterlyShares.filter((x) => x.filed <= price.date).at(-1);
    const revenue = availableRevenue.length === 4 ? availableRevenue.reduce((sum, x) => sum + x.value, 0) : null;
    const eps = availableEps.length === 4 ? availableEps.reduce((sum, x) => sum + splitAdjustedPerShare(x.value, x.filed, splits), 0) : null;
    const shares = availableShares ? availableShares.value * splitFactorAfter(availableShares.filed, splits) : null;
    const trailingPE = eps > 0 ? splitAdjustedClose / eps : null;
    const trailingPS = revenue > 0 && shares > 0 ? (splitAdjustedClose * shares) / revenue : null;
    const filed = [...availableRevenue, ...availableEps, ...(availableShares ? [availableShares] : [])].map((x) => x.filed).sort().at(-1) ?? null;
    return {
      date: price.date, adjustedClose: round(splitAdjustedClose), trailingPE: round(trailingPE), trailingPS: round(trailingPS), fundamentalAsOf: filed,
      trailingEpsPerShare: round(eps), trailingRevenuePerShare: revenue > 0 && shares > 0 ? round(revenue / shares) : null,
      splitBasis: "current-share basis", splitEventsApplied: splits.filter((split) => split.date > filed).length,
    };
  }).filter((row) => row.trailingPE !== null || row.trailingPS !== null);
}

function splitFactorAfter(date, splits) {
  if (!date) return 1;
  return splits.filter((split) => split.date > date).reduce((factor, split) => factor * split.ratio, 1);
}

function splitAdjustedPerShare(value, filed, splits) {
  const factor = splitFactorAfter(filed, splits);
  return Number(value) / factor;
}

export function buildTargetAndMispricing(row) {
  const price = row?.price;
  const history = row?.valuationHistory ?? [];
  const cacheStatus = row?.fundamentals?.cacheStatus ?? row?.fundamentalCacheStatus ?? null;
  if (!Number.isFinite(price) || price <= 0) return unavailableTarget(row, "current price unavailable");
  if (cacheStatus === "stale") return unavailableTarget(row, "SEC fundamentals cache is expired pending refresh");
  if (!["fresh", "refreshed"].includes(cacheStatus)) return unavailableTarget(row, "SEC fundamental freshness is unavailable");
  if ((row?.splits?.length ?? 0) > 0 && history.some((item) => item.splitBasis !== "current-share basis")) {
    return unavailableTarget(row, "split events exist but valuation history is not normalized to current-share basis");
  }
  const preferredMetric = Number.isFinite(row?.valuation?.trailingPE) && row.valuation.trailingPE > 0 ? "trailingPE" : "trailingPS";
  const multiples = history.map((item) => item?.[preferredMetric]).filter((value) => Number.isFinite(value) && value > 0);
  const metricVintages = normalizedMetricVintages(history, preferredMetric);
  if (multiples.length < 126 || metricVintages.length < 2) {
    return unavailableTarget(row, `insufficient trailing history: ${multiples.length} valuation observations and ${metricVintages.length} filing vintages`);
  }
  const recentVintages = metricVintages.slice(-4);
  const normalizedInput = recentVintages.at(-1)?.value;
  const currentMultiple = row?.valuation?.[preferredMetric];
  const impliedCurrentInput = Number.isFinite(currentMultiple) && currentMultiple > 0 ? price / currentMultiple : null;
  const currentInputDifferencePercent = Number.isFinite(impliedCurrentInput) && normalizedInput > 0
    ? round((Math.abs(impliedCurrentInput - normalizedInput) / normalizedInput) * 100)
    : null;
  if (!Number.isFinite(currentInputDifferencePercent) || currentInputDifferencePercent > 10) {
    return unavailableTarget(row, "current TTM input and quoted trailing multiple fail consistency check");
  }
  const vintageMedian = median(recentVintages.map((item) => item.value));
  const vintageDispersionPercent = vintageMedian > 0
    ? round(((Math.max(...recentVintages.map((item) => item.value)) - Math.min(...recentVintages.map((item) => item.value))) / vintageMedian) * 100)
    : null;
  if (!Number.isFinite(vintageDispersionPercent) || vintageDispersionPercent > 200) return unavailableTarget(row, "trailing per-share filing vintages fail dispersion sanity check");
  const bearMultiple = quantile(multiples, 0.25);
  const baseMultiple = quantile(multiples, 0.5);
  const bullMultiple = quantile(multiples, 0.75);
  if (![normalizedInput, bearMultiple, baseMultiple, bullMultiple].every((value) => Number.isFinite(value) && value > 0)) return unavailableTarget(row, "normalized trailing input or historical multiple unavailable");
  const bearValue = round(normalizedInput * bearMultiple);
  const baseValue = round(normalizedInput * baseMultiple);
  const bullValue = round(normalizedInput * bullMultiple);
  const baseUpsidePercent = round(((baseValue - price) / price) * 100);
  const downsideToBearPercent = round(((price - bearValue) / price) * 100);
  const upside = Math.max(0, baseValue - price);
  const downside = Math.max(0, price - bearValue);
  const riskRewardRatio = upside > 0 && downside > 0 ? round(upside / downside) : null;
  const preferredEntryPrice = round(baseValue / 1.2);
  const valuationAdjustment = baseUpsidePercent >= 30 ? 2 : baseUpsidePercent >= 20 ? 1 : baseUpsidePercent >= 10 ? 0 : baseUpsidePercent >= 5 ? -1 : -2;
  const valuationLabel = valuationAdjustment > 0 ? "Opportunity Bonus" : valuationAdjustment < 0 ? "Opportunity Penalty" : "Neutral";
  const confidence = multiples.length >= 756 && metricVintages.length >= 4 && vintageDispersionPercent <= 35
    ? "High"
    : multiples.length >= 252 && metricVintages.length >= 3 && vintageDispersionPercent <= 75 ? "Medium" : "Low";
  const metricLabel = preferredMetric === "trailingPE" ? "normalized TTM EPS/share" : "normalized TTM revenue/share";
  const multipleLabel = preferredMetric === "trailingPE" ? "trailing P/E" : "trailing P/S";
  const buyZones = buildExecutableBuyZones({
    currentPrice: price,
    valuationHistory: history,
    bearValue,
    baseValue,
    preferredEntryPrice,
  });
  return {
    status: "available",
    currentPrice: round(price),
    priceAsOf: row.priceAsOf ?? row.generatedAt ?? null,
    inputAsOf: metricVintages.at(-1)?.asOf ?? row.valuation?.fundamentalAsOf ?? null,
    bearValue, baseValue, bullValue, baseUpsidePercent, downsideToBearPercent, riskRewardRatio, preferredEntryPrice, buyZones,
    method: "trailing-data implied fair-value range",
    metric: preferredMetric,
    normalizedInput: round(normalizedInput),
    normalizedInputVintages: Math.min(4, metricVintages.length), vintageDispersionPercent, currentInputDifferencePercent,
    splitEventsApplied: row?.splits?.length ?? 0, splitBasis: "current-share basis",
    historicalObservations: multiples.length,
    multiplePercentiles: { bear: 25, base: 50, bull: 75 },
    multiples: { bear: round(bearMultiple), base: round(baseMultiple), bull: round(bullMultiple) },
    formula: `${metricLabel} × historical ${multipleLabel} P25/P50/P75`,
    assumptions: "Latest valid TTM per-share input is used; up to four filing vintages test stability. Yahoo adjusted prices and SEC per-share/share facts are normalized to the current split basis; historical multiples use only filings available on each price date.",
    confidence,
    consensusCrossCheck: { status: "unavailable", reason: "no fresh analyst-consensus target source configured" },
    valuationAdjustment,
    valuationLabel,
    calibration: { outcomeStatus: "pending", catalystType: "record with research packet", dataCompleteness: confidence === "Low" ? "limited" : "complete", evaluationHorizons: ["1D", "5D", "1M", "3M"], marketBenchmark: "SPY", sectorBenchmark: null },
  };
}

export function buildExecutableBuyZones({ currentPrice, valuationHistory = [], bearValue, baseValue, preferredEntryPrice }) {
  const closes = [...valuationHistory]
    .filter((row) => row?.date && Number.isFinite(row.adjustedClose) && row.adjustedClose > 0)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .slice(-60)
    .map((row) => row.adjustedClose);
  if (closes.length < 40) return { status: "unavailable", reason: `insufficient recent price history: ${closes.length}/40 observations` };
  const returns = closes.slice(1).map((close, index) => (close / closes[index]) - 1).filter(Number.isFinite).slice(-20);
  const dailyVolatilityPercent = round(standardDeviation(returns) * 100);
  if (!Number.isFinite(dailyVolatilityPercent) || dailyVolatilityPercent <= 0) return { status: "unavailable", reason: "recent realized volatility unavailable" };
  const support25 = quantile(closes, 0.25);
  const support10 = quantile(closes, 0.10);
  const support05 = quantile(closes, 0.05);
  const minimumRiskReward = 2;
  const riskRewardCap = Number.isFinite(bearValue) && Number.isFinite(baseValue) && baseValue > bearValue
    ? (baseValue + minimumRiskReward * bearValue) / (minimumRiskReward + 1)
    : null;
  const highCandidates = [preferredEntryPrice, support25, riskRewardCap].filter((value) => Number.isFinite(value) && value > 0);
  if (!highCandidates.length) return { status: "unavailable", reason: "valuation, support, and risk/reward anchors unavailable" };
  const zoneBandPercent = Math.max(2, Math.min(6, dailyVolatilityPercent * 1.5));
  const suggestedHigh = Math.min(...highCandidates);
  const volatilityFloor = suggestedHigh * (1 - zoneBandPercent / 100);
  const suggestedLow = Math.min(suggestedHigh * 0.995, Math.max(support10, volatilityFloor));
  const strongerHigh = Math.min(suggestedLow * (1 - zoneBandPercent / 100), support10);
  const strongerLow = Math.min(strongerHigh * 0.995, Math.max(support05, strongerHigh * (1 - zoneBandPercent / 100)));
  if (![suggestedLow, suggestedHigh, strongerLow, strongerHigh].every((value) => Number.isFinite(value) && value > 0)
    || suggestedLow >= suggestedHigh || strongerLow >= strongerHigh || strongerHigh >= suggestedLow) {
    return { status: "unavailable", reason: "recent support and volatility do not form ordered executable zones" };
  }
  return {
    status: "available",
    suggested: { low: round(suggestedLow), high: round(suggestedHigh) },
    stronger: { low: round(strongerLow), high: round(strongerHigh) },
    currentPosition: Number.isFinite(currentPrice) && currentPrice <= suggestedHigh ? "inside_or_below_suggested_zone" : "above_suggested_zone",
    inputs: {
      lookbackObservations: closes.length,
      supportPercentiles: { suggested: 25, stronger: 10, floor: 5 },
      supportPrices: { p25: round(support25), p10: round(support10), p05: round(support05) },
      dailyVolatilityPercent,
      zoneBandPercent: round(zoneBandPercent),
      valuationThreshold: round(preferredEntryPrice),
      minimumRiskReward,
      riskRewardPriceCap: round(riskRewardCap),
    },
    method: "60-session close distribution + 20-session realized volatility + valuation threshold + 2.0x minimum modeled risk/reward cap",
  };
}

function standardDeviation(values) {
  if (values.length < 2) return null;
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.sqrt(values.reduce((sum, value) => sum + ((value - average) ** 2), 0) / (values.length - 1));
}

function normalizedMetricVintages(history, metric) {
  const byFiling = new Map();
  for (const row of history) {
    const value = metric === "trailingPE" ? row?.trailingEpsPerShare : row?.trailingRevenuePerShare;
    const fallback = Number.isFinite(row?.[metric]) && row[metric] > 0 && Number.isFinite(row?.adjustedClose) ? row.adjustedClose / row[metric] : null;
    const normalized = Number.isFinite(value) && value > 0 ? value : fallback;
    if (!row?.fundamentalAsOf || !Number.isFinite(normalized) || normalized <= 0) continue;
    byFiling.set(row.fundamentalAsOf, { asOf: row.fundamentalAsOf, value: normalized, splitBasis: row.splitBasis ?? "fixture-unspecified" });
  }
  return [...byFiling.values()].sort((a, b) => a.asOf.localeCompare(b.asOf));
}

function quantile(values, probability) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const index = (sorted.length - 1) * probability;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

function unavailableTarget(row, reason) {
  return {
    status: "unavailable",
    currentPrice: Number.isFinite(row?.price) ? round(row.price) : null,
    priceAsOf: row?.priceAsOf ?? null,
    inputAsOf: row?.valuation?.fundamentalAsOf ?? row?.fundamentalAsOf ?? null,
    reason,
    confidence: "Unavailable",
    consensusCrossCheck: { status: "unavailable", reason: "no fresh analyst-consensus target source configured" },
    valuationAdjustment: 0,
    valuationLabel: "Neutral",
  };
}

export function percentile(value, values) {
  if (!Number.isFinite(value)) return null;
  const valid = values.filter(Number.isFinite);
  if (!valid.length) return null;
  return round((valid.filter((item) => item <= value).length / valid.length) * 100);
}

export function zonedParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const out = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return { date: `${out.year}-${out.month}-${out.day}`, hour: Number(out.hour), minute: Number(out.minute) };
}

function reportDateFor(value) {
  const date = value instanceof Date ? value : new Date(value ?? NaN);
  return Number.isFinite(date.getTime()) ? zonedParts(date, "America/New_York").date : "unknown-date";
}

function yahooHeaders(env) {
  return { accept: "application/json", "user-agent": env.YAHOO_USER_AGENT || "Mozilla/5.0 growth-tech-morning-brief/0.2" };
}

function nasdaqHeaders(env) {
  return {
    accept: "application/json, text/plain, */*",
    "accept-language": "en-US,en;q=0.9",
    origin: "https://www.nasdaq.com",
    referer: "https://www.nasdaq.com/market-activity/",
    "user-agent": env.NASDAQ_USER_AGENT || "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36",
  };
}

function parseSymbols(value = "") {
  return [...new Set(value.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean))];
}

function rangePosition(price, low, high) {
  if (![price, low, high].every(Number.isFinite) || high <= low) return null;
  return ((price - low) / (high - low)) * 100;
}

function number(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function finitePair(a, b) { return Number.isFinite(a) && Number.isFinite(b); }
function round(value) { return Number.isFinite(value) ? Math.round(value * 100) / 100 : null; }
function errorMessage(error) { return error instanceof Error ? error.message : String(error); }

function json(value, status = 200) {
  return new Response(JSON.stringify(value, null, 2), { status, headers: { "content-type": "application/json; charset=utf-8" } });
}
