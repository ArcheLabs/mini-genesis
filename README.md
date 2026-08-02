# MINI Genesis Stream

MINI Genesis Stream distributes a fixed allocation of MINI credit according to
time-weighted DOT contributions. The first valid contribution starts the stream.
All contributed DOT is irreversible and is forwarded to the immutable treasury in
the same transaction.

An independent `luckyRootAllocation` cumulative-difference schedule defines off-chain,
finalized-event Lucky Root Credit settlement without changing direct MINI streaming accounting.
See `docs/LUCKY_ROOT_CREDIT_ACCOUNTING.md`.

The deployment configuration supplies exact block counts and native-asset units.
The intended product schedule is approximately ten days of contributions followed
by four days of protected emission. No day-to-block conversion is hard-coded.

## User rules

- The first contribution must be at least the configured 1 DOT equivalent.
- Later contributions must be strictly greater than the configured 0.1 DOT equivalent.
- Every contribution supplies a UTF-8 username between 1 and 64 bytes. The first
  contribution records `keccak256(bytes(username))`; later contributions from that
  account must use the same username. A username may be shared by multiple accounts.
- Contributions are accepted only before `contributionEndBlock`.
- One percent of MINI's supply, supplied as `genesisAllocation`, streams over the
  complete approximately fourteen-day period.
- Earlier contributions participate in more completed emission blocks.
- New DOT affects the current block and future blocks, never completed blocks.
- Every contribution in the same block receives that block's emission according to
  the block's final contribution balances, independent of transaction ordering.
- DOT cannot be withdrawn or refunded and immediately enters the team treasury.
- The protocol needs no randomness, keeper, oracle, or indexer.
- The contract exposes the raw values required to derive a later bonding-curve
  anchor: `totalRaisedDot` and `protectionEmissionMini()`. Unit normalization belongs
  to the future curve module.
- The contract records future MINI credit only; it does not issue, hold, or transfer MINI.
- `totalRaisedDot` is gross on-chain contribution volume, not proof of unique external
  capital; v0 does not identify recycled funds or related addresses.

The bonding curve, graduation, AMM creation, and frontend are intentionally outside
this repository's current scope.

## Local contribution call

Use the ABI's `contribute(string username)` function. For example, with Foundry:

```bash
cast send "$MINI_GENESIS_STREAM_ADDRESS" \
  "contribute(string)" "alice.dot" \
  --value 1ether --private-key "$CONTRIBUTOR_PRIVATE_KEY" --rpc-url "$RPC_URL"
```

The username is only an input to the later Lucky Credit allocation. MINI entitlement
continues to be calculated from each contributor account's DOT contributions.

## Documentation

- [Accounting](docs/ACCOUNTING.md)
- [Build](docs/BUILD.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Security](docs/SECURITY.md)
- [TestNet checklist](docs/TESTNET_CHECKLIST.md)
- [Mainnet checklist](docs/MAINNET_CHECKLIST.md)

## Development

Requirements: Foundry, Slither, Git, and Bash.

```bash
forge install
make check
```

Dependencies are pinned as Git submodules.
