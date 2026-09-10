// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { MiniGenesisCurve } from "../src/MiniGenesisCurve.sol";
import { CurveReferenceModel } from "./helpers/CurveReferenceModel.sol";
import { ReentrantCurveTreasury } from "./mocks/ReentrantCurveTreasury.sol";
import { RejectingRefundBuyer } from "./mocks/RejectingRefundBuyer.sol";
import { RevertingCurveTreasury } from "./mocks/RevertingCurveTreasury.sol";

contract MiniGenesisCurveTest is Test {
    uint256 internal constant ALLOCATION = 2_000_000 ether;
    uint256 internal constant START_PRICE = 750_000_000_000_000;
    uint256 internal constant END_PRICE = 1_250_000_000_000_000;
    uint64 internal constant START = 1_000_000;
    uint64 internal constant END = START + 7 days;

    address internal treasury = makeAddr("curve treasury");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    MiniGenesisCurve internal curve;

    function setUp() public {
        curve = new MiniGenesisCurve(treasury, ALLOCATION, START_PRICE, END_PRICE, START, END);
        vm.deal(alice, 10_000 ether);
        vm.deal(bob, 10_000 ether);
        vm.warp(START);
    }

    function testConfigurationAndWaitingPhase() public {
        MiniGenesisCurve waiting =
            new MiniGenesisCurve(treasury, ALLOCATION, START_PRICE, END_PRICE, START, END);
        assertEq(waiting.treasury(), treasury);
        assertEq(waiting.allocation(), ALLOCATION);
        assertEq(waiting.startPrice(), START_PRICE);
        assertEq(waiting.endPrice(), END_PRICE);
        assertEq(waiting.startTime(), START);
        assertEq(waiting.endTime(), END);
        vm.warp(START - 1);
        assertEq(uint256(waiting.phase()), uint256(MiniGenesisCurve.Phase.Waiting));
    }

    function testConstructorValidation() public {
        vm.expectRevert(MiniGenesisCurve.ZeroAddress.selector);
        new MiniGenesisCurve(address(0), ALLOCATION, START_PRICE, END_PRICE, START, END);
        vm.expectRevert(MiniGenesisCurve.InvalidConfiguration.selector);
        new MiniGenesisCurve(treasury, 0, START_PRICE, END_PRICE, START, END);
        vm.expectRevert(MiniGenesisCurve.InvalidConfiguration.selector);
        new MiniGenesisCurve(treasury, ALLOCATION, 0, END_PRICE, START, END);
        vm.expectRevert(MiniGenesisCurve.InvalidConfiguration.selector);
        new MiniGenesisCurve(treasury, ALLOCATION, END_PRICE, START_PRICE, START, END);
        vm.expectRevert(MiniGenesisCurve.InvalidConfiguration.selector);
        new MiniGenesisCurve(treasury, ALLOCATION, START_PRICE, END_PRICE, 0, END);
        vm.expectRevert(MiniGenesisCurve.InvalidConfiguration.selector);
        new MiniGenesisCurve(treasury, ALLOCATION, START_PRICE, END_PRICE, END, START);
        vm.expectRevert(MiniGenesisCurve.InvalidConfiguration.selector);
        new MiniGenesisCurve(treasury, type(uint256).max, START_PRICE, END_PRICE, START, END);
    }

    function testCheckpointPricesAndCumulativeCosts() public view {
        uint256[5] memory sold =
            [uint256(0), 500_000 ether, 1_000_000 ether, 1_500_000 ether, ALLOCATION];
        uint256[5] memory prices = [
            uint256(750_000_000_000_000),
            875_000_000_000_000,
            1_000_000_000_000_000,
            1_125_000_000_000_000,
            1_250_000_000_000_000
        ];
        uint256[5] memory costs = [uint256(0), 406.25 ether, 875 ether, 1_406.25 ether, 2_000 ether];
        for (uint256 i; i < sold.length; ++i) {
            assertEq(curve.priceAt(sold[i]), prices[i]);
            assertEq(curve.spotPrice(), prices[0]);
            assertEq(curve.cumulativeCost(sold[i]), costs[i]);
            assertEq(
                curve.priceAt(sold[i]),
                CurveReferenceModel.priceAt(START_PRICE, END_PRICE, ALLOCATION, sold[i])
            );
            assertEq(
                curve.cumulativeCost(sold[i]),
                CurveReferenceModel.cumulativeCost(START_PRICE, END_PRICE, ALLOCATION, sold[i])
            );
        }
    }

    function testPhaseBoundariesAndSoldOut() public {
        vm.warp(START - 1);
        assertEq(uint256(curve.phase()), uint256(MiniGenesisCurve.Phase.Waiting));
        vm.warp(START);
        assertEq(uint256(curve.phase()), uint256(MiniGenesisCurve.Phase.Active));
        vm.warp(END);
        assertEq(uint256(curve.phase()), uint256(MiniGenesisCurve.Phase.Ended));

        MiniGenesisCurve sold =
            new MiniGenesisCurve(treasury, 1 ether, START_PRICE, END_PRICE, START, END);
        vm.warp(START);
        vm.prank(alice);
        sold.buyExactMini{ value: 0.001 ether }(1 ether, type(uint256).max);
        assertTrue(sold.soldOut());
        assertEq(uint256(sold.phase()), uint256(MiniGenesisCurve.Phase.Ended));
    }

    function testPurchaseForwardsExactCostRefundsExcessAndCountsUniqueBuyers() public {
        uint256 amount = 500_000 ether;
        uint256 cost = curve.quoteBuy(amount);
        uint256 before = alice.balance;
        vm.prank(alice);
        curve.buyExactMini{ value: cost + 1 ether }(amount, cost);
        assertEq(alice.balance, before - cost);
        assertEq(treasury.balance, cost);
        assertEq(address(curve).balance, 0);
        assertEq(curve.totalSoldMini(), amount);
        assertEq(curve.totalRaisedDot(), cost);
        assertEq(curve.purchasedMini(alice), amount);
        assertEq(curve.buyerCount(), 1);

        uint256 second = 100 ether;
        uint256 secondCost = curve.quoteBuy(second);
        vm.prank(alice);
        curve.buyExactMini{ value: secondCost }(second, secondCost);
        vm.prank(bob);
        curve.buyExactMini{ value: curve.quoteBuy(1 ether) }(1 ether, type(uint256).max);
        assertEq(curve.buyerCount(), 2);
        assertEq(curve.purchasedMini(alice), amount + second);
        assertEq(curve.totalRaisedDot(), curve.cumulativeCost(curve.totalSoldMini()));
    }

    function testZeroCostDustPurchaseCannotCreateCreditOrBuyer() public {
        uint256 dust = 1;
        assertEq(curve.quoteBuy(dust), 0);

        vm.prank(alice);
        vm.expectRevert(MiniGenesisCurve.InsufficientPayment.selector);
        curve.buyExactMini{ value: 0 }(dust, 0);

        assertEq(curve.totalSoldMini(), 0);
        assertEq(curve.totalRaisedDot(), 0);
        assertEq(curve.purchasedMini(alice), 0);
        assertEq(curve.buyerCount(), 0);
        assertEq(treasury.balance, 0);
    }

    function testSlippageAndCapRevertAtomically() public {
        uint256 beforeBalance = alice.balance;
        vm.prank(alice);
        vm.expectRevert(MiniGenesisCurve.SlippageExceeded.selector);
        curve.buyExactMini{ value: 407 ether }(500_000 ether, 400 ether);
        assertEq(alice.balance, beforeBalance);
        assertEq(curve.totalSoldMini(), 0);
        assertEq(curve.totalRaisedDot(), 0);

        vm.prank(alice);
        vm.expectRevert(MiniGenesisCurve.AllocationExceeded.selector);
        curve.buyExactMini{ value: 2_001 ether }(ALLOCATION + 1, type(uint256).max);
    }

    function testTreasuryRevertRollsBackAllState() public {
        RevertingCurveTreasury broken = new RevertingCurveTreasury();
        MiniGenesisCurve brokenCurve =
            new MiniGenesisCurve(address(broken), ALLOCATION, START_PRICE, END_PRICE, START, END);
        uint256 cost = brokenCurve.quoteBuy(1 ether);
        vm.prank(alice);
        vm.expectRevert(MiniGenesisCurve.TreasuryTransferFailed.selector);
        brokenCurve.buyExactMini{ value: cost }(1 ether, cost);
        assertEq(brokenCurve.totalSoldMini(), 0);
        assertEq(brokenCurve.totalRaisedDot(), 0);
        assertEq(brokenCurve.buyerCount(), 0);
        assertEq(brokenCurve.purchasedMini(alice), 0);
    }

    function testTreasuryCannotReenter() public {
        ReentrantCurveTreasury reentrant = new ReentrantCurveTreasury();
        MiniGenesisCurve guarded =
            new MiniGenesisCurve(address(reentrant), ALLOCATION, START_PRICE, END_PRICE, START, END);
        reentrant.setTarget(address(guarded));
        uint256 cost = guarded.quoteBuy(1 ether);
        vm.prank(alice);
        guarded.buyExactMini{ value: cost }(1 ether, cost);
        assertTrue(reentrant.attempted());
        assertFalse(reentrant.succeeded());
        assertEq(guarded.totalSoldMini(), 1 ether);
    }

    function testRefundReceiverRevertRollsBackState() public {
        RejectingRefundBuyer buyer = new RejectingRefundBuyer();
        vm.deal(address(buyer), 10 ether);
        uint256 amount = 1 ether;
        uint256 cost = curve.quoteBuy(amount);
        vm.expectRevert(MiniGenesisCurve.RefundFailed.selector);
        buyer.buy{ value: cost + 1 }(address(curve), amount, cost);
        assertEq(curve.totalSoldMini(), 0);
        assertEq(curve.totalRaisedDot(), 0);
        assertEq(treasury.balance, 0);
    }

    function testContractBuyerCanPurchaseExactValue() public {
        RejectingRefundBuyer buyer = new RejectingRefundBuyer();
        vm.deal(address(buyer), 10 ether);
        uint256 cost = curve.quoteBuy(1 ether);
        buyer.buy{ value: cost }(address(curve), 1 ether, cost);
        assertEq(curve.purchasedMini(address(buyer)), 1 ether);
    }

    function testEndTimeAlwaysRejectsPurchase() public {
        vm.warp(END);
        vm.prank(alice);
        vm.expectRevert(MiniGenesisCurve.NotActive.selector);
        curve.buyExactMini{ value: 1 ether }(1 ether, type(uint256).max);
    }

    function testFullSaleCostsExactlyTwoThousandDot() public {
        uint256 cost = curve.quoteBuy(ALLOCATION);
        assertEq(cost, 2_000 ether);
        vm.prank(alice);
        curve.buyExactMini{ value: cost }(ALLOCATION, cost);
        assertEq(curve.totalSoldMini(), ALLOCATION);
        assertEq(curve.totalRaisedDot(), 2_000 ether);
        assertEq(curve.remainingMini(), 0);
    }
}
