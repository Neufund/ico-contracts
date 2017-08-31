pragma solidity 0.4.15;

contract IERC677Callback {

    function receiveApproval(
        address from,
        uint256 amount,
        address token, // IERC667Token
        bytes data
    )
        public
        returns (bool success);

}
