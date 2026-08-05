# MINI Genesis

MINI Genesis is the fair-launch application for MINI.

Users contribute DOT and accumulate MINI through block-by-block distribution. The repository contains:

* the `MiniGenesisStream` contract;
* deployment and manifest tooling;
* the standalone Genesis frontend;
* staging and production release workflows.

## Requirements

For local frontend wallet connections, copy `packages/web/.env.example` to `packages/web/.env.local` and set `VITE_REOWN_PROJECT_ID`. The local file is ignored by Git.

```env
VITE_REOWN_PROJECT_ID=replace-with-reown-project-id
```

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
