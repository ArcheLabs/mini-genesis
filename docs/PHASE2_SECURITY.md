# Genesis II security model

The Phase II contract is a standalone, non-upgradeable deployment. It has no
owner and no mutable pricing, allocation, whitelist, wallet privilege, NFT, or
deadline-extension mechanism.

The constructor fixes the treasury, allocation, prices, and timestamps. The
production verifier additionally requires the fixed 2,000,000 MINI allocation,
0.003500 start price, 0.005500 end price, a seven-day time range, and the
corresponding 9,000 DOT full-sale cumulative cost.

`buyExactMini` is protected by `ReentrancyGuard`. It checks the active time
window, exact output amount, allocation cap, slippage limit, and payment before
updating state. Treasury forwarding and excess-value refunds are checked calls;
failure reverts all state changes.

The principal invariants are:

```text
totalSoldMini <= allocation
totalRaisedDot == cumulativeCost(totalSoldMini)
sum(purchasedMini[account]) == totalSoldMini
priceAt(q2) >= priceAt(q1) when q2 >= q1
cumulativeCost(q2) >= cumulativeCost(q1) when q2 >= q1
cumulativeCost(1,600,000 MINI) == 6,880 DOT
cumulativeCost(2,000,000 MINI) == 9,000 DOT
```

The contract records MINI credits only. It neither proves unique people nor
guarantees secondary-market price, liquidity, or future valuation.
