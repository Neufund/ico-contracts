pragma solidity 0.4.15;

import './IERC20Token.sol';

contract IERC667Token is IERC20Token {

    function approveAndCall(
        address _spender, // IERC667Callback
        uint256 _amount,
        bytes _extraData
    )
        public
        returns (bool success);

}
