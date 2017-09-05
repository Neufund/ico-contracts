pragma solidity 0.4.15;


contract IERC677Callback {

    ////////////////////////
    // Public functions
    ////////////////////////

    // NOTE: This call can be initiated by anyone. You need to make sure that
    // it is send by the token (`require(msg.sender == token)`) or make sure
    // amount is valid (`require(token.allowance(this) >= amount)`).
    function receiveApproval(
        address from,
        uint256 amount,
        address token, // IERC667Token
        bytes data
    )
        public
        returns (bool success);

}
