pragma solidity 0.4.15;

import '../Snapshot/DailyAndSnapshotable.sol';
import '../Standards/IERC677Token.sol';
import '../Standards/IERC677Callback.sol';
import '../Standards/IERC20Token.sol';
import '../Standards/ISnapshotToken.sol';
import '../Standards/ISnapshotTokenParent.sol';
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
    IERC677Token,
    ISnapshotToken,
    MMint,
    MTokenController,
    BasicSnapshotToken,
    DailyAndSnapshotable,
    Allowance,
    TokenMetadata
{
    string private constant VERSION = "ST_1.0";

////////////////
// Constructor
////////////////

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

///////////////////
// Public functions
///////////////////

    /// @notice Send `_amount` tokens to `_to` from `msg.sender`
    /// @param _to The address of the recipient
    /// @param _amount The amount of tokens to be transferred
    /// @return Whether the transfer was successful or not
    /// Overrides the public function in SnapshotTokenBase
    function transfer(address _to, uint256 _amount)
        public
        returns (bool success)
    {
        return transfer(msg.sender, _to, _amount);
    }

    /// @notice `msg.sender` approves `_spender` to spend `_amount` tokens on
    ///  its behalf. This is a modified version of the ERC20 approve function
    ///  to be a little bit safer
    /// @param _spender The address of the account able to transfer the tokens
    /// @param _amount The amount of tokens to be approved for transfer
    /// @return True if the approval was successful
    /// Overrides the public function in Allowance
    function approve(address _spender, uint256 _amount)
        public
        returns (bool success)
    {
        // Alerts the token controller of the approve function call
        require(mOnApprove(msg.sender, _spender, _amount));

        return Allowance.approve(_spender, _amount);
    }

    /// @notice `msg.sender` approves `_spender` to send `_amount` tokens on
    ///  its behalf, and then a function is triggered in the contract that is
    ///  being approved, `_spender`. This allows users to use their tokens to
    ///  interact with contracts in one function call instead of two
    /// @param _spender The address of the contract able to transfer the tokens
    /// @param _amount The amount of tokens to be approved for transfer
    /// @return True if the function call was successful
    /// Reimplements the public function in Allowance (TODO: is this necessary?)
    function approveAndCall(address _spender, uint256 _amount, bytes _extraData)
        public
        returns (bool success)
    {
        require(approve(_spender, _amount));

        success = IERC677Callback(_spender).receiveApproval(
            msg.sender,
            _amount,
            this,
            _extraData
        );

        return success;
    }

////////////////
// Internal functions
////////////////

    /// @dev This is the actual transfer function in the token contract, it can
    ///  only be called by other functions in this contract.
    /// @param _from The address holding the tokens being transferred
    /// @param _to The address of the recipient
    /// @param _amount The amount of tokens to be transferred
    /// @return True if the transfer was successful
    /// Implements the abstract function from AllowanceBase
    function mAllowanceTransfer(address _from, address _to, uint _amount)
        internal
        returns(bool)
    {
        return transfer(_from, _to, _amount);
    }

    /// @dev This is the actual transfer function in the token contract, it can
    ///  only be called by other functions in this contract.
    /// @param _from The address holding the tokens being transferred
    /// @param _to The address of the recipient
    /// @param _amount The amount of tokens to be transferred
    /// @return True if the transfer was successful
    /// Implements the abstract function from AllowanceBase
    function transfer(address _from, address _to, uint _amount)
        internal
        returns(bool)
    {
        // Alerts the token controller of the transfer
        require(mOnTransfer(_from, _to, _amount));

        return mTransfer(_from, _to, _amount);
    }
}
