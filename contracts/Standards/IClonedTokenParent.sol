pragma solidity 0.4.15;

import './ITokenSnapshots.sol';


/// @title represents link between cloned and parent token
/// @dev when token is clone from other token, initial balances of the cloned token
///     correspond to balances of parent token at the moment of parent snapshot id specified
/// @notice please note that other tokens beside snapshot token may be cloned
contract IClonedTokenParent is ITokenSnapshots {

    ////////////////////////
    // Public functions
    ////////////////////////


    /// @return address of parent token, address(0) if root
    /// @dev parent token does not need to clonable, nor snapshottable, just a normal token
    function parentToken()
        public
        constant
        returns(IClonedTokenParent parent);

    /// @return snapshot at wchich initial token distribution was taken
    function parentSnapshotId()
        public
        constant
        returns(uint256 snapshotId);
}
