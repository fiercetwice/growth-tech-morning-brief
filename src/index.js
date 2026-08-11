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
const SERVICE_VERSION = "0.5.7";
const BUILD_REVISION = "0.5.7-hf5.2";
const RESEND_EMAILS = "https://api.resend.com/emails";
const HISTORY_YEARS = 5;
const REQUIRED_REPORT_SECTIONS = [
  "Executive Summary",
  "Overnight and Market Context",
  "AI Cycle Dashboard",
  "Sector Scorecard",
  "Watchlist",
];
const REQUIRED_EXECUTIVE_LABELS = ["AI Cycle", "Key Catalyst", "Principal Risk", "Best Opportunity", "Research Exclusions"];
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

const CIKS = {
  NVDA: "0001045810", AMZN: "0001018724", MSFT: "0000789019",
  ANET: "0001596532", CRWV: "0001769628", AVGO: "0001730168",
  META: "0001326801", GOOGL: "0001652044", ORCL: "0001341439",
  TSM: "0001046179", VRT: "0001674101", CEG: "0001868275",
  FTNT: "0001262039",
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
  const [results, marketContext, calendars, discovery] = await Promise.all([
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
    schemaVersion: 7,
    generatedAt: now.toISOString(),
    session: marketSession(now),
    sources: {
      price: "Yahoo Finance chart endpoint (unofficial)",
      fundamentals: "SEC EDGAR CompanyFacts",
      marketContext: "Yahoo Finance chart endpoint (unofficial)",
      calendars: "Nasdaq public calendar endpoints (unofficial)",
      monetaryPolicyNews: "Federal Reserve monetary policy RSS (official)",
      companyNews: "Yahoo Finance search news (unofficial)",
      discovery: "Nasdaq full-market stock screener (unofficial public endpoint)",
      methodology: "Point-in-time TTM multiples use only filings available by each price date",
    },
    coverage: { requested: symbols.length, succeeded, failed: symbols.length - succeeded },
    marketContext,
    calendars,
    news,
    discovery: { ...discovery, symbols: discoverySymbols },
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
    for (const symbol of item.symbols ?? [null]) events.push(eventRecord("company_news", symbol, item.title, item.publishedAt, item.url, item.source));
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
    const newsSettled = await Promise.allSettled(candidates.map(async (row) => normalizeYahooNews(await fetchYahooNews(row.symbol, env), row.symbol, now).slice(0, 3)));
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

export function normalizeYahooNews(body, symbol, now = new Date()) {
  const cutoff = now.getTime() - 48 * 60 * 60 * 1000;
  return (Array.isArray(body?.news) ? body.news : []).map((item) => ({
    title: cleanText(item.title),
    url: cleanText(item.link),
    publishedAt: isoDate(item.providerPublishTime),
    source: cleanText(item.publisher) || "Yahoo Finance",
    kind: "company_news",
    symbols: [symbol],
    verified: Boolean(item.link && item.title),
    material: materialCompanyHeadline(item.title),
  })).filter((item) => item.title && item.url && item.publishedAt && Date.parse(item.publishedAt) >= cutoff);
}

function materialCompanyHeadline(title = "") {
  return /earnings|revenue|profit|guidance|forecast|outlook|contract|customer|partnership|acqui|merger|offering|buyback|dividend|layoff|restructur|FDA|SEC|investigation|lawsuit|regulat|ban|export|launch|announc|order|backlog|capacity|data.?center|AI\b|artificial intelligence/i.test(title);
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

function buildDecisionFramework(rows) {
  const sectorScorecard = Object.fromEntries(Object.entries(SECTOR_MEMBERS).map(([sector, symbols]) => {
    const members = rows.filter((row) => symbols.includes(row.symbol));
    return [sector, aggregateDecision(members)];
  }));
  const aiCycle = Object.fromEntries(Object.entries(AI_CYCLE_SEGMENTS).map(([segment, symbols]) => {
    const members = rows.filter((row) => symbols.includes(row.symbol));
    return [segment, {
      rating: "Insufficient Data",
      trend: "Unclear",
      evidence: members.map((row) => `${row.symbol} ${signed(row.changePercent)}%`).join(", ") || "No covered symbols",
      limitation: "Price, reported financials, and trailing valuation do not measure demand, backlog, CapEx guidance, or estimate revisions.",
    }];
  }));
  return {
    methodology: "Deterministic rules; the AI explains but must not change supplied ratings or actions.",
    aiCycle,
    sectorScorecard,
  };
}

function aggregateDecision(rows) {
  if (!rows.length) return { fundamentals: "Unavailable", valuation: "Unavailable", momentum: "Unavailable", stance: "Neutral", symbols: [] };
  const staleFundamentalRows = rows.filter((row) => row.fundamentalCacheStatus === "stale" && Number.isFinite(row.reportedGrowth?.revenueTtmYoY));
  const freshFundamentalRows = rows.filter((row) => row.fundamentalCacheStatus !== "stale" && Number.isFinite(row.reportedGrowth?.revenueTtmYoY));
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
      staleFundamentals: staleFundamentalRows.map(fundamentalEvidence),
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

function catalystFor(row, earnings) {
  if (earnings) return `Earnings scheduled today${earnings.time ? ` (${earnings.time})` : ""}`;
  return "n/a — no company-specific catalyst in snapshot";
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

export function toBrief(snapshot) {
  const rows = snapshot.watchlist.map(compactRow);
  const discoveredRows = (snapshot.discovery?.candidates ?? []).map(compactDiscoveryRow);
  const earningsBySymbol = new Map((snapshot.calendars?.earnings?.events ?? []).map((event) => [event.symbol, event]));
  const companyNews = snapshot.news?.company?.items ?? [];
  for (const row of rows) {
    if (row.missing) continue;
    row.catalyst = catalystFor(row, earningsBySymbol.get(row.symbol));
    row.risk = riskFor(row);
    row.strategicAction = stockAction(row);
    row.action = row.strategicAction;
    row.news = companyNews.filter((item) => item.symbols?.includes(row.symbol)).slice(0, 3);
    row.setup = todaySetup(row, earningsBySymbol.get(row.symbol));
  }
  for (const row of discoveredRows) {
    row.catalyst = catalystFor(row, earningsBySymbol.get(row.symbol));
    row.risk = discoveryRiskFor(row);
    row.strategicAction = "Research pending";
    row.action = "Watch";
    row.setup = todaySetup(row, earningsBySymbol.get(row.symbol));
    row.setup.reasons.unshift(`discovered by ${row.screen}`);
    row.setup.score = round(row.setup.score + Math.min(10, row.discoveryScore ?? 0) / 2);
  }
  const valid = [...rows, ...discoveredRows].filter((row) => !row.missing);
  const dataQuality = snapshotDataQuality(snapshot);
  const candidates = selectResearchCandidates(rows, discoveredRows, snapshot.eventLedger);
  const validResearchUniverse = [...rows, ...discoveredRows].filter((row) => !row.missing);
  const targetResearchCount = Math.min(MAX_RESEARCH_CANDIDATES, validResearchUniverse.length);
  if (candidates.length !== targetResearchCount) {
    throw new Error(`Research capacity invariant failed: expected ${targetResearchCount}, selected ${candidates.length}`);
  }
  const brief = {
    schemaVersion: 7,
    generatedAt: snapshot.generatedAt,
    session: snapshot.session,
    coverage: snapshot.coverage,
    dataQuality,
    marketContext: snapshot.marketContext ?? unavailableMarketContext("not in snapshot"),
    calendars: snapshot.calendars ?? unavailableCalendars("not in snapshot"),
    news: snapshot.news ?? {
      monetaryPolicy: unavailableNews("Federal Reserve monetary policy RSS (official)", "not in snapshot"),
      company: unavailableNews("Yahoo Finance search news (unofficial)", "not in snapshot"),
    },
    decisionFramework: buildDecisionFramework(valid),
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

export function selectResearchCandidates(coreRows, discoveryRows, eventLedger, maximum = MAX_RESEARCH_CANDIDATES) {
  const valid = [...coreRows, ...discoveryRows].filter((row) => !row.missing);
  const admitted = valid.filter((row) => row.setup?.eligible)
    .sort((a, b) => (b.setup?.score ?? 0) - (a.setup?.score ?? 0))
    .slice(0, maximum)
    .map((row) => ({ ...row, admissionType: "setup_gate", setup: { ...row.setup, admissionType: "setup_gate" } }));
  if (admitted.length >= maximum) return admitted;

  const selected = new Set(admitted.map((row) => row.symbol));
  const newEventSymbols = new Set((eventLedger?.events ?? [])
    .filter((event) => event.delta === "new" && event.symbol)
    .map((event) => event.symbol));
  const fillers = coreRows.filter((row) => !row.missing && !selected.has(row.symbol))
    .sort((a, b) => autoWatchlistPriority(b, newEventSymbols) - autoWatchlistPriority(a, newEventSymbols))
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

function autoWatchlistPriority(row, newEventSymbols) {
  const newEvent = newEventSymbols.has(row.symbol) ? 100 : 0;
  const move = Math.min(20, Math.abs(row.changePercent ?? 0) * 4);
  const financialCoverage = row.valuation && row.reportedGrowth ? 6 : row.valuation || row.reportedGrowth ? 3 : 0;
  const rangeExtreme = Number.isFinite(row.positionIn52WeekRange)
    ? Math.abs(row.positionIn52WeekRange - 50) / 25
    : 0;
  return newEvent + move + financialCoverage + rangeExtreme;
}

export function compactSnapshotForReport(snapshot) {
  const brief = toBrief(snapshot);
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

function todaySetup(row, earnings) {
  const verifiedNews = (row.news ?? []).filter((item) => item.verified && item.material !== false);
  const dislocation = Number.isFinite(row.changePercent) && Math.abs(row.changePercent) >= 3;
  const extremeTrim = (row.valuation?.selectedPercentile ?? 0) >= 90 && (row.positionIn52WeekRange ?? 0) >= 90;
  const earningsToday = Boolean(earnings);
  const reasons = [];
  if (verifiedNews.length) reasons.push(`${verifiedNews.length} fresh company headline(s)`);
  if (earningsToday) reasons.push("earnings scheduled today");
  if (dislocation) reasons.push(`${signed(row.changePercent)}% price dislocation`);
  if (extremeTrim) reasons.push("valuation-risk flag: valuation and range position both at/above 90th threshold");
  return {
    eligible: reasons.length > 0,
    score: verifiedNews.length * 3 + (earningsToday ? 3 : 0) + (dislocation ? 2 : 0) + (extremeTrim ? 2 : 0),
    reasons,
    verifiedCatalyst: verifiedNews.length > 0 || earningsToday,
    dislocation,
    extremeTrim,
  };
}

export async function generateAiReport(env, snapshot, override = null, options = {}) {
  const route = selectedAiRoute(env, override);
  const { provider, model } = route;
  const compact = compactSnapshotForReport(snapshot);
  compact.reportMode = selectedReportMode(env, options.reportMode);
  compact.engineVersion = SERVICE_VERSION;
  compact.buildRevision = BUILD_REVISION;
  const research = await researchCandidates(env, route, compact);
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
    pipeline: "staged-research-deterministic-render-v1",
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

async function researchCandidates(env, route, compact) {
  const candidates = (compact.opportunityGate?.candidates ?? []).slice(0, MAX_RESEARCH_CANDIDATES);
  const batchSize = Math.max(1, Math.min(5, Math.round(nonNegativeNumber(env.RESEARCH_BATCH_SIZE, DEFAULT_RESEARCH_BATCH_SIZE)) || DEFAULT_RESEARCH_BATCH_SIZE));
  const batches = [];
  for (let index = 0; index < candidates.length; index += batchSize) batches.push(candidates.slice(index, index + batchSize));
  const results = await Promise.all(batches.map((batch, index) => researchCandidateBatch(env, route, compact, batch, index + 1)));
  const packets = results.flatMap((result) => result.packets);
  return {
    schemaVersion: "candidate-research-v1",
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

async function researchCandidateBatch(env, route, compact, candidates, batchNumber) {
  const failures = [];
  for (let attempt = 1; attempt <= MAX_AI_ATTEMPTS; attempt += 1) {
    const prompt = candidateResearchPrompt(compact, candidates, {
      batchNumber,
      retry: attempt > 1,
      validationErrors: failures.at(-1),
    });
    const response = await requestAiReport(env, route, prompt, {
      maxTokens: positiveInteger(env.RESEARCH_MAX_TOKENS, DEFAULT_RESEARCH_MAX_TOKENS),
    });
    const extracted = extractAiReport(response.body, route, env);
    if (!response.ok || extracted.finishReason !== "STOP" || !extracted.markdown) {
      failures.push(aiFailureDiagnostic(response.status, route, extracted, env));
      continue;
    }
    const parsed = parseJsonObject(extracted.markdown);
    const validation = validateResearchBatch(parsed, candidates);
    if (!validation.ok) {
      failures.push(validation.errors.join("; "));
      continue;
    }
    return {
      batchNumber,
      symbols: candidates.map((row) => row.symbol),
      attempts: attempt,
      status: "complete",
      failures,
      packets: parsed.candidates.map((packet) => normalizeResearchPacket(packet, candidates.find((row) => row.symbol === packet.symbol))),
    };
  }
  const failure = failures.join(" | ") || "unknown research failure";
  return {
    batchNumber,
    symbols: candidates.map((row) => row.symbol),
    attempts: MAX_AI_ATTEMPTS,
    status: "incomplete",
    failures,
    packets: candidates.map((candidate) => incompleteResearchPacket(candidate, failure)),
  };
}

function candidateResearchPrompt(compact, candidates, options = {}) {
  const candidateSymbols = new Set(candidates.map((candidate) => candidate.symbol));
  const earnings = compact.calendars?.earnings;
  const companyNews = compact.news?.company;
  return [
    "Research this bounded Growth-Tech candidate batch. Return JSON only, without Markdown fences.",
    "Use only the supplied evidence. Do not infer that a headline caused a move unless the linkage is direct.",
    `Analyze only these batch symbols: ${[...candidateSymbols].join(", ")}. Do not place any other equity ticker in candidate fields; non-candidate market facts are context only.`,
    "Discovery names cannot pass the action gate when valuation, fundamentals, liquidity context, or a verified fresh company catalyst is missing.",
    "Price movement alone may support Watch, never Buy/Sell. Without supplied portfolio holdings and target weights, extremeTrim is a valuation-risk flag only: use Watch, never Review position size or Trim.",
    "Return {\"candidates\":[...]} with exactly one object per supplied symbol and these fields:",
    "symbol, catalystSummary, evidenceFor (array), evidenceAgainst (array), mispricingThesis, strategicPosition (Buy/Hold/Avoid), todayAction (Buy now/Buy on weakness/Sell/Review position size/Watch/No action), confidence (High/Medium/Low), entryExitCondition, riskReward, invalidation, missingEvidence (array), sourceQuality, gateResult (pass/fail), gateReason.",
    "Do not invent target, support, resistance, stop, or entry prices. A dollar-denominated price may appear in entryExitCondition, invalidation, riskReward, or mispricingThesis only when it exactly matches the supplied current price, 52-week low, or 52-week high.",
    options.retry ? `Repair the previous failure exactly: ${options.validationErrors}` : "",
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
  const requiredStrings = ["catalystSummary", "mispricingThesis", "strategicPosition", "todayAction", "confidence", "entryExitCondition", "riskReward", "invalidation", "sourceQuality", "gateResult", "gateReason"];
  for (const row of parsed.candidates) {
    for (const field of requiredStrings) if (typeof row?.[field] !== "string" || !row[field].trim()) errors.push(`${row?.symbol ?? "unknown"} missing ${field}`);
    for (const field of ["evidenceFor", "evidenceAgainst", "missingEvidence"]) if (!Array.isArray(row?.[field])) errors.push(`${row?.symbol ?? "unknown"} ${field} must be an array`);
    if (!["Buy", "Hold", "Avoid"].includes(row?.strategicPosition)) errors.push(`${row?.symbol ?? "unknown"} invalid strategicPosition`);
    if (!TODAY_ACTIONS.includes(row?.todayAction)) errors.push(`${row?.symbol ?? "unknown"} invalid todayAction`);
    if (!["High", "Medium", "Low"].includes(row?.confidence)) errors.push(`${row?.symbol ?? "unknown"} invalid confidence`);
    if (!["pass", "fail"].includes(row?.gateResult)) errors.push(`${row?.symbol ?? "unknown"} invalid gateResult`);
    validatePacketPriceLevels(row, candidates.find((candidate) => candidate.symbol === row?.symbol), errors);
  }
  return { ok: errors.length === 0, errors };
}

export function normalizeResearchPacket(packet, candidate) {
  const discoveryBlocked = candidate?.sourceType === "discovery"
    && (!discoveryFinancialsComplete(candidate) || !candidate?.setup?.verifiedCatalyst);
  const recommendedAction = ["Buy now", "Buy on weakness", "Sell"].includes(packet.todayAction)
    ? candidate?.setup?.verifiedCatalyst
    : false;
  const gateResult = packet.gateResult === "pass" && recommendedAction && !discoveryBlocked ? "pass" : "fail";
  const portfolioInput = candidate?.portfolio?.holding === true && Number.isFinite(candidate?.portfolio?.targetWeight);
  const portfolioReview = ["Trim", "Review position size"].includes(packet.todayAction) && candidate?.setup?.extremeTrim && portfolioInput;
  const unsupportedPortfolioAction = ["Trim", "Review position size"].includes(packet.todayAction) && !portfolioInput;
  const finalAction = gateResult === "pass"
    ? packet.todayAction
    : portfolioReview
      ? "Review position size"
      : unsupportedPortfolioAction
        ? "Watch"
        : (["Review position size", "Watch", "No action"].includes(packet.todayAction) ? packet.todayAction : "Watch");
  return {
    ...packet,
    status: "complete",
    modelGateResult: packet.gateResult,
    gateResult,
    todayAction: finalAction,
    finalAction,
    gateReason: gateResult === "pass" ? packet.gateReason : [packet.gateReason, discoveryBlocked ? "discovery evidence gate incomplete" : null, unsupportedPortfolioAction ? "position-size action requires supplied holdings and target weights; valuation risk remains Watch-only" : null, !recommendedAction && !portfolioReview && !unsupportedPortfolioAction ? "action lacks deterministic catalyst eligibility" : null].filter(Boolean).join("; "),
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
      reportedGrowth: candidate.reportedGrowth,
      fundamentals: candidate.fundamentals,
      fundamentalCoverage: candidate.fundamentalCoverage,
      setup: candidate.setup,
      news: candidate.news,
    },
  };
}

function validatePacketPriceLevels(packet, candidate, errors) {
  if (!candidate) return;
  const supplied = [candidate.price, candidate.yearLow, candidate.yearHigh].filter(Number.isFinite);
  for (const field of ["entryExitCondition", "invalidation", "riskReward", "mispricingThesis"]) {
    const values = [...String(packet?.[field] ?? "").matchAll(/\$\s*([0-9]+(?:\.[0-9]+)?)/g)].map((match) => Number(match[1]));
    for (const value of values) {
      const sourced = supplied.some((known) => Math.abs(known - value) <= Math.max(0.01, Math.abs(known) * 0.001));
      if (!sourced) errors.push(`${packet?.symbol ?? "unknown"} unsourced price level in ${field}: $${value}`);
    }
  }
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
      reportedGrowth: row.reportedGrowth,
      fundamentalCacheStatus: row.fundamentalCacheStatus,
      fundamentalAsOf: row.fundamentalAsOf,
      catalyst: row.catalyst,
      risk: row.risk,
      finalAction: !researchSet.has(row.symbol)
        ? "Wait"
        : packetBySymbol.get(row.symbol)?.status !== "complete"
          ? "Wait"
          : packetBySymbol.get(row.symbol)?.finalAction ?? packetBySymbol.get(row.symbol)?.todayAction ?? "Wait",
      researchStatus: researchSet.has(row.symbol) ? "researched" : "not_researched_today",
    })),
  };
}

export function renderMorningBrief(compact, identity = {}) {
  const reportId = identity.reportId ?? "unavailable";
  const generatedAt = identity.generatedAt ?? new Date().toISOString();
  const packets = compact.research?.packets ?? [];
  const recommended = packets.filter((packet) => packet.status === "complete" && packet.gateResult === "pass");
  const gateQualified = packets.filter((packet) => packet.status === "complete" && packet.modelGateResult === "pass");
  const verified = packets.filter((packet) => packet.sourceSnapshot?.setup?.verifiedCatalyst);
  const researchExclusions = packets.filter((packet) => packet.status === "complete" && packet.strategicPosition === "Avoid");
  const cycleRows = Object.entries(compact.decisionFramework?.aiCycle ?? {});
  const sectorRows = Object.entries(compact.decisionFramework?.sectorScorecard ?? {});
  const unavailableContext = Object.entries(compact.marketContext ?? {}).filter(([, group]) => group?.status !== "available").map(([name]) => name);
  const researchSymbols = new Set(compact.researchSymbols ?? packets.map((packet) => packet.symbol));
  const staleFundamentals = (compact.watchlist ?? []).filter((row) => row.fundamentalCacheStatus === "stale");
  const researchedStaleFundamentals = staleFundamentals.filter((row) => researchSymbols.has(row.symbol)).map((row) => row.symbol);
  const unresearchedStaleCount = staleFundamentals.length - researchedStaleFundamentals.length;
  const staleFundamentalRisks = [
    researchedStaleFundamentals.length ? `expired SEC fundamentals excluded from sector ratings pending refresh: ${researchedStaleFundamentals.join(", ")}` : null,
    unresearchedStaleCount ? `${unresearchedStaleCount} unresearched watchlist ${unresearchedStaleCount === 1 ? "name also has" : "names also have"} expired SEC fundamentals pending refresh` : null,
  ].filter(Boolean);
  const principalRisks = [
    unavailableContext.length ? `Market inputs stale or unavailable: ${unavailableContext.join(", ")}` : null,
    staleFundamentalRisks.length ? staleFundamentalRisks.join("; ") : null,
  ].filter(Boolean);
  const best = recommended[0];
  const catalyst = verified[0];
  const lines = [
    `# Growth Tech Morning Brief — ${generatedAt.slice(0, 10)}`,
    "",
    `**Report Mode:** ${compact.reportMode}`,
    `**Engine Version:** ${compact.engineVersion}`,
    `**Build Revision:** ${compact.buildRevision ?? BUILD_REVISION}`,
    `**Report ID:** ${reportId}`,
    `**Generated At:** ${generatedAt}`,
    "",
    "# Executive Summary",
    `- **AI Cycle:** ${cycleRows.every(([, row]) => row.rating === "Insufficient Data") ? "Insufficient Data; direct CapEx, demand, utilization, and estimate-revision evidence is unavailable." : "Mixed; see the deterministic dashboard."}`,
    `- **Key Catalyst:** ${catalyst ? `${catalyst.symbol} — ${cleanReportText(catalyst.catalystSummary)}` : "No verified company-specific catalyst in today's researched universe."}`,
    `- **Principal Risk:** ${principalRisks.length ? `${principalRisks.join("; ")}.` : "Forward estimates and direct AI-cycle indicators are not in the snapshot; trailing data limit conviction."}`,
    `- **Best Opportunity:** ${best ? `${best.symbol} — ${best.todayAction}; ${cleanReportText(best.gateReason)}` : `None clears the deterministic action gate; ${gateQualified.length} gate-qualified research setup(s), ${recommended.length} recommended action(s).`}`,
    `- **Research Exclusions:** ${researchExclusions.length ? `${researchExclusions.map((packet) => packet.symbol).join(", ")} — excluded by research screening; not final portfolio recommendations.` : "None; research screening exclusions are not final portfolio recommendations."}`,
    "",
    "# Overnight and Market Context",
    `- **As Of:** ${compact.generatedAt ?? generatedAt}; session=${compact.session ?? "unavailable"}.`,
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
    "| Symbol | Price | Daily Change | 52-Week Position | Valuation | Trailing 5Y Percentile | Catalyst | Risk | Final Action | Research Status |",
    "|---|---:|---:|---:|---|---:|---|---|---|---|",
    ...(compact.watchlist ?? []).map((row) => renderWatchlistRow(row)),
  ];
  return lines.join("\n");
}

export function renderResearchAudit(compact, identity = {}) {
  const funnel = compact.research?.funnel ?? {};
  const packets = compact.research?.packets ?? [];
  const capacity = compact.opportunityGate?.researchCapacity ?? {};
  const missing = materialMissingFields(packets);
  const sourceFailures = compact.dataQuality?.discoveryFundamentals?.sourceFailures ?? 0;
  const lines = [
    `# Growth Tech Research Audit — ${(identity.generatedAt ?? compact.generatedAt ?? "").slice(0, 10)}`,
    "",
    `**Engine Version:** ${compact.engineVersion}`,
    `**Build Revision:** ${compact.buildRevision ?? BUILD_REVISION}`,
    `**Report ID:** ${identity.reportId ?? "unavailable"}`,
    `**Report Content SHA-256:** ${identity.contentHash ?? "unavailable"}`,
    "",
    `**Funnel:** screened=${funnel.screened ?? "unavailable"}; admitted=${funnel.admitted ?? 0}; researched=${funnel.researched ?? 0}; incomplete=${funnel.incomplete ?? 0}; gateQualified=${funnel.gateQualified ?? 0}; recommendedActions=${funnel.recommendedActions ?? 0}; rejectedOrWatch=${funnel.rejectedOrWatch ?? 0}`,
    `**Packet Completion:** capacity=${capacity.filled ?? packets.length}/${capacity.target ?? packets.length}; generated packets are not described as complete fields.`,
    `**Field Completeness:** ${fieldCompletenessSummary(packets)}`,
    `**Material Missing Fields:** ${missing.length ? missing.join("; ") : "None in the deterministic required-field set."}`,
    `**Source Failures:** discovery fundamentals=${sourceFailures}; extraction gaps remain separate from provider failures.`,
    "",
    "## Research Packets",
  ];
  for (const packet of packets) {
    lines.push(
      `### ${packet.symbol} — ${packet.todayAction ?? "No action"}`,
      `- Status: ${packet.status}; model gate=${packet.modelGateResult ?? "unavailable"}; recommended action=${packet.gateResult === "pass" ? "yes" : "no"}.`,
      `- Catalyst: ${cleanReportText(packet.catalystSummary)}`,
      `- Balance sheet: ${balanceSheetDisplay(packet.sourceSnapshot?.fundamentals)}.`,
      `- Evidence against: ${normalizedEvidenceAgainst(packet).join("; ") || "unavailable"}.`,
      `- Missing evidence: ${(packet.missingEvidence ?? []).map(cleanReportText).join("; ") || "none stated"}.`,
      "",
    );
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
  return `| ${tableCell(row.symbol)} | ${money(row.price)} | ${percent(row.changePercent, true)} | ${percent(row.positionIn52WeekRange)} | ${trailing}; ${forward} | ${percent(valuation?.selectedPercentile)} | ${tableCell(row.catalyst)} | ${tableCell(row.risk)} | ${finalAction} | ${row.researchStatus === "not_researched_today" ? "Not researched today" : "Researched"} |`;
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
  const stale = formatFundamentalEvidence(row?.metrics?.staleFundamentals);
  return [
    symbols,
    `median fresh reported revenue growth ${percent(growth)}`,
    fresh ? `fresh fundamentals ${fresh}` : null,
    stale ? `stale fundamentals excluded ${stale}` : null,
    `median valuation percentile ${percent(valuation)}`,
  ].filter(Boolean).join("; ");
}

function formatFundamentalEvidence(rows) {
  if (!rows?.length) return null;
  return rows.map((row) => `${row.symbol} (as of ${row.asOf ?? "unavailable"})`).join(", ");
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
    const fields = label === "AI Cycle Dashboard" ? ["rating", "trend"] : ["fundamentals", "valuation", "momentum", "stance"];
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
  const expectedHeaders = ["Symbol", "Price", "Daily Change", "52-Week Position", "Valuation", "Trailing 5Y Percentile", "Catalyst", "Risk", "Final Action", "Research Status"];
  const table = parseMarkdownTable(section);
  const normalizedHeaders = table.headers.map(normalizeCell);
  for (const header of expectedHeaders) if (!normalizedHeaders.includes(normalizeCell(header))) errors.push(`Watchlist missing column: ${header}`);
  const symbolIndex = normalizedHeaders.indexOf(normalizeCell("Symbol"));
  const actionIndex = normalizedHeaders.indexOf(normalizeCell("Final Action"));
  const statusIndex = normalizedHeaders.indexOf(normalizeCell("Research Status"));
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
    } else if (expected.finalAction && normalizeCell(actionText) !== normalizeCell(expected.finalAction)) {
      errors.push(`Watchlist Final Action changed deterministic gate result: ${expected.symbol}`);
    }
  }
  const recommendedActions = compact?.research?.funnel?.recommendedActions;
  if (recommendedActions === 0) {
    const tradeActions = table.rows.filter((row) => /^(Buynow|Buyonweakness|Sell)$/i.test(String(row[actionIndex] ?? "").replace(/[\s*`_]/g, "")));
    if (tradeActions.length) errors.push("recommendedActions=0 forbids Buy/Sell in Watchlist Final Action");
  }
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
    if (setup?.extremeTrim && !setup?.verifiedCatalyst) for (const line of lines) {
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
    `# Growth Tech Morning Brief — ${brief.generatedAt.slice(0, 10)}`,
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
    volume: number(quote.volume?.[index]),
  })).filter((row) => row.adjustedClose !== null);
  const meta = result.meta ?? {};
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
  const closes = chart.history.map((row) => row.adjustedClose).filter(Number.isFinite);
  const window = closes.slice(-252);
  const yearLow = window.length ? Math.min(...window) : null;
  const yearHigh = window.length ? Math.max(...window) : null;
  const valuationHistory = fundamentals.available ? buildValuationHistory(chart.history, fundamentals) : [];
  const latestValuation = valuationHistory.at(-1) ?? null;
  return {
    symbol,
    name: chart.name ?? fundamentals.entityName ?? null,
    currency: chart.currency,
    exchange: chart.exchange,
    price: round(chart.price),
    previousClose: round(chart.previousClose),
    change: round(chart.change),
    changePercent: round(chart.changePercent),
    yearHigh: round(yearHigh),
    yearLow: round(yearLow),
    positionIn52WeekRange: round(rangePosition(chart.price, yearLow, yearHigh)),
    valuation: latestValuation ? {
      trailingPE: latestValuation.trailingPE,
      trailingPS: latestValuation.trailingPS,
      trailingPEPercentile5Y: percentile(latestValuation.trailingPE, valuationHistory.map((x) => x.trailingPE)),
      trailingPSPercentile5Y: percentile(latestValuation.trailingPS, valuationHistory.map((x) => x.trailingPS)),
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
    valuationHistory,
    missing: false,
  };
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

export function buildValuationHistory(prices, fundamentals) {
  return prices.map((price) => {
    const availableRevenue = fundamentals.quarterlyRevenue.filter((x) => x.filed <= price.date).slice(-4);
    const availableEps = fundamentals.quarterlyEps.filter((x) => x.filed <= price.date).slice(-4);
    const availableShares = fundamentals.quarterlyShares.filter((x) => x.filed <= price.date).at(-1);
    const revenue = availableRevenue.length === 4 ? availableRevenue.reduce((sum, x) => sum + x.value, 0) : null;
    const eps = availableEps.length === 4 ? availableEps.reduce((sum, x) => sum + x.value, 0) : null;
    const shares = availableShares?.value ?? null;
    const trailingPE = eps > 0 ? price.adjustedClose / eps : null;
    const trailingPS = revenue > 0 && shares > 0 ? (price.adjustedClose * shares) / revenue : null;
    const filed = [...availableRevenue, ...availableEps, ...(availableShares ? [availableShares] : [])].map((x) => x.filed).sort().at(-1) ?? null;
    return { date: price.date, trailingPE: round(trailingPE), trailingPS: round(trailingPS), fundamentalAsOf: filed };
  }).filter((row) => row.trailingPE !== null || row.trailingPS !== null);
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
