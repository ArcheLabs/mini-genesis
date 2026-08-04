// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import { Script, console2 } from "forge-std/Script.sol";

import { MiniGenesisStream } from "../src/MiniGenesisStream.sol";

contract DeployMiniGenesisStream is Script {
    function run() external returns (MiniGenesisStream stream) {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address treasury = vm.envAddress("TREASURY");
        uint256 allocation = vm.envUint("GENESIS_ALLOCATION");
        uint256 contributionBlocks = vm.envUint("CONTRIBUTION_BLOCKS");
        uint256 protectionBlocks = vm.envUint("PROTECTION_BLOCKS");
        uint256 firstMinimum = vm.envUint("FIRST_CONTRIBUTION_MINIMUM");
        uint256 laterMinimum = vm.envUint("SUBSEQUENT_CONTRIBUTION_MINIMUM_EXCLUSIVE");
        uint256 expectedChainId = vm.envOr("EXPECTED_CHAIN_ID", block.chainid);

        require(block.chainid == expectedChainId, "unexpected chain id");

        console2.log("chain id", block.chainid);
        console2.log("treasury", treasury);
        console2.log("genesis allocation", allocation);
        console2.log("contribution blocks", contributionBlocks);
        console2.log("protection blocks", protectionBlocks);
        console2.log("total blocks", contributionBlocks + protectionBlocks);
        console2.log("first contribution minimum", firstMinimum);
        console2.log("later exclusive minimum", laterMinimum);
        console2.log(
            "protection ratio (x1e18)",
            protectionBlocks * 1e18 / (contributionBlocks + protectionBlocks)
        );
        console2.log(
            "theoretical curve multiple (x1e18)",
            (contributionBlocks + protectionBlocks) * 1e18 / protectionBlocks
        );
        vm.startBroadcast(privateKey);
        stream = new MiniGenesisStream(
            treasury,
            allocation,
            contributionBlocks,
            protectionBlocks,
            firstMinimum,
            laterMinimum
        );
        vm.stopBroadcast();

        require(stream.treasury() == treasury, "treasury verification");
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
