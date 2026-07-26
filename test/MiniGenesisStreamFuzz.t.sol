// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";

import { MiniGenesisStream } from "../src/MiniGenesisStream.sol";

contract MiniGenesisStreamFuzzTest is Test {
    address internal treasury = makeAddr("treasury");
    address internal activator = makeAddr("activator");
    address internal alice = makeAddr("alice");

    function testFuzzCumulativeEmissionIsExactAndMonotonic(
        uint128 allocation,
        uint16 contributionBlocks,
        uint16 protectionBlocks
    ) public {
        allocation = uint128(bound(allocation, 1, type(uint128).max));
        contributionBlocks = uint16(bound(contributionBlocks, 1, 10_000));
        protectionBlocks = uint16(bound(protectionBlocks, 1, 10_000));
        MiniGenesisStream stream = new MiniGenesisStream(
            treasury, activator, allocation, contributionBlocks, protectionBlocks, 2, 1
        );
        vm.deal(alice, 2);
        vm.prank(alice);
        stream.contribute{ value: 2 }();

        uint256 start = stream.startBlock();
        uint256 total = uint256(contributionBlocks) + protectionBlocks;
        uint256 previous;
        for (uint256 k; k <= 32; ++k) {
            uint256 elapsed = total * k / 32;
            uint256 current = stream.cumulativeEmissionAt(start + elapsed);
            assertGe(current, previous);
            assertLe(current, allocation);
            previous = current;
        }
        assertEq(stream.cumulativeEmissionAt(start + total), allocation);
    }

    function testFuzzSingleContributorReceivesAllocation(uint96 amount) public {
        amount = uint96(bound(amount, 1 ether, 1_000_000 ether));
        MiniGenesisStream stream =
            new MiniGenesisStream(treasury, activator, 1e30, 100, 40, 1 ether, 0.1 ether);
        vm.deal(alice, amount);
        vm.prank(alice);
        stream.contribute{ value: amount }();
        vm.roll(stream.emissionEndBlock());
        assertApproxEqAbs(stream.pendingMini(alice), 1e30, 1);
    }
}
