# Genesis II economics

All contract amounts use 18-decimal EVM native units. The existing frontend
execution layer converts these values to 10-decimal Substrate native units.

Let `Q = 2,000,000 MINI`, `Ps = 0.000750 DOT/MINI`, and
`Pe = 0.001250 DOT/MINI`.

In base units:

```text
Q  = 2,000,000e18
Ps = 750,000,000,000,000
Pe = 1,250,000,000,000,000
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
C(q1) - C(q0)
```

This makes the result path-independent: splitting a purchase into multiple
transactions telescopes to the same cumulative cost, subject only to the
specified integer floor at each cumulative value.

| Sold MINI | Spot price | Cumulative DOT |
| ---: | ---: | ---: |
| 0 | 0.000750 | 0 |
| 500,000 | 0.000875 | 406.25 |
| 1,000,000 | 0.001000 | 875 |
| 1,500,000 | 0.001125 | 1,406.25 |
| 2,000,000 | 0.001250 | 2,000 |

The full-sale amount is capacity, not an all-or-nothing crowdfunding
threshold. If the seven-day campaign ends before sell-out, the actual amount
raised and actual terminal price are retained; there is no automatic refund.
