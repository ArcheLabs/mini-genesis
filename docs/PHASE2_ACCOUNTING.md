# Genesis II accounting

`MiniGenesisCurve` is a credit ledger, not a token contract.

## Credit

Each successful `buyExactMini(miniAmount, maxDotCost)` increases
`purchasedMini[msg.sender]` by the exact requested amount and increases
`totalSoldMini` by the same amount. The global cap is `2,000,000e18` MINI.

Any future claim or migration system must use the credit as its authoritative
upper bound. A repeated backend request must never be able to issue more than
the recorded account credit, and the global claimed amount must never exceed
`totalSoldMini`.

## Rounding

`cumulativeCost(q)` floors the complete rational expression once at the
cumulative point. A purchase cost is the difference between two cumulative
values. This is intentional: it prevents transaction splitting from changing
the economic path and leaves only the explicitly visible integer rounding
boundary.

The contract does not calculate `spotPrice(q) * amount` for a purchase.

## DOT accounting

`totalRaisedDot` is set to `cumulativeCost(totalSoldMini)` after each successful
purchase. The invariant is:

```text
totalRaisedDot == cumulativeCost(totalSoldMini)
```

Only the actual curve cost is sent synchronously to the immutable treasury.
Excess `msg.value` is returned to the buyer and is not included in
`totalRaisedDot`. If either the treasury transfer or refund fails, the whole
purchase reverts atomically.
