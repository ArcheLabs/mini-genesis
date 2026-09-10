// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import { Script, console2 } from "forge-std/Script.sol";
import { MiniGenesisCurve } from "../src/MiniGenesisCurve.sol";

/// @notice Deploys the independent Genesis II curve. This script never touches Phase I.
contract DeployMiniGenesisCurve is Script {
    function run() external returns (MiniGenesisCurve curve) {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address treasury = vm.envAddress("TREASURY");
        uint256 allocation = vm.envUint("PHASE2_ALLOCATION");
        uint256 startPrice = vm.envUint("PHASE2_START_PRICE_X18");
        uint256 endPrice = vm.envUint("PHASE2_END_PRICE_X18");
        uint256 startTimestamp = vm.envUint("PHASE2_START_TIMESTAMP");
        uint256 endTimestamp = vm.envUint("PHASE2_END_TIMESTAMP");
        uint256 expectedChainId = vm.envOr("EXPECTED_CHAIN_ID", block.chainid);

        require(block.chainid == expectedChainId, "unexpected chain id");
        require(startTimestamp <= type(uint64).max, "start timestamp exceeds uint64");
        require(endTimestamp <= type(uint64).max, "end timestamp exceeds uint64");

        console2.log("chain id", block.chainid);
        console2.log("treasury", treasury);
        console2.log("allocation", allocation);
        console2.log("start price x18", startPrice);
        console2.log("end price x18", endPrice);
        console2.log("start timestamp", startTimestamp);
        console2.log("end timestamp", endTimestamp);

        vm.startBroadcast(privateKey);
        curve = new MiniGenesisCurve(
            treasury, allocation, startPrice, endPrice, uint64(startTimestamp), uint64(endTimestamp)
        );
        vm.stopBroadcast();

        require(curve.treasury() == treasury, "treasury verification");
        require(curve.allocation() == allocation, "allocation verification");
        require(curve.startPrice() == startPrice, "start price verification");
        require(curve.endPrice() == endPrice, "end price verification");
        require(curve.startTime() == startTimestamp, "start timestamp verification");
        require(curve.endTime() == endTimestamp, "end timestamp verification");
        console2.log("MiniGenesisCurve", address(curve));
    }
}
