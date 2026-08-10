# Growth Tech Morning Brief Roadmap

## v0.5.7 — Data completeness, consistency, and memory

- Enrich discovery candidates with SEC CompanyFacts without adding price-history calls.
- Calculate current trailing P/E or P/S from Nasdaq screened price/market cap and reported SEC data.
- Include reported revenue/EPS growth plus cash/debt context.
- Classify missing coverage separately as extraction gap, mapping gap, or source failure.
- Persist a stable event ledger with new, unchanged, and resolved deltas.
- Enforce exact research-funnel counts and reject ticker references outside the researched universe.
- Keep the opportunity gate intact: valuation alone cannot bypass evidence quality, liquidity, risk, and a verified catalyst or explicit rerating path.

## v0.5.8 — Target & Mispricing Engine

Build an auditable valuation decision layer that answers both whether a company is attractive and whether its current price offers enough upside.

### Target hierarchy

1. Use FY1/FY2 consensus EPS or revenue with a justified target multiple when fresh forward estimates are available.
2. Use analyst target low/median/high and coverage count only as a cross-check, never as the sole valuation method.
3. Fall back to a clearly labeled trailing-data implied fair-value range using normalized EPS or revenue and historical multiples.
4. Return `Target unavailable` when inputs are insufficient; the model may not invent a target or missing estimate.

### Required output

- Current price and input as-of time
- Bear, base, and bull value
- Base upside and downside to bear value
- Risk/reward ratio
- Preferred entry price
- Method, formula, assumptions, and confidence
- Consensus target cross-check when available
- Valuation Opportunity Bonus or Penalty

### Verdict integration

- Base upside >=30%: bonus +2
- Base upside 20–30%: bonus +1
- Base upside 10–20%: neutral
- Base upside 5–10%: penalty -1; prefer Buy on weakness
- Base upside <5%: penalty -2; prefer Hold/Watch
- Price above base value or near bull value: evaluate Hold/Trim

The valuation score may improve candidate ranking but cannot independently support `Buy now` when target confidence is low or financial/risk evidence is incomplete. An underappreciated-value call may lack same-day news only when it names a testable rerating path within the next one or two quarters.

### Calibration foundation

- Record each target, verdict, confidence, catalyst type, and data-completeness state.
- Measure 1D, 5D, 1M, and 3M returns versus SPY and the relevant sector benchmark.
- Calibrate target methods and valuation bonuses from realized outcomes without rewriting historical snapshots.

## v0.5.9 — Typed supply-chain discovery and thesis memory

- Add sourced customer, supplier, competitor, and substitution edges with economic direction, exposure, timing, and confidence.
- Use graph propagation for candidate discovery only; every propagated name requires independent research before sentiment or action.
- Preserve thesis changes, invalidation conditions, event deltas, and subsequent outcomes by company.
- Rank the research queue by material information change rather than raw mentions.

## v0.6.0 — Portfolio-aware decision layer

- Incorporate existing position size, concentration, tax lots, and correlated exposures.
- Convert stock-level calls into portfolio actions with sizing bands and explicit risk budgets.
- Keep portfolio state optional and separate from the objective research record.
