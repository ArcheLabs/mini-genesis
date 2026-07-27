# Deployment

Genesis Stream parameters are immutable. Every value must be confirmed against a
tested Polkadot Hub network before a production broadcast.

## Required environment

```text
RPC_URL
PRIVATE_KEY
TREASURY
GENESIS_ALLOCATION
CONTRIBUTION_BLOCKS
PROTECTION_BLOCKS
FIRST_CONTRIBUTION_MINIMUM
SUBSEQUENT_CONTRIBUTION_MINIMUM_EXCLUSIVE
EXPECTED_BLOCK_TIME_SECONDS (optional display aid)
```

`GENESIS_ALLOCATION` is MINI base units. Contribution thresholds are DOT native
base units. Do not assume Ethereum-style decimals: validate the representation of
one DOT on Polkadot Hub TestNet. Block counts, not timestamps, define the schedule.

## Procedure

1. Test the target RPC's block cadence and native-asset units.
2. Review the treasury (preferably a simple multisig or EOA).
3. Dry-run and inspect every value printed by the script:

   ```bash
   forge script script/DeployMiniGenesisStream.s.sol \
     --rpc-url "$RPC_URL"
   ```

4. Broadcast only after independent review:

   ```bash
   forge script script/DeployMiniGenesisStream.s.sol \
     --rpc-url "$RPC_URL" --broadcast
   ```

5. Preserve Foundry's `broadcast/` deployment JSON, verify the exact Solidity
   0.8.24 source on the explorer, and run `make abi`.
6. Read all immutable getters from the deployed contract and compare them with the
   signed deployment checklist.
7. Do not send a start transaction. The first real participant starts the stream.
