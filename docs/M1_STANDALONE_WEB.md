# M1 Standalone Genesis Web

This milestone adds the standalone Mini Genesis EVM dApp. It uses an injected
EIP-1193 browser wallet and viem against the fixed Polkadot Hub TestNet
configuration in the selected deployment manifest. All native EVM amounts use
18 decimals; no Substrate 10-decimal conversion is performed.

## Runtime configuration

`VITE_DEPLOYMENT_ENV` selects `local`, `staging`, or `production`. Development
defaults to `local`; a production build without an explicit value remains
unselected and cannot connect. A manifest must be `deployed` before reads or
writes are enabled. Runtime checks verify chain ID, genesis block hash,
contract bytecode/runtime hash, and configured immutable getters. Failures are
reported as `CONFIGURATION_MISMATCH` and never fall back to another network.

The checked-in manifests are templates. They contain no deployable addresses,
keys, RPC credentials, or secrets. Fill a deployment manifest and set
`status: deployed` only in an operator-controlled release artifact.

## Local start

```bash
cd packages/web
pnpm install
VITE_DEPLOYMENT_ENV=local pnpm dev
```

The local manifest intentionally remains a template, so the page displays the
diagnostic state and disables chain reads/writes until a verified deployment
manifest is supplied. This is expected and does not broadcast a transaction.

## Contribution and Claim

Contribution uses strict 18-decimal parsing, `simulateContract`, wallet
signature, receipt/status and `Contributed` event validation, followed by an
Ethereum `finalized` block-tag check. Unsupported finality is never treated as
finalized. The Claim client calls the fixed Backend endpoints from the
manifest, preserves the exact UTF-8 username, validates the Backend-provided
EIP-712 typed data, and signs only with the connected source H160. It never
sends AccountId32 or uses `personal_sign`.

The Backend is an M2 deliverable. If `backend.baseUrl` is null, contribution
remains available while Claim prepare/sign is disabled and the page reports
that the Claim service is not configured. Claim signing uses the M2
`GenesisCreditClaim` EIP-712 V2 schema: `sourceAccount` is the only source
field and every source, identity, destination, amount, sequence and deadline
field is checked against the prepared claim before `signTypedData`.

## Checks and limitations

```bash
pnpm typecheck
pnpm lint
pnpm test
VITE_DEPLOYMENT_ENV=local pnpm build
```

The offline Vitest suite is deterministic and does not require a public RPC or
a browser wallet; no real wallet or TestNet transaction is used in M1.1.
