pragma solidity 0.4.15;


contract MTokenTransferController {

    ////////////////////////
    // Internal functions
    ////////////////////////

    /// @notice Notifies the controller about a token transfer allowing the
    ///  controller to react if desired
    /// @param from The origin of the transfer
    /// @param to The destination of the transfer
    /// @param amount The amount of the transfer
    /// @return False if the controller does not authorize the transfer
    function mOnTransfer(
        address from,
        address to,
        uint256 amount
    )
        internal
        returns (bool allow);

}
