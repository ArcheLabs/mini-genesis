# Lucky Root Credit accounting

`luckyRootAllocation` is independent of the existing direct MINI stream. For elapsed contribution
block `k`, the base amount is:

`floor(allocation * (k + 1) / contributionBlocks) - floor(allocation * k / contributionBlocks)`.

Only finalized `Contributed` events are inputs. Contributions are aggregated by account and block.
An empty block carries its base amount forward. An active block distributes the pool by that
block's newly contributed DOT, with integer dust carried forward. After the window, raw account
totals are scaled to the full allocation; remaining units use descending remainder then ascending
account bytes. This produces an exact, deterministic total without modifying `pendingMini`,
`accMiniPerDot`, reward debt or accrued MINI.

Cross-block splitting may enter more block competitions while delaying direct-MINI weight; the
mechanism does not claim to eliminate splitting strategies.
