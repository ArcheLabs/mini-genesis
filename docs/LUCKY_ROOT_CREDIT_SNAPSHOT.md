# Lucky Root Credit snapshot

> **SUPERSEDED — DO NOT IMPLEMENT**
>
> Replaced by the final context-alias credit architecture: finalized contribution
> ledger plus repeatable source-account claims, not a frozen username snapshot.

The public V1 snapshot is reconstructed from finalized `Contributed` logs and uses algorithm
`block-pro-rata-carry-global-finalization-v1`. Accounts and all decimal-string amounts are stably
sorted. It records source genesis hash, contract, block bounds and hashes, raw/final credits,
source claim IDs, exact total, and a SHA-256 content hash.

`sourceClaimId` commits to source chain genesis hash, source contract, start block and source
account. Publication should include the JSON in a GitHub release plus its SHA-256 and optional CID.
