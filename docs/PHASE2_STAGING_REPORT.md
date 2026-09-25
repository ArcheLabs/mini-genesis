# Genesis II TestNet staging report

## Preflight

```text
STAGING_BASE_COMMIT=d84c790325e762d4dd6e586060a06362f86569cb
BRANCH=codex/genesis2-product-closure
WORKTREE_CLEAN_BEFORE_PREFLIGHT=true
NETWORK=Polkadot Hub TestNet
NATIVE_ASSET=PAS
CHAIN_ID=420420417
RPC_HOST=services.polkadothub-rpc.com
RPC_REACHABLE=PARTIAL_ON_PRIOR_ATTEMPT; CURRENT_ATTEMPT=TLS_HANDSHAKE_TIMEOUT
LATEST_BLOCK=13592247 (prior observation; no fresh block read)
PREFLIGHT_OBSERVED_AT=2026-09-23 (prior observation)

DEPLOYER_ADDRESS=0x738d974FD3B11C3C2FFDbF137eee06fEE2E3c6cD
DEPLOYER_KEY_MATCH=PASS
DEPLOYER_INITIAL_BALANCE=4999.99 PAS (read from TestNet RPC)
TREASURY_ADDRESS=0x738d974FD3B11C3C2FFDbF137eee06fEE2E3c6cD

BUYER_A_ADDRESS=0x544Ac734C6B113789Ea97ac145B1a141bB7e0c65
BUYER_A_KEY_MATCH=PASS
BUYER_A_INITIAL_BALANCE=4999.99 PAS (read from TestNet RPC)
BUYER_B_ADDRESS=0xe5179A9Aaa634fd1F8b04D3Be860ea2dC8Cba9ec
BUYER_B_KEY_MATCH=PASS
BUYER_B_INITIAL_BALANCE=UNVERIFIED (TestNet RPC request timed out)

NATIVE_BUYER_ADDRESS=157rP7UaRkfsok4qAGj3rSjynQYF48fZHeBZQ7shq8Q55gwL
NATIVE_SIGNER=sr25519 account created; secret stored locally with mode 600
NATIVE_BALANCE=UNVERIFIED
NATIVE_WS=wss://asset-hub-paseo-rpc.n.dwellir.com
NATIVE_WS_REACHABLE=UNVERIFIED (current TLS handshake timed out)
NATIVE_E2E=BLOCKED_WS_CONNECTIVITY
STAGING_FUNDS=UNVERIFIED
```

An earlier attempt received chain ID `420420417` and a latest block from the
primary EVM RPC and read 4999.99 PAS for the deployer and Buyer A. Buyer B's
balance timed out. The secondary EVM RPC returned the correct chain ID on
that earlier attempt, but its block and balance reads timed out. These are
historical reads and do not count as fresh verification for this attempt.

## Current bounded failover attempt

```text
EVM_RPC_PRIMARY=https://eth-rpc-testnet.polkadot.io/
EVM_RPC_SECONDARY=https://services.polkadothub-rpc.com/testnet/
EVM_RPC_FAILOVER=BLOCKED_RPC_TIMEOUT (3 bounded attempts per endpoint; no fresh chain ID returned)
CHAIN_ID=UNVERIFIED_THIS_ATTEMPT (historical observed value: 420420417)
LATEST_BLOCK=UNVERIFIED_THIS_ATTEMPT
DEPLOYER_BALANCE=UNVERIFIED_THIS_ATTEMPT (historical observed value: 4999.99 PAS)
BUYER_A_BALANCE=UNVERIFIED_THIS_ATTEMPT (historical observed value: 4999.99 PAS)
BUYER_B_BALANCE=UNVERIFIED
STAGING_FUNDS=UNVERIFIED

WS_PRIMARY=wss://asset-hub-paseo-rpc.n.dwellir.com
WS_PRIMARY_DIAGNOSTIC=DNS_OK; TCP_CONNECT_OK; TLS_HANDSHAKE_TIMEOUT
WS_SECONDARY=wss://asset-hub-paseo.dotters.network
WS_SECONDARY_DIAGNOSTIC=DNS_LOOKUP_FAILED
NATIVE_WS_FAILOVER=BLOCKED_WS_CONNECTIVITY
NATIVE_ADDRESS=157rP7UaRkfsok4qAGj3rSjynQYF48fZHeBZQ7shq8Q55gwL
NATIVE_BALANCE=UNVERIFIED
NATIVE_FUNDS=UNVERIFIED
```

Each EVM endpoint was given up to three read-only JSON-RPC attempts with a
7-second request timeout. Neither returned a fresh chain ID. Direct network
diagnostics resolved the primary EVM hosts and Dwellir, and TCP connected to
them, but TLS handshakes timed out. Dotters did not resolve in DNS. No
transaction was signed or broadcast. No alternate chain or mainnet endpoint
was used.

## Deployment and transaction evidence

```text
PRE_BROADCAST_PREFLIGHT=BLOCKED
BLOCKER=No fresh EVM chain ID/account state and no native WebSocket account read
EXPECTED_DEPLOYMENT_ACTION=NOT_RUN
ESTIMATED_GAS=NOT_RUN
ESTIMATED_MAX_COST=NOT_RUN

CONTRACT_ADDRESS=NOT_DEPLOYED
DEPLOY_TX=NOT_RUN
DEPLOY_BLOCK=NOT_RUN
SOURCE_VERIFICATION=NOT_RUN
DEPLOYMENT_VERIFIER=NOT_RUN

ALLOCATION=NOT_DEPLOYED
START_PRICE=NOT_DEPLOYED
END_PRICE=NOT_DEPLOYED
START_TIME=NOT_DEPLOYED
END_TIME=NOT_DEPLOYED

BUYER_A_TX=NOT_RUN
PRICE_BEFORE_A=NOT_RUN
PRICE_AFTER_A=NOT_RUN
BUYER_B_TX=NOT_RUN
PRICE_AFTER_B=NOT_RUN
REPRICING_CHECK=NOT_RUN
NATIVE_TX=NOT_RUN
NATIVE_PURCHASE=BLOCKED
REFUND_TEST=NOT_RUN
SLIPPAGE_REVERT_TEST=NOT_RUN
TREASURY_ACCOUNTING=NOT_RUN
CUMULATIVE_ACCOUNTING=NOT_RUN
FINALITY=NOT_RUN
DEADLINE_REAL_NETWORK=NOT_RUN
SOLD_OUT_REAL_NETWORK=NOT_RUN
FRONTEND_STAGING=NOT_RUN
```

No transaction was signed or broadcast. Deployment is held until the required
fresh EVM and native reads pass. The native account secret is outside the
repository and is not included in this report.

## Local verification on the staging commit

```text
FORGE_BUILD=PASS
FORGE_TEST=PASS (43/43)
FUZZ=PASS (10,000 runs)
INVARIANT=PASS (1,000 runs)
SLITHER=PASS (0 findings)
ABI_CHECK=PASS
MANIFEST_CHECK=PASS
MANIFEST_TEST=PASS
FRONTEND_TYPECHECK=PASS
FRONTEND_TEST=PASS (113 tests)
FRONTEND_BUILD=PASS
```

## Result

```text
GENESIS1_CONTRACT_MODIFIED=false
GENESIS1_HISTORICAL_DATA_MODIFIED=false
PRIVATE_KEYS_IN_GIT=false
PRIVATE_KEYS_IN_REPORT=false
PRIVATE_KEYS_IN_LOG_OUTPUT=false
MAINNET_BROADCAST=false
FILES_CHANGED=docs/PHASE2_STAGING_REPORT.md
COMMITS_CREATED=none
WORKTREE_CLEAN=false (this evidence report is the only tracked change)
STAGING_E2E=BLOCKED_RPC_TIMEOUT_AND_WS_CONNECTIVITY
RELEASE_READY=BLOCKED
PRODUCTION_READY=BLOCKED
```

## RPC Differential Diagnosis

Read-only network diagnosis from the WSL2 shell on 2026-09-23. The repository
was on the expected branch and commit; the report was already modified from
the previous staging attempt (`WORKTREE_CLEAN_BEFORE=false`).

```text
BRANCH=codex/genesis2-product-closure
HEAD=d84c790325e762d4dd6e586060a06362f86569cb
REMOTE_HEAD=d84c790325e762d4dd6e586060a06362f86569cb

GENERAL_HTTPS_GITHUB=TCP_TIMEOUT (curl -4; connect timeout after 5 seconds)
GENERAL_HTTPS_POLKADOT_DOCS=TCP_TIMEOUT (curl -4; connect timeout after 5 seconds)
DNS_GITHUB=IPv4_RESOLVED (20.205.243.166)
DNS_POLKADOT_DOCS=IPv4_RESOLVED (52.175.9.80)
HTTP_PROXY_STATE=UNSET
HTTPS_PROXY_STATE=UNSET
ALL_PROXY_STATE=UNSET
NO_PROXY_STATE=UNSET
WSL=WSL2_CONFIRMED
VPN_OR_CORPORATE_PROXY=UNKNOWN

DNS_eth-rpc.polkadot.io=IPv4 (104.26.8.125, 104.26.9.125, 172.67.71.26)
DNS_services.polkadothub-rpc.com=IPv4 (104.26.0.37, 104.26.1.37, 172.67.72.56)
DNS_eth-rpc-testnet.polkadot.io=IPv4 (104.26.8.125, 104.26.9.125, 172.67.71.26)
DNS_asset-hub-paseo-rpc.n.dwellir.com=IPv4 (185.176.96.154)
DNS_sys.turboflakes.io=IPv4 (193.39.195.54)

LOCAL_NETWORK_BASELINE=FAIL
RPC_DIAGNOSIS=STOPPED_PER_BASELINE_GATE
MAINNET_RPC_A=NOT_TESTED
MAINNET_RPC_A_CHAIN_ID=NOT_TESTED
MAINNET_RPC_A_BLOCK=NOT_TESTED
MAINNET_RPC_B=NOT_TESTED
MAINNET_RPC_B_CHAIN_ID=NOT_TESTED
MAINNET_RPC_B_BLOCK=NOT_TESTED
GENESIS1_CONTRACT_ADDRESS=NOT_LOOKED_UP
GENESIS1_CODE_READ=NOT_RUN
GENESIS1_ETH_CALL=NOT_RUN
TESTNET_RPC_A=NOT_TESTED
TESTNET_RPC_A_CHAIN_ID=NOT_TESTED
TESTNET_RPC_A_BLOCK=NOT_TESTED
TESTNET_RPC_B=NOT_TESTED
TESTNET_RPC_B_CHAIN_ID=NOT_TESTED
TESTNET_RPC_B_BLOCK=NOT_TESTED
IPV4_RESULT=GENERAL_HTTPS_TCP_TIMEOUT
IPV6_RESULT=NOT_TESTED
DEPLOYER_BALANCE=UNVERIFIED
BUYER_A_BALANCE=UNVERIFIED
BUYER_B_BALANCE=UNVERIFIED
WS_A=NOT_TESTED_IN_THIS_DIAGNOSIS
WS_A_CHAIN=NOT_TESTED
WS_B=NOT_TESTED_IN_THIS_DIAGNOSIS
WS_B_CHAIN=NOT_TESTED
NATIVE_BALANCE=UNVERIFIED

FAILURE_LAYER=OUTBOUND_TCP_CONNECT (ordinary IPv4 HTTPS controls)
DIAGNOSIS=LIKELY_LOCAL_NETWORK_OR_PATH_ISSUE
STAGING_CAN_RESUME=false
TRANSACTIONS_SIGNED=0
TRANSACTIONS_BROADCAST=0
MAINNET_BROADCAST=false
```

DNS resolves for the ordinary HTTPS controls and all five requested Polkadot
hosts. Both ordinary HTTPS controls timed out before establishing a TCP
connection, so the specified stop condition applied and no Mainnet or TestNet
RPC request was made in this diagnosis. The Mainnet control, Genesis I reads,
TLS tests, and WebSocket tests therefore remain unverified here; this result
does not establish a Polkadot provider or TestNet-specific failure. No proxy
environment variables are set. The shell is WSL2; VPN/corporate network
status cannot be determined from this environment. A prior attempt reported
TLS handshake timeouts to several Polkadot endpoints, but that is historical
evidence and was not repeated after the failed baseline.

## Revised EVM and native gates

This section supersedes the earlier forced-IPv4 baseline as the Genesis II
EVM deployment gate. The `curl -4` connectivity result is diagnostic only.
Genesis II EVM deployment and EVM purchases use HTTP JSON-RPC; native WSS is a
separate gate for the native purchase path.

```text
EVM_PREFLIGHT=PASS
DEPLOYMENT_CAN_PROCEED=true
EXPECTED_CHAIN_ID=420420417

EVM_RPC_PRIMARY=https://eth-rpc-testnet.polkadot.io/
EVM_RPC_PRIMARY_CHAIN_ID=420420417
EVM_RPC_PRIMARY_BLOCK=13596914 (Cast block-number)
EVM_RPC_PRIMARY_DEPLOYER_BALANCE=4999990000000000000000 wei (4999.99 PAS)
EVM_RPC_PRIMARY_BUYER_A_BALANCE=4999990000000000000000 wei (4999.99 PAS)
EVM_RPC_PRIMARY_BUYER_B_BALANCE=4999990000000000000000 wei (4999.99 PAS)

EVM_RPC_SECONDARY=https://services.polkadothub-rpc.com/testnet/
EVM_RPC_SECONDARY_CHAIN_ID=420420417
EVM_RPC_SECONDARY_BLOCK=13596998 (latest successful Cast block read)
EVM_RPC_SECONDARY_DEPLOYER_BALANCE=4999990000000000000000 wei (4999.99 PAS)
EVM_RPC_SECONDARY_BUYER_A_BALANCE=4999990000000000000000 wei (4999.99 PAS)
EVM_RPC_SECONDARY_BUYER_B_BALANCE=4999990000000000000000 wei (4999.99 PAS)
STAGING_FUNDS=VERIFIED_SUFFICIENT_FOR_SMALL_EVM_STAGING_TRANSACTIONS

FORGE_SIMULATION_PRIMARY=BLOCKED_RPC_TIMEOUT
FORGE_SIMULATION_SECONDARY=BLOCKED_RPC_TIMEOUT
FORGE_DEPLOY_ATTEMPT_PRIMARY=BLOCKED_RPC_TIMEOUT_BEFORE_DEPLOYMENT_RECORD
FORGE_DEPLOY_ATTEMPT_SECONDARY=BLOCKED_RPC_TIMEOUT_BEFORE_DEPLOYMENT_RECORD
DEPLOYMENT=NOT_COMPLETED
DEPLOYMENT_BROADCAST_RECORD=NOT_FOUND
EVM_PURCHASES=NOT_RUN

NATIVE_E2E=BLOCKED_WS
NATIVE_BALANCE=UNVERIFIED
NATIVE_WS_GATE=INDEPENDENT_FROM_EVM_DEPLOYMENT_AND_PURCHASES
TRANSACTIONS_SIGNED=0 (no deployment transaction produced)
TRANSACTIONS_BROADCAST=0
MAINNET_BROADCAST=false
```

Cast successfully read chain ID, block number, and the three account balances
from both official TestNet HTTP RPC endpoints. The providers were
intermittent: later block/chain reads and Forge's normal pre-broadcast RPC
work timed out. Forge's broadcast attempts did not produce a deployment
record, and no EVM purchase could run without a deployed Phase II contract.
The required chain and balance checks passed, so WSS did not block the EVM
gate; the execution blocker was RPC timeouts during Forge. The native path
remains separately blocked on WSS and was not retried during this EVM attempt.

## Genesis I / Genesis II Forge differential diagnosis

Read-only, no-broadcast diagnosis. The current Foundry toolchain is pinned and
unchanged. Both providers passed the immediate Cast health check, but both
became unavailable during the paired simulation window. Per the diagnosis
stop rule, the A/B comparison was stopped when both providers failed basic
Cast reads.

```text
FOUNDRY_VERSION=forge 0.3.0 (5a8bd89 2024-12-19T17:17:10.245193696Z)
CAST_VERSION=cast 0.3.0 (5a8bd89 2024-12-19T17:17:10.252265834Z)
SOLC_VERSION=0.8.36+commit.8a079791.Linux.g++

RPC_A_CAST_HEALTH_INITIAL=PASS (chain 420420417; block 13597817; deployer balance 4999990000000000000000 wei)
RPC_B_CAST_HEALTH_INITIAL=PASS (chain 420420417; block 13597816; deployer balance 4999990000000000000000 wei)

GENESIS1_RPC_A_SIMULATION=TIMEOUT (no --broadcast)
GENESIS1_RPC_A_ELAPSED=120080ms
GENESIS1_RPC_A_LAST_VISIBLE_STEP=compiled; Forge reported an RPC cache miss for block 13597860; no Solidity trace followed
GENESIS1_RPC_A_ERROR=outer 120-second timeout (exit 124)

GENESIS2_RPC_A_SIMULATION=NOT_RUN
GENESIS2_RPC_A_PRECHECK=Cast eth_chainId request timed out immediately after Genesis I timeout

RPC_B_CAST_HEALTH_AFTER_A=FAIL (eth_chainId, eth_blockNumber, and deployer eth_getBalance each timed out)
A_B_DIAGNOSIS=BLOCKED_RPC_UNAVAILABLE
GENESIS1_RPC_B_ELAPSED=NOT_RUN
GENESIS1_RPC_B_SIMULATION=NOT_RUN
GENESIS2_RPC_B_ELAPSED=NOT_RUN
GENESIS2_RPC_B_SIMULATION=NOT_RUN
GENESIS2_RPC_A_ELAPSED=NOT_RUN

PROVIDER_BECAME_UNHEALTHY=true
PROXY_METHOD_LOGGING=NOT_RUN (both providers failed the required basic Cast health check)
GENESIS1_RPC_METHOD_SEQUENCE_SUMMARY=UNAVAILABLE
GENESIS2_RPC_METHOD_SEQUENCE_SUMMARY=UNAVAILABLE
GENESIS1_FIRST_FAILED_RPC_METHOD=UNIDENTIFIED
GENESIS2_FIRST_FAILED_RPC_METHOD=UNIDENTIFIED
RAW_RPC_REPRODUCTION=NOT_RUN

GENESIS1_CREATION_BYTECODE_BYTES=NOT_MEASURED
GENESIS1_RUNTIME_BYTECODE_BYTES=NOT_MEASURED
GENESIS2_CREATION_BYTECODE_BYTES=NOT_MEASURED
GENESIS2_RUNTIME_BYTECODE_BYTES=NOT_MEASURED

GENESIS2_SPECIFIC_DIFFERENCE_CONFIRMED=NOT_DETERMINED
PROVIDER_SPECIFIC=NOT_DETERMINED
FORGE_SPECIFIC=NOT_DETERMINED
RPC_METHOD_SPECIFIC=NOT_DETERMINED
ROOT_CAUSE=UNRESOLVED
ROOT_CAUSE_CONFIDENCE=LOW
RECOMMENDED_NEXT_ACTION=Repeat paired no-broadcast tests when both providers remain healthy through the full pair; use a method-only proxy if Forge still hides the failing RPC method.

TRANSACTIONS_SIGNED=0
TRANSACTIONS_BROADCAST=0
MAINNET_BROADCAST=false
```

Genesis I's direct `-vvvv` run did not expose the RPC method. It compiled, then
waited until the outer timeout without a trace. The follow-up Cast check
showed RPC A had become unhealthy, so Genesis II was not run against A. RPC B
then failed all three basic Cast reads, which triggered the required stop
before running either script on B or starting a localhost proxy. Static
constructor differences were inspected but cannot be correlated with a
measured Genesis II simulation result: Genesis I takes allocation/block
window/contribution minimum arguments, while Genesis II takes allocation,
price bounds, and timestamps. Neither difference proves a cause. No source
file changed, no Foundry upgrade was performed, and no transaction was
signed or broadcast.

## Foundry nightly and raw RPC follow-up

Read-only continuation on 2026-09-23. The installed Foundry 0.3.0 baseline
remains intact. A fresh Cast health check briefly passed on both RPCs, then
the independent raw JSON-RPC probes timed out across methods on both.

```text
FOUNDRY_BASELINE=forge 0.3.0 (5a8bd89)
CAST_BASELINE=cast 0.3.0 (5a8bd89)

RPC_A_INITIAL_CAST_HEALTH=PASS (chainId 420420417; block 13597817; deployer 4999990000000000000000 wei)
RPC_B_INITIAL_CAST_HEALTH=PASS (chainId 420420417; block 13597816; deployer 4999990000000000000000 wei)

RPC_A_eth_chainId=TIMEOUT (8036ms)
RPC_A_eth_blockNumber=TIMEOUT (8025ms)
RPC_A_eth_getBlockByNumber_13597860=TIMEOUT (8028ms; correct block parameter 0xcf7ca4)
RPC_A_eth_getBlockByNumber_latest=TIMEOUT (8029ms)
RPC_B_eth_chainId=TIMEOUT (8035ms)
RPC_B_eth_blockNumber=TIMEOUT (8029ms)
RPC_B_eth_getBlockByNumber_13597860=TIMEOUT (8031ms; correct block parameter 0xcf7ca4)
RPC_B_eth_getBlockByNumber_latest=TIMEOUT (8028ms)
HISTORICAL_BLOCK_PROBE_CONTEXT=13597860 was 43 blocks above RPC A latest 13597817 and 44 above RPC B latest 13597816 at the preceding Cast health check; a healthy endpoint could return null

RPC_A_CAST_CHAIN_ID_RETRY=PASS (420420417), followed by raw-probe timeouts
RPC_B_CAST_CHAIN_ID_RETRY=TIMEOUT
RAW_RPC_BLOCK_TIMEOUT_REPRODUCED=true (but all probed methods timed out in the same window)
BLOCK_LOOKUP_SPECIFIC_FAILURE=NOT_ESTABLISHED
FINAL_RAW_RETRY=all eight Cast raw calls failed with operation/request timeout (6.19–6.21 seconds)

NIGHTLY_INSTALL=FAILED
NIGHTLY_INSTALL_DETAIL=Installed foundryup could not query current GitHub release tags; the initial attempt hit an unsupported curl option, and the isolated retry timed out after 180 seconds.
NIGHTLY_INSTALL_DIR=/tmp/mini-genesis-foundry-nightly (no nightly binary installed; temporary files cleaned)
FOUNDRY_0_3_0_PRESERVED=true

GENESIS1_NIGHTLY_RPC_URL=NOT_RUN (no healthy RPC; nightly unavailable)
GENESIS2_NIGHTLY_RPC_URL=NOT_RUN (no healthy RPC; nightly unavailable)
GENESIS1_NIGHTLY_CHAIN_FLAG_POLKADOT_TESTNET=NOT_RUN
GENESIS2_NIGHTLY_CHAIN_FLAG_POLKADOT_TESTNET=NOT_RUN
METHOD_ONLY_PROXY=NOT_RUN (the required paired Foundry-version tests did not run)

ROOT_CAUSE=UNRESOLVED
ROOT_CAUSE_CONFIDENCE=LOW
NEXT_ACTION=Re-run the raw method probes and paired nightly simulations when an official TestNet RPC and the isolated nightly installer are reachable.
TRANSACTIONS_SIGNED=0
TRANSACTIONS_BROADCAST=0
MAINNET_BROADCAST=false
```

The raw `eth_getBlockByNumber` request for block 13597860 failed, but so did
`eth_chainId`, `eth_blockNumber`, and the `latest` block request at the same
time. This reproduces a timeout for the block read without proving a
block-lookup-specific failure or explaining Forge's earlier cache miss. No
nightly A/B result is available because both the current RPC probe and
separate nightly installation were blocked. No method-only proxy was started,
no repository source or toolchain pin was changed, and no transaction was
signed or broadcast.

## Runtime and ETH-RPC compatibility investigation

Read-only continuation on 2026-09-23. No contract, deployment, toolchain, or
application source was changed. The repository branch and commit remained
`codex/genesis2-product-closure` / `d84c790325e762d4dd6e586060a06362f86569cb`.
Only this report is modified.

### Live native runtime and historical state

The repository has `@polkadot/api` installed, but the available Node runtime
is Windows Node invoked from WSL. It could not resolve the package through the
WSL `node_modules` symlink. I then made bounded read-only WebSocket JSON-RPC
attempts to both endpoints below. Both timed out before completing the
handshake/query, so neither current nor historical runtime identity was
obtained.

```text
DWELLIR=wss://asset-hub-paseo-rpc.n.dwellir.com
DWELLIR_WS_QUERY=TIMEOUT (18-second bound)
TURBOFLAKES=wss://sys.turboflakes.io/asset-hub-paseo
TURBOFLAKES_WS_QUERY=TIMEOUT (18-second bound)

CURRENT_SUBSTRATE_CHAIN=UNAVAILABLE_FROM_RPC
CURRENT_NODE_NAME=UNAVAILABLE_FROM_RPC
CURRENT_NODE_VERSION=UNAVAILABLE_FROM_RPC
CURRENT_SPEC_NAME=UNAVAILABLE_FROM_RPC
CURRENT_SPEC_VERSION=UNAVAILABLE_FROM_RPC
CURRENT_IMPL_NAME=UNAVAILABLE_FROM_RPC
CURRENT_IMPL_VERSION=UNAVAILABLE_FROM_RPC
CURRENT_TRANSACTION_VERSION=UNAVAILABLE_FROM_RPC
CURRENT_FINALIZED_HEAD=UNAVAILABLE_FROM_RPC
CURRENT_GENESIS_HASH=UNAVAILABLE_FROM_RPC

GENESIS1_NATIVE_BLOCK_HASH=UNAVAILABLE_FROM_RPC
GENESIS1_RUNTIME_SPEC_NAME=UNAVAILABLE_FROM_RPC
GENESIS1_RUNTIME_SPEC_VERSION=UNAVAILABLE_FROM_RPC
GENESIS1_RUNTIME_IMPL_VERSION=UNAVAILABLE_FROM_RPC
GENESIS1_RUNTIME_TRANSACTION_VERSION=UNAVAILABLE_FROM_RPC
RUNTIME_GENERATION_CHANGED_SINCE_GENESIS1=UNVERIFIED
```

The Windows Node invocation failure is a local tooling limitation; the direct
WebSocket probes independently establish that neither tested endpoint
responded in this attempt. No native signing or transaction request was made.

### Release and Revive context

The official Paseo runtime release page lists v2.5.2, dated 2026-09-10, with
`asset-hub-paseo` spec version 2005002. This is release metadata, not a live
runtime query, and does not establish that either tested endpoint currently
runs that release. The supplied task identifies v2.4.2 / 2004002 and v2.5.1 /
2005000 as comparison checkpoints, but the GitHub release/API hosts timed out
from this environment, so those two checkpoints and the deployment-date
ordering were not independently reverified here. [Paseo runtime releases](https://github.com/paseo-network/runtimes/releases)

Polkadot SDK release metadata for `polkadot-stable2606-2` (September 2026)
describes ongoing Revive / ETH-RPC work, including runtime API versioning,
transaction replay and resource exhaustion handling, log block tags,
`eth_getBlockReceipts`, and submitted-transaction gas reporting. These release
notes establish that the Revive/RPC surface has continued to evolve; they do
not show that one listed change caused the observed Forge timeout. [Polkadot SDK release](https://github.com/paritytech/polkadot-sdk/releases/tag/polkadot-stable2606-2)

```text
PASEO_RELEASE_BEFORE_GENESIS1=v2.4.2 / spec 2004002 (brief-supplied; not independently reverified)
PASEO_RELEASE_AFTER_GENESIS1=v2.5.1 / spec 2005000 (brief-supplied; not independently reverified)
PASEO_CURRENT_RELEASE=v2.5.2 / spec 2005002 (release metadata; live match unverified)
CURRENT_LIVE_SPEC_MATCHES_RELEASE=UNVERIFIED
REVIVE_RPC_CHANGED_SINCE_GENESIS1=LIKELY_ENVIRONMENTAL_EVOLUTION; historical and live runtime comparison unavailable
RELEVANT_REVIVE_CHANGES=runtime API versioning; transaction replay/resource exhaustion; log block tags; eth_getBlockReceipts; submitted-transaction gas reporting
```

Direct requests to GitHub's release API and Polkadot documentation timed out.
The current forum discussion about Asset Hub EVM RPC reliability could not be
reached or verified in this pass. No community symptom is counted as evidence
for this particular failure.

```text
PUBLIC_RPC_RELIABILITY_REPORTS_EXIST=UNVERIFIED_IN_THIS_PASS
PUBLIC_RPC_REPORTED_FAILURE_MODES=UNVERIFIED_IN_THIS_PASS
PROJECT_PINNED_FOUNDRY=0.3.0 (forge/cast commit 5a8bd89)
CURRENT_POLKADOT_DOC_RECOMMENDED_FOUNDRY=UNVERIFIED_IN_THIS_PASS
CURRENT_POLKADOT_CHAIN_FLAG=UNVERIFIED_IN_THIS_PASS
```

### EVM endpoint and method observations

The public HTTP endpoints remained intermittent during a fresh, sequential,
read-only method check. Both continued to return some successful calls among
timeouts. RPC A returned `eth_chainId=0x190f1b41` (420420417),
`eth_blockNumber=0xcf84c5`, and a successful `eth_getBlockByNumber` response
for the mistakenly supplied parameter `0xb6a1c8` (the returned block number
was not retained); subsequent latest-block, balance, nonce, code, fee,
and client/module probes timed out. The intended Genesis I deployment height
11973384 is `0xb6b308`; a later lookup of that exact block timed out on both
providers, so its timestamp remains unknown.

RPC B timed out on chain ID, block number, block reads, and balance in this
sample. It did return nonce `0x1`, contract code (8008 returned hex characters,
including the `0x` prefix),
`eth_gasPrice=0xe8d4a51000`, and `eth_maxPriorityFeePerGas=0x0`. These isolated
successes do not establish stable service. `web3_clientVersion` and
`rpc_modules` timed out on both providers; method support is therefore
unknown, not unsupported. These fresh observations are consistent with the
earlier ten-request sample, which showed only 0–2 successful replies per ten
requests for chain ID, block number, and balance, with most requests timing
out.

```text
RPC_A_WEB3_CLIENT_VERSION=UNAVAILABLE (timeout)
RPC_B_WEB3_CLIENT_VERSION=UNAVAILABLE (timeout)
RPC_A_RPC_MODULES=UNAVAILABLE (timeout; unsupported not established)
RPC_B_RPC_MODULES=UNAVAILABLE (timeout; unsupported not established)
GENESIS1_EVM_DEPLOYMENT_BLOCK_TIMESTAMP=UNAVAILABLE (exact-height query timed out)
GENESIS1_CONTRACT_CODE_READ=PASS on RPC B (8008 hex characters returned, including 0x)
GENESIS1_VIEW_CALLS=NOT_RUN
PUBLIC_RPC_RELIABILITY_OBSERVED_LOCALLY=true
PUBLIC_RPC_RELIABILITY_REPORTS_EXIST=UNVERIFIED_IN_THIS_PASS
```

Method support for the unstable period, based on the fresh one-off requests:

| Method | RPC A | RPC B |
| --- | --- | --- |
| `eth_chainId` | PASS once, later timeout | timeout |
| `eth_blockNumber` | PASS once, later timeout | timeout |
| `eth_getBlockByNumber` latest / deployment height | timeout | timeout |
| `eth_getBalance` | timeout | timeout |
| `eth_getTransactionCount` | timeout | PASS once (`0x1`) |
| `eth_getCode` | timeout | PASS once (code returned) |
| `eth_gasPrice` | timeout | PASS once |
| `eth_maxPriorityFeePerGas` | not completed | PASS once |
| `web3_clientVersion` / `rpc_modules` | timeout | timeout |

### Foundry source investigation and assessment

The exact Foundry 0.3.0 source commit could not be retrieved from GitHub, and
the installed binary does not expose source locations for the terminal
message. The exact `RPC cache miss` emitter, function, cache-hydration meaning,
and next RPC operation therefore remain unresolved. No method-only proxy was
started, because the required paired Forge tests were not run and the
endpoints were not stable. The remote-fork method list below is not asserted
from source; determining it requires recovering the exact Foundry source or
capturing a redacted method-only trace against a stable endpoint.

```text
FOUNDRY_CACHE_MISS_SOURCE_FILE=UNRESOLVED
FOUNDRY_CACHE_MISS_FUNCTION=UNRESOLVED
FOUNDRY_CACHE_MISS_SEMANTICS=UNRESOLVED
FOUNDRY_NEXT_OPERATION_AFTER_CACHE_MISS=UNRESOLVED
FOUNDRY_REMOTE_FORK_RPC_METHODS_CONFIRMED=UNRESOLVED_FROM_EXACT_SOURCE
FOUNDRY_REMOTE_FORK_RPC_METHODS_POSSIBLE=UNRESOLVED_FROM_EXACT_SOURCE
```

Root-cause assessment separates observations from inference:

```text
FACT: Genesis I Foundry 0.3.0 no-broadcast simulation timed out after 120 seconds without a Solidity trace.
FACT: Genesis II was not run in a paired test; a Genesis II-specific failure is not established.
FACT: simple HTTP RPC methods were intermittently successful and frequently timed out across both official providers.
FACT: current and historical Substrate runtime identities were unavailable from the tested WSS endpoints.
FACT: Genesis I contract code was read successfully once from RPC B; client identity, exact deployment block, and view-call results were not obtained.
EXTERNAL CONTEXT: Paseo v2.5.2 release metadata reports spec 2005002; live endpoint equivalence is unverified.
EXTERNAL CONTEXT: Polkadot SDK release notes show ongoing Revive/ETH-RPC changes; this does not identify the timeout cause.
INFERENCE: public RPC instability is directly observed and is a plausible contributor to Forge's timeout.
INFERENCE: a Foundry 0.3.0/current-runtime compatibility issue remains plausible but unisolated.
NOT PROVEN: runtime generation changed between the actual Genesis I deployment block and the live chain.
NOT PROVEN: nightly Foundry resolves the failure; no nightly A/B was run.
NOT PROVEN: the timeout is specific to Genesis II or to any single JSON-RPC method.
```

```text
H1_GENESIS2_SPECIFIC=NOT_SUPPORTED (no paired Genesis I/II result)
H2_PUBLIC_RPC_RELIABILITY=SUPPORTED (local sequential observations; cause of Forge timeout not proven)
H3_FOUNDRY_030_COMPATIBILITY=UNRESOLVED (single timed-out Forge baseline; unstable RPC; no nightly A/B)
H4_RUNTIME_EVOLUTION=UNRESOLVED (release evolution is visible, but live and deployment-block runtimes were not queried)
H5_LOCAL_NETWORK=UNRESOLVED (no independent environment comparison)
MOST_LIKELY_FAILURE_MODEL=public RPC instability is an observed contributor; Foundry/runtime interaction remains open
CONFIDENCE=LOW
NEXT_EXPERIMENT=repeat runtime and method reads from an independently stable provider/environment; then run controlled 0.3.0/nightly no-broadcast A/B only after RPC stability is demonstrated
SOURCE_FILES_CHANGED=none
REPORT_CHANGED=yes
TRANSACTIONS_SIGNED=0
TRANSACTIONS_BROADCAST=0
MAINNET_BROADCAST=false
```

## Public TestNet RPC qualification

Read-only endpoint qualification on 2026-09-23 at the pinned repository
baseline. Stage 0 used Cast 0.3.0. The final Stage 1 batches and session probes
used direct HTTP JSON-RPC requests so that HTTP, JSON-RPC, timeout, and latency
outcomes could be counted independently. An initial bounded Stage 0 command
returned a detached session and may have overlapped an earlier preliminary
Stage 1 sample; that preliminary sample was excluded and Stage 1 was rerun
cleanly. No requests in the final reported batches or session were concurrent,
and no transaction method was called.

### Stage 0 — identity gate

```text
RPC_A=https://eth-rpc-testnet.polkadot.io/
RPC_A_CLIENT="eth-rpc/master-9b3a4a9/x86_64-unknown-linux-gnu/rustc1.93.0"
RPC_A_CHAIN_ID=420420417
RPC_A_INITIAL_BLOCK=13607777

RPC_B=https://services.polkadothub-rpc.com/testnet/
RPC_B_CLIENT="eth-rpc/stable2603-241bd90/x86_64-unknown-linux-gnu/rustc1.93.0"
RPC_B_CHAIN_ID=420420417
RPC_B_INITIAL_BLOCK=13607779

RPC_C=https://paseo-assethub-rpc.laissez-faire.trade/
RPC_C_CHAIN_ID=NOT_ESTABLISHED
RPC_C_CLIENT=UNAVAILABLE
RPC_C_INITIAL_BLOCK=UNAVAILABLE
RPC_C_INITIAL_PROBES=HTTP 502 for web3_clientVersion, eth_chainId, eth_blockNumber
RPC_C_RETRY=TIMEOUT for all three Cast probes (5-second RPC timeout)
RPC_C_CLASSIFICATION=STAGE0_UNAVAILABLE (not wrong-chain; identity not proven)
```

Only A and B passed the required chain identity gate. C was not advanced to
Stage 1 because it never proved chain ID 420420417.

### Stage 1 — three sequential batches

Each cell reports `success/20`, then latency in milliseconds as
`min / median / p95 / max`. Three batches were run per method with a 30-second
pause between batches. HTTP errors and timeouts are included in latency
statistics; there were no JSON-RPC errors in these samples.

| Endpoint | Batch | `eth_chainId` | `eth_blockNumber` | `eth_getBalance` |
| --- | --- | --- | --- | --- |
| A | 1 | 12/20; 533 / 804 / 15022 / 15026 | 20/20; 529 / 570 / 844 / 913 | 20/20; 512 / 558 / 582 / 591 |
| A | 2 | 20/20; 399 / 436 / 534 / 717 | 20/20; 415 / 438 / 447 / 468 | 20/20; 427 / 444 / 451 / 487 |
| A | 3 | 20/20; 411 / 426 / 681 / 833 | 20/20; 404 / 434 / 488 / 709 | 20/20; 441 / 463 / 488 / 495 |
| B | 1 | 14/20; 219 / 279 / 15017 / 15020 | 20/20; 214 / 250 / 497 / 502 | 20/20; 193 / 233 / 265 / 503 |
| B | 2 | 20/20; 203 / 242 / 324 / 521 | 20/20; 258 / 280 / 595 / 743 | 20/20; 252 / 282 / 608 / 897 |
| B | 3 | 20/20; 142 / 192 / 297 / 466 | 20/20; 170 / 203 / 253 / 259 | 20/20; 179 / 203 / 271 / 469 |

```text
RPC_A_STAGE1=172/180 (95.6%); success 52/60 chain ID, 60/60 block number, 60/60 balance
RPC_A_STAGE1_FAILURES=8 timeouts, all during batch 1 eth_chainId; 0 HTTP errors, 0 JSON-RPC errors
RPC_B_STAGE1=174/180 (96.7%); success 54/60 chain ID, 60/60 block number, 60/60 balance
RPC_B_STAGE1_FAILURES=6 timeouts, all during batch 1 eth_chainId; 0 HTTP errors, 0 JSON-RPC errors
```

Balance requests used the supplied public staging deployer address. No account
secrets were read.

### Stage 2 — Forge-relevant methods

RPC A and B passed the Stage 1 95% entry threshold and received ten sequential
requests per method. Results:

| Method | Success | Latency min / median / p95 / max (ms) | Note |
| --- | ---: | --- | --- |
| `eth_getBlockByNumber` (`latest`, `false`) | 3/10 | 423 / 12657 / 15095 / 15095 | 7 timeouts |
| `eth_getTransactionCount` (staging deployer) | 10/10 | 436 / 481 / 555 / 555 | returned `0x0` |
| `eth_getCode` (Genesis I) | 10/10 | 433 / 487 / 2279 / 2279 | nonempty code; 8008 hex characters including `0x` |
| `eth_gasPrice` | 10/10 | 485 / 550 / 1036 / 1036 | supported |
| `eth_maxPriorityFeePerGas` | 10/10 | 545 / 568 / 822 / 822 | supported |
| `eth_feeHistory` | 10/10 | 496 / 535 / 1566 / 1566 | supported |

RPC B results:

| Method | Success | Latency min / median / p95 / max (ms) | Note |
| --- | ---: | --- | --- |
| `eth_getBlockByNumber` (`latest`, `false`) | 10/10 | 193 / 238 / 1207 / 1207 | latest block `0xcfa686` |
| `eth_getTransactionCount` (staging deployer) | 10/10 | 174 / 206 / 441 / 441 | supported |
| `eth_getCode` (Genesis I) | 10/10 | 207 / 227 / 891 / 891 | nonempty code; 8008 hex characters including `0x` |
| `eth_gasPrice` | 10/10 | 169 / 210 / 707 / 707 | supported |
| `eth_maxPriorityFeePerGas` | 10/10 | 174 / 210 / 254 / 254 | supported |
| `eth_feeHistory` | 10/10 | 181 / 198 / 237 / 237 | supported |

```text
RPC_A_STAGE2=53/60 (88.3%); 7 timeouts, all on eth_getBlockByNumber
RPC_B_STAGE2=60/60 (100%); no failures or unsupported methods
RPC_C_STAGE2=NOT_RUN (identity gate did not pass)
```

No tested method returned JSON-RPC `-32601`; unsupported methods were not
observed.

### Stage 3 — Genesis I contract reads

RPC A returned nonempty Genesis I runtime code during Stage 2. Four read-only
view calls were then made against the deployed contract using selectors from
the repository ABI (`phase()`, `contributorCount()`, `totalRaisedDot()`, and
`treasury()`). None returned during this connectivity window: `phase()` timed
out on response; the other three timed out while connecting. RPC B returned
two of four calls (`contributorCount()` and `totalRaisedDot()`); `phase()` and
`treasury()` timed out. RPC C did not reach this stage.

```text
RPC_A_GENESIS1_CODE_READ=PASS (nonempty code, read in Stage 2)
RPC_A_GENESIS1_VIEW_READ=FAIL (0/4 returned)
RPC_B_GENESIS1_CODE_READ=PASS (nonempty code, read in Stage 2)
RPC_B_GENESIS1_VIEW_READ=PARTIAL (2/4 returned)
RPC_C_GENESIS1_READ=NOT_RUN
```

### Stage 4 — five-minute sequential session

RPC A passed the Stage 1 entry threshold and was polled for five minutes,
rotating the six requested methods once every two seconds with no concurrency.
The endpoint initially experienced an extended outage, later recovered, then
completed the five-minute window.

```text
RPC_A_SESSION_TOTAL_REQUESTS=150
RPC_A_SESSION_SUCCESS=131 (87.3%)
RPC_A_SESSION_FAILURE=19 (all timeouts)
RPC_A_SESSION_HTTP_429=0
RPC_A_SESSION_JSONRPC_ERRORS=0
RPC_A_SESSION_LONGEST_FAILURE_STREAK=19 requests / 94.3 seconds
RPC_B_SESSION_TOTAL_REQUESTS=150
RPC_B_SESSION_SUCCESS=141 (94.0%)
RPC_B_SESSION_FAILURE=9 (all timeouts)
RPC_B_SESSION_HTTP_429=0
RPC_B_SESSION_JSONRPC_ERRORS=0
RPC_B_SESSION_LONGEST_FAILURE_STREAK=9 requests / 28.1 seconds
RPC_C_SESSION=NOT_RUN (identity gate not passed)
```

### Qualification and gated follow-up

```text
RPC_A_CLASSIFICATION=UNSTABLE
RPC_B_CLASSIFICATION=UNSTABLE
RPC_C_CLASSIFICATION=UNAVAILABLE_AT_STAGE0 (chain identity unproven)
BEST_EVM_RPC=NONE QUALIFIED; B is the relative retest candidate (Stage 2 100%, but Stage 1 96.7%, session 94.0%, and view reads partial)
BEST_EVM_RPC_CONFIDENCE=HIGH that no endpoint met GOOD in these samples; LOW for any broader provider ranking

GENESIS1_FORGE_SIMULATION=NOT_RUN (no endpoint met GOOD)
GENESIS2_FORGE_SIMULATION=NOT_RUN
PUBLIC_OFFICIAL_RPC_RELIABILITY_PROBLEM=SUPPORTED (A and B showed material timeouts/errors; no public endpoint qualified as GOOD)
FOUNDRY_0_3_0_COMPATIBILITY_SUSPECT=NOT_TESTED_BY_THIS_QUALIFICATION
GENESIS2_SPECIFIC_DIFFERENCE_CONFIRMED=false

TRANSACTIONS_SIGNED=0
TRANSACTIONS_BROADCAST=0
MAINNET_BROADCAST=false
SOURCE_FILES_CHANGED=none
REPORT_CHANGED=yes
```

The stage results do not establish a stable public staging control. A passed
the Stage 1 entry threshold but had only 3/10 latest-block reads, failed all
four sampled views, and had a 94-second continuous outage during the
five-minute session. B passed Stage 2 and recovered after its first-batch
chain-ID timeouts, but the five-minute session had 9 timeouts with a
28-second longest streak, and two of four views did not return. C remains
unqualified because it did not return a chain ID. No Forge simulations were
run, so this qualification makes no conclusion about Foundry compatibility
or Genesis II behavior. Native / Substrate WSS endpoints were not tested.

## Genesis II EVM staging execution

Execution attempt on 2026-09-24. The repository and account setup were
validated without exposing private-key values. The protected local file
`/home/libingjiang/.config/mini-genesis/staging.env` has mode 600, and all
three configured key/address pairs derive the runbook's expected deployer,
Buyer A, and Buyer B addresses. The production environment file was not read
or used.

```text
BRANCH=codex/genesis2-product-closure
HEAD=d84c790325e762d4dd6e586060a06362f86569cb
REMOTE_HEAD=d84c790325e762d4dd6e586060a06362f86569cb
FOUNDRY_VERSION=forge 0.3.0 (5a8bd89)
CAST_VERSION=cast 0.3.0 (5a8bd89)
EXPECTED_CHAIN_ID=420420417
```

The earlier operational preflight selected Parity after OpsLayer's block
number read failed twice. At that earlier point, Parity returned chain ID,
block, deployer/treasury balances, and nonce. The block timestamp was
1790179332, giving the provisional seven-day window shown below. This data
was not treated as the immediate pre-deployment preflight because RPC
availability changed before a deployment could start.

```text
EARLIER_SELECTED_RPC=https://eth-rpc-testnet.polkadot.io/
EARLIER_CHAIN_ID=420420417
EARLIER_LATEST_BLOCK=13609910
EARLIER_DEPLOYER_BALANCE=4999990000000000000000 wei
EARLIER_DEPLOYER_NONCE=0
EARLIER_TREASURY_BALANCE=4999990000000000000000 wei
EARLIER_START_TIMESTAMP=1790179272
EARLIER_END_TIMESTAMP=1790784072
EARLIER_WINDOW_SECONDS=604800
EXPECTED_CREATE_ADDRESS_FROM_EARLIER_NONCE=0x345Fa7cAd2DD826D581B533f4C189e1ce68D2f28
```

The required fresh pre-deployment checks were then attempted using Cast. The
selected Parity RPC returned the correct chain ID and block, but both deployer
balance attempts timed out. Per the runbook, OpsLayer was tried as fallback;
its first chain ID read failed and retry passed, and its block read passed,
but both deployer balance attempts also timed out. Since the sender balance
could not be verified on either endpoint, the signing gate was not met.

```text
FINAL_PREFLIGHT_PARITY_CHAIN_ID=420420417
FINAL_PREFLIGHT_PARITY_BLOCK=13609999
FINAL_PREFLIGHT_PARITY_DEPLOYER_BALANCE=TIMEOUT on both attempts
FINAL_PREFLIGHT_OPSLAYER_CHAIN_ID=420420417 (passed on retry)
FINAL_PREFLIGHT_OPSLAYER_BLOCK=13610013
FINAL_PREFLIGHT_OPSLAYER_DEPLOYER_BALANCE=TIMEOUT on both attempts
FINAL_PREFLIGHT_DEPLOYER_NONCE=NOT_OBTAINED_IN_FINAL_PREFLIGHT
FINAL_PREFLIGHT_TREASURY_BALANCE=NOT_OBTAINED_IN_FINAL_PREFLIGHT
ACTIVE_DEPLOY_RPC=NONE (no endpoint completed the required immediate preflight)
EXPECTED_CONTRACT_ADDRESS=PROVISIONAL_ONLY (earlier nonce 0; not used)
DEPLOYMENT_STATE=NOT_STARTED_PREFLIGHT_FAILED
DEPLOYMENT_COMMAND=NOT_RUN
BUYER_A_PURCHASE=NOT_RUN
BUYER_B_PURCHASE=NOT_RUN
TRANSACTIONS_SIGNED=0
TRANSACTIONS_BROADCAST=0
MAINNET_BROADCAST=false
```

No Forge broadcast command was started, no deployment transaction exists from
this attempt, and no recovery/rebroadcast decision is pending. The canonical
deployment entry point, manifest finalization, purchases, frontend build, and
regression suite remain unrun because the mandatory immediate sender-balance
check failed on both official RPCs. This is an RPC operational preflight
block, not a source defect; no contract or application source was changed.

```text
EVM_STAGING=BLOCKED_RPC_PREFLIGHT
NATIVE_E2E=BLOCKED_WS (separate track; not tested here)
FULL_STAGING_E2E=BLOCKED_EVM_PREFLIGHT
RELEASE_READY=BLOCKED_EVM_PREFLIGHT
SOURCE_FILES_CHANGED=none
DEPLOYMENT_ARTIFACTS_CHANGED=none
REPORT_CHANGED=yes
```
