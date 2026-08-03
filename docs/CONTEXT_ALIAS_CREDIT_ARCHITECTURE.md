# MINI Lucky context-alias credit architecture

This is the tracked baseline for the final MINI Genesis and Mini Lucky model.
It replaces username allocation and Admin Grant designs; they must not be
deployed or revived.

## Identity

Personhood is read from fixed precompile
`0x000000000000000000000000000000000A010000` under
`keccak256("MINI_LUCKY_PERSONHOOD_V1")`. Status `1` or `2` and a non-zero
`contextAlias` are required for credit minting, trust, and packets.

Usernames use exact finalized People `Resources.UsernameOwnerOf` raw UTF-8
bytes: no trim, case folding, Unicode normalization, or `.dot` change.
AccountId32/H160 conversion uses only `@parity/product-sdk-address`.

## Genesis and Lucky

`MiniGenesisStream.contribute()` has no username parameter. A finalized ledger
calculates repeatable source-account credit, which the source account signs and
the restricted Minter credits to the revalidated context alias.

Trust, Credit, vMINI, packets and grant deduplication are alias-keyed. Lucky
history is a finalized client IndexedDB cache; PostgreSQL is only for Genesis
ledger and claim persistence.
