function quantile(sorted, q) {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

function percentileRank(sorted, value) {
  if (!sorted.length || !Number.isFinite(value)) return null;
  let n = 0;
  for (const x of sorted) if (x <= value) n++;
  return n / sorted.length;
}

function futureSplitFactor(filedMs, splits = []) {
  let factor = 1;
  for (const s of splits) {
    if (s.timeMs > filedMs && Number.isFinite(s.ratio) && s.ratio > 0) factor *= s.ratio;
  }
  return factor;
}

export function buildPointInTimeValuation({ priceRows, filingVintages, splits = [] }) {
  const vintages = filingVintages
    .filter(v => v?.filed && (Number.isFinite(v?.epsPerShare) || Number.isFinite(v?.revenuePerShare)))
    .map(v => {
      const filedMs = Date.parse(v.filed);
      const factor = futureSplitFactor(filedMs, splits);
      return {
        ...v,
        filedMs,
        splitFactorToPresent: factor,
        epsPerShareAdjusted: Number.isFinite(v.epsPerShare) ? v.epsPerShare / factor : null,
        revenuePerShareAdjusted: Number.isFinite(v.revenuePerShare) ? v.revenuePerShare / factor : null,
      };
    })
    .filter(v => Number.isFinite(v.filedMs))
    .sort((a,b) => a.filedMs - b.filedMs);

  const pe = [], ps = [];
  for (const row of priceRows) {
    const t = row.timeMs ?? row.t * 1000;
    const px = row.adjustedClose ?? row.close;
    if (!Number.isFinite(px)) continue;
    let vintage = null;
    for (const v of vintages) {
      if (v.filedMs <= t) vintage = v; else break;
    }
    if (!vintage) continue;
    if (Number.isFinite(vintage.epsPerShareAdjusted) && vintage.epsPerShareAdjusted > 0) {
      pe.push({ t, value: px / vintage.epsPerShareAdjusted, filed: vintage.filed });
    }
    if (Number.isFinite(vintage.revenuePerShareAdjusted) && vintage.revenuePerShareAdjusted > 0) {
      ps.push({ t, value: px / vintage.revenuePerShareAdjusted, filed: vintage.filed });
    }
  }

  return {
    pe: summarizeMultiple(pe),
    ps: summarizeMultiple(ps),
    filingVintageCount: vintages.length,
  };
}

function summarizeMultiple(rows) {
  const vals = rows.map(r => r.value).filter(Number.isFinite).sort((a,b) => a-b);
  const latest = rows.at(-1)?.value ?? null;
  return {
    observations: vals.length,
    current: latest,
    p25: quantile(vals, .25),
    p50: quantile(vals, .50),
    p75: quantile(vals, .75),
    percentile: percentileRank(vals, latest),
  };
}
