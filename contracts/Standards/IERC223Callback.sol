pragma solidity 0.4.15;


contract IERC223Callback {

    ////////////////////////
    // Public functions
    ////////////////////////

    function tokenFallback(
        address from,
        uint amount,
        bytes data
    )
        public;

}
