# Genesis accounting

## Purpose and state machine

MiniGenesisStream accepts native DOT, forwards it immediately to the immutable
treasury, and records time-weighted future MINI credit. It does not know or hold a
MINI token.

The phase is derived, never administered:

```text
Waiting -> Contribution -> Protection -> Ended
```

The first valid contribution sets `startBlock`. Contributions are accepted on
`[startBlock, contributionEndBlock)`, while emission covers
`[startBlock, emissionEndBlock)`. Protection is the final interval
`[contributionEndBlock, emissionEndBlock)`.

The first contribution must be at least `firstContributionMinimum`; every later
contribution must be strictly greater than
`subsequentContributionMinimumExclusive`. Both values are target-chain native base
units.

## Block-final allocation

All successful DOT in block `b` participates in block `b` emission. A transaction
in block `b` settles only completed blocks `[lastSettledBlock, b)`, so transaction
ordering inside the block cannot change its final allocation. Later contributions
cannot affect completed blocks.

For elapsed block count `k`, cumulative emission is:

```text
C(k) = floor(genesisAllocation * min(k, totalEmissionBlocks)
             / totalEmissionBlocks)
```

Block emission is `C(k + 1) - C(k)`. Empty blocks require no transaction: the next
write or `pendingMini()` preview accounts for them in constant time.

## Reward index and authoritative credit

`accMiniPerDot` stores emitted MINI per DOT scaled by `1e36`. A settlement batch
adds:

```text
floor(newEmission * 1e36 / totalRaisedDot)
```

`rewardDebt` prevents a new contribution from receiving completed-block rewards.
Debt for newly added DOT is rounded upward, making the accounting conservative and
preventing fractional historical index values from causing over-allocation.

`userInfo(account).accruedMini` contains only credit crystallized by prior writes.
The authoritative complete balance is:

```text
pendingMini(account)
```

It includes a read-only preview from `lastSettledBlock` to the current completed
block, capped at `emissionEndBlock`. During protection it continues increasing even
without transactions; after Ended it is fixed.

## Rounding and Dust

Rounding is always conservative:

- cumulative emission rounds down;
- every `accMiniPerDot` increment rounds down;
- user credit conversions round down;
- debt on newly contributed DOT rounds up.

Consequently, known-user credit must never exceed emitted MINI, and final aggregate
credit must never exceed `genesisAllocation`. Small unassigned Dust can remain and
is neither recovered nor redistributed.

For a run with settlement batches `j`, batch-end total DOT `D_j`, precision
`P = 1e36`, `K` successful contributions, and `U` users, a conservative
amount-aware final Dust bound is:

```text
sum_j ceil(D_j / P) + 2*K + U
```

The independent-model tests use bounded `D_j < P` and compare direct per-block
allocation with a per-user bound:

```text
2 * totalEmissionBlocks + K + 1
```

This bound grows only with explicit rounding boundaries; no broad relative
tolerance is used.

## External boundaries

No keeper, oracle, indexer, randomness, token, claim, refund, or participant scan is
required. Core reads use RPC directly.

`totalRaisedDot` is gross contribution flow, not cryptographic proof of unique
external capital. Treasury funds can be transferred and contributed again; the
protocol does not identify related addresses or recycled funds.

A future bonding-curve module may use raw `totalRaisedDot` as numerator and
`protectionEmissionMini()` as denominator. That module must handle DOT and MINI
decimal normalization. Genesis deliberately exposes no standardized price.
