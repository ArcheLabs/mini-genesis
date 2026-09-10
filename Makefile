.PHONY: fmt fmt-check build test test-ci snapshot slither abi abi-check manifest-check manifest-test check

PHASE2_SOL_FILES = \
	src/MiniGenesisCurve.sol \
	test/MiniGenesisCurve.t.sol \
	test/MiniGenesisCurveFuzz.t.sol \
	test/MiniGenesisCurveInvariant.t.sol \
	test/helpers/CurveReferenceModel.sol \
	test/mocks/ReentrantCurveTreasury.sol \
	test/mocks/RejectingRefundBuyer.sol \
	test/mocks/RevertingCurveTreasury.sol \
	script/DeployMiniGenesisCurve.s.sol \
	script/VerifyMiniGenesisCurveDeployment.s.sol

fmt:
	forge fmt

# Phase I Solidity is historical and intentionally frozen. Formatting gates only
# the Phase II Solidity introduced by this release.
fmt-check:
	forge fmt --check $(PHASE2_SOL_FILES)

build:
	forge build

test:
	forge test

test-ci:
	FOUNDRY_PROFILE=ci forge test

snapshot:
	forge snapshot

slither:
	# Phase I is immutable historical code. Its reviewed startBlock == 0 state
	# sentinel triggers Slither's incorrect-equality detector; exclude only that
	# detector for Phase I rather than rewriting historical source.
	slither src/MiniGenesisStream.sol --foundry-out-directory out \
		--filter-paths "lib" --exclude incorrect-equality
	# Phase II receives the full detector set.
	slither src/MiniGenesisCurve.sol --foundry-out-directory out \
		--filter-paths "lib"

abi:
	./packages/abi/export.sh

abi-check: abi
	git diff --exit-code -- packages/abi/MiniGenesisStream.json packages/abi/MiniGenesisCurve.json

manifest-check:
	node scripts/validate-deployment-manifests.mjs

manifest-test:
	node scripts/test-deployment-manifests.mjs

check: fmt-check build test slither abi-check manifest-check manifest-test
