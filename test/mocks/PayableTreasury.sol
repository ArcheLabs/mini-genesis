// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

contract PayableTreasury {
    uint256 public received;

    receive() external payable {
        received += msg.value;
    }
}
