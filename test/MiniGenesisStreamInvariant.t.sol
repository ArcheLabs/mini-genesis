// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";

import { MiniGenesisStream } from "../src/MiniGenesisStream.sol";

contract GenesisHandler is Test {
    MiniGenesisStream public immutable stream;
    address public immutable treasury;
    uint256 public successfulContributions;

    constructor(MiniGenesisStream stream_, address treasury_) {
        stream = stream_;
        treasury = treasury_;
    }

    function contribute(uint256 actorSeed, uint96 rawAmount) external {
        bool started = stream.startBlock() != 0;
        if (started && block.number >= stream.contributionEndBlock()) return;
        address actor = address(uint160(uint256(keccak256(abi.encode(actorSeed)))));
        uint256 minimum = started ? stream.subsequentContributionMinimumExclusive() + 1 : 1 ether;
        uint256 amount = bound(rawAmount, minimum, 100 ether);
        vm.deal(actor, amount);
        vm.prank(actor);
        stream.contribute{ value: amount }();
        successfulContributions += amount;
    }

    function roll(uint16 blocksForward) external {
        vm.roll(block.number + bound(blocksForward, 1, 20));
    }
}

contract MiniGenesisStreamInvariantTest is Test {
    MiniGenesisStream internal stream;
    GenesisHandler internal handler;
    address internal treasury = makeAddr("treasury");

    function setUp() public {
        stream = new MiniGenesisStream(treasury, 1_400_000 ether, 100, 40, 1 ether, 0.1 ether);
        handler = new GenesisHandler(stream, treasury);
        targetContract(address(handler));
    }

    function invariantRaisedEqualsSuccessfulContributions() public view {
        assertEq(stream.totalRaisedDot(), handler.successfulContributions());
        assertEq(treasury.balance, stream.totalRaisedDot());
    }

    function invariantEmissionAndSettlementAreBounded() public view {
        assertLe(stream.emittedMini(), stream.genesisAllocation());
        assertLe(stream.lastSettledBlock(), stream.emissionEndBlock());
        assertEq(address(stream).balance, 0);
    }
}
