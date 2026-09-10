// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { MiniGenesisCurve } from "../src/MiniGenesisCurve.sol";

contract MiniGenesisCurveHandler is Test {
    MiniGenesisCurve internal immutable curve;
    address[] internal actors;
    uint256 public totalCredited;

    constructor(MiniGenesisCurve curve_) {
        curve = curve_;
        for (uint256 i; i < 4; ++i) {
            address actor = address(uint160(uint256(keccak256(abi.encode("curve actor", i)))));
            actors.push(actor);
            vm.deal(actor, 10_000 ether);
        }
    }

    function buy(uint256 actorSeed, uint256 amountSeed) external {
        address actor = actors[actorSeed % actors.length];
        uint256 remaining = curve.remainingMini();
        if (remaining == 0 || uint256(curve.phase()) != uint256(MiniGenesisCurve.Phase.Active)) {
            return;
        }
        uint256 amount = bound(amountSeed, 1 ether, remaining);
        uint256 cost = curve.quoteBuy(amount);
        vm.prank(actor);
        curve.buyExactMini{ value: cost }(amount, cost);
        totalCredited += amount;
    }
}

contract MiniGenesisCurveInvariantTest is Test {
    uint256 internal constant ALLOCATION = 2_000_000 ether;
    uint256 internal constant START_PRICE = 750_000_000_000_000;
    uint256 internal constant END_PRICE = 1_250_000_000_000_000;
    uint64 internal constant START = 1_000_000;
    uint64 internal constant END = START + 7 days;
    MiniGenesisCurve internal curve;
    MiniGenesisCurveHandler internal handler;

    function setUp() public {
        curve = new MiniGenesisCurve(
            makeAddr("treasury"), ALLOCATION, START_PRICE, END_PRICE, START, END
        );
        vm.warp(START);
        handler = new MiniGenesisCurveHandler(curve);
        targetContract(address(handler));
    }

    function invariant_soldRaisedAndCreditsRemainConsistent() public view {
        assertLe(curve.totalSoldMini(), ALLOCATION);
        assertEq(handler.totalCredited(), curve.totalSoldMini());
        assertEq(curve.totalRaisedDot(), curve.cumulativeCost(curve.totalSoldMini()));
        assertLe(curve.spotPrice(), END_PRICE);
    }
}
