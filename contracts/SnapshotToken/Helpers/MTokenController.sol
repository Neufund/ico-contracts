pragma solidity 0.4.15;


/// @dev The token controller contract must implement these functions
contract MTokenController {

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

    /// @notice Notifies the controller about an approval allowing the
    ///  controller to react if desired
    /// @param owner The address that calls `approve()`
    /// @param spender The spender in the `approve()` call
    /// @param amount The amount in the `approve()` call
    /// @return False if the controller does not authorize the approval
    function mOnApprove(
        address owner,
        address spender,
        uint256 amount
    )
        internal
        returns (bool allow);
}
