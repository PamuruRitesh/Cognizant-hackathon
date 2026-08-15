# Inventory math — every formula, symbols defined

## Protection interval
`protection_interval = L + R`
- `L` = lead time in days
- `R` = review period in days (R = 1 for daily review)

State this explicitly on stage — it's L+R, not just L.

## Reorder point (ROP)
`ROP = Q_alpha( D over L+R )`

Where `Q_alpha` is the alpha-quantile of demand **aggregated over the protection interval**,
taken directly from the aggregate-target quantile model (`forecasts_lt.parquet`), NOT computed by
summing daily quantiles. Summing L daily P90s gives the comonotonic upper bound, which is too high:
for roughly independent daily errors the true quantile of the sum grows like sqrt(L), not L.

## Safety stock (derived, not primitive)
`SS = ROP - E[D over L+R]`

We use `p50_lt` as a practical stand-in for the mean under right-skewed retail demand.

## Order-up-to level
`S = Q_alpha( D over L+R )` (same value as ROP under this policy)

## Order quantity
`order_qty = max(0, S - inventory_position)`

Then constrained by:
- MOQ (minimum order quantity)
- pack size (round to nearest multiple)
- budget cap (units)

Violations become `guardrail_flags`, never silent adjustments.

## Costs
- Holding cost (daily): `units_on_hand * unit_cost * (annual_rate / 365)`, default annual_rate = 25%
- Stockout cost: `units_short * unit_margin * goodwill_multiplier`, default goodwill_multiplier = 1.2

## Why not the textbook `z * sigma * sqrt(L)` formula
1. Assumes normality; retail demand is right-skewed.
2. `sigma` must be the **forecast error** standard deviation, not the standard deviation of
   historical demand — a very common substitution error.

We report the textbook formula only as a cross-check, never as the primary method.

## Three-arm simulation
- Arm A — current practice: replay the dataset's own `units_ordered`.
- Arm B — incumbent forecast + our policy: same (s,S) machinery fed by `incumbent`.
- Arm C — StockPilot: our quantiles + our policy.

All three arms share ONE inventory-dynamics function (`src/inventory/simulator.py:simulate_arm`) with
identical starting on-hand and lead time. Headline: **C vs B** isolates the forecasting lift; **C vs A**
isolates the full system lift. "C vs nothing" alone is not a valid claim.
