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
    /// @return True if the transfer was successful
    function mTransfer(
        address from,
        address to,
        uint256 amount
    )
        internal
        returns(bool);

    /// @notice Generates `amount` tokens that are assigned to `owner`
    /// @param owner The address that will be assigned the new tokens
    /// @param amount The quantity of tokens generated
    /// @return True if the tokens are generated correctly
    function mGenerateTokens(address owner, uint256 amount)
        internal
        returns (bool);

    /// @notice Burns `amount` tokens from `owner`
    /// @param owner The address that will lose the tokens
    /// @param amount The quantity of tokens to burn
    /// @return True if the tokens are burned correctly
    function mDestroyTokens(address owner, uint256 amount)
        internal
        returns (bool);
}
