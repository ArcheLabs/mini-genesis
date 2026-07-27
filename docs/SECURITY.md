# Security model

The contract is immutable and non-upgradeable. It has no owner, administrator,
pause, refund, withdrawal, allocation edit, timing edit, user-balance edit, keeper,
oracle, randomness, token integration, or participant iteration.

Contributed DOT is forwarded to the immutable treasury synchronously. A failed
transfer reverts all accounting, and `contribute` is reentrancy guarded. Direct
native-asset transfers revert. Forced native transfers are not accounted as raised
DOT and cannot be recovered by this contract.

Reward and price calculations use full-precision `Math.mulDiv`. Integer division can
leave tiny accounting dust. The contract only records credit and never holds MINI.

`totalRaisedDot` records gross contribution flow. The protocol cannot prove unique
capital or prevent DOT returned by the treasury or other parties from being
contributed again.

Before mainnet deployment, validate compiler/runtime behavior, native units, block
cadence, treasury call behavior, and ERC-20 compatibility on Polkadot Hub TestNet.
Report vulnerabilities privately to the maintainers; do not include exploitable
details in a public issue.
