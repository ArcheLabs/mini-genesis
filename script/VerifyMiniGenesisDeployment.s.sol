// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import { Script, console2 } from "forge-std/Script.sol";
import { MiniGenesisStream } from "../src/MiniGenesisStream.sol";

/// @notice Read-only deployment verification. This script never broadcasts.
contract VerifyMiniGenesisDeployment is Script {
    function run() external view {
        uint256 expectedChainId = vm.envUint("EXPECTED_CHAIN_ID");
        bytes32 expectedGenesisHash = vm.envBytes32("EXPECTED_GENESIS_HASH");
        address streamAddress = vm.envAddress("MINI_GENESIS_STREAM_ADDRESS");
        MiniGenesisStream stream = MiniGenesisStream(streamAddress);

        require(block.chainid == expectedChainId, "unexpected chain id");
        require(stream.treasury() == vm.envAddress("TREASURY"), "treasury mismatch");
        require(
            stream.genesisAllocation() == vm.envUint("GENESIS_ALLOCATION"), "allocation mismatch"
        );
        require(
            stream.contributionBlocks() == vm.envUint("CONTRIBUTION_BLOCKS"),
            "contribution blocks mismatch"
        );
        require(
            stream.protectionBlocks() == vm.envUint("PROTECTION_BLOCKS"),
            "protection blocks mismatch"
        );
        require(
            stream.firstContributionMinimum() == vm.envUint("FIRST_CONTRIBUTION_MINIMUM"),
            "first minimum mismatch"
        );
        require(
            stream.subsequentContributionMinimumExclusive()
                == vm.envUint("SUBSEQUENT_CONTRIBUTION_MINIMUM_EXCLUSIVE"),
            "subsequent minimum mismatch"
        );
        console2.log("verified MiniGenesisStream", streamAddress);
        console2.log("verified chain id", block.chainid);
        console2.logBytes32(expectedGenesisHash);
    }
}
