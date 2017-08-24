pragma solidity ^0.4.13;

contract IERC667Callback {

    function receiveApproval(
        address from,
        uint256 amount,
        address token, // IERC667Token
        bytes data
    )
        public
        returns (bool success);

}
