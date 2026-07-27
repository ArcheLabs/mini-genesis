// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";

import { MiniGenesisStream } from "../src/MiniGenesisStream.sol";
import { GenesisReferenceModel } from "./helpers/GenesisReferenceModel.sol";

contract MiniGenesisStreamModelTest is Test {
    uint256 internal constant ALLOCATION = 1_400_003;
    uint256 internal constant CONTRIBUTION_BLOCKS = 50;
    uint256 internal constant PROTECTION_BLOCKS = 20;
    uint256 internal constant FIRST_MINIMUM = 100;
    uint256 internal constant LATER_MINIMUM = 10;
    uint256 internal constant ACTOR_COUNT = 5;

    address internal treasury = makeAddr("treasury");
    address[] internal actors;
    MiniGenesisStream internal stream;
    GenesisReferenceModel internal model;
    uint256 internal contributionOperations;

    function setUp() public {
        for (uint256 i; i < ACTOR_COUNT; ++i) {
            address actor = makeAddr(string.concat("model-actor-", vm.toString(i)));
            actors.push(actor);
            vm.deal(actor, 1e30);
        }
        stream = new MiniGenesisStream(
            treasury,
            ALLOCATION,
            CONTRIBUTION_BLOCKS,
            PROTECTION_BLOCKS,
            FIRST_MINIMUM,
            LATER_MINIMUM
        );
        model =
            new GenesisReferenceModel(ALLOCATION, CONTRIBUTION_BLOCKS, PROTECTION_BLOCKS, actors);
    }

    /// forge-config: default.fuzz.runs = 64
    /// forge-config: ci.fuzz.runs = 256
    function testFuzzMultiUserStateMachine(uint256 seed, uint8 rawSteps) public {
        uint256 steps = bound(rawSteps, 50, 100);

        for (uint256 step; step < steps; ++step) {
            seed = uint256(keccak256(abi.encode(seed, step)));
            uint256 action = seed % 4;

            if (action == 0) {
                vm.roll(block.number + ((seed >> 8) % 21));
            } else if (action <= 2) {
                _attemptContribution(seed);
            } else {
                _assertActor(seed % ACTOR_COUNT);
            }
        }

        if (stream.startBlock() == 0) _contribute(actors[0], FIRST_MINIMUM);
        vm.roll(stream.emissionEndBlock());
        model.settleTo(block.number);
        _assertAllActors();
        assertLe(model.totalCredit(), ALLOCATION);
    }

    function _attemptContribution(uint256 entropy) internal {
        bool started = stream.startBlock() != 0;
        if (started && block.number >= stream.contributionEndBlock()) return;

        address actor = actors[(entropy >> 16) % ACTOR_COUNT];
        uint256 minimum = started ? LATER_MINIMUM + 1 : FIRST_MINIMUM;
        uint256 amount = minimum + ((entropy >> 32) % 10_000);
        _contribute(actor, amount);
    }

    function _contribute(address actor, uint256 amount) internal {
        model.settleTo(block.number);
        vm.prank(actor);
        stream.contribute{ value: amount }();
        model.contribute(actor, amount, block.number);
        ++contributionOperations;
    }

    function _assertActor(uint256 actorIndex) internal {
        if (stream.startBlock() == 0) return;
        model.settleTo(block.number);
        uint256 actual = stream.pendingMini(actors[actorIndex]);
        uint256 expected = model.credit(actors[actorIndex]);
        assertApproxEqAbs(actual, expected, _dustBound());
    }

    function _assertAllActors() internal {
        uint256 productionTotal;
        for (uint256 i; i < ACTOR_COUNT; ++i) {
            _assertActor(i);
            productionTotal += stream.pendingMini(actors[i]);
        }
        assertLe(productionTotal, ALLOCATION);
    }

    function _dustBound() internal view returns (uint256) {
        // Direct per-block floors and production index/debt floors can each lose at
        // most one unit per completed block or contribution boundary for one user.
        return 2 * (CONTRIBUTION_BLOCKS + PROTECTION_BLOCKS) + contributionOperations + 1;
    }
}
