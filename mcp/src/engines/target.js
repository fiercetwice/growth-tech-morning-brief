// Independent of the MAX_SANE_MULTIPLE guard in valuation.js (which cleans
// the historical percentile distribution), this catches the other half of
// the same failure mode: the CURRENT period's per-share figure being the
// near-zero one. selected.base = currentPerShare * historicalP50 - if
// currentPerShare is degenerate, even a perfectly clean historical
// percentile still produces a nonsense target. Real fundamentals-reversion
// targets essentially never imply a move this large; when the math says
// otherwise, it means the inputs broke, not that the signal is real.
const MAX_PLAUSIBLE_RETURN_MAGNITUDE = 5; // 500%

export function buildTargetModel({ lastPrice, valuation, fundamentals }) {
  const candidates = [];

  const eps = fundamentals?.latestAnnual?.epsPerShareAdjusted ?? fundamentals?.latestAnnual?.epsPerShare ?? null;
  if (Number.isFinite(eps) && eps > 0 && valuation?.pe?.observations >= 126) {
    candidates.push(buildFromMultiple('PE', eps, valuation.pe));
  }

  const rps = fundamentals?.latestAnnual?.revenuePerShareAdjusted ?? fundamentals?.latestAnnual?.revenuePerShare ?? null;
  if (Number.isFinite(rps) && rps > 0 && valuation?.ps?.observations >= 126) {
    candidates.push(buildFromMultiple('PS', rps, valuation.ps));
  }

  const valid = candidates.filter(Boolean);
  if (!valid.length || !Number.isFinite(lastPrice) || lastPrice <= 0) {
    return { available: false, reason: 'insufficient_valuation_history' };
  }

  // Prefer P/E for profitable companies; otherwise P/S.
  const selected = valid.find(x => x.method === 'PE') || valid[0];
  const baseUpside = selected.base / lastPrice - 1;
  const bearReturn = selected.bear / lastPrice - 1;
  const bullUpside = selected.bull / lastPrice - 1;

  if ([baseUpside, bearReturn, bullUpside].some(x => Math.abs(x) > MAX_PLAUSIBLE_RETURN_MAGNITUDE)) {
    return { available: false, reason: 'implausible_multiple_result', method: selected.method };
  }

  const preferredEntry = selected.base / 1.20;
  const downside = Math.max(0, lastPrice - selected.bear);
  const upside = Math.max(0, selected.base - lastPrice);
  const riskReward = downside > 0 ? upside / downside : null;

  return {
    available: true,
    method: selected.method,
    bear: selected.bear,
    base: selected.base,
    bull: selected.bull,
    baseUpside,
    bearReturn,
    bullUpside,
    preferredEntry,
    riskReward,
    confidence: confidenceFor(selected.multiple, valuation.filingVintageCount),
  };
}

function buildFromMultiple(method, perShare, multiple) {
  if (![multiple.p25, multiple.p50, multiple.p75].every(Number.isFinite)) return null;
  return {
    method,
    multiple,
    bear: perShare * multiple.p25,
    base: perShare * multiple.p50,
    bull: perShare * multiple.p75,
  };
}

function confidenceFor(multiple, vintages) {
  if ((multiple?.observations || 0) >= 750 && vintages >= 4) return 'high';
  if ((multiple?.observations || 0) >= 252 && vintages >= 3) return 'medium';
  return 'low';
}
