# Genesis II economics

All contract amounts use 18-decimal EVM native units. The frontend converts
these values to 10-decimal Substrate native units for the Native purchase path.

Genesis II allocates `Q = 2,000,000 MINI` from the `10,000,000 MINI` Early
Operations Reserve. It creates no new MINI. Unsold MINI remains in that reserve
and is not transferred automatically to Genesis III.

The production constants are:

```text
Q  = 2,000,000e18 MINI
Ps = 0.003500 DOT/MINI = 3,500,000,000,000,000
Pe = 0.005500 DOT/MINI = 5,500,000,000,000,000
```

The marginal price at cumulative sold amount `q` is:

```text
P(q) = Ps + (Pe - Ps) * q / Q
```

The cumulative cost in DOT base units is:

```text
C(q) = Ps * q / 1e18 + (Pe - Ps) * q² / (2 * Q * 1e18)
```

The cost of a purchase from `q0` to `q1` is always:

```text
cost(q0 → q1) = C(q1) - C(q0)
```

This is path-independent cumulative pricing. It is not `spotPrice ×
purchaseAmount` and the curve does not advance with time.

| Sold MINI | Spot price | Cumulative raised |
| ---: | ---: | ---: |
| 0 | 0.003500 DOT/MINI | 0 DOT |
| 500,000 | 0.004000 DOT/MINI | 1,875 DOT |
| 1,000,000 | 0.004500 DOT/MINI | 4,000 DOT |
| 1,500,000 | 0.005000 DOT/MINI | 6,375 DOT |
| 1,600,000 | 0.005100 DOT/MINI | 6,880 DOT |
| 2,000,000 | 0.005500 DOT/MINI | 9,000 DOT |

The exact production checks are:

```text
C(1,600,000 MINI) = 6,880 DOT
C(Q) = C(2,000,000 MINI) = 9,000 DOT
```

Approximately 80% sell-through therefore corresponds to 6,880 DOT raised, and
full-sale capacity is 9,000 DOT. Genesis II is not all-or-nothing crowdfunding:
if the seven-day campaign ends before sell-out, the actual raised amount and
terminal price remain visible and there is no automatic refund.

The page emphasizes current price, starting price, maximum price, distributed
and remaining MINI, DOT raised, participants, and time remaining. Curve-implied
price is not a market-validated valuation; FDV, market cap, and valuation are
not presented as primary product metrics.
