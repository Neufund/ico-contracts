pragma solidity 0.4.15;

import './ERC23.sol';

contract TokenWithDeposit is ERC23 {

    function deposit(address to, uint256 amount) payable returns (bool);
    function withdraw(uint256 amount);

    event Deposit(address indexed to, uint amount);
    event Withdrawal(address indexed to, uint amount);
}
