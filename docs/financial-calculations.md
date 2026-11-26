# Financial Calculations

> **Status: implemented in Phase 2, used by persisted trades in Phase 3, and aggregated in Phase 4.** The authoritative server engine calculates trade values before storage; the client calculator is a read-only preview that stores nothing.

## Canonical units

| Value             | Storage                       | Example                                        |
| ----------------- | ----------------------------- | ---------------------------------------------- |
| Money             | Integer micro-USD             | `$2,200.00` = `2_200_000_000`                  |
| Price             | Integer ticks                 | `25,000.00` with `0.25` tick = `100_000` ticks |
| Quantity          | Integer hundredths            | `1.25` contracts = `125`                       |
| Ratios / averages | `decimal.js`                  | R, win rate, profit factor                     |
| Display           | Round only at formatting time | `$1,234.56`                                    |

JavaScript floating point is never used for stored financial values.

## Instrument specifications

| Instrument | Point value | Tick value | Tick size |
| ---------- | ----------: | ---------: | --------: |
| NQ         |      $20.00 |      $5.00 |      0.25 |
| MNQ        |       $2.00 |      $0.50 |      0.25 |
| ES         |      $50.00 |     $12.50 |      0.25 |
| MES        |       $5.00 |      $1.25 |      0.25 |

Specifications are configurable. Each completed trade stores an immutable instrument snapshot so config changes never rewrite historical calculations.

## Partial exit P&L

```text
Long gross P&L  = (exitTicks - entryTicks) × tickValueMicros × exitQtyHundredths / 100
Short gross P&L = (entryTicks - exitTicks) × tickValueMicros × exitQtyHundredths / 100
```

Each partial exit is calculated independently, then summed.

```text
Gross P&L = sum(exit P&L)
```

## Weighted average exit

```text
Weighted average exit = sum(exitPrice × exitQuantity) / sum(exitQuantity)
```

Use decimal arithmetic for the weighted price. The result is a display value, not the source of P&L.

## Fees

- The user enters total actual fees for the completed trade.
- Fees are optional, but `null` means “not entered”; it is not zero.
- Fees are allocated across partial exits proportionally by exited quantity using largest-remainder allocation at micro-USD precision.
- Allocated fees sum exactly to the entered total.

```text
Net P&L = Gross P&L - total fees
```

If fees are not entered:

- `netPnlMicros = null`
- `outcomeNet = null`
- Net metrics exclude the trade and display coverage.
- Calculated account balance is marked incomplete.

## Risk

Automatic risk:

```text
Automatic risk = abs(entry price - initial stop) × tickValue × quantity
```

- Long stop must be below entry.
- Short stop must be above entry.
- No stop means no automatic risk.

Manual risk:

- User may enter a USD risk amount greater than zero.
- Manual override is preserved separately from automatic risk.
- The selected risk is the manual value when present, otherwise automatic.
- All three values are preserved: automatic, manual, selected.
- If selected risk is absent or invalid, R is unavailable.

## R-multiple

```text
Gross R = Gross P&L / selected initial risk
```

R is calculated before fees. Zero or negative risk never produces an R value.

## Poster ROI on risk

```text
Trade ROI = selected-basis P&L / selected risk
```

The single-trade poster uses the same selected risk as R and the poster's selected P&L basis. Gross ROI uses gross P&L; net ROI uses net P&L and stays unavailable when fees are missing. Zero, negative, or missing risk never produces an ROI value; the poster displays **Unavailable** and an explanatory note instead of inventing a number.

## Implementation notes

- Stored values are always integer micro-USD, integer ticks, and integer quantity hundredths.
- `decimal.js` runs at 28 significant digits with half-up rounding; rounding happens only when a value must be stored as an integer micro-USD.
- `grossR`, `weightedAverageExitTicks`, and `weightedAverageExitPrice` are decimal strings so precision is not lost in JSON or MongoDB.
- Fee allocation uses `BigInt` largest remainders at micro-USD precision and breaks ties by exit order. Allocations always sum exactly to the entered total.
- The active formula version is `2026-11-24.1` and is returned with every calculation.
- `POST /api/v1/finance/calculate` exposes a server-authoritative preview. Completed trades recompute and store these values server-side.

## Worked fixtures

### NQ long with three exits

- Entry: `25,000.00`, quantity `3.00`
- Exits: `1 @ 25,020.00`, `1 @ 25,040.00`, `1 @ 25,050.00`

| Exit      | Points |           P&L |
| --------- | -----: | ------------: |
| 25,020    |     20 |       $400.00 |
| 25,040    |     40 |       $800.00 |
| 25,050    |     50 |     $1,000.00 |
| **Gross** |        | **$2,200.00** |

Weighted average exit: `25,036.6667`  
Fees `$15.00` → net `$2,185.00`  
Stop `24,990.00` → risk `10 points × 3 × $20 = $600.00`  
Gross R: `$2,200 / $600 = 3.6667`

### ES short with two exits

- Entry `5,000.00`, quantity `2.00`
- Exit `1 @ 4,990.50`, `1 @ 4,995.00`
- Gross: `(9.5 × $50) + (5 × $50) = $475 + $250 = $725.00`
- Weighted average exit: `4,992.75`
- Fees `$8.00` → net `$717.00`
- Stop `5,010.00` → risk `$1,000.00`
- Gross R: `0.725`

### Fractional MNQ

- Entry `20,000.00`, quantity `0.25`
- Exit `20,010.00`
- Gross: `10 × $2.00 × 0.25 = $5.00`
- Fees `$1.25` → net `$3.75`
- Stop `19,990.00` → risk `$5.00`
- Gross R: `1.00`

### Manual risk override

- Auto risk `$600.00`
- Manual risk `$500.00`
- Selected risk `$500.00`
- Gross P&L `$2,200.00`
- Gross R `4.4`
- Auto risk remains preserved in the trade record.

### Break-even

- Entry equals exit → gross P&L exactly `$0.00` → gross break-even.
- Fees `$2.00` → net `-$2.00` → net loss.
- Gross and net outcomes are classified independently.

### Missing fees

- Gross `$2,200.00`
- Fees `null`
- Net unavailable
- Net outcome unavailable
- Not counted as zero fees

## Analytics definitions

| Metric           | Definition                                                                    |
| ---------------- | ----------------------------------------------------------------------------- |
| Gross P&L        | Sum of gross trade P&L                                                        |
| Net P&L          | Gross minus actual fees; unavailable when fees are missing                    |
| Win rate         | Wins ÷ (wins + losses); break-even shown separately                           |
| Average win      | Average net P&L of net-winning trades; gross view available                   |
| Average loss     | Average net P&L of net-losing trades; gross view available                    |
| Profit factor    | Positive net P&L ÷ absolute negative net P&L                                  |
| Average R        | Average gross R over completed trades with valid selected risk; show coverage |
| Maximum drawdown | Peak-to-trough decline on the net equity curve                                |
| Winning streak   | Consecutive completed trades with selected outcome win                        |
| Losing streak    | Consecutive completed trades with selected outcome loss                       |
| Break-even       | Exact zero P&L on the selected basis                                          |
| Winning day      | Daily selected-basis P&L greater than zero                                    |
| Losing day       | Daily selected-basis P&L less than zero                                       |

Phase 4 aggregates apply these definitions server-side. If any selected trade has missing fees, the entire net aggregate is `null`; available net values are reported through `coverage` but are never substituted for the missing trade. Average R averages only trades with stored `grossR`, with `rAvailable` and `rComplete` coverage fields. Break-even outcomes reset both win and loss streaks.

### Profit factor edge cases

| Case                       | Result |
| -------------------------- | ------ |
| Positive profit, no losses | `∞`    |
| No profit, losses exist    | `0`    |
| No profit, no losses       | `—`    |

### Equity curves

1. Cumulative net P&L from `$0`.
2. Account balance from starting balance plus completed net trade P&L, deposits, withdrawals, and corrections.

Deposits and withdrawals are never treated as trading profit.

### Partial exits

Partial exits contribute to a single trade. They are never counted as separate trades for win rate, streaks, trade count, or trade-level analytics.

## Time

- Trades record a date only.
- No mandatory entry or exit timestamps.
- `completedAt` is an audit/order timestamp, not an execution timestamp.
- Period boundaries use the configured app time zone.
- Monday is the first day of the week.
