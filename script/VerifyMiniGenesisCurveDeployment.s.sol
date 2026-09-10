// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import { Script, console2 } from "forge-std/Script.sol";
import { MiniGenesisCurve } from "../src/MiniGenesisCurve.sol";

/// @notice Read-only production gate for the fixed Genesis II economics.
contract VerifyMiniGenesisCurveDeployment is Script {
    uint256 internal constant EXPECTED_ALLOCATION = 2_000_000 ether;
    uint256 internal constant EXPECTED_START_PRICE = 750_000_000_000_000;
    uint256 internal constant EXPECTED_END_PRICE = 1_250_000_000_000_000;

    function run() external view {
        uint256 expectedChainId = vm.envUint("EXPECTED_CHAIN_ID");
        address curveAddress = vm.envAddress("MINI_GENESIS_CURVE_ADDRESS");
        MiniGenesisCurve curve = MiniGenesisCurve(payable(curveAddress));

        require(block.chainid == expectedChainId, "unexpected chain id");
        require(curve.treasury() == vm.envAddress("TREASURY"), "treasury mismatch");
        require(curve.allocation() == EXPECTED_ALLOCATION, "allocation mismatch");
        require(curve.startPrice() == EXPECTED_START_PRICE, "start price mismatch");
        require(curve.endPrice() == EXPECTED_END_PRICE, "end price mismatch");
        require(curve.endTime() > curve.startTime(), "invalid time range");

        console2.log("verified MiniGenesisCurve", curveAddress);
        console2.log("verified chain id", block.chainid);
        console2.log("verified full-sale proceeds", curve.cumulativeCost(curve.allocation()));
    }
}
