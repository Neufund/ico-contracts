pragma solidity ^0.4.11;

contract Error {

    enum Status {
        SUCCESS,
        INSUFFICIENT_FUNDS
        /// @dev Add your own
    }

    event Error(Status);

    // Example usage:
    //
    // if(msg.value < expected)
    //     return logError(Status.Status);
    //
    function logError(Status code)
        internal
        constant
        returns(Status)
    {
        Error(code);
        return code;
    }

}
