# Genesis II mainnet checklist

Do not mark production ready until every item is evidenced.

- [ ] `make fmt-check`, `forge build`, and `forge test` pass.
- [ ] Fuzz and invariant suites pass.
- [ ] Slither passes with only reviewed, local suppressions. Phase I's reviewed `startBlock == 0` state sentinel is excluded from only the `incorrect-equality` detector; Phase II receives the full detector set.
- [ ] Phase I ABI, manifest fields, contract, and tests are unchanged.
- [ ] `MiniGenesisCurve.json` and frontend generated ABI pass the ABI check.
- [ ] Deployment manifest validation and manifest tests pass, including staging at exactly 1 hour and production at exactly 15 days.
- [ ] Frontend typecheck, tests, and production-equivalent build pass.
- [ ] Staging EVM purchase, second-buyer repricing, refund, treasury, and finality checks pass; staging purchase tests use EVM wallets only.
- [ ] Production Polkadot.js injected SS58 signer and account-mapping path is reviewed against Polkadot Hub Mainnet; no SS58 purchase test is run on TestNet.
- [ ] Staging deadline rejection and accounting checks pass.
- [ ] Production verifier reads the deployed immutable values directly.
- [ ] Production deployment verifies chain ID, runtime code hash, and immutable getters through at least two independent RPC hosts.
- [ ] Production broadcast uses the explicit `CONFIRM_MAINNET_DEPLOYMENT=DEPLOY_PRODUCTION_PHASE2` guard.
- [ ] Allocation is 2,000,000 MINI; prices are 0.003500 and 0.005500 DOT/MINI.
- [ ] Full-sale capacity is 9,000 DOT; treasury address is independently reviewed.
- [ ] Production start and end timestamps are public, correct, exactly 15 days apart, and the start is at least one hour after the latest mainnet block at deployment.
- [ ] Network is Polkadot Hub Mainnet.
- [ ] Dedicated production deployer address and DOT balance are verified; the production key is never reused from staging or stored in GitHub Actions.
- [ ] `deployments/production.json` and generated frontend config are committed.
- [ ] Production Pages is published only through the manual workflow dispatch after the Phase II contract and manifest pass production verification.
- [ ] Legal, tax, and geographic restrictions receive independent review.

No private key may be stored in GitHub Actions and CI must never broadcast a
production contract deployment.
