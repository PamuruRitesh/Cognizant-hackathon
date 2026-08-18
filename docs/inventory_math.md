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
- Arm A — static rule: order a fixed quantity (the seller's historical mean demand) every day.
  Olist is a marketplace sales dataset with no replenishment/purchase-order history, so there is no
  real `units_ordered` column to replay — Arm A is the naive status quo a seller with no forecasting
  process would run, not a replay of real ordering decisions. (An earlier version of this doc claimed
  the latter; that was wrong and has been corrected to match `scripts/run_plan.py`.)
- Arm B — incumbent forecast + our policy: same (s,S) machinery fed by `incumbent` (seasonal-naive).
- Arm C — StockPilot: our quantiles + our policy.

All three arms share ONE inventory-dynamics function (`src/inventory/simulator.py:simulate_arm`) with
identical starting on-hand and lead time. Headline: **C vs B** isolates the forecasting lift; **C vs A**
isolates the full system lift. "C vs nothing" alone is not a valid claim.

## Assumptions used in `scripts/run_plan.py` — stated and defended

These are configurable constants, not hidden defaults. Here's the reasoning behind each, for when
someone asks "why that number" out loud.

**Unit economics: 60% cost / 40% margin of each seller's median item price.**
Olist has no seller-level cost-of-goods data, so cost and margin have to be derived from price.
40% gross margin is a mid-of-range, commonly-cited figure for Brazilian e-commerce marketplace
sellers (varies a lot by category in reality). It's a stated proxy, not a measured value — the honest
answer to "why 60/40" is "no COGS data exists in Olist, and this is a defensible industry-typical
split," not "we measured it." Sensitivity: `unit_cost`/`unit_margin` are plain function args to
`cost_model.py`, so this ratio can be swapped and rerun in minutes if a reviewer wants to pressure-test
a different split (e.g. 70/30 for thinner-margin categories).

**Initial on-hand: 7 days of median forecast demand.**
A one-week starting buffer is a neutral, round-number initialization that doesn't pre-bias any of the
three arms toward looking better — all three start from the identical on-hand value
(`src/inventory/simulator.py:simulate_arm`'s shared dynamics). It is not meant to represent a real
seller's actual current stock (Olist doesn't expose that either); it's a common starting condition so
the *relative* comparison between arms is fair. If challenged, the honest framing is "the absolute
cost totals depend on this choice, but the A-vs-B-vs-C ranking and lift percentages are robust to it
because every arm starts identically."

**Top-50 sellers by forecast volume, not the full seller base.**
Chosen for two reasons: (1) compute/demo runtime — simulating the full seller base (thousands of
sellers) at Monte-Carlo N=2000 paths each is unnecessary to prove the method works, and (2) the
top-volume sellers are where forecast errors and stockout costs are largest in absolute dollar terms,
so this is where the business case is strongest and easiest to defend. The honest caveat: results are
not claimed to generalize uniformly to the long tail of low-volume sellers, whose demand is sparser
and where the quantile model has less signal — that's flagged as a scope limit, not glossed over.

## Service-level sensitivity (90% / 95% / 99%)

Generated by `scripts/service_level_sensitivity.py`, which reruns Arm C (StockPilot) at three service
levels, holding everything else fixed — same top-50 sellers (the exact set already committed to
`data/processed/recommendations.json`, not a freshly recomputed ranking — see script comment for why
that distinction matters across environments), same demand history, same lead times, same starting
on-hand. Raw numbers: `data/processed/service_level_sensitivity.json`.

| Service level | Arm C total cost | Holding cost | Stockout cost | Stockout days | Avg on-hand | Avg order-up-to (S) | Avg safety stock |
|---|---|---|---|---|---|---|---|
| 90% | $19,165.79 | $86.19 | $19,079.60 | 229 | 4.3 | 21.1 | 8.7 |
| 95% | $19,043.57 | $96.40 | $18,947.17 | 229 | 4.8 | 23.3 | 11.0 |
| 99% | $18,893.70 | $114.99 | $18,778.71 | 224 | 5.8 | 27.1 | 14.8 |

Reading it: going from 90% to 99% roughly **doubles average safety stock** (+70%, 8.7 → 14.8 units)
and raises holding cost by a third, but only trims stockout-days by ~2% (229 → 224) over this 14-day,
50-seller window. Most of the achievable stockout protection is already captured at 90%; pushing to
99% buys a little extra protection at a real, quantifiable holding-cost premium. That's the trade-off
to state on stage — 90% is a reasonable default, not the only defensible choice, and the table is the
evidence for whichever level the team picks.

Note: the 90% row is generated independently of `data/processed/simulation_results.json` (fresh
Monte-Carlo draws, same seed strategy but reseeded per seller) and lands within ~0.04% of its total
cost ($19,165.79 vs $19,158.21) — close enough to confirm the two pipelines agree, not an exact replay.
