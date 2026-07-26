// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";

import { MiniGenesisStream } from "../src/MiniGenesisStream.sol";
import { IMiniGenesisStream } from "../src/interfaces/IMiniGenesisStream.sol";
import { MockMiniToken } from "./mocks/MockMiniToken.sol";
import { ReentrantTreasury } from "./mocks/ReentrantTreasury.sol";
import { RevertingTreasury } from "./mocks/RevertingTreasury.sol";

contract MiniGenesisStreamTest is Test {
    uint256 internal constant ALLOCATION = 1_400_000 ether;
    uint256 internal constant CONTRIBUTION_BLOCKS = 10;
    uint256 internal constant PROTECTION_BLOCKS = 4;
    uint256 internal constant FIRST_MINIMUM = 1 ether;
    uint256 internal constant LATER_MINIMUM = 0.1 ether;

    address internal treasury = makeAddr("treasury");
    address internal activator = makeAddr("activator");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    MiniGenesisStream internal stream;

    function setUp() public {
        stream = _deploy(treasury);
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
    }

    function testInitialConfigurationAndWaitingPhase() public view {
        assertEq(stream.treasury(), treasury);
        assertEq(stream.claimActivator(), activator);
        assertEq(stream.totalEmissionBlocks(), 14);
        assertEq(uint256(stream.phase()), uint256(IMiniGenesisStream.Phase.Waiting));
        assertFalse(stream.started());
    }

    function testConstructorValidation() public {
        vm.expectRevert(IMiniGenesisStream.ZeroAddress.selector);
        new MiniGenesisStream(
            address(0), activator, ALLOCATION, 10, 4, FIRST_MINIMUM, LATER_MINIMUM
        );
        vm.expectRevert(IMiniGenesisStream.InvalidConfiguration.selector);
        new MiniGenesisStream(treasury, activator, 0, 10, 4, FIRST_MINIMUM, LATER_MINIMUM);
        vm.expectRevert(IMiniGenesisStream.InvalidConfiguration.selector);
        new MiniGenesisStream(treasury, activator, ALLOCATION, 10, 4, 1, 1);
    }

    function testFirstContributionMinimumAndStart() public {
        vm.prank(alice);
        vm.expectRevert(IMiniGenesisStream.FirstContributionTooSmall.selector);
        stream.contribute{ value: FIRST_MINIMUM - 1 }();

        uint256 treasuryBefore = treasury.balance;
        vm.expectEmit(true, true, false, true);
        emit IMiniGenesisStream.GenesisStarted(
            block.number, block.number + 10, block.number + 14, alice, FIRST_MINIMUM
        );
        vm.expectEmit(true, false, false, true);
        emit IMiniGenesisStream.Contributed(alice, FIRST_MINIMUM, FIRST_MINIMUM, FIRST_MINIMUM);
        vm.prank(alice);
        stream.contribute{ value: FIRST_MINIMUM }();

        assertEq(stream.startBlock(), block.number);
        assertEq(stream.contributionEndBlock(), block.number + 10);
        assertEq(stream.emissionEndBlock(), block.number + 14);
        assertEq(stream.lastSettledBlock(), block.number);
        assertEq(stream.totalRaisedDot(), FIRST_MINIMUM);
        assertEq(stream.contributorCount(), 1);
        assertEq(treasury.balance - treasuryBefore, FIRST_MINIMUM);
        assertEq(address(stream).balance, 0);
    }

    function testLaterContributionIsStrictAndCountsUniqueUsers() public {
        _contribute(alice, FIRST_MINIMUM);
        vm.prank(bob);
        vm.expectRevert(IMiniGenesisStream.ContributionTooSmall.selector);
        stream.contribute{ value: LATER_MINIMUM }();

        _contribute(bob, LATER_MINIMUM + 1);
        _contribute(bob, 1 ether);
        assertEq(stream.contributorCount(), 2);
        assertEq(stream.userInfo(bob).contributedDot, LATER_MINIMUM + 1 + 1 ether);
    }

    function testContributionEndBlockIsExclusive() public {
        _contribute(alice, FIRST_MINIMUM);
        vm.roll(stream.contributionEndBlock());
        vm.prank(bob);
        vm.expectRevert(IMiniGenesisStream.ContributionClosed.selector);
        stream.contribute{ value: 1 ether }();
    }

    function testSameBlockContributorsShareFirstBlock() public {
        _contribute(alice, 10 ether);
        _contribute(bob, 30 ether);
        assertEq(stream.pendingMini(alice), 0);
        assertEq(stream.pendingMini(bob), 0);

        vm.roll(block.number + 1);
        uint256 firstBlockEmission = ALLOCATION / 14;
        assertEq(stream.pendingMini(alice), firstBlockEmission / 4);
        assertEq(stream.pendingMini(bob), firstBlockEmission * 3 / 4);
    }

    function testEmptyBlocksAreSettledInOneUpdate() public {
        _contribute(alice, 1 ether);
        uint256 start = stream.startBlock();
        vm.roll(start + 7);
        _contribute(bob, 1 ether);

        assertEq(stream.lastSettledBlock(), start + 7);
        assertEq(stream.pendingMini(alice), ALLOCATION / 2);
        assertEq(stream.pendingMini(bob), 0);
    }

    function testEmissionViewsAndProtectionPrice() public {
        _contribute(alice, 10 ether);
        uint256 start = stream.startBlock();
        assertEq(stream.cumulativeEmissionAt(start), 0);
        assertEq(stream.protectionEmissionMini(), ALLOCATION * 4 / 14);
        vm.roll(start + 14);
        assertEq(stream.emittedMini(), ALLOCATION);
        assertEq(stream.remainingMini(), 0);
        assertEq(stream.curveStartPriceX18(), 10 ether * 1e18 / (ALLOCATION * 4 / 14));
    }

    function testTreasuryFailureRollsBackAllState() public {
        MiniGenesisStream broken = _deploy(address(new RevertingTreasury()));
        vm.prank(alice);
        vm.expectRevert(IMiniGenesisStream.TreasuryTransferFailed.selector);
        broken.contribute{ value: 1 ether }();
        assertFalse(broken.started());
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

    function testFinalizeIsPermissionlessAndSingleUse() public {
        _contribute(alice, 1 ether);
        vm.expectRevert(IMiniGenesisStream.EmissionNotEnded.selector);
        stream.finalize();
        vm.roll(stream.emissionEndBlock());
        stream.finalize();
        assertTrue(stream.finalized());
        assertEq(stream.lastSettledBlock(), stream.emissionEndBlock());
        vm.expectRevert(IMiniGenesisStream.AlreadyFinalized.selector);
        stream.finalize();
    }

    function testActivateAndClaim() public {
        _contribute(alice, 1 ether);
        vm.roll(stream.emissionEndBlock());
        uint256 expected = stream.pendingMini(alice);
        MockMiniToken token = new MockMiniToken();

        vm.prank(alice);
        vm.expectRevert(IMiniGenesisStream.Unauthorized.selector);
        stream.activateClaims(address(token));

        token.mint(address(stream), ALLOCATION - 1);
        vm.prank(activator);
        vm.expectRevert(IMiniGenesisStream.InsufficientMiniFunding.selector);
        stream.activateClaims(address(token));
        token.mint(address(stream), 1);

        vm.prank(activator);
        stream.activateClaims(address(token));
        assertTrue(stream.finalized());
        assertTrue(stream.claimsEnabled());
        assertEq(uint256(stream.phase()), uint256(IMiniGenesisStream.Phase.Claims));

        vm.prank(alice);
        stream.claim();
        assertEq(token.balanceOf(alice), expected);
        assertEq(stream.totalClaimedMini(), expected);
        assertEq(stream.userInfo(alice).claimedMini, expected);
        vm.prank(alice);
        vm.expectRevert(IMiniGenesisStream.NothingToClaim.selector);
        stream.claim();
    }

    function testCannotActivateBeforeEndOrTwice() public {
        _contribute(alice, 1 ether);
        MockMiniToken token = new MockMiniToken();
        token.mint(address(stream), ALLOCATION);
        vm.prank(activator);
        vm.expectRevert(IMiniGenesisStream.EmissionNotEnded.selector);
        stream.activateClaims(address(token));

        vm.roll(stream.emissionEndBlock());
        vm.prank(activator);
        stream.activateClaims(address(token));
        vm.prank(activator);
        vm.expectRevert(IMiniGenesisStream.ClaimsAlreadyEnabled.selector);
        stream.activateClaims(address(token));
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
        return new MiniGenesisStream(
            treasury_,
            activator,
            ALLOCATION,
            CONTRIBUTION_BLOCKS,
            PROTECTION_BLOCKS,
            FIRST_MINIMUM,
            LATER_MINIMUM
        );
    }

    function _contribute(address account, uint256 amount) internal {
        vm.prank(account);
        stream.contribute{ value: amount }();
    }
}
