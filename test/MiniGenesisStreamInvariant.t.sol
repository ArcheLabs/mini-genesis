// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { MiniGenesisStream } from "../src/MiniGenesisStream.sol";

contract GenesisHandler is Test {
    MiniGenesisStream public immutable stream;
    address public immutable treasury;
    uint256 public successfulContributions;
    uint256 public expectedContributorCount;
    bool public monotonicityViolated;
    bool public failedCallMutatedState;
    bool public endedStateMutated;
    bool public startBlockViolated;
    uint256 public recordedStartBlock;

    address[] public actors;
    mapping(address actor => bool seen) public hasContributed;
    mapping(address actor => uint256 amount) public previousContributed;

    constructor(MiniGenesisStream stream_, address treasury_) {
        stream = stream_;
        treasury = treasury_;
        for (uint256 i; i < 5; ++i) {
            actors.push(address(uint160(uint256(keccak256(abi.encode("invariant", i))))));
        }
    }

    function contribute(uint256 actorSeed, uint96 rawAmount) external {
        bool started = stream.startBlock() != 0;
        if (started && block.number >= stream.contributionEndBlock()) return;
        address participant = actors[actorSeed % actors.length];
        uint256 minimum = started ? stream.subsequentContributionMinimumExclusive() + 1 : 1 ether;
        uint256 amount = bound(rawAmount, minimum, 100 ether);
        uint256[5] memory beforePending = _pending();

        vm.deal(participant, amount);
        vm.prank(participant);
        stream.contribute{ value: amount }();
        successfulContributions += amount;
        if (recordedStartBlock == 0) recordedStartBlock = stream.startBlock();
        if (stream.startBlock() != recordedStartBlock) startBlockViolated = true;
        if (!hasContributed[participant]) {
            hasContributed[participant] = true;
            ++expectedContributorCount;
        }
        uint256 contributed = stream.userInfo(participant).contributedDot;
        if (contributed < previousContributed[participant]) monotonicityViolated = true;
        previousContributed[participant] = contributed;
        _checkPending(beforePending, false, 0);
    }

    function failedContribution(uint256 actorSeed) external {
        address participant = actors[actorSeed % actors.length];
        uint256 raisedBefore = stream.totalRaisedDot();
        uint256 countBefore = stream.contributorCount();
        uint256 contributedBefore = stream.userInfo(participant).contributedDot;
        vm.deal(participant, 1 ether);
        vm.prank(participant);
        (bool success,) =
            address(stream).call{ value: 0 }(abi.encodeCall(MiniGenesisStream.contribute, ()));
        if (
            success || stream.totalRaisedDot() != raisedBefore
                || stream.contributorCount() != countBefore
                || stream.userInfo(participant).contributedDot != contributedBefore
        ) failedCallMutatedState = true;
    }

    function roll(uint16 blocksForward) external {
        uint256[5] memory beforePending = _pending();
        bool wasEnded = stream.startBlock() != 0 && block.number >= stream.emissionEndBlock();
        uint256 emittedBefore = stream.emittedMini();
        vm.roll(block.number + bound(blocksForward, 1, 20));
        _checkPending(beforePending, wasEnded, emittedBefore);
    }

    function actorAt(uint256 index) external view returns (address) {
        return actors[index];
    }

    function actorCount() external view returns (uint256) {
        return actors.length;
    }

    function _pending() private view returns (uint256[5] memory values) {
        for (uint256 i; i < actors.length; ++i) {
            values[i] = stream.pendingMini(actors[i]);
        }
    }

    function _checkPending(uint256[5] memory beforePending, bool wasEnded, uint256 emittedBefore)
        private
    {
        for (uint256 i; i < actors.length; ++i) {
            uint256 currentPending = stream.pendingMini(actors[i]);
            if (currentPending < beforePending[i]) {
                monotonicityViolated = true;
            }
            if (wasEnded && currentPending != beforePending[i]) endedStateMutated = true;
        }
        if (wasEnded && stream.emittedMini() != emittedBefore) endedStateMutated = true;
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

    function invariantRaisedAndTreasuryMatchSuccessfulContributions() public view {
        assertEq(stream.totalRaisedDot(), handler.successfulContributions());
        assertEq(treasury.balance, stream.totalRaisedDot());
        assertEq(address(stream).balance, 0);
    }

    function invariantEmissionAndKnownCreditsAreBounded() public view {
        uint256 pendingTotal;
        for (uint256 i; i < handler.actorCount(); ++i) {
            pendingTotal += stream.pendingMini(handler.actorAt(i));
        }
        assertLe(stream.emittedMini(), stream.genesisAllocation());
        assertLe(pendingTotal, stream.emittedMini());
        assertLe(stream.lastSettledBlock(), stream.emissionEndBlock());
    }

    function invariantUserStateIsMonotonicAndFailedCallsAreAtomic() public view {
        assertFalse(handler.monotonicityViolated());
        assertFalse(handler.failedCallMutatedState());
        assertFalse(handler.endedStateMutated());
        assertFalse(handler.startBlockViolated());
        assertEq(stream.contributorCount(), handler.expectedContributorCount());
    }
}
