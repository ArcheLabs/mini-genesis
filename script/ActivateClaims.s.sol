// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import { Script, console2 } from "forge-std/Script.sol";

import { IMiniGenesisStream } from "../src/interfaces/IMiniGenesisStream.sol";

contract ActivateClaims is Script {
    function run() external {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address streamAddress = vm.envAddress("GENESIS_STREAM");
        address miniToken = vm.envAddress("MINI_TOKEN");

        console2.log("chain id", block.chainid);
        console2.log("genesis stream", streamAddress);
        console2.log("MINI token", miniToken);

        vm.startBroadcast(privateKey);
        IMiniGenesisStream(streamAddress).activateClaims(miniToken);
        vm.stopBroadcast();
    }
}
