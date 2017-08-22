pragma solidity ^0.4.11;

import 'zeppelin-solidity/contracts/token/ERC20.sol';

contract ERC23 is ERC20 {
    function approveAndCall(address _spender, uint256 _amount, bytes _extraData) returns (bool success);
}
