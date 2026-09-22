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

## Genesis II — WAITING / LIVE / COMPLETED

Genesis II is a separate `MiniGenesisCurve` contract. It distributes a fixed
2,000,000 MINI credit from the 10,000,000 MINI Early Operations Reserve through a
quantity-based deterministic linear bonding curve.

No new MINI is created. Unsold allocation remains in the Early Operations
Reserve. The contract records the authoritative on-chain credit in
`purchasedMini(account)`; it does not mint or hold MINI.

The contract is non-upgradeable and has no owner pricing control, whitelist,
deadline extension, or allocation increase path.

The production allocation is 2,000,000 MINI, drawn from the 10,000,000 MINI
Early Operations Reserve. Its immutable quantity-based curve runs from
0.003500 to 0.005500 DOT/MINI. Full-sale capacity is 9,000 DOT; this is a
capacity, not an all-or-nothing fundraising target or soft cap.

The page has three runtime states: WAITING before `startTime`, LIVE during the
immutable time window, and COMPLETED after `endTime` or sell-out. A completed
campaign retains its actual on-chain economic result. Campaign completion does
not mark every work item as delivered: work status comes from explicit
manifest data.

The implementation must not be described as LIVE until a production deployment
has been completed and the production manifest contains the deployed Phase II
contract and immutable parameters.

## Genesis III — LOCKED

Genesis III is the final Genesis phase. This release implements only its locked
UI state. Its allocation, dates, prices, and valuation are deliberately not
specified.

The only standing policy rule is:

```text
Genesis III start price >= Genesis II actual terminal price
```

Genesis III has no allocation, price, date, end price, valuation, or mechanism
in this release.

## Funding and execution are separate states

Genesis I is a historical outcome page: it shows the immutable historical
accounting and the delivered results of the first execution cycle. Genesis II
shows the current funding curve and explicit work items. `COMPLETED` means that
funding ended; it does not mean that all listed work has been completed.
