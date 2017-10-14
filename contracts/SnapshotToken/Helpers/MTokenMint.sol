pragma solidity 0.4.15;


contract MTokenMint {

    ////////////////////////
    // Internal functions
    ////////////////////////

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
