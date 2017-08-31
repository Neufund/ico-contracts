pragma solidity 0.4.15;

contract IERC223Callback {

    function tokenFallback(
        address from,
        uint amount,
        bytes data
    )
        public;

}
