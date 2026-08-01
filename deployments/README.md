# Deployment manifests

Each approved deployment produces a network JSON manifest committed with the ABI used for
verification. Include chain ID and genesis hash, deployment transaction/block, treasury,
constructor arguments, Git SHA, Foundry/Solidity/OpenZeppelin versions, ABI SHA-256, creation
bytecode hash and runtime bytecode hash.

Run the read-only verifier before publishing a manifest. It checks immutable values and expected
chain ID. The operator independently records the RPC-observed genesis hash in the signed manifest.
