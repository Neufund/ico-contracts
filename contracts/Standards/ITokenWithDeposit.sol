pragma solidity 0.4.15;

import './IERC20Token.sol';


contract ITokenWithDeposit is IERC20Token {

    function deposit(address to, uint256 amount) payable returns (bool);
    function withdraw(uint256 amount);

    event Deposit(address indexed to, uint amount);
    event Withdrawal(address indexed to, uint amount);
}
