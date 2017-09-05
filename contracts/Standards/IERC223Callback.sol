pragma solidity 0.4.15;


contract IERC223Callback {

    ////////////////////////
    // Public functions
    ////////////////////////

    function tokenFallback(
        address from,
        uint256 amount,
        bytes data
    )
        public;

}
