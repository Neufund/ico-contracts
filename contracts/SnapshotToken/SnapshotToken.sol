pragma solidity 0.4.15;

import '../Snapshot/DailyAndSnapshotable.sol';
import '../Standards/IERC223Token.sol';
import '../Standards/IERC223Callback.sol';
import '../Standards/IERC677Token.sol';
import '../Standards/IERC677Callback.sol';
import '../Standards/IERC20Token.sol';
import '../Standards/ISnapshotToken.sol';
import '../Standards/ISnapshotTokenParent.sol';
import '../IsContract.sol';
import './Helpers/Allowance.sol';
import './Helpers/BasicSnapshotToken.sol';
import './Helpers/MMint.sol';
import './Helpers/TokenMetadata.sol';
import './MTokenController.sol';


/*
    Copyright 2016, Remco Bloemen, Jordi Baylina

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
/// @title SnapshotToken Contract
/// @author Remco Bloemen, Jordi Baylina
/// @dev This token contract's goal is to make it easy for anyone to clone this
///  token using the token distribution at a given block, this will allow DAO's
///  and DApps to upgrade their features in a decentralized manner without
///  affecting the original token
/// @dev It is ERC20 compliant, but still needs to under go further testing.
/// @dev The actual token contract, the default controller is the msg.sender
///  that deploys the contract, so usually this token will be deployed by a
///  token controller contract, which Giveth will call a "Campaign"
// Consumes the MMint mixin from SnapshotToken
contract SnapshotToken is
    IERC20Token,
    IERC223Token,
    IERC677Token,
    ISnapshotToken,
    MMint,
    MTokenController,
    BasicSnapshotToken,
    DailyAndSnapshotable,
    Allowance,
    TokenMetadata,
    IsContract
{
    ////////////////////////
    // Constants
    ////////////////////////

    string private constant VERSION = "ST_1.0";

    ////////////////////////
    // Constructor
    ////////////////////////

    /// @notice Constructor to create a MiniMeToken
    ///  is a new token
    /// @param tokenName Name of the new token
    /// @param decimalUnits Number of decimals of the new token
    /// @param tokenSymbol Token Symbol for the new token
    function SnapshotToken(
        string tokenName,
        uint8 decimalUnits,
        string tokenSymbol
    )
        BasicSnapshotToken(ISnapshotTokenParent(0x0), 0)
        DailyAndSnapshotable()
        Allowance()
        TokenMetadata(tokenName, decimalUnits, tokenSymbol, VERSION)
    {
    }

    ////////////////////////
    // Public functions
    ////////////////////////

    /// @notice Send `amount` tokens to `to` from `msg.sender`
    /// @param to The address of the recipient
    /// @param amount The amount of tokens to be transferred
    /// @return Whether the transfer was successful or not
    /// Overrides the public function in SnapshotTokenBase
    function transfer(address to, uint256 amount)
        public
        returns (bool success)
    {
        // NOTE: We do not call the ERC223 callback
        // here for compatibility reasons. Please use
        // tranfser(to, amount, bytes()) instead.
        return transfer(msg.sender, to, amount);
    }

    function transfer(address to, uint amount, bytes data)
        public
        returns (bool success)
    {
        success = transfer(msg.sender, to, amount);
        if (!success) {
            return success;
        }

        // Notify the receiving contract.
        if (isContract(to)) {
            IERC223Callback(to).tokenFallback(msg.sender, amount, data);
        }
        return success;
    }

    /// @notice `msg.sender` approves `spender` to spend `amount` tokens on
    ///  its behalf. This is a modified version of the ERC20 approve function
    ///  to be a little bit safer
    /// @param spender The address of the account able to transfer the tokens
    /// @param amount The amount of tokens to be approved for transfer
    /// @return True if the approval was successful
    /// Overrides the public function in Allowance
    function approve(address spender, uint256 amount)
        public
        returns (bool success)
    {
        // Alerts the token controller of the approve function call
        require(mOnApprove(msg.sender, spender, amount));

        return Allowance.approve(spender, amount);
    }

    /// @notice `msg.sender` approves `spender` to send `amount` tokens on
    ///  its behalf, and then a function is triggered in the contract that is
    ///  being approved, `spender`. This allows users to use their tokens to
    ///  interact with contracts in one function call instead of two
    /// @param spender The address of the contract able to transfer the tokens
    /// @param amount The amount of tokens to be approved for transfer
    /// @return True if the function call was successful
    /// Reimplements the public function in Allowance (TODO: is this necessary?)
    function approveAndCall(address spender, uint256 amount, bytes extraData)
        public
        returns (bool success)
    {
        require(approve(spender, amount));

        success = IERC677Callback(spender).receiveApproval(
            msg.sender,
            amount,
            this,
            extraData
        );

        return success;
    }

    ////////////////////////
    // Internal functions
    ////////////////////////

    /// @dev This is the actual transfer function in the token contract, it can
    ///  only be called by other functions in this contract.
    /// @param from The address holding the tokens being transferred
    /// @param to The address of the recipient
    /// @param amount The amount of tokens to be transferred
    /// @return True if the transfer was successful
    /// Implements the abstract function from AllowanceBase
    function transfer(address from, address to, uint amount)
        internal
        returns(bool)
    {
        // Alerts the token controller of the transfer
        require(mOnTransfer(from, to, amount));

        return mTransfer(from, to, amount);
    }

    //
    // Implements MAllowance
    //

    /// @dev This is the actual transfer function in the token contract, it can
    ///  only be called by other functions in this contract.
    /// @param from The address holding the tokens being transferred
    /// @param to The address of the recipient
    /// @param amount The amount of tokens to be transferred
    /// @return True if the transfer was successful
    /// Implements the abstract function from AllowanceBase
    function mAllowanceTransfer(address from, address to, uint amount)
        internal
        returns(bool)
    {
        return transfer(from, to, amount);
    }

}
