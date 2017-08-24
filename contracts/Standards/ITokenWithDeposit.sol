pragma solidity 0.4.15;

import '../Zeppelin/ERC20.sol';

contract ITokenWithDeposit is ERC20 {

    function deposit(address to, uint256 amount) payable returns (bool);
    function withdraw(uint256 amount);

    event Deposit(address indexed to, uint amount);
    event Withdrawal(address indexed to, uint amount);
}
