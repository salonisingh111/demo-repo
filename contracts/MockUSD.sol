// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockUSD
 * @dev Mock ERC20 token for stablecoin settlement on Base Sepolia.
 * Includes a public mint function to allow easy testing with fresh wallets.
 */
contract MockUSD is ERC20 {
    constructor() ERC20("Mock USD", "MockUSD") {
        // Mint 1,000,000 MockUSD to deployer for initial supply
        _mint(msg.sender, 1000000 * 10**decimals());
    }

    /**
     * @dev Mint MockUSD to any address.
     * Crucial for hackathon/demo wallet funding.
     */
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
