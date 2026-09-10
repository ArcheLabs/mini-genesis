# MINI Genesis phases

MINI Genesis has exactly three phases. There is no Genesis IV and no automatic
financing loop.

## Genesis I — COMPLETED

Genesis I is the immutable `MiniGenesisStream` historical protocol. It used
time-weighted block emission: users contributed DOT and earned MINI according to
the stream accounting. Its contract, deployment manifest, ABI, accounting, and
claim history remain unchanged.

The page is read-only and records the earliest participants' risk and the work
that followed. The displayed `0.00008946 DOT/MINI` value is the **Genesis I final
reference price**, not an exchange spot price.

## Genesis II — LIVE

Genesis II is a separate `MiniGenesisCurve` contract. It distributes a fixed
2,000,000 MINI credit from the 10,000,000 MINI Early Operations Reserve through a
quantity-based deterministic linear bonding curve.

No new MINI is created. Unsold allocation remains in the Early Operations
Reserve. The contract records the authoritative on-chain credit in
`purchasedMini(account)`; it does not mint or hold MINI.

The contract is non-upgradeable and has no owner pricing control, whitelist,
deadline extension, or allocation increase path.

## Genesis III — LOCKED

Genesis III is the final Genesis phase. This release implements only its locked
UI state. Its allocation, dates, prices, and valuation are deliberately not
specified.

The only standing policy rule is:

```text
Genesis III start price >= Genesis II actual terminal price
```
