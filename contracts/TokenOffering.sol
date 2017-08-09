pragma solidity ^0.4.11;

/// Base class for any token offering on Neufund platform
contract TokenOffering {
    // on every investment transaction
    event FundsInvested(address indexed investor, address indexed to, uint256 amount, address token, uint256 eurEquivalent);
}
