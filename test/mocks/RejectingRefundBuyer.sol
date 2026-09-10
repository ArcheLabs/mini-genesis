// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

interface ICurveBuyer {
    function buyExactMini(uint256 miniAmount, uint256 maxDotCost) external payable;
}

contract RejectingRefundBuyer {
    function buy(address curve, uint256 miniAmount, uint256 maxDotCost) external payable {
        ICurveBuyer(curve).buyExactMini{ value: msg.value }(miniAmount, maxDotCost);
    }

    receive() external payable {
        revert();
    }
}
