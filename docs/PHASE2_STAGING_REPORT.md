# Genesis II staging report

This report must be completed from an actual Polkadot Hub TestNet deployment.
Local Anvil or unit-test output is not staging evidence.

```text
STAGING_E2E=BLOCKED
STAGING_BLOCKER=RPC_URL, PRIVATE_KEY, and a funded staging account are not configured in this checkout; deployment tooling stops at missing RPC_URL.

contract:
deployment tx:
deployment block:
runtime code hash:
allocation: 2,000,000 MINI
start price: 0.003500 DOT/MINI
end price: 0.005500 DOT/MINI
start timestamp:
end timestamp:
EVM purchase tx:
second buyer / repricing tx:
Substrate Native purchase tx:
refund behavior:
treasury receipt:
deadline rejection:
observed totalSoldMini:
observed totalRaisedDot:
finality evidence:
```

The independent deployment tooling and local validation are implemented in
`scripts/deploy-phase2.mjs`. It must not be used to infer a staging result when
the RPC, funded account, or transaction receipts are unavailable.
