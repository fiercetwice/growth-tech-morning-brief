import test from "node:test";
import assert from "node:assert/strict";
import { buildValuationHistory, normalizeYahooChart, percentile, quarterlyFacts, toBrief, zonedParts } from "../src/index.js";

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
  assert.match(brief.markdown, /CRWV/);
  assert.match(brief.markdown, /80 percentile \(P\/S\)/);
});

test("brief renders missing valuation percentile as n/a", () => {
  const brief = toBrief({
    generatedAt: "2026-08-04T13:35:00.000Z", session: "regular_open_plus_5m",
    coverage: { requested: 1, succeeded: 1, failed: 0 },
    watchlist: [{ symbol: "TSM", price: 100, changePercent: 1, yearLow: 80, yearHigh: 120,
      positionIn52WeekRange: 50, missing: false, valuation: null }],
  });
  assert.doesNotMatch(brief.markdown, /n\/ath/);
  assert.match(brief.markdown, /\| n\/a \|$/m);
});
