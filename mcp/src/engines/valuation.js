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

// Multiples above this are treated as not-a-genuine-observation rather than
// an extreme-but-real valuation: in practice they come from a near-zero
// per-share denominator (e.g. a barely-profitable TTM quarter for a
// volatile-earnings name), not a stock that's actually priced at 500x+
// trailing earnings or revenue. Discarding them here - rather than only
// guarding the final target output in target.js - keeps the percentile
// distribution itself (p25/p50/p75) from being skewed by a handful of
// degenerate days, which a single output-side clamp could not undo.
const MAX_SANE_MULTIPLE = 500;

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
  let peExcludedExtreme = 0, psExcludedExtreme = 0;
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
      const impliedPe = px / vintage.epsPerShareAdjusted;
      if (impliedPe <= MAX_SANE_MULTIPLE) pe.push({ t, value: impliedPe, filed: vintage.filed });
      else peExcludedExtreme++;
    }
    if (Number.isFinite(vintage.revenuePerShareAdjusted) && vintage.revenuePerShareAdjusted > 0) {
      const impliedPs = px / vintage.revenuePerShareAdjusted;
      if (impliedPs <= MAX_SANE_MULTIPLE) ps.push({ t, value: impliedPs, filed: vintage.filed });
      else psExcludedExtreme++;
    }
  }

  return {
    pe: summarizeMultiple(pe, peExcludedExtreme),
    ps: summarizeMultiple(ps, psExcludedExtreme),
    filingVintageCount: vintages.length,
  };
}

function summarizeMultiple(rows, excludedExtreme = 0) {
  const vals = rows.map(r => r.value).filter(Number.isFinite).sort((a,b) => a-b);
  const latest = rows.at(-1)?.value ?? null;
  return {
    observations: vals.length,
    current: latest,
    p25: quantile(vals, .25),
    p50: quantile(vals, .50),
    p75: quantile(vals, .75),
    percentile: percentileRank(vals, latest),
    excludedExtreme,
  };
}
