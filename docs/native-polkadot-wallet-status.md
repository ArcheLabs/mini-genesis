# Native Polkadot Wallet Status

**Status: Experimental / blocked by the current browser wallet transaction interface.** Native Polkadot wallet support is not part of the production user flow. The experimental local/staging path requires `VITE_ENABLE_EXPERIMENTAL_NATIVE_POLKADOT=true`; the production environment always disables it.

## Verified capabilities

- PAPI can construct transactions for the current runtime.
- Runtime metadata can be checked against the expected profile.
- Revive dry runs work.
- SS58 to H160 account mapping works.

## Current blocker

The browser injected-wallet / `polkadot-api/pjs-signer` `signPayload` bridge cannot reliably encode the current runtime's custom or arbitrary transaction extensions, including `AsPgas`, `AsDotnsGateway`, and `RestrictOrigins`. This fails before a signing prompt appears. The behavior was reproduced with both SubWallet and Talisman, so the limitation is in the wallet transaction interface compatibility boundary rather than the MINI contract.

The Native path remains in the repository for research, including PAPI runtime profiles, account resolution, balance reads, dry runs, event reconciliation, and transaction tests. Do not route production users through it or work around the limitation with raw-signature or custom extension encoding.

## Production path

Production uses Polkadot Hub Mainnet through its EVM JSON-RPC endpoint, Reown/Wagmi/Viem, and EIP-1193 wallets. The production chain is `420420419`, with DOT at 18 EVM decimals. A SubWallet or Talisman EVM provider may be used only through this EIP-1193 path.

## Conditions to reconsider Native wallet support

Reopen the product path only after all of these are demonstrated on the current runtime:

1. A browser wallet exposes `createTransaction` or an equivalent metadata-driven full-transaction API.
2. The path does not depend on the legacy PJS `signPayload` bridge and can handle arbitrary runtime transaction extensions.
3. Current runtime metadata is resolved automatically.
4. A real SubWallet/Talisman or other target-wallet test produces an actual signing prompt.
5. A `Revive.call` transaction is broadcast, included, and finalized.
6. The finalized contract event is verified.
7. The flow continues to work after a runtime upgrade without a wallet-specific encoding workaround.

Until then, classify the work as `BLOCKED_BY_WALLET_STANDARD` and keep it experimental.
