pragma solidity 0.4.15;

import '../Standards/IERC223Token.sol';
import '../Standards/IERC223Callback.sol';
import '../IsContract.sol';
import './Helpers/TokenAllowance.sol';
import './MintableSnapshotToken.sol';
import './Helpers/TokenMetadata.sol';
import './Helpers/MTokenController.sol';
import './Helpers/MTokenTransfer.sol';


/*
    Copyright 2016, Jordi Baylina
    Copyright 2017, Remco Bloemen, Marcin Rudolf

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
/// @author Jordi Baylina, Remco Bloemen, Marcin Rudolf
/// @dev This token contract's goal is to make it easy for anyone to clone this
///  token using the token distribution at a given block, this will allow DAO's
///  and DApps to upgrade their features in a decentralized manner without
///  affecting the original token
/// @dev It is ERC20 compliant, but still needs to under go further testing.
/// @dev Various contracts are composed to provide required functionality of this token, different compositions are possible
///     MintableSnapshotToken provides transfer, miniting and snapshotting functions
///     TokenAllowance provides approve/transferFrom functions
///     TokenMetadata adds name, symbol and other token metadata
/// @dev This token is still abstract, Snapshot, BasicSnapshotToken and TokenAllowance observe interfaces that must be implemented
///     MSnapshotPolicy - particular snapshot id creation mechanism
///     MTokenController - controlls approvals and transfers
///     see Neumark as an example
contract SnapshotToken is
    MintableSnapshotToken,
    TokenAllowance,
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
        MintableSnapshotToken(ISnapshotTokenParent(0x0), 0)
        TokenAllowance()
        TokenMetadata(tokenName, decimalUnits, tokenSymbol, VERSION)
    {
    }

    ////////////////////////
    // Public functions
    ////////////////////////

    //
    // Implements IERC223Token
    //

    function transfer(address to, uint256 amount, bytes data)
        public
        returns (bool)
    {
        // it is necessary to point out implementation to be called
        BasicSnapshotToken.mTransfer(msg.sender, to, amount);

        // Notify the receiving contract.
        if (isContract(to)) {
            IERC223Callback(to).tokenFallback(msg.sender, amount, data);
        }
        return true;
    }
}
