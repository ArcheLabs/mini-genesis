# Genesis II security model

The Phase II contract is a standalone, non-upgradeable deployment. It has no
owner and no mutable pricing, allocation, whitelist, wallet privilege, NFT, or
deadline-extension mechanism.

The constructor fixes the treasury, allocation, prices, and timestamps. The
production verifier additionally requires the fixed 2,000,000 MINI allocation,
0.000750 start price, 0.001250 end price, and a valid time range.

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
cumulativeCost(2,000,000 MINI) == 2,000 DOT
```

The contract records MINI credits only. It neither proves unique people nor
guarantees secondary-market price, liquidity, or future valuation.
