# MINI Genesis

MINI Genesis is a finite, three-phase Genesis application for MINI:

* **Genesis I — COMPLETED:** immutable time-weighted stream distribution through `MiniGenesisStream`.
* **Genesis II — LIVE:** a separate, limited 2,000,000 MINI Early Operations Reserve allocation through a deterministic quantity-based linear bonding curve.
* **Genesis III — LOCKED:** the final Genesis phase, with no allocation, date, or price determined in this release.

Phase I and Phase II are different mechanisms. Phase I emits MINI by block and
contribution weight; Phase II prices exact MINI quantities from cumulative sold
amount. Phase II creates no additional MINI, and unsold MINI remains in the
Early Operations Reserve.

The repository contains:

* the `MiniGenesisStream` contract;
* deployment and manifest tooling;
* the standalone Genesis frontend;
* staging and production release workflows.

Phase II production parameters are fixed at 0.000750 → 0.001250 DOT/MINI,
with a full-sale capacity of 2,000 DOT. The displayed Genesis I value
0.00008946 DOT/MINI is a historical final reference price, not an exchange spot
price.

## Requirements

* Git
* Foundry `v0.3.0`
* Node.js `24`
* pnpm `10`
* Python `3.12` and Slither

Clone the repository with its submodules:

```bash
git clone --recurse-submodules https://github.com/ArcheLabs/mini-genesis.git
cd mini-genesis
```

For an existing checkout:

```bash
git submodule update --init --recursive
```

## Contract checks

Run the complete contract validation:

```bash
make check
```

Individual commands:

```bash
forge fmt --check
forge build
FOUNDRY_PROFILE=ci forge test
make slither
make abi-check
make manifest-check
make manifest-test
```

The same checks can also be run manually from the **contracts** workflow in GitHub Actions.

## Frontend development

Install frontend dependencies:

```bash
pnpm --dir packages/web install --frozen-lockfile
```

Start the local frontend:

```bash
VITE_DEPLOYMENT_ENV=local pnpm --dir packages/web dev
```

Run checks and tests:

```bash
pnpm --dir packages/web typecheck
pnpm --dir packages/web test
```

Build the local frontend:

```bash
VITE_DEPLOYMENT_ENV=local pnpm --dir packages/web build
```

For an explicit staging/development-only Native verification against Polkadot Hub Mainnet:

```bash
VITE_DEPLOYMENT_ENV=staging VITE_NATIVE_NETWORK_OVERRIDE=polkadot-mainnet pnpm --dir packages/web dev
```

This override changes only the SS58 Native query and transaction path. Production ignores it.

The generated site is written to:

```text
packages/web/dist
```

## Staging deployment

Create and configure the staging environment file:

```bash
cp .env.example .env.staging
```

Load the environment:

```bash
set -a
source .env.staging
set +a
```

Install frontend dependencies, then deploy to Polkadot Hub TestNet:

```bash
pnpm --dir packages/web install --frozen-lockfile
pnpm deploy:staging
```

To finalize an existing deployment without broadcasting another contract:

```bash
pnpm finalize:staging
```

The deployment updates:

```text
deployments/staging.json
```

## Production deployment

Create and review the production environment file:

```bash
cp .env.example .env.production
```

Load the environment:

```bash
set -a
source .env.production
set +a
```

Run all checks before deployment:

```bash
make check
pnpm --dir packages/web test
```

Deploy the contract and generate the production frontend:

```bash
pnpm deploy:production
```

To finalize an existing deployment:

```bash
pnpm finalize:production
```

Phase II uses independent deployment tooling and never modifies the Phase I
deployment:

```bash
pnpm deploy:phase2:staging
pnpm finalize:phase2:staging
pnpm deploy:phase2:production
pnpm finalize:phase2:production
```

The deployment updates:

```text
deployments/production.json
```

Production deployment must be performed from a controlled local environment. Do not store deployment private keys in GitHub Actions.

## GitHub Pages

The **deploy production pages** workflow publishes the production frontend manually.

Before running it:

1. Complete the production contract deployment.
2. Commit the updated `deployments/production.json`.
3. Open **Actions → deploy production pages → Run workflow**.
4. Enter `DEPLOY_PRODUCTION` when prompted.

The Pages workflow validates the production manifest and deployed contract before publishing. It does not deploy the contract.

## Local contribution call

```bash
cast send "$MINI_GENESIS_STREAM_ADDRESS" \
  "contribute()" \
  --value 1ether \
  --private-key "$CONTRIBUTOR_PRIVATE_KEY" \
  --rpc-url "$RPC_URL"
```

## Documentation

* [Accounting](docs/ACCOUNTING.md)
* [Build](docs/BUILD.md)
* [Security](docs/SECURITY.md)
* [TestNet checklist](docs/TESTNET_CHECKLIST.md)
* [Mainnet checklist](docs/MAINNET_CHECKLIST.md)
* [Genesis phases](docs/GENESIS_PHASES.md)
* [Phase II economics](docs/PHASE2_ECONOMICS.md)
* [Phase II accounting](docs/PHASE2_ACCOUNTING.md)
* [Phase II security](docs/PHASE2_SECURITY.md)
* [Phase II mainnet checklist](docs/PHASE2_MAINNET_CHECKLIST.md)
* [Phase II staging report](docs/PHASE2_STAGING_REPORT.md)
