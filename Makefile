.PHONY: fmt fmt-check build test test-ci snapshot slither abi abi-check manifest-check check

fmt:
	forge fmt

fmt-check:
	forge fmt --check

build:
	forge build

test:
	forge test

test-ci:
	FOUNDRY_PROFILE=ci forge test

snapshot:
	forge snapshot

slither:
	slither src/MiniGenesisStream.sol --foundry-out-directory out \
		--filter-paths "lib"

abi:
	./packages/abi/export.sh

abi-check: abi
	git diff --exit-code -- packages/abi/MiniGenesisStream.json

manifest-check:
	node scripts/validate-deployment-manifests.mjs

check: fmt-check build test slither abi-check manifest-check
