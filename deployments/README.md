# Deployment manifests

> **M0 baseline:** `local.json`, `staging.json`, and `production.json` are non-secret
> templates validated by `make manifest-check`. They do not authorize deployment,
> publication, or any transaction.

Each approved deployment produces a network JSON manifest committed with the ABI used for
verification. Include chain ID and genesis hash, deployment transaction/block, treasury,
constructor arguments, Git SHA, Foundry/Solidity/OpenZeppelin versions, ABI SHA-256, creation
bytecode hash and runtime bytecode hash.

The simplified architecture separates the Genesis EVM source chain from the Lucky
Product chain. Native EVM amounts use 18 decimals. A Substrate display decimal setting,
when present, is display-only and never changes contract or API integer values.

Run the read-only verifier before publishing a manifest. It checks immutable values and expected
chain ID. The operator independently records the RPC-observed genesis hash in the signed manifest.
