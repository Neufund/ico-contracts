pragma solidity 0.4.15;

import './IBasicToken.sol';
import './ITokenMetadata.sol';

contract IERC223Token is IBasicToken, ITokenMetadata {

    event Transfer(
        address indexed from,
        address indexed to,
        uint256 amount,
        bytes data);

    function transfer(address to, uint amount, bytes data)
        public
        returns (bool);
}
