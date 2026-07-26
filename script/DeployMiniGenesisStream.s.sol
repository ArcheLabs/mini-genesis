// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import { Script, console2 } from "forge-std/Script.sol";

import { MiniGenesisStream } from "../src/MiniGenesisStream.sol";

contract DeployMiniGenesisStream is Script {
    function run() external returns (MiniGenesisStream stream) {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address treasury = vm.envAddress("TREASURY");
        address claimActivator = vm.envAddress("CLAIM_ACTIVATOR");
        uint256 allocation = vm.envUint("GENESIS_ALLOCATION");
        uint256 contributionBlocks = vm.envUint("CONTRIBUTION_BLOCKS");
        uint256 protectionBlocks = vm.envUint("PROTECTION_BLOCKS");
        uint256 firstMinimum = vm.envUint("FIRST_CONTRIBUTION_MINIMUM");
        uint256 laterMinimum = vm.envUint("SUBSEQUENT_CONTRIBUTION_MINIMUM_EXCLUSIVE");
        uint256 expectedBlockTime = vm.envOr("EXPECTED_BLOCK_TIME_SECONDS", uint256(0));

        console2.log("chain id", block.chainid);
        console2.log("treasury", treasury);
        console2.log("claim activator", claimActivator);
        console2.log("genesis allocation", allocation);
        console2.log("contribution blocks", contributionBlocks);
        console2.log("protection blocks", protectionBlocks);
        console2.log("total blocks", contributionBlocks + protectionBlocks);
        console2.log("first contribution minimum", firstMinimum);
        console2.log("later exclusive minimum", laterMinimum);
        if (expectedBlockTime != 0) {
            console2.log(
                "estimated duration (seconds)",
                (contributionBlocks + protectionBlocks) * expectedBlockTime
            );
        }

        vm.startBroadcast(privateKey);
        stream = new MiniGenesisStream(
            treasury,
            claimActivator,
            allocation,
            contributionBlocks,
            protectionBlocks,
            firstMinimum,
            laterMinimum
        );
        vm.stopBroadcast();

        require(stream.treasury() == treasury, "treasury verification");
        require(stream.claimActivator() == claimActivator, "activator verification");
        require(stream.genesisAllocation() == allocation, "allocation verification");
        require(stream.contributionBlocks() == contributionBlocks, "contribution verification");
        require(stream.protectionBlocks() == protectionBlocks, "protection verification");
        require(stream.firstContributionMinimum() == firstMinimum, "first min verification");
        require(
            stream.subsequentContributionMinimumExclusive() == laterMinimum,
            "later min verification"
        );
        console2.log("MiniGenesisStream", address(stream));
    }
}
