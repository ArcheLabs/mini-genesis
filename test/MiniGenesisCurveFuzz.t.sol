// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { MiniGenesisCurve } from "../src/MiniGenesisCurve.sol";

contract MiniGenesisCurveFuzzTest is Test {
    uint256 internal constant ALLOCATION = 2_000_000 ether;
    uint256 internal constant START_PRICE = 750_000_000_000_000;
    uint256 internal constant END_PRICE = 1_250_000_000_000_000;
    uint64 internal constant START = 1_000_000;
    uint64 internal constant END = START + 7 days;
    address internal treasury = makeAddr("treasury");
    address internal alice = makeAddr("alice");

    function testFuzzPriceAndCostAreMonotone(uint256 soldA, uint256 soldB) public {
        MiniGenesisCurve curve =
            new MiniGenesisCurve(treasury, ALLOCATION, START_PRICE, END_PRICE, START, END);
        soldA %= ALLOCATION + 1;
        soldB %= ALLOCATION + 1;
        if (soldA > soldB) (soldA, soldB) = (soldB, soldA);
        assertLe(curve.priceAt(soldA), curve.priceAt(soldB));
        assertLe(curve.cumulativeCost(soldA), curve.cumulativeCost(soldB));
    }

    function testFuzzSplitPurchasesTelescope(uint256 first, uint256 second) public {
        first = bound(first, 1 ether, 1_000_000 ether);
        second = bound(second, 1 ether, ALLOCATION - first);
        MiniGenesisCurve combined =
            new MiniGenesisCurve(treasury, ALLOCATION, START_PRICE, END_PRICE, START, END);
        MiniGenesisCurve split =
            new MiniGenesisCurve(treasury, ALLOCATION, START_PRICE, END_PRICE, START, END);
        vm.warp(START);
        vm.deal(alice, 10_000 ether);

        uint256 total = combined.quoteBuy(first + second);
        vm.prank(alice);
        combined.buyExactMini{ value: total }(first + second, total);

        uint256 firstCost = split.quoteBuy(first);
        vm.prank(alice);
        split.buyExactMini{ value: firstCost }(first, firstCost);
        uint256 secondCost = split.quoteBuy(second);
        vm.prank(alice);
        split.buyExactMini{ value: secondCost }(second, secondCost);

        assertEq(firstCost + secondCost, total);
        assertEq(split.totalRaisedDot(), combined.totalRaisedDot());
        assertEq(split.totalSoldMini(), combined.totalSoldMini());
    }
}
