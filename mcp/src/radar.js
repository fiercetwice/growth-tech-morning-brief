function clampPct(x) {
  return Number.isFinite(x) ? x : null;
}

export function buildEntrySetup(analysis) {
  const p = analysis?.price || {};
  const v = analysis?.valuation || {};
  const t = analysis?.target || {};
  const q = analysis?.dataQuality || {};
  const oneDayExtended = Number.isFinite(p.return1d) ? p.return1d >= 0.08 : false;
  const oneMonthExtendedNearHigh = Number.isFinite(p.return1m) && Number.isFinite(p.drawdownFromMonthHigh)
    ? p.return1m >= 0.15 && p.drawdownFromMonthHigh >= -0.03
    : false;
  return {
    ticker: analysis?.ticker || null,
    last: p.last ?? null,
    observations1m: p.observations1m ?? null,
    return5d: clampPct(p.return5d),
    return1m: clampPct(p.return1m),
    monthHigh: p.monthHigh ?? null,
    monthLow: p.monthLow ?? null,
    drawdownFromMonthHigh: clampPct(p.drawdownFromMonthHigh),
    distanceFromMonthLow: clampPct(p.distanceFromMonthLow),
    avgVolume1m: p.avgVolume1m ?? null,
    valuationBasis: v.basis || null,
    pePercentile: v.pe?.percentile ?? null,
    psPercentile: v.ps?.percentile ?? null,
    targetBase: t.base ?? null,
    targetUpside: t.baseUpside ?? t.upside ?? null,
    targetConfidence: t.confidence ?? null,
    completeOneMonth: Boolean(q.completeOneMonth),
    ttmAvailable: (q.ttmVintageCount || 0) > 0,
    recentFilingCount: q.recentFilingCount || 0,
    extensionFlags: {
      oneDayExtended,
      oneMonthExtendedNearHigh,
    },
    buyNowDataGate: Boolean(q.completeOneMonth) && Boolean(q.secAvailable) && Boolean(q.targetAvailable),
  };
}

export function buildWatchlistPacket(batch) {
  const rows = [];
  const failures = [];
  for (const item of batch?.results || []) {
    if (!item?.ok) {
      failures.push({ ticker: item?.ticker || null, error: item?.error || 'unknown_error' });
      continue;
    }
    const a = item.data;
    const entry = buildEntrySetup(a);
    rows.push({
      ...entry,
      latestFiling: a?.recentFilings?.[0] ? {
        form: a.recentFilings[0].form,
        filed: a.recentFilings[0].filed,
        items: a.recentFilings[0].items,
      } : null,
      cacheHit: Boolean(a?.cache?.hit),
    });
  }
  return {
    version: '0.4.0',
    asOf: batch?.asOf || new Date().toISOString(),
    requested: batch?.requested || rows.length + failures.length,
    succeeded: rows.length,
    failed: failures.length,
    rows,
    failures,
  };
}
