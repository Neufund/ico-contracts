pragma solidity ^0.4.11;

import 'zeppelin-solidity/contracts/token/ERC20.sol';

contract TokenWithDeposit is ERC20 {

    function deposit(address to, uint256 amount) payable returns (bool);
    function withdraw(uint256 amount);

    event Deposit(address indexed to, uint amount);
    event Withdrawal(address indexed to, uint amount);
}
