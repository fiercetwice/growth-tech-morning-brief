const YAHOO_CHART = "https://query1.finance.yahoo.com/v8/finance/chart";
const NASDAQ_API_BASE = "https://api.nasdaq.com/api/calendar";
const FED_MONETARY_RSS = "https://www.federalreserve.gov/feeds/press_monetary.xml";
const YAHOO_SEARCH = "https://query2.finance.yahoo.com/v1/finance/search";
const NASDAQ_STOCK_SCREENER = "https://api.nasdaq.com/api/screener/stocks";
const SEC_FACTS = "https://data.sec.gov/api/xbrl/companyfacts";
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash";
const DEEPSEEK_API_BASE = "https://api.deepseek.com";
const DEFAULT_DEEPSEEK_MODEL = "deepseek-v4-flash";
const DEFAULT_AI_PROVIDER = "gemini";
const SERVICE_VERSION = "0.5.5";
const RESEND_EMAILS = "https://api.resend.com/emails";
const HISTORY_YEARS = 5;
const REQUIRED_REPORT_SECTIONS = [
  "Today's Verdict",
  "Decision Reasoning",
  "Opportunities",
  "Rejected Candidates",
  "Market and AI-Cycle Context",
  "What Could Change the Call",
];
const REQUIRED_VERDICT_LABELS = ["Verdict", "Confidence", "Why Today"];
const REQUIRED_CONTEXT_LABELS = ["AI Cycle", "Market Regime", "Material News"];
const REQUIRED_REASONING_LABELS = ["Universe Searched", "Opportunity Gate", "Conclusion"];
const REQUIRED_AUDIT_LABELS = ["Available Evidence", "Missing Evidence", "Source Failures", "Confidence Impact"];
const TODAY_ACTIONS = ["Buy now", "Buy on weakness", "Trim", "Sell", "Watch", "No action"];
const REPORT_MODES = new Set(["standard", "verbose"]);
const DEFAULT_DISCOVERY_LIMIT = 6;
const DEFAULT_MIN_MARKET_CAP = 250_000_000;
const DEFAULT_MIN_DOLLAR_VOLUME = 5_000_000;
const DEFAULT_SEC_REFRESH_LIMIT = 3;
const ALLOWED_AI_PROVIDERS = new Set(["gemini", "deepseek", "openai-compatible"]);
const MARKET_CONTEXT_GROUPS = {
  futures: [
    { symbol: "ES=F", label: "S&P 500" },
    { symbol: "NQ=F", label: "Nasdaq 100" },
    { symbol: "YM=F", label: "Dow" },
    { symbol: "RTY=F", label: "Russell 2000" },
  ],
  rates: [{ symbol: "^TNX", label: "U.S. 10Y yield", unit: "%" }],
  usd: [{ symbol: "DX-Y.NYB", label: "U.S. Dollar Index" }],
  oil: [
    { symbol: "CL=F", label: "WTI crude" },
    { symbol: "BZ=F", label: "Brent crude" },
  ],
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
    if (path === "/health") return json({ ok: true, service: "growth-tech-morning-brief", version: SERVICE_VERSION });
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
    if (path === "/run-report" && request.method === "POST") {
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
  const reportResults = { date: reportDate, engineVersion: SERVICE_VERSION, generated: false, stored: false, email: null, webhook: null };
  try {
    let reportMarkdown;
    if (reportObject && !options.forceRegenerate) {
      reportMarkdown = await reportObject.text();
      reportResults.reused = true;
      reportResults.reportMode = reportObject.customMetadata?.reportMode ?? "unknown";
      reportResults.reportEngineVersion = reportObject.customMetadata?.engineVersion ?? "unknown";
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
      if (generatedReport.provider === "gemini") reportResults.geminiModel = generatedReport.model;
      reportResults.generation = generatedReport.metadata;
      await storeReport(env, reportDate, reportMarkdown, generatedReport.metadata);
      reportResults.generated = true;
      reportResults.stored = true;
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
  const [results, marketContext, calendars, coreNews, discovery] = await Promise.all([
    Promise.allSettled(symbols.map(async (symbol) => {
    const chart = await fetchYahooChart(symbol, now, env);
    const fundamentals = await fetchSecFundamentals(symbol, env, now, { networkBudget: secNetworkBudget }).catch((error) => ({
      available: false, reason: error.message,
    }));
    return assembleSymbol(symbol, chart, fundamentals);
    })),
    buildMarketContext(env, now),
    buildCalendarContext(env, now, symbols),
    buildNewsContext(env, now, symbols),
    buildDiscoveryContext(env, now, symbols),
  ]);

  const watchlist = results.map((result, index) => result.status === "fulfilled"
    ? result.value
    : { symbol: symbols[index], missing: true, error: result.reason?.message ?? String(result.reason) });
  const succeeded = watchlist.filter((row) => !row.missing).length;
  if (!succeeded) throw new Error("All Yahoo chart requests failed");

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
    schemaVersion: 6,
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

  if (env.BRIEF_BUCKET?.put) {
    const body = JSON.stringify(snapshot, null, 2);
    const briefBody = JSON.stringify(toBrief(snapshot), null, 2);
    await Promise.all([
      env.BRIEF_BUCKET.put(`snapshots/${ny.date}.json`, body, { httpMetadata: { contentType: "application/json" } }),
      env.BRIEF_BUCKET.put("snapshots/latest.json", body, { httpMetadata: { contentType: "application/json" } }),
      env.BRIEF_BUCKET.put(`briefs/${ny.date}.json`, briefBody, { httpMetadata: { contentType: "application/json" } }),
      env.BRIEF_BUCKET.put("briefs/latest.json", briefBody, { httpMetadata: { contentType: "application/json" } }),
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
    return {
      status: "available",
      source: "Nasdaq full-market stock screener (unofficial public endpoint)",
      asOf: body?.data?.asOf ?? now.toISOString(),
      scanned: rows.length,
      eligibleAfterLiquidityAndRelevance: candidates.length,
      filters: { minMarketCap, minDollarVolume, maximumCandidates: limit },
      candidates,
      news: { items: newsItems },
    };
  } catch (error) {
    return { status: "unavailable", source: "Nasdaq full-market stock screener (unofficial public endpoint)", asOf: null, scanned: 0, candidates: [], news: { items: [] }, reason: errorMessage(error) };
  }
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
  return { categories, available, total: Object.keys(categories).length, complete: available === Object.keys(categories).length, fundamentalCache };
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
  if (!rows.length) return { fundamentals: "Unavailable", valuation: "Unavailable", momentum: "Unavailable", action: "Wait", symbols: [] };
  const growth = median(rows.map((row) => row.reportedGrowth?.revenueTtmYoY).filter(Number.isFinite));
  const valuation = median(rows.map((row) => row.valuation?.selectedPercentile).filter(Number.isFinite));
  const momentum = median(rows.map(momentumScore).filter(Number.isFinite));
  const fundamentalsLabel = growth === null ? "Unavailable" : growth >= 15 ? "Strong" : growth >= 5 ? "Moderate" : growth >= 0 ? "Stable" : "Weak";
  const valuationLabel = valuation === null ? "Unavailable" : valuation >= 80 ? "High" : valuation <= 30 ? "Low" : "Moderate";
  const momentumLabel = momentum > 0 ? "Positive" : momentum < 0 ? "Negative" : "Mixed";
  return {
    fundamentals: fundamentalsLabel,
    valuation: valuationLabel,
    momentum: momentumLabel,
    action: decisionAction(fundamentalsLabel, valuationLabel, momentumLabel),
    symbols: rows.map((row) => row.symbol),
    metrics: { medianReportedRevenueTtmYoY: growth, medianHistoricalValuationPercentile: valuation },
  };
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
  const candidates = valid.filter((row) => row.setup.eligible)
    .sort((a, b) => b.setup.score - a.setup.score).slice(0, 15);
  const brief = {
    schemaVersion: 6,
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
      candidates: discoveredRows,
    },
    opportunityGate: {
      rule: "No actionable trade merely because it ranks highest. Action requires a verified fresh event, same-day earnings, a >=3% dislocation, or an extreme valuation/range trim setup. Discovery names require explicit liquidity and data-quality review.",
      maximumOpportunities: 8,
      allowedTodayActions: TODAY_ACTIONS,
      defaultVerdict: "No high-conviction trade today",
      candidates: candidates.slice(0, 15),
    },
    watchlist: rows,
  };
  brief.markdown = renderMarkdown(brief);
  return brief;
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
    valuation: null,
    reportedGrowth: null,
    news: row.news ?? [],
    missing: false,
  };
}

function discoveryRiskFor(row) {
  const risks = ["discovery candidate; fundamentals and valuation not yet verified"];
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
  if (extremeTrim) reasons.push("valuation and range position both at/above 90th threshold");
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
  const requiredSymbols = [
    ...(snapshot.watchlist ?? []).filter((row) => !row.missing).map((row) => row.symbol),
    ...(snapshot.discovery?.candidates ?? []).filter((row) => !row.missing).map((row) => row.symbol),
  ];
  const prompts = [
    reportPrompt(compact),
    reportPrompt(compact, { retry: true }),
  ];
  const failures = [];

  for (const [index, prompt] of prompts.entries()) {
    const attempt = index + 1;
    const response = await requestAiReport(env, route, prompt);
    const extracted = extractAiReport(response.body, route, env);
    const metadata = reportMetadata(route, response.body, extracted, attempt);
    if (!response.ok || extracted.finishReason !== "STOP" || !extracted.markdown) {
      const diagnostic = aiFailureDiagnostic(response.status, route, extracted, env);
      failures.push(`attempt ${attempt}: ${diagnostic}`);
      if (!isTokenLimitFinish(extracted.finishReason)) break;
      continue;
    }
    const validation = validateReportCompleteness(extracted.markdown, requiredSymbols, compact);
    metadata.validation = validation.ok ? "passed" : "failed";
    metadata.validationErrors = validation.errors.join("; ");
    if (validation.ok) return {
      markdown: extracted.markdown,
      provider,
      model,
      reportMode: compact.reportMode,
      metadata: { ...metadata, reportMode: compact.reportMode, engineVersion: SERVICE_VERSION },
    };
    failures.push(`attempt ${attempt}: ${validation.errors.join("; ")}`);
  }
  throw new Error(`AI report incomplete after ${failures.length} attempt(s) (${provider}/${model}): ${failures.join(" | ")}`);
}

// Backward-compatible export for callers that explicitly expect Gemini.
export async function generateGeminiReport(env, snapshot) {
  return generateAiReport(env, snapshot, { provider: "gemini" });
}

async function requestAiReport(env, route, prompt) {
  if (route.provider === "gemini") return requestGeminiReport(env, route, prompt);
  return requestOpenAiCompatibleReport(env, route, prompt);
}

async function requestGeminiReport(env, route, prompt) {
  const endpoint = `${GEMINI_API_BASE}/${encodeURIComponent(route.model)}:generateContent?key=${encodeURIComponent(route.apiKey)}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(geminiRequestBody(prompt)),
  });
  return { ok: response.ok, status: response.status, body: await response.json().catch(() => null) };
}

async function requestOpenAiCompatibleReport(env, route, prompt) {
  const response = await fetch(`${route.baseUrl}/chat/completions`, {
    method: "POST",
    headers: { authorization: `Bearer ${route.apiKey}`, "content-type": "application/json" },
    body: JSON.stringify(openAiCompatibleRequestBody(route, prompt)),
  });
  return { ok: response.ok, status: response.status, body: await response.json().catch(() => null) };
}

function openAiCompatibleRequestBody(route, prompt) {
  return {
    model: route.model,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.25,
    stream: false,
    ...(route.provider === "deepseek" ? { thinking: { type: "disabled" } } : {}),
  };
}

function geminiRequestBody(prompt) {
  return {
    contents: [{
      role: "user",
      parts: [{ text: prompt }],
    }],
    generationConfig: {
      temperature: 0.25,
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

function isTokenLimitFinish(reason) {
  return reason === "MAX_TOKENS";
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
  for (const section of REQUIRED_REPORT_SECTIONS) {
    if (!sectionBody(markdown, section)) errors.push(`missing section: ${section}`);
  }

  const verdict = sectionBody(markdown, "Today's Verdict");
  for (const label of REQUIRED_VERDICT_LABELS) {
    if (!new RegExp(`\\*{0,2}${escapeRegExp(label)}\\*{0,2}\\s*:`, "i").test(verdict)) {
      errors.push(`missing Today's Verdict field: ${label}`);
    }
  }
  const context = sectionBody(markdown, "Market and AI-Cycle Context");
  for (const label of REQUIRED_CONTEXT_LABELS) {
    if (!new RegExp(`(?:\\*{0,2})${escapeRegExp(label)}(?:\\*{0,2})\\s*:`, "i").test(context)) {
      errors.push(`missing Market Context field: ${label}`);
    }
  }
  const reasoning = sectionBody(markdown, "Decision Reasoning");
  for (const label of REQUIRED_REASONING_LABELS) {
    if (!new RegExp(`(?:\\*{0,2})${escapeRegExp(label)}(?:\\*{0,2})\\s*:`, "i").test(reasoning)) {
      errors.push(`missing Decision Reasoning field: ${label}`);
    }
  }
  const rejected = sectionBody(markdown, "Rejected Candidates");
  if (!rejected) errors.push("Rejected Candidates must explain the strongest failed setups");
  validateDecisionAudit(markdown, compact, errors);
  validateOpportunities(markdown, symbols, compact, errors);
  validateUnsupportedClaims(markdown, compact, errors);
  if (markdown.length < 700) errors.push("report is shorter than the minimum insight length");
  if (endsIncomplete(markdown)) errors.push("report ends with an incomplete sentence");
  return { ok: errors.length === 0, errors };
}

function validateDecisionAudit(markdown, compact, errors) {
  if (compact?.reportMode !== "verbose") return;
  if (!/\*{0,2}Report Mode\*{0,2}\s*:\*{0,2}\s*verbose\b/i.test(markdown)) {
    errors.push("verbose report must identify Report Mode: verbose");
  }
  const expectedVersion = compact.engineVersion ?? SERVICE_VERSION;
  if (!new RegExp(`\\*{0,2}Engine Version\\*{0,2}\\s*:\\*{0,2}\\s*${escapeRegExp(expectedVersion)}\\b`, "i").test(markdown)) {
    errors.push("verbose report must identify the current engine version");
  }
  const audit = sectionBody(markdown, "Data and Pipeline Audit");
  if (!audit) errors.push("missing section: Data and Pipeline Audit");
  for (const label of REQUIRED_AUDIT_LABELS) {
    if (!new RegExp(`(?:\\*{0,2})${escapeRegExp(label)}(?:\\*{0,2})\\s*:`, "i").test(audit)) {
      errors.push(`missing Data and Pipeline Audit field: ${label}`);
    }
  }
  const candidates = (compact?.opportunityGate?.candidates ?? []).slice(0, 10);
  const audited = [
    sectionBody(markdown, "Decision Reasoning"),
    sectionBody(markdown, "Opportunities"),
    sectionBody(markdown, "Rejected Candidates"),
  ].join("\n");
  for (const row of candidates) {
    if (!new RegExp(`\\b${escapeRegExp(row.symbol)}\\b`).test(audited)) {
      errors.push(`verbose report silently omitted gated candidate: ${row.symbol}`);
    }
  }
  const opportunities = sectionBody(markdown, "Opportunities");
  if (!/^###\s+/m.test(opportunities) && /no high-conviction trade|no actionable opportunity/i.test(opportunities)) {
    for (const label of ["Threshold Result", "Best Near-Miss", "Why It Failed", "Portfolio Action"]) {
      if (!new RegExp(`(?:\\*{0,2})${escapeRegExp(label)}(?:\\*{0,2})\\s*:`, "i").test(opportunities)) {
        errors.push(`verbose no-trade Opportunities missing field: ${label}`);
      }
    }
  }
}

function validateOpportunities(markdown, symbols, compact, errors) {
  const opportunities = sectionBody(markdown, "Opportunities");
  const matches = [...opportunities.matchAll(/^###\s+([A-Z.]{1,8})\s+[—-]\s+(.+)$/gm)];
  const maximum = compact?.opportunityGate?.maximumOpportunities ?? 8;
  if (matches.length > maximum) errors.push(`Opportunities must contain at most ${maximum} names`);
  const candidates = new Map((compact?.opportunityGate?.candidates ?? []).map((row) => [row.symbol, row]));
  const required = ["Why Considered", "Mispricing Thesis", "Evidence For", "Evidence Against", "Strategic Position", "Today's Action", "Confidence", "Entry/Exit Condition", "Verified Catalyst", "Risk/Reward", "Invalidation"];
  for (const match of matches) {
    const [heading, symbol, headingAction] = match;
    const next = opportunities.slice(match.index + heading.length);
    const block = next.slice(0, next.search(/^###\s+/m) < 0 ? undefined : next.search(/^###\s+/m));
    const action = TODAY_ACTIONS.find((value) => normalizeCell(value) === normalizeCell(headingAction));
    if (!action) errors.push(`invalid today's action: ${symbol}`);
    if (!symbols?.includes(symbol)) errors.push(`opportunity is outside research universe: ${symbol}`);
    if (!candidates.has(symbol)) errors.push(`opportunity did not clear absolute setup gate: ${symbol}`);
    for (const label of required) if (!new RegExp(`\\*{0,2}${escapeRegExp(label)}\\*{0,2}\\s*:`, "i").test(block)) {
      errors.push(`missing opportunity field for ${symbol}: ${label}`);
    }
    if (["Buy now", "Buy on weakness", "Sell"].includes(action) && !candidates.get(symbol)?.setup?.verifiedCatalyst) {
      errors.push(`actionable call lacks verified catalyst: ${symbol}`);
    }
    if (action === "Trim" && !candidates.get(symbol)?.setup?.verifiedCatalyst && !candidates.get(symbol)?.setup?.extremeTrim) {
      errors.push(`trim call lacks verified catalyst or extreme setup: ${symbol}`);
    }
  }
  if (!matches.length && !/no high-conviction trade|no actionable opportunity/i.test(opportunities)) {
    errors.push("Opportunities must state that no setup clears the threshold");
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

function markdownTableRow(section, label, options = {}) {
  const escaped = escapeRegExp(label);
  const prefix = options.allowLabelFormatting
    ? `(?:\\*{0,2}|\`{0,1})${options.allowDollar ? "\\$?" : ""}${escaped}(?:\\*{0,2}|\`{0,1})`
    : escaped;
  const line = section.split("\n").find((candidate) => new RegExp(`^\\|\\s*${prefix}\\s*\\|`, "i").test(candidate));
  if (!line) return null;
  return line.split("|").slice(1, -1).map((cell) => cell.trim());
}

function validateAvailableContextIsUsed(overnight, compact, errors) {
  if (!compact) return;
  const categories = [
    ["Futures", compact.marketContext?.futures],
    ["Rates", compact.marketContext?.rates],
    ["USD", compact.marketContext?.usd],
    ["Oil", compact.marketContext?.oil],
    ["Macro Events", compact.calendars?.macroEvents],
    ["Earnings", compact.calendars?.earnings],
  ];
  for (const [label, context] of categories) {
    const line = overnight.split("\n").find((candidate) => new RegExp(`${escapeRegExp(label)}(?:\\*{0,2})\\s*:`, "i").test(candidate));
    if (context?.status === "available" && (!line || /\bunavailable\b|not in snapshot/i.test(line))) {
      errors.push(`available context incorrectly marked unavailable: ${label}`);
    }
    if (context?.status === "unavailable" && (!line || !/\bunavailable\b/i.test(line))) {
      errors.push(`unavailable context not flagged unavailable: ${label}`);
    }
  }
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

function reportPrompt(compact, options = {}) {
  const verbose = compact.reportMode === "verbose";
  return [
    `Produce an evidence-rich, decision-focused Growth Tech Morning Brief in Markdown in ${compact.reportMode} mode.`,
    "Answer one question: after screening both the core watchlist and a broader movers universe, is there a sufficiently strong, time-sensitive reason to buy, sell, trim, or investigate a stock today?",
    "Do not recommend a trade merely because a stock ranks highest. Default to 'No high-conviction trade today' unless an absolute setup threshold is cleared.",
    `Use only opportunityGate.candidates. Include at most ${compact.opportunityGate.maximumOpportunities} names. A >=3% move without verified news may be Watch only, never Buy/Sell.`,
    "Buy now, Buy on weakness, and Sell require a verified fresh company event or same-day earnings. Trim requires either that evidence or the supplied extremeTrim flag.",
    "Show the reasoning chain. For each call explain why it was considered, what the market may be mispricing, evidence for and against, strategic position, today's action, confidence, entry/exit condition, catalyst, risk/reward, and falsifiable invalidation.",
    "Discovery candidates are not pre-approved investments. Explicitly discuss market cap, dollar liquidity, missing fundamental/valuation data, and source quality before any actionable call.",
    "News metadata is evidence, not automatically causal. Attribute a price move to an event only when relevance is direct; otherwise call the move unverified.",
    "Federal Reserve items are from the official monetary-policy feed. Use them as market-regime inputs only when fresh and material to today's decision.",
    "Reported growth is backward-looking SEC data. Price action cannot establish demand, CapEx, adoption, institutional flows, or fundamental strength.",
    `Label market context as ${compact.session}; do not call regular-trading quotes overnight futures or premarket indications.`,
    `Allowed Today's Actions: ${TODAY_ACTIONS.join(", ")}.`,
    verbose
      ? "Verbose mode is an audit trail, not filler: expose the candidate funnel, analyze every gated candidate supplied (up to ten), state missing or failed inputs, and fully explain why each setup passed or failed. Do not silently omit a candidate or data-source failure."
      : "Standard mode must remain auditable: explain the funnel and strongest rejected setups without exhaustive low-value tables.",
    "Depth is preferred over brevity when it adds decision value. Do not add exhaustive sector, dashboard, or full-watchlist tables.",
    "",
    `**Report Mode:** ${compact.reportMode}`,
    `**Engine Version:** ${compact.engineVersion}`,
    "Repeat those two metadata lines verbatim immediately beneath the report title.",
    "",
    "# Today's Verdict",
    "Exactly three bullets labeled **Verdict:**, **Confidence:**, and **Why Today:**.",
    "",
    "# Decision Reasoning",
    "Use three labeled paragraphs: **Universe Searched:** with core and discovery coverage counts, **Opportunity Gate:** explaining which signals admitted candidates and the evidence standard, and **Conclusion:** explaining why the strongest setups passed or failed today.",
    "",
    "# Opportunities",
    verbose
      ? "If no candidate merits action, do not leave this section empty or use only one sentence. Use four labeled bullets: **Threshold Result:**, **Best Near-Miss:**, **Why It Failed:**, and **Portfolio Action:**."
      : "If no candidate merits action, state that no actionable opportunity clears the threshold and identify the best near-miss plus its decisive failure.",
    "Otherwise use `### SYMBOL — Today's Action` and eleven bullets labeled **Why Considered:**, **Mispricing Thesis:**, **Evidence For:**, **Evidence Against:**, **Strategic Position:**, **Today's Action:**, **Confidence:**, **Entry/Exit Condition:**, **Verified Catalyst:**, **Risk/Reward:**, and **Invalidation:** for each name.",
    "",
    "# Rejected Candidates",
    verbose
      ? "Audit every supplied opportunityGate candidate, up to ten, that is not actionable. Use `### SYMBOL — Rejected/Watch` and fields **Admission Signal:**, **Evidence Supporting:**, **Evidence Missing or Conflicting:**, **Rejection Reason:**, and **Promotion Trigger:**."
      : "Discuss up to five of the strongest candidates that failed the action threshold. For each, state the admission signal, missing evidence or conflicting evidence, and what would promote it to an actionable setup. If none exist, say so explicitly.",
    "",
    ...(verbose ? [
      "# Data and Pipeline Audit",
      "Use four labeled paragraphs: **Available Evidence:**, **Missing Evidence:**, **Source Failures:**, and **Confidence Impact:**. Distinguish a genuine lack of evidence from a source or extraction failure. If no source failed, say so explicitly.",
      "",
    ] : []),
    "",
    "# Market and AI-Cycle Context",
    "Exactly three concise bullets labeled **AI Cycle:**, **Market Regime:**, and **Material News:**. Mention only facts that change conviction today; omit low-value calendar items.",
    "",
    "# What Could Change the Call",
    "Use specific earnings, macro events, price levels, verified news, or data gaps that could change today's calls.",
    options.retry ? `Retry instruction: the previous response failed validation. Preserve every ${verbose ? "verbose" : "standard"} section and required label; reduce repetition but retain the complete reasoning chain.` : "",
    "",
    "Compact snapshot JSON:",
    JSON.stringify(compact),
  ].filter(Boolean).join("\n");
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
      reportMode: metadata.reportMode,
      engineVersion: metadata.engineVersion ?? SERVICE_VERSION,
    }),
  };
  await Promise.all([
    env.BRIEF_BUCKET.put(`reports/${reportDate}.md`, markdown, options),
    env.BRIEF_BUCKET.put("reports/latest.md", markdown, options),
  ]);
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
    const chunks = discordMessageChunks(reportDate, markdown);
    let delivered = 0;
    for (const [index, content] of chunks.entries()) {
      try {
        await postWebhookJson(discordUrl, discordPayload(content), `Discord webhook delivery failed (${index + 1}/${chunks.length})`);
        delivered += 1;
      } catch (error) {
        error.chunks = { expected: chunks.length, delivered, failed: chunks.length - delivered };
        throw error;
      }
    }
    return {
      sent: true,
      provider: "discord",
      messages: chunks.length,
      chunks: { expected: chunks.length, delivered, failed: chunks.length - delivered },
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

async function postWebhookJson(url, payload, label) {
  let response = await postJson(url, payload);
  if (response.status === 429) {
    await sleep(await discordRetryDelayMs(response));
    response = await postJson(url, payload);
  }
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`${label} (${response.status})${body ? `: ${body}` : ""}`);
  }
}

function postJson(url, payload) {
  return fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

async function discordRetryDelayMs(response) {
  const header = Number(response.headers.get("retry-after"));
  if (Number.isFinite(header)) return Math.max(0, header * 1000);
  const body = await response.clone().json().catch(() => null);
  const retryAfter = Number(body?.retry_after);
  if (Number.isFinite(retryAfter)) return Math.max(0, retryAfter * 1000);
  return 1000;
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

function discordMessageChunks(reportDate, markdown) {
  const maxLength = 1900;
  const text = markdown.trim();
  if (text.length <= maxLength) return [text];
  const chunks = [];
  let remaining = text;
  while (remaining) {
    const partLabel = `Part ${chunks.length + 1}\n`;
    const available = chunks.length ? maxLength - partLabel.length : maxLength;
    let chunk = remaining.slice(0, available);
    const breakAt = chunk.lastIndexOf("\n\n");
    const lineBreakAt = chunk.lastIndexOf("\n");
    if (breakAt > 200) chunk = chunk.slice(0, breakAt);
    else if (lineBreakAt > 200) chunk = chunk.slice(0, lineBreakAt);
    chunks.push(chunks.length ? `${partLabel}${chunk}`.trim() : chunk.trim());
    remaining = remaining.slice(chunk.length).trim();
  }
  return chunks.map((chunk, index) => chunk.replace(/^Part \d+/, `Part ${index + 1}/${chunks.length}`));
}

async function settleDelivery(delivery) {
  try {
    return await delivery();
  } catch (error) {
    console.error(error);
    return { failed: true, error: errorMessage(error), ...(error?.chunks ? { chunks: error.chunks } : {}) };
  }
}

function markdownToHtml(markdown) {
  return markdown.split(/\n{2,}/).map((block) => {
    const escaped = escapeHtml(block).replace(/\n/g, "<br>");
    if (block.startsWith("# ")) return `<h1>${escaped.slice(2)}</h1>`;
    if (block.startsWith("## ")) return `<h2>${escaped.slice(3)}</h2>`;
    return `<p>${escaped}</p>`;
  }).join("\n");
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
  const cik = CIKS[symbol];
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
  return {
    available: Boolean(quarterlyRevenue.length || quarterlyEps.length),
    entityName: body?.entityName ?? null,
    quarterlyRevenue,
    quarterlyEps,
    quarterlyShares,
  };
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
