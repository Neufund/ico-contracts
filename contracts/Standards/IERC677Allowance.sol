pragma solidity 0.4.15;

import './IERC20Allowance.sol';


contract IERC677Allowance is IERC20Allowance {

    ////////////////////////
    // Public functions
    ////////////////////////

    /// @notice `msg.sender` approves `spender` to send `amount` tokens on
    ///  its behalf, and then a function is triggered in the contract that is
    ///  being approved, `spender`. This allows users to use their tokens to
    ///  interact with contracts in one function call instead of two
    /// @param spender The address of the contract able to transfer the tokens
    /// @param amount The amount of tokens to be approved for transfer
    /// @return True if the function call was successful
    function approveAndCall(address spender, uint256 amount, bytes extraData)
        public
        returns (bool success);

}
