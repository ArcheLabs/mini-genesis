# Genesis II mainnet checklist

Do not mark production ready until every item is evidenced.

- [ ] `forge fmt --check`, `forge build`, and `forge test` pass.
- [ ] Fuzz and invariant suites pass.
- [ ] Slither passes with only reviewed, local suppressions.
- [ ] Phase I ABI, manifest fields, contract, and tests are unchanged.
- [ ] `MiniGenesisCurve.json` and frontend generated ABI pass the ABI check.
- [ ] Staging EVM purchase, second-buyer repricing, refund, treasury, and finality checks pass.
- [ ] Staging Substrate Native purchase and account-mapping checks pass.
- [ ] Staging deadline rejection and accounting checks pass.
- [ ] Production verifier reads the deployed immutable values directly.
- [ ] Allocation is 2,000,000 MINI; prices are 0.000750 and 0.001250 DOT/MINI.
- [ ] Full-sale capacity is 2,000 DOT; treasury address is independently reviewed.
- [ ] Start and end timestamps are public, correct, and exactly seven days apart.
- [ ] Network is Polkadot Hub Mainnet.
- [ ] `deployments/production.json` and generated frontend config are committed.
- [ ] Production Pages is published only through the manual workflow dispatch.
- [ ] Legal, tax, and geographic restrictions receive independent review.

No private key may be stored in GitHub Actions and CI must never broadcast a
production contract deployment.
