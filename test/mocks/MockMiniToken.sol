// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockMiniToken is ERC20 {
    constructor() ERC20("Mock MINI", "MINI") { }

    function mint(address account, uint256 amount) external {
        _mint(account, amount);
    }
}
