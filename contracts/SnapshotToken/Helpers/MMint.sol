pragma solidity 0.4.15;


contract MMint {

    ////////////////////////
    // Internal functions
    ////////////////////////

    /// @dev This is the actual transfer function in the token contract, it can
    ///  only be called by other functions in this contract.
    /// @param from The address holding the tokens being transferred
    /// @param to The address of the recipient
    /// @param amount The amount of tokens to be transferred
    /// @dev  reverts if transfer was not successful
    function mTransfer(
        address from,
        address to,
        uint256 amount
    )
        internal;

    /// @notice Generates `amount` tokens that are assigned to `owner`
    /// @param owner The address that will be assigned the new tokens
    /// @param amount The quantity of tokens generated
    /// @dev reverts if tokens could not be generated
    function mGenerateTokens(address owner, uint256 amount)
        internal;

    /// @notice Burns `amount` tokens from `owner`
    /// @param owner The address that will lose the tokens
    /// @param amount The quantity of tokens to burn
    /// @dev reverts if tokens could not be destroyed
    function mDestroyTokens(address owner, uint256 amount)
        internal;
}
