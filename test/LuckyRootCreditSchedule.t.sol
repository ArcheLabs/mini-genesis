// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { MiniGenesisStream } from "../src/MiniGenesisStream.sol";

contract LuckyRootCreditScheduleTest is Test {
    function testScheduleSumsExactlyAndIsMonotonic() public {
        MiniGenesisStream stream = _deploy(101, 7);
        uint256 sum;
        uint256 previous;
        for (uint256 i; i < 7; ++i) {
            uint256 cumulative = stream.cumulativeLuckyRootCredit(i + 1);
            assertGe(cumulative, previous);
            assertEq(stream.luckyRootCreditForElapsedBlock(i), cumulative - previous);
            sum += stream.luckyRootCreditForElapsedBlock(i);
            previous = cumulative;
        }
        assertEq(sum, 101);
        assertEq(stream.cumulativeLuckyRootCredit(8), 101);
        assertEq(stream.luckyRootCreditForElapsedBlock(7), 0);
    }

    function testTinyAllocationMayHaveZeroBaseBlocksButStillSumsExactly() public {
        MiniGenesisStream stream = _deploy(2, 7);
        uint256 sum;
        for (uint256 i; i < 7; ++i) {
            sum += stream.luckyRootCreditForElapsedBlock(i);
        }
        assertEq(stream.luckyRootCreditForElapsedBlock(0), 0);
        assertEq(stream.luckyRootCreditForElapsedBlock(6), 1);
        assertEq(sum, 2);
    }

    function testFuzzSchedule(uint128 rawAllocation, uint32 rawBlocks) public {
        uint256 allocation = bound(uint256(rawAllocation), 1, 1e30);
        uint256 blocks_ = bound(uint256(rawBlocks), 1, 1_000);
        MiniGenesisStream stream = _deploy(allocation, blocks_);
        uint256 sum;
        for (uint256 i; i < blocks_; ++i) {
            sum += stream.luckyRootCreditForElapsedBlock(i);
        }
        assertEq(sum, allocation);
    }

    function _deploy(uint256 luckyAllocation, uint256 blocks_)
        internal
        returns (MiniGenesisStream)
    {
        return new MiniGenesisStream(address(1), 1e24, luckyAllocation, blocks_, 1, 2, 1);
    }
}
