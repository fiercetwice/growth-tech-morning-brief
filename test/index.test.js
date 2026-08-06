import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCalendarContext, buildDiscoveryContext, buildMarketContext, buildSnapshot, buildValuationHistory, normalizeFedMonetaryNews, normalizeNasdaqEarningsCalendar,
  normalizeNasdaqMacroCalendar, normalizeNasdaqStockUniverse, normalizeYahooNews, marketSession, normalizeYahooChart, percentile, quarterlyFacts,
  reportedGrowth, toBrief, zonedParts,
} from "../src/index.js";

test("DST-aware New York schedule accepts summer and winter triggers", () => {
  assert.deepEqual(zonedParts(new Date("2026-08-03T13:35:00Z"), "America/New_York"), { date: "2026-08-03", hour: 9, minute: 35 });
  assert.deepEqual(zonedParts(new Date("2026-12-03T14:35:00Z"), "America/New_York"), { date: "2026-12-03", hour: 9, minute: 35 });
});

test("normalizes Yahoo chart history and current move", () => {
  const chart = normalizeYahooChart({
    meta: { regularMarketPrice: 110, regularMarketPreviousClose: 100, chartPreviousClose: 10, currency: "USD" },
    timestamp: [1722470400, 1722556800],
    indicators: { quote: [{ close: [99, 109], volume: [10, 20] }], adjclose: [{ adjclose: [100, 110] }] },
  });
  assert.equal(chart.price, 110);
  assert.equal(chart.changePercent, 10);
  assert.equal(chart.history.length, 2);
});

test("Yahoo normalization retains the quote as-of timestamp", () => {
  const chart = normalizeYahooChart({
    meta: { regularMarketPrice: 101, regularMarketPreviousClose: 100, regularMarketTime: 1785935700 },
    timestamp: [1785849300, 1785935700],
    indicators: { quote: [{ close: [100, 101] }] },
  });
  assert.equal(chart.asOf, "2026-08-05T13:15:00.000Z");
});

test("normalizes Nasdaq macro events without HTML placeholders", () => {
  const calendar = normalizeNasdaqMacroCalendar({ data: { rows: [{
    time: "08:30 AM", country: "US", eventName: "Initial Claims", actual: "225K",
    consensus: "230K", previous: "<span>228K</span>",
  }] } }, "2026-08-05", new Date("2026-08-05T13:35:00Z"));
  assert.equal(calendar.status, "available");
  assert.deepEqual(calendar.events[0], {
    time: "08:30 AM", country: "US", event: "Initial Claims", actual: "225K", consensus: "230K", previous: "228K",
  });
});

test("macro calendar removes low-relevance non-US events", () => {
  const calendar = normalizeNasdaqMacroCalendar({ data: { rows: [
    { time: "09:00 AM", country: "Canada", eventName: "S&P Manufacturing PMI", actual: "53" },
    { time: "10:00 AM", country: "US", eventName: "ISM Services", actual: "52" },
    { time: "02:00 PM", country: "EU", eventName: "ECB Interest Rate Decision", actual: "3%" },
  ] } }, "2026-08-05");
  assert.deepEqual(calendar.events.map((event) => event.event), ["ISM Services", "ECB Interest Rate Decision"]);
});

test("official Fed feed classifies a fresh rate decision", () => {
  const xml = `<rss><channel><item><title>Federal Reserve issues FOMC statement on interest rates</title><link>https://www.federalreserve.gov/newsevents/pressreleases/monetary20260804a.htm</link><pubDate>Tue, 04 Aug 2026 18:00:00 GMT</pubDate></item></channel></rss>`;
  const news = normalizeFedMonetaryNews(xml, new Date("2026-08-05T13:35:00Z"));
  assert.equal(news.items.length, 1);
  assert.equal(news.items[0].kind, "rate_decision");
  assert.equal(news.items[0].verified, true);
});

test("company news keeps only fresh symbol-linked headlines", () => {
  const news = normalizeYahooNews({ news: [
    { title: "NVIDIA announces new platform", link: "https://example.test/nvda", publisher: "Reuters", providerPublishTime: 1785930000 },
    { title: "Old NVIDIA item", link: "https://example.test/old", providerPublishTime: 1785000000 },
  ] }, "NVDA", new Date("2026-08-05T13:35:00Z"));
  assert.equal(news.length, 1);
  assert.deepEqual(news[0].symbols, ["NVDA"]);
  assert.equal(news[0].source, "Reuters");
  assert.equal(news[0].material, true);
});

test("Nasdaq discovery normalizes lesser-known liquid technology stocks", () => {
  const rows = normalizeNasdaqStockUniverse({ data: { rows: [{
    symbol: "LITE", name: "Lumentum Holdings", country: "United States", sector: "Technology",
    industry: "Communication Equipment", lastsale: "$80.00", pctchange: "7.5%",
    volume: "2,000,000", marketCap: "5,000,000,000",
  }] } });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].symbol, "LITE");
  assert.equal(rows[0].dollarVolume, 160_000_000);
  assert.equal(rows[0].changePercent, 7.5);
});

test("discovery excludes the core watchlist and enforces liquidity", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes("/screener/stocks")) return new Response(JSON.stringify({ data: { asOf: "2026-08-05", rows: [
      { symbol: "NVDA", name: "NVIDIA", sector: "Technology", industry: "Semiconductors", lastsale: "$200", pctchange: "4%", volume: "5000000", marketCap: "5000000000000" },
      { symbol: "LITE", name: "Lumentum", sector: "Technology", industry: "Communication Equipment", lastsale: "$80", pctchange: "8%", volume: "2000000", marketCap: "5000000000" },
      { symbol: "TINY", name: "Tiny Software", sector: "Technology", industry: "Software", lastsale: "$1", pctchange: "30%", volume: "10000", marketCap: "50000000" },
    ] } }), { headers: { "content-type": "application/json" } });
    if (url.includes("/finance/search")) return new Response(JSON.stringify({ news: [{ title: "Lumentum announces AI optics contract", link: "https://example.test/lite", publisher: "Reuters", providerPublishTime: 1785930000 }] }), { headers: { "content-type": "application/json" } });
    throw new Error(`Unexpected fetch ${url}`);
  };
  try {
    const discovery = await buildDiscoveryContext({}, new Date("2026-08-05T13:35:00Z"), ["NVDA"]);
    assert.deepEqual(discovery.candidates.map((row) => row.symbol), ["LITE"]);
    assert.equal(discovery.candidates[0].news[0].material, true);
    assert.equal(discovery.filters.minMarketCap, 250_000_000);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("cold SEC cache obeys the per-invocation external refresh budget", async () => {
  const originalFetch = globalThis.fetch;
  let secCalls = 0;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.startsWith("https://query1.finance.yahoo.com")) return new Response(JSON.stringify({ chart: { result: [{
      meta: { regularMarketPrice: 100, regularMarketPreviousClose: 99, currency: "USD" },
      timestamp: [1785849300, 1785935700], indicators: { quote: [{ close: [99, 100], volume: [1000, 2000] }] },
    }] } }), { headers: { "content-type": "application/json" } });
    if (url.startsWith("https://query2.finance.yahoo.com")) return new Response(JSON.stringify({ news: [] }), { headers: { "content-type": "application/json" } });
    if (url.startsWith("https://data.sec.gov")) {
      secCalls += 1;
      return new Response(JSON.stringify({ facts: { "us-gaap": {} } }), { headers: { "content-type": "application/json" } });
    }
    if (url.startsWith("https://api.nasdaq.com")) return new Response(JSON.stringify({ data: { rows: [] } }), { headers: { "content-type": "application/json" } });
    if (url.startsWith("https://www.federalreserve.gov")) return new Response("<rss><channel></channel></rss>");
    throw new Error(`Unexpected fetch ${url}`);
  };
  try {
    const snapshot = await buildSnapshot({
      WATCHLIST: "NVDA,AMZN,MSFT,ANET,AVGO", DISCOVERY_ENABLED: "false", SEC_REFRESH_LIMIT: "2",
    }, new Date("2026-08-05T13:35:00Z"), { force: true });
    assert.equal(secCalls, 2);
    assert.equal(snapshot.watchlist.filter((row) => row.fundamentals?.reason?.includes("refresh budget exhausted")).length, 3);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("market session labels premarket, regular trading, after-hours, and closed", () => {
  assert.equal(marketSession(new Date("2026-08-05T12:00:00Z")), "premarket");
  assert.equal(marketSession(new Date("2026-08-05T15:00:00Z")), "regular_trading");
  assert.equal(marketSession(new Date("2026-08-05T21:00:00Z")), "after_hours");
  assert.equal(marketSession(new Date("2026-08-06T02:00:00Z")), "closed");
});

test("Nasdaq earnings prioritizes covered symbols and caps prompt payload", () => {
  const rows = Array.from({ length: 30 }, (_, index) => ({
    symbol: `T${index}`, name: `Company ${index}`, time: "time-not-supplied", epsForecast: "$1.00",
  }));
  rows.push({ symbol: "NVDA", name: "NVIDIA", time: "After Hours", epsForecast: "$2.00" });
  const calendar = normalizeNasdaqEarningsCalendar({ data: { asOf: "08/05/2026", rows } }, "2026-08-05", ["NVDA"]);
  assert.equal(calendar.events.length, 25);
  assert.equal(calendar.events[0].symbol, "NVDA");
  assert.deepEqual(calendar.watchlistMatches, ["NVDA"]);
});

test("market context preserves partial coverage and flags stale quotes", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (!url.includes("ES%3DF")) return new Response("upstream failed", { status: 503 });
    return new Response(JSON.stringify({ chart: { result: [{
      meta: { regularMarketPrice: 6000, regularMarketPreviousClose: 5970, regularMarketTime: 1785849300, currency: "USD" },
      timestamp: [1785849300], indicators: { quote: [{ close: [6000] }] },
    }] } }), { headers: { "content-type": "application/json" } });
  };
  try {
    const context = await buildMarketContext({}, new Date("2026-08-05T13:35:00Z"));
    assert.equal(context.futures.status, "stale");
    assert.equal(context.futures.items.length, 1);
    assert.equal(context.futures.failed, 1);
    assert.equal(context.rates.status, "unavailable");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("calendar provider failure is isolated by category", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ status: { bCodeMessage: [{ errorMessage: "calendar unavailable" }] } }), {
    status: 503, headers: { "content-type": "application/json" },
  });
  try {
    const calendars = await buildCalendarContext({}, new Date("2026-08-05T13:35:00Z"), ["NVDA"]);
    assert.equal(calendars.macroEvents.status, "unavailable");
    assert.equal(calendars.earnings.status, "unavailable");
    assert.match(calendars.macroEvents.reason, /calendar unavailable/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("does not mistake the start of a multi-year chart for previous close", () => {
  const chart = normalizeYahooChart({
    meta: { regularMarketPrice: 110, chartPreviousClose: 20 },
    timestamp: [1722470400, 1722556800],
    indicators: { quote: [{ close: [100, 110], volume: [10, 20] }] },
  });
  assert.equal(chart.previousClose, 100);
  assert.equal(chart.changePercent, 10);
});

test("quarterly facts discard cumulative 10-Q observations", () => {
  const rows = [
    { form: "10-Q", fy: 2026, fp: "Q1", start: "2026-01-01", end: "2026-03-31", filed: "2026-05-01", val: 10 },
    { form: "10-Q", fy: 2026, fp: "Q2", start: "2026-01-01", end: "2026-06-30", filed: "2026-08-01", val: 30 },
  ];
  assert.deepEqual(quarterlyFacts(rows).map((x) => x.value), [10]);
});

test("quarterly facts derive Q4 from annual total", () => {
  const rows = [1, 2, 3].map((q) => ({ form: "10-Q", fy: 2025, fp: `Q${q}`, start: `2025-0${q * 3 - 2}-01`, end: `2025-0${q * 3}-28`, filed: `2025-0${q * 3 + 1}-15`, val: q * 10 }));
  rows.push({ form: "10-K", fy: 2025, fp: "FY", start: "2025-01-01", end: "2025-12-31", filed: "2026-02-15", val: 100 });
  const facts = quarterlyFacts(rows, { deriveFourthQuarter: true });
  assert.equal(facts.at(-1).value, 40);
  assert.equal(facts.at(-1).derivedFromAnnual, true);
});

test("reported growth calculates TTM and latest-quarter YoY from SEC facts", () => {
  const quarterlyRevenue = Array.from({ length: 8 }, (_, index) => ({
    value: index < 4 ? 100 : 120, filed: `202${index < 4 ? 5 : 6}-0${(index % 4) + 1}-15`,
  }));
  const growth = reportedGrowth({ quarterlyRevenue, quarterlyEps: quarterlyRevenue.map((row) => ({ ...row, value: row.value / 10 })) });
  assert.equal(growth.revenueTtmYoY, 20);
  assert.equal(growth.revenueLatestQuarterYoY, 20);
  assert.equal(growth.epsTtmYoY, 20);
  assert.match(growth.basis, /reported SEC filings/);
});

test("valuation uses only filings available on the price date", () => {
  const quarters = [1, 2, 3, 4].map((q) => ({ end: `2025-0${q * 2}-28`, filed: `2025-0${q * 2 + 1}-15`, value: 10 }));
  const history = buildValuationHistory([{ date: "2025-10-01", adjustedClose: 20 }], {
    quarterlyRevenue: quarters.map((x) => ({ ...x, value: 100 })), quarterlyEps: quarters,
    quarterlyShares: [{ end: "2025-08-28", filed: "2025-09-15", value: 50 }],
  });
  assert.equal(history[0].trailingPE, 0.5);
  assert.equal(history[0].trailingPS, 2.5);
});

test("percentile ignores missing values", () => {
  assert.equal(percentile(3, [1, 2, 3, 4, null]), 75);
});

test("brief excludes raw history and selects P/S for negative earners", () => {
  const brief = toBrief({
    generatedAt: "2026-08-04T13:35:00.000Z", session: "regular_open_plus_5m",
    coverage: { requested: 1, succeeded: 1, failed: 0 },
    watchlist: [{ symbol: "CRWV", name: "CoreWeave", price: 100, changePercent: 2,
      yearLow: 50, yearHigh: 150, positionIn52WeekRange: 50, missing: false,
      valuation: { trailingPE: null, trailingPS: 10, trailingPEPercentile5Y: null,
        trailingPSPercentile5Y: 80, fundamentalAsOf: "2026-07-01" },
      history: [{ date: "2026-08-04", adjustedClose: 100 }], valuationHistory: [] }],
  });
  assert.equal(brief.watchlist[0].valuation.selectedMetric, "trailingPS");
  assert.equal(brief.watchlist[0].valuation.selectedPercentile, 80);
  assert.equal("history" in brief.watchlist[0], false);
  assert.equal(brief.opportunityGate.candidates.length, 0);
  assert.match(brief.markdown, /No stock cleared the absolute setup gate/);
});

test("brief renders missing valuation percentile as n/a", () => {
  const brief = toBrief({
    generatedAt: "2026-08-04T13:35:00.000Z", session: "regular_open_plus_5m",
    coverage: { requested: 1, succeeded: 1, failed: 0 },
    watchlist: [{ symbol: "TSM", price: 100, changePercent: 1, yearLow: 80, yearHigh: 120,
      positionIn52WeekRange: 50, missing: false, valuation: null }],
  });
  assert.doesNotMatch(brief.markdown, /n\/ath/);
  assert.equal(brief.watchlist[0].valuation, null);
});

test("brief computes deterministic stock and sector actions from supplied metrics", () => {
  const brief = toBrief({
    generatedAt: "2026-08-05T15:00:00.000Z", session: "regular_trading",
    coverage: { requested: 1, succeeded: 1, failed: 0 },
    watchlist: [{
      symbol: "NVDA", price: 100, changePercent: 2, yearLow: 50, yearHigh: 110,
      positionIn52WeekRange: 83, missing: false,
      valuation: { trailingPE: 20, trailingPS: 10, trailingPEPercentile5Y: 50, trailingPSPercentile5Y: 70 },
      reportedGrowth: { revenueTtmYoY: 25, epsTtmYoY: 30, basis: "reported SEC filings; not analyst estimates" },
    }],
  });
  assert.equal(brief.watchlist[0].action, "Buy");
  assert.equal(brief.decisionFramework.sectorScorecard.GPU.action, "Buy");
  assert.equal(brief.decisionFramework.aiCycle["GPU Demand"].rating, "Insufficient Data");
  assert.equal(brief.opportunityGate.candidates.length, 0);
});

test("brief admits a liquid discovery name with a material event outside the core watchlist", () => {
  const brief = toBrief({
    generatedAt: "2026-08-05T15:00:00.000Z", session: "regular_trading",
    coverage: { requested: 1, succeeded: 1, failed: 0 },
    watchlist: [{ symbol: "NVDA", price: 100, changePercent: 0.5, yearLow: 50, yearHigh: 110, positionIn52WeekRange: 83, missing: false, valuation: null }],
    discovery: {
      status: "available", source: "Nasdaq full-market stock screener (unofficial public endpoint)", scanned: 7000,
      eligibleAfterLiquidityAndRelevance: 1, filters: { minMarketCap: 250_000_000, minDollarVolume: 5_000_000 },
      candidates: [{
        symbol: "LITE", name: "Lumentum", price: 80, changePercent: 8, yearLow: 40, yearHigh: 100,
        positionIn52WeekRange: 66.67, marketCap: 5_000_000_000, dollarVolume: 160_000_000,
        relativeVolume: null, sector: "Technology", industry: "Communication Equipment", screen: "nasdaq_full_market",
        discoveryScore: 14, news: [{ title: "Lumentum announces AI optics contract", url: "https://example.test/lite", verified: true, material: true, symbols: ["LITE"] }], missing: false,
      }],
    },
    news: { company: { items: [] } },
  });
  assert.equal(brief.discovery.candidates[0].symbol, "LITE");
  assert.equal(brief.opportunityGate.candidates[0].symbol, "LITE");
  assert.equal(brief.opportunityGate.candidates[0].setup.verifiedCatalyst, true);
  assert.match(brief.opportunityGate.candidates[0].risk, /fundamentals and valuation not yet verified/);
});
