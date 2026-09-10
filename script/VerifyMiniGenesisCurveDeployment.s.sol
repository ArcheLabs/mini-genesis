// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import { Script, console2 } from "forge-std/Script.sol";

import { MiniGenesisCurve } from "../src/MiniGenesisCurve.sol";

/// @notice Read-only production gate for the fixed Genesis II economics.
contract VerifyMiniGenesisCurveDeployment is Script {
    uint256 internal constant EXPECTED_ALLOCATION = 2_000_000 ether;
    uint256 internal constant EXPECTED_START_PRICE = 750_000_000_000_000;
    uint256 internal constant EXPECTED_END_PRICE = 1_250_000_000_000_000;
    uint256 internal constant EXPECTED_FULL_SALE_PROCEEDS = 2_000 ether;
    uint64 internal constant EXPECTED_DURATION = 7 days;

    function run() external view {
        uint256 expectedChainId = vm.envUint("EXPECTED_CHAIN_ID");
        address curveAddress = vm.envAddress("MINI_GENESIS_CURVE_ADDRESS");
        uint256 expectedStart = vm.envUint("PHASE2_START_TIMESTAMP");
        uint256 expectedEnd = vm.envUint("PHASE2_END_TIMESTAMP");
        require(expectedStart <= type(uint64).max, "expected start exceeds uint64");
        require(expectedEnd <= type(uint64).max, "expected end exceeds uint64");

        MiniGenesisCurve curve = MiniGenesisCurve(payable(curveAddress));

        require(block.chainid == expectedChainId, "unexpected chain id");
        require(curve.treasury() == vm.envAddress("TREASURY"), "treasury mismatch");
        require(curve.allocation() == EXPECTED_ALLOCATION, "allocation mismatch");
        require(curve.startPrice() == EXPECTED_START_PRICE, "start price mismatch");
        require(curve.endPrice() == EXPECTED_END_PRICE, "end price mismatch");
        require(curve.startTime() == uint64(expectedStart), "start timestamp mismatch");
        require(curve.endTime() == uint64(expectedEnd), "end timestamp mismatch");
        require(curve.endTime() > curve.startTime(), "invalid time range");
        require(curve.endTime() - curve.startTime() == EXPECTED_DURATION, "duration mismatch");
        require(
            curve.cumulativeCost(curve.allocation()) == EXPECTED_FULL_SALE_PROCEEDS,
            "full-sale proceeds mismatch"
        );

        console2.log("verified MiniGenesisCurve", curveAddress);
        console2.log("verified chain id", block.chainid);
        console2.log("verified start timestamp", curve.startTime());
        console2.log("verified end timestamp", curve.endTime());
        console2.log("verified duration", curve.endTime() - curve.startTime());
        console2.log("verified full-sale proceeds", curve.cumulativeCost(curve.allocation()));
    }
}
