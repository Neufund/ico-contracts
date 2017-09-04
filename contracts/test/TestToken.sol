pragma solidity 0.4.15;

import '../Zeppelin/StandardToken.sol';


contract TestToken is StandardToken {

    function TestToken(uint256 initialBalance)
        StandardToken()
    {
        balances[msg.sender] = initialBalance;
    }
}
