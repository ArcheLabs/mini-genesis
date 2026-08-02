// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

interface IContribute {
    function contribute(string calldata username) external payable;
}

contract ReentrantTreasury {
    IContribute public target;
    bool public attempted;

    function setTarget(address target_) external {
        target = IContribute(target_);
    }

    receive() external payable {
        if (!attempted) {
            attempted = true;
            (bool success,) = address(target).call{ value: msg.value }(
                abi.encodeCall(IContribute.contribute, ("reentrant"))
            );
            require(!success, "reentrancy succeeded");
        }
    }
}
