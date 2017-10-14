pragma solidity 0.4.15;


contract MTokenAllowanceController {

    ////////////////////////
    // Internal functions
    ////////////////////////

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
