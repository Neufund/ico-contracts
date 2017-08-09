pragma solidity ^0.4.11;

contract Error {

    enum Status {
        SUCCESS
        /// @dev Add your own
    }

    event Error(Status code);

    /// Example usage:
    ///
    /// if(msg.value < expected)
    ///     return logError(Status.Status);
    ///

    function logError(Status code)
        internal
        returns (Status)
    {
        Error(code);
        return code;
    }
}
