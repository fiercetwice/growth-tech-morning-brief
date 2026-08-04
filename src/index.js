const YAHOO_CHART = "https://query1.finance.yahoo.com/v8/finance/chart";
const SEC_FACTS = "https://data.sec.gov/api/xbrl/companyfacts";
const HISTORY_YEARS = 5;

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
    if (path === "/health") return json({ ok: true, service: "growth-tech-morning-brief" });
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
    return json({ error: "not_found" }, 404);
  },

  async scheduled(controller, env, ctx) {
    ctx.waitUntil(buildSnapshot(env, new Date(controller.scheduledTime)).catch((error) => console.error(error)));
  },
};

export async function buildSnapshot(env, now = new Date(), options = {}) {
  const ny = zonedParts(now, "America/New_York");
  if (!options.force && (ny.hour !== 9 || ny.minute !== 35)) {
    return { skipped: true, reason: "not_09_35_ET", observed: ny };
  }

  const symbols = parseSymbols(env.WATCHLIST);
  const results = await Promise.allSettled(symbols.map(async (symbol) => {
    const chart = await fetchYahooChart(symbol, now, env);
    const fundamentals = await fetchSecFundamentals(symbol, env, now).catch((error) => ({
      available: false, reason: error.message,
    }));
    return assembleSymbol(symbol, chart, fundamentals);
  }));

  const watchlist = results.map((result, index) => result.status === "fulfilled"
    ? result.value
    : { symbol: symbols[index], missing: true, error: result.reason?.message ?? String(result.reason) });
  const succeeded = watchlist.filter((row) => !row.missing).length;
  if (!succeeded) throw new Error("All Yahoo chart requests failed");

  const snapshot = {
    schemaVersion: 2,
    generatedAt: now.toISOString(),
    session: "regular_open_plus_5m",
    sources: {
      price: "Yahoo Finance chart endpoint (unofficial)",
      fundamentals: "SEC EDGAR CompanyFacts",
      methodology: "Point-in-time TTM multiples use only filings available by each price date",
    },
    coverage: { requested: symbols.length, succeeded, failed: symbols.length - succeeded },
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

export function toBrief(snapshot) {
  const rows = snapshot.watchlist.map(compactRow);
  const valid = rows.filter((row) => !row.missing);
  const ranked = [...valid].filter((row) => Number.isFinite(row.changePercent)).sort((a, b) => b.changePercent - a.changePercent);
  const expensive = [...valid].filter((row) => Number.isFinite(row.valuation?.selectedPercentile))
    .sort((a, b) => b.valuation.selectedPercentile - a.valuation.selectedPercentile);
  const brief = {
    schemaVersion: 3,
    generatedAt: snapshot.generatedAt,
    session: snapshot.session,
    coverage: snapshot.coverage,
    executiveSummary: {
      strongest: ranked.slice(0, 3).map((row) => `${row.symbol} ${signed(row.changePercent)}%`),
      weakest: ranked.slice(-3).reverse().map((row) => `${row.symbol} ${signed(row.changePercent)}%`),
      highestValuationPercentile: expensive.slice(0, 3).map((row) => `${row.symbol} ${row.valuation.selectedPercentile} percentile`),
      dataQuality: snapshot.coverage.failed ? `${snapshot.coverage.failed} symbol(s) failed` : "All requested symbols available",
    },
    watchlist: rows,
  };
  brief.markdown = renderMarkdown(brief);
  return brief;
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
    missing: false,
  };
}

function renderMarkdown(brief) {
  const lines = [
    `# Growth Tech Morning Brief — ${brief.generatedAt.slice(0, 10)}`,
    "",
    `Coverage: ${brief.coverage.succeeded}/${brief.coverage.requested}. Session: 9:35 AM ET.`,
    "",
    `Strongest: ${brief.executiveSummary.strongest.join(", ") || "n/a"}`,
    `Weakest: ${brief.executiveSummary.weakest.join(", ") || "n/a"}`,
    `Highest valuation percentile: ${brief.executiveSummary.highestValuationPercentile.join(", ") || "n/a"}`,
    "",
    "| Symbol | Price | Day | 52W position | TTM P/E | TTM P/S | 5Y valuation percentile |",
    "|---|---:|---:|---:|---:|---:|---:|",
  ];
  for (const row of brief.watchlist) {
    if (row.missing) {
      lines.push(`| ${row.symbol} | n/a | n/a | n/a | n/a | n/a | failed |`);
      continue;
    }
    const percentileLabel = Number.isFinite(row.valuation?.selectedPercentile)
      ? `${fmt(row.valuation.selectedPercentile)} percentile (${row.valuation.selectedMetric === "trailingPE" ? "P/E" : "P/S"})`
      : "n/a";
    lines.push(`| ${row.symbol} | ${fmt(row.price)} | ${signed(row.changePercent)}% | ${fmt(row.positionIn52WeekRange)}% | ${fmt(row.valuation?.trailingPE)} | ${fmt(row.valuation?.trailingPS)} | ${percentileLabel} |`);
  }
  lines.push("", "Valuation history is point-in-time and uses only SEC filings available on each observation date. Yahoo price data is unofficial.");
  return lines.join("\n");
}

function authorized(request, env) {
  return env.RUN_TOKEN_REQUIRED !== "true" || request.headers.get("authorization") === `Bearer ${env.RUN_TOKEN}`;
}

function fmt(value) { return Number.isFinite(value) ? String(value) : "n/a"; }
function signed(value) { return Number.isFinite(value) ? `${value >= 0 ? "+" : ""}${value}` : "n/a"; }

async function fetchYahooChart(symbol, now, env) {
  const end = Math.floor(now.getTime() / 1000) + 86400;
  const start = end - Math.round(HISTORY_YEARS * 365.25 * 86400);
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
    price: latest,
    previousClose: previous,
    change: finitePair(latest, previous) ? latest - previous : null,
    changePercent: finitePair(latest, previous) && previous !== 0 ? ((latest - previous) / previous) * 100 : null,
    history,
  };
}

async function fetchSecFundamentals(symbol, env, now) {
  const cik = CIKS[symbol];
  if (!cik) return { available: false, reason: "CIK not configured" };
  const cacheKey = `sec/companyfacts/${cik}.json`;
  let body = null;
  if (env.BRIEF_BUCKET?.get) {
    const cached = await env.BRIEF_BUCKET.get(cacheKey);
    if (cached) {
      const uploaded = cached.uploaded ? new Date(cached.uploaded).getTime() : 0;
      if (now.getTime() - uploaded < 7 * 86400_000) body = await cached.json();
    }
  }
  if (!body) {
    const response = await fetch(`${SEC_FACTS}/CIK${cik}.json`, {
      headers: { accept: "application/json", "user-agent": env.SEC_USER_AGENT || "growth-tech-morning-brief research@example.com" },
    });
    if (!response.ok) throw new Error(`SEC CompanyFacts failed (${response.status})`);
    body = await response.json();
    if (env.BRIEF_BUCKET?.put) await env.BRIEF_BUCKET.put(cacheKey, JSON.stringify(body), { httpMetadata: { contentType: "application/json" } });
  }
  return extractSecFundamentals(body);
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
    history: chart.history,
    fundamentals: fundamentals.available ? {
      quarterlyRevenue: fundamentals.quarterlyRevenue,
      quarterlyEps: fundamentals.quarterlyEps,
      quarterlyShares: fundamentals.quarterlyShares,
    } : fundamentals,
    valuationHistory,
    missing: false,
  };
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

function json(value, status = 200) {
  return new Response(JSON.stringify(value, null, 2), { status, headers: { "content-type": "application/json; charset=utf-8" } });
}
