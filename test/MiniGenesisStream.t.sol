// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { MiniGenesisStream } from "../src/MiniGenesisStream.sol";
import { ReentrantTreasury } from "./mocks/ReentrantTreasury.sol";
import { RevertingTreasury } from "./mocks/RevertingTreasury.sol";

contract MiniGenesisStreamTest is Test {
    uint256 internal constant ALLOCATION = 1_400_000 ether;
    uint256 internal constant FIRST_MINIMUM = 1 ether;
    uint256 internal constant LATER_MINIMUM = 0.1 ether;
    address internal treasury = makeAddr("treasury");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    MiniGenesisStream internal stream;

    function setUp() public {
        stream = _deploy(treasury);
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
    }

    function testConfigurationAndWaitingPhase() public view {
        assertEq(stream.treasury(), treasury);
        assertEq(stream.genesisAllocation(), ALLOCATION);
        assertEq(stream.totalEmissionBlocks(), 14);
        assertEq(uint256(stream.phase()), uint256(MiniGenesisStream.Phase.Waiting));
    }

    function testConstructorValidation() public {
        vm.expectRevert(MiniGenesisStream.ZeroAddress.selector);
        new MiniGenesisStream(address(0), ALLOCATION, 10, 4, FIRST_MINIMUM, LATER_MINIMUM);
        vm.expectRevert(MiniGenesisStream.InvalidConfiguration.selector);
        new MiniGenesisStream(treasury, 0, 10, 4, FIRST_MINIMUM, LATER_MINIMUM);
        vm.expectRevert(MiniGenesisStream.InvalidConfiguration.selector);
        new MiniGenesisStream(treasury, ALLOCATION, 10, 4, 1, 1);
    }

    function testFirstContributionStartsAndForwardsDot() public {
        vm.prank(alice);
        vm.expectRevert(MiniGenesisStream.FirstContributionTooSmall.selector);
        stream.contribute{ value: FIRST_MINIMUM - 1 }();
        vm.expectEmit(true, true, false, true);
        emit MiniGenesisStream.GenesisStarted(
            block.number, block.number + 10, block.number + 14, alice, FIRST_MINIMUM
        );
        vm.expectEmit(true, false, false, true);
        emit MiniGenesisStream.Contributed(alice, FIRST_MINIMUM, FIRST_MINIMUM, FIRST_MINIMUM);
        vm.prank(alice);
        stream.contribute{ value: FIRST_MINIMUM }();
        assertEq(stream.startBlock(), block.number);
        assertEq(stream.contributionEndBlock(), block.number + 10);
        assertEq(stream.emissionEndBlock(), block.number + 14);
        assertEq(stream.lastSettledBlock(), block.number);
        assertEq(stream.totalRaisedDot(), FIRST_MINIMUM);
        assertEq(stream.contributorCount(), 1);
        assertEq(treasury.balance, FIRST_MINIMUM);
        assertEq(address(stream).balance, 0);
    }

    function testLaterMinimumAndContributorCount() public {
        _contribute(alice, FIRST_MINIMUM);
        vm.prank(bob);
        vm.expectRevert(MiniGenesisStream.ContributionTooSmall.selector);
        stream.contribute{ value: LATER_MINIMUM }();
        _contribute(bob, LATER_MINIMUM + 1);
        _contribute(bob, 1 ether);
        assertEq(stream.contributorCount(), 2);
        assertEq(stream.userInfo(bob).contributedDot, LATER_MINIMUM + 1 + 1 ether);
    }

    function testContributionEndIsExclusiveAndPhasesAreDerived() public {
        _contribute(alice, FIRST_MINIMUM);
        vm.roll(stream.contributionEndBlock());
        assertEq(uint256(stream.phase()), uint256(MiniGenesisStream.Phase.Protection));
        vm.prank(bob);
        vm.expectRevert(MiniGenesisStream.ContributionClosed.selector);
        stream.contribute{ value: 1 ether }();
        vm.roll(stream.emissionEndBlock());
        assertEq(uint256(stream.phase()), uint256(MiniGenesisStream.Phase.Ended));
    }

    function testSameBlockContributorsShareFirstBlock() public {
        _contribute(alice, 10 ether);
        _contribute(bob, 30 ether);
        assertEq(stream.pendingMini(alice), 0);
        assertEq(stream.pendingMini(bob), 0);
        vm.roll(block.number + 1);
        uint256 emission = ALLOCATION / 14;
        assertEq(stream.pendingMini(alice), emission / 4);
        assertEq(stream.pendingMini(bob), emission * 3 / 4);
    }

    function testEmptyAndProtectionBlocksAccrueThroughView() public {
        _contribute(alice, 1 ether);
        uint256 start = stream.startBlock();
        vm.roll(start + 7);
        _contribute(bob, 1 ether);
        assertEq(stream.lastSettledBlock(), start + 7);
        assertEq(stream.pendingMini(alice), ALLOCATION / 2);
        assertEq(stream.pendingMini(bob), 0);
        vm.roll(stream.contributionEndBlock() + 2);
        uint256 duringProtection = stream.pendingMini(alice);
        vm.roll(stream.emissionEndBlock());
        assertGt(stream.pendingMini(alice), duringProtection);
        uint256 finalCredit = stream.pendingMini(alice);
        vm.roll(block.number + 1_000);
        assertEq(stream.pendingMini(alice), finalCredit);
        assertEq(stream.emittedMini(), ALLOCATION);
    }

    function testProtectionEmission() public {
        _contribute(alice, 10 ether);
        assertEq(stream.protectionEmissionMini(), ALLOCATION * 4 / 14);
    }

    function testTreasuryFailureRollsBackState() public {
        MiniGenesisStream broken = _deploy(address(new RevertingTreasury()));
        vm.prank(alice);
        vm.expectRevert(MiniGenesisStream.TreasuryTransferFailed.selector);
        broken.contribute{ value: 1 ether }();
        assertEq(broken.startBlock(), 0);
        assertEq(broken.totalRaisedDot(), 0);
    }

    function testTreasuryCannotReenter() public {
        ReentrantTreasury reentrant = new ReentrantTreasury();
        MiniGenesisStream guarded = _deploy(address(reentrant));
        reentrant.setTarget(address(guarded));
        vm.prank(alice);
        guarded.contribute{ value: 1 ether }();
        assertTrue(reentrant.attempted());
        assertEq(guarded.totalRaisedDot(), 1 ether);
    }

    function testDirectNativeTransferReverts() public {
        vm.prank(alice);
        (bool success,) = address(stream).call{ value: 1 ether }("");
        assertFalse(success);
    }

    function testGas_FirstContribution() public {
        _contribute(alice, FIRST_MINIMUM);
    }

    function testGas_NewAndExistingContributor() public {
        _contribute(alice, FIRST_MINIMUM);
        vm.roll(block.number + 1);
        _contribute(bob, 1 ether);
        vm.roll(block.number + 1);
        _contribute(bob, 1 ether);
    }

    function _deploy(address treasury_) internal returns (MiniGenesisStream) {
        return new MiniGenesisStream(treasury_, ALLOCATION, 10, 4, FIRST_MINIMUM, LATER_MINIMUM);
    }

    function _contribute(address account, uint256 amount) internal {
        vm.prank(account);
        stream.contribute{ value: amount }();
    }
}
