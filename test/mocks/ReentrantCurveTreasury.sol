// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

interface ICurvePurchase {
    function buyExactMini(uint256 miniAmount, uint256 maxDotCost) external payable;
}

contract ReentrantCurveTreasury {
    ICurvePurchase public target;
    bool public attempted;
    bool public succeeded;

    function setTarget(address target_) external {
        target = ICurvePurchase(target_);
    }

    receive() external payable {
        if (!attempted) {
            attempted = true;
            (succeeded,) = address(target).call{ value: msg.value }(
                abi.encodeCall(ICurvePurchase.buyExactMini, (1e18, type(uint256).max))
            );
        }
    }
}
