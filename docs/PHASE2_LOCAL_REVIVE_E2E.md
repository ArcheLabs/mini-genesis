# MINI Genesis II — Local Revive E2E Evidence

## Scope

This report records an E2E run against a **local-only prebuilt pallet-revive development runtime and its paired ETH-RPC adapter**. It is not TestNet evidence and does not establish current Paseo compatibility, public RPC reliability, wallet integration, or production readiness.

The binary pair came from the [Parity hardhat-polkadot `nodes-19907546951` release](https://github.com/paritytech/hardhat-polkadot/releases/tag/nodes-19907546951). That release is an older testing build; `LOCAL_REVIVE_VERSION_IS_TESTNET_EQUIVALENT=false`.

No public TestNet or Mainnet transaction was signed or broadcast. The local E2E used three unlocked development accounts exposed by `eth_accounts`; the local node handled JSON-RPC `eth_sendTransaction` requests. No private keys were loaded by the driver.

## Environment

| Item | Result |
| --- | --- |
| Repository baseline | `codex/genesis2-product-closure` at `d84c790325e762d4dd6e586060a06362f86569cb` |
| Platform | Linux x86_64, Ubuntu 20.04 host under WSL |
| Binary runtime | Ubuntu 24.04 WSL, glibc 2.39, GLIBCXX 3.4.33; host glibc 2.31 could not load the release binaries |
| Revive node | `0.0.0-505af766450` |
| Runtime spec | `revive-dev-runtime`, spec version `0` |
| ETH-RPC client | `anvil/anp-dirty-node-v2-505af76/x86_64-unknown-linux-gnu/rustc1.88.0` |
| Local chain | `Development`, EVM chain ID `420420420` |
| Local native properties | symbol `MINI`, 12 decimals; EVM value scale 18 decimals |
| SS58 prefix | `0` |
| EVM endpoint | `http://127.0.0.1:8545` |
| Substrate endpoint | `ws://127.0.0.1:9944` |
| Account mode | `JSON_RPC_UNLOCKED` |
| State persistence | PASS — after a runner restart the local chain resumed at block 7 |
| Logs | `/tmp/mini-genesis-revive/` |

On this Ubuntu 20.04 WSL host, the prebuilt pair runs in the installed Ubuntu 24.04 WSL distro. Set `REVIVE_LOCAL_RUNTIME_DISTRO=Ubuntu` for `setup:revive-local` and `revive:local`; Linux hosts with a sufficiently recent runtime can run them directly without that setting.

The binaries were checked against the release `checksums.txt` and pinned SHA-256 values. They remain outside the repository under the user cache. The setup checks for at least 8 GiB free before downloading; the host had approximately 561 GiB available when checked.

```text
revive-dev-node SHA256=c06e7589264558bd214f3eef2e9be71c459f932e3d8a0508b1a1018a8f34cb1f
eth-rpc         SHA256=01beeb5449926028dabc6176a8f1f793a9f4b3ea4aafb0d9eada48a6d3fc327d
```

## E2E result

The driver deployed the Forge-built `MiniGenesisCurve` artifact through the local ETH-RPC using unlocked development accounts. It did not invoke the staging deployment script, which is intentionally left unchanged and expects a protected private key.

| Check | Result |
| --- | --- |
| Revive node / ETH-RPC started | PASS / PASS |
| Three funded unlocked EVM accounts | PASS |
| Forge build artifact | PASS |
| Deployment | PASS — `0x970951a12f975e6762482aca81e57d5a2a4e73f4` at block `8` |
| Deployment tx | `0x39a3bfc3206d36e36d6fe648b5a5bb34ad32adf5c27a7f15297807ee072d49bc` |
| Runtime code hash | `0xe38de2beab8e0ee08c371d1a104fa480943433c41946faadf4de46d31bef9f68` |
| Immutable deployment values | PASS — treasury is the local deployer; allocation `2000000000000000000000000`; start/end prices `3500000000000000` / `5500000000000000`; seven-day window `1790309748`–`1790914548` |
| Buyer A | PASS — `10000000000000000000000` MINI; tx `0x04c55fd7efb117ad9f611e47305b446b57689a9e726ac2acbe6336bcb1018056`, block `10` |
| Repricing after A | PASS — spot moved from `3500000000000000` to `3510000000000000`; quote B was `70400000000000000000` |
| Buyer B and excess refund | PASS — `20000000000000000000000` MINI; sent `71400000000000000000`, contract cost `70400000000000000000`, excess `1000000000000000000`; tx `0x3fee0aebfe5a156f2bcc69dd45a01cb5507b2265f3ef315248332149bd35621a`, block `12` |
| Repricing after B | PASS — spot `3530000000000000`; independently matches `priceAt(totalSoldMini)` |
| Slippage rejection | PASS — `eth_call` returned `SlippageExceeded`; no intentional revert transaction was sent |
| Insufficient-payment rejection | PASS — `eth_call` returned `InsufficientPayment`; no intentional revert transaction was sent |
| Buyer accounting | PASS — buyer count `2`, purchased amounts match both requested quantities |
| Cumulative accounting | PASS — total sold `30000000000000000000000`; raised and independently calculated cumulative cost both `105450000000000000000` |
| Remaining allocation | PASS — `1970000000000000000000000` |
| Treasury / cumulative accounting | PASS — Buyer B treasury balance delta equals quote B; cumulative raised and event costs equal quote A plus quote B, `105450000000000000000` |
| Purchased events | PASS — both event amounts, costs, cumulative totals, and post-purchase spot prices match state |
| Finality | PASS — ETH `finalized` block tag reached block `13`, covering deployment and both purchases |

The campaign timestamps are derived from the local chain’s block timestamp. On a fresh chain whose genesis timestamp is zero, the driver first seals an empty local block through `evm_mine`, then derives the seven-day window from that block. This operation affects only the local development chain.

## Frontend and regression checks

Local manifest support is explicitly limited to `environment=local`: loopback HTTP/WS endpoints, the discovered local chain ID and SS58 prefix, and an empty explorer URL are accepted there. Staging and production network validation remains strict.

```text
LOCAL_FRONTEND_RUNTIME_WIRING=PASS
LOCAL_FRONTEND_TYPECHECK=PASS
LOCAL_FRONTEND_TEST=PASS (24 files, 113 tests)
LOCAL_FRONTEND_BUILD=PASS (VITE_DEPLOYMENT_ENV=local)
FORGE_BUILD=PASS
FORGE_TEST=PASS (FOUNDRY_PROFILE=ci; 43 tests)
FUZZ=PASS (10,000 runs per configured Genesis I / II fuzz target)
INVARIANT=PASS (1,000 runs per invariant target)
SLITHER=PASS (Genesis I: 0 findings; Genesis II: 0 findings)
ABI_CHECK=PASS
MANIFEST_CHECK=PASS
MANIFEST_TEST=PASS
```

The generated local frontend manifest contains the deployed Phase II address and code hash. Phase I historical data is unchanged, Phase III remains locked, and neither `deployments/staging.json` nor `deployments/production.json` was changed.

## Final status

```text
REVIVE_BINARY_DOWNLOAD=PASS
REVIVE_BINARY_CHECKSUM=PASS
ETH_RPC_BINARY_CHECKSUM=PASS
REVIVE_NODE_STARTED=true
ETH_RPC_STARTED=true
LOCAL_REVIVE_E2E=PASS
LOCAL_REVIVE_VERSION_IS_TESTNET_EQUIVALENT=false
IMPLEMENTATION_COMPLETE=true

TESTNET_EVM_STAGING=BLOCKED_RPC_PREFLIGHT
TESTNET_NATIVE_STAGING=BLOCKED_WS
TESTNET_RELEASE_VALIDATED=false
LOCAL_NATIVE_REVIVE_CALL=NOT_RUN
DEADLINE_REAL_NETWORK=NOT_RUN
SOLD_OUT_REAL_NETWORK=NOT_RUN
MAINNET_BROADCAST=false
```

`IMPLEMENTATION_COMPLETE=true` means the implementation and local E2E are complete against this prebuilt local Revive environment. It does not mean TestNet staging or release readiness has passed. The local-native `Revive.call` purchase path remains a separate, untested track.
