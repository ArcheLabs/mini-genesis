# Security model

The contract is immutable and non-upgradeable. It has no owner, pause, refund,
withdrawal, allocation edit, timing edit, user-balance edit, token sweep, keeper,
oracle, randomness, or participant iteration.

The only post-deployment authority is `claimActivator`, which can set the MINI token
once after emission ends and only when the contract holds at least the complete
Genesis allocation. `finalize` is permissionless.

Contributed DOT is forwarded to the immutable treasury synchronously. A failed
transfer reverts all accounting, and `contribute` is reentrancy guarded. Direct
native-asset transfers revert. Forced native transfers are not accounted as raised
DOT and cannot be recovered by this contract.

Claims use OpenZeppelin `SafeERC20`. Reward and price calculations use full-precision
`Math.mulDiv`. Integer division can leave tiny MINI dust; there is deliberately no
sweep function.

`totalRaisedDot` records gross contribution flow. The protocol cannot prove unique
capital or prevent DOT returned by the treasury or other parties from being
contributed again.

Before mainnet deployment, validate compiler/runtime behavior, native units, block
cadence, treasury call behavior, and ERC-20 compatibility on Polkadot Hub TestNet.
Report vulnerabilities privately to the maintainers; do not include exploitable
details in a public issue.
