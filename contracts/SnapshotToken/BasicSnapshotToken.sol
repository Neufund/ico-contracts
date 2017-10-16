pragma solidity 0.4.15;

import '../Snapshot/Snapshot.sol';
import '../Standards/ISnapshotToken.sol';
import './Helpers/MTokenTransfer.sol';
import './Helpers/MTokenTransferController.sol';


/// @title token with snapshots and transfer functionality
/// @dev observes MTokenTransferController interface
///     observes ISnapshotToken interface
///     implementes MTokenTransfer interface
contract BasicSnapshotToken is
    MTokenTransfer,
    MTokenTransferController,
    ISnapshotToken,
    Snapshot
{
    ////////////////////////
    // Immutable state
    ////////////////////////

    // `parentToken` is the Token address that was cloned to produce this token;
    //  it will be 0x0 for a token that was not cloned
    ISnapshotTokenParent private PARENT_TOKEN;

    // `parentSnapShotBlock` is the block number from the Parent Token that was
    //  used to determine the initial distribution of the cloned token
    uint256 private PARENT_SNAPSHOT_ID;

    ////////////////////////
    // Mutable state
    ////////////////////////

    // `balances` is the map that tracks the balance of each address, in this
    //  contract when the balance changes the snapshot id that the change
    //  occurred is also included in the map
    mapping (address => Values[]) internal _balances;

    // Tracks the history of the `totalSupply` of the token
    Values[] internal _totalSupplyValues;

    ////////////////////////
    // Constructor
    ////////////////////////

    /// @notice Constructor to create snapshot token
    /// @param parentToken Address of the parent token, set to 0x0 if it is a
    ///  new token
    /// @param parentSnapshotId at which snapshot id clone was created
    function BasicSnapshotToken(
        ISnapshotTokenParent parentToken,
        uint256 parentSnapshotId
    )
        public
        Snapshot()
    {
        PARENT_TOKEN = parentToken;
        PARENT_SNAPSHOT_ID = parentSnapshotId;
    }

    ////////////////////////
    // Public functions
    ////////////////////////

    //
    // Implements IBasicToken
    //

    /// @dev This function makes it easy to get the total number of tokens
    /// @return The total number of tokens
    function totalSupply()
        public
        constant
        returns (uint256)
    {
        return getValue(_totalSupplyValues, 0);
    }

    /// @param owner The address that's balance is being requested
    /// @return The balance of `owner` at the current block
    function balanceOf(address owner)
        public
        constant
        returns (uint256 balance)
    {
        return getValue(_balances[owner], 0);
    }

    /// @notice Send `amount` tokens to `to` from `msg.sender`
    /// @param to The address of the recipient
    /// @param amount The amount of tokens to be transferred
    /// @return True if the transfer was successful, reverts in any other case
    function transfer(address to, uint256 amount)
        public
        returns (bool success)
    {
        mTransfer(msg.sender, to, amount);
        return true;
    }

    //
    // Implements ISnapshotTokenParent
    //

    /// @notice Total amount of tokens at a specific `snapshotId`.
    /// @param snapshotId of snapshot at which totalSupply is queried
    /// @return The total amount of tokens at `snapshotId`
    function totalSupplyAt(uint256 snapshotId)
        public
        constant
        returns(uint256)
    {
        Values[] storage values = _totalSupplyValues;

        // If there is a value, return it, reverts if value is in the future
        if (hasValueAt(values, snapshotId)) {
            return getValueAt(values, snapshotId, 0);
        }

        // Try parent contract at or before the fork
        if (address(PARENT_TOKEN) != 0) {
            // TODO: this is certainly wrong, should be totalSupplyAt(min(PARENT_SNAPSHOT_ID, snapshotId))
            return PARENT_TOKEN.totalSupplyAt(PARENT_SNAPSHOT_ID);
        }

        // Default to an empty balance
        return 0;
    }

    /// @dev Queries the balance of `owner` at a specific `snapshotId`
    /// @param owner The address from which the balance will be retrieved
    /// @param snapshotId of snapshot at which the balance is queried
    /// @return The balance at `snapshotId`
    function balanceOfAt(address owner, uint256 snapshotId)
        public
        constant
        returns (uint256)
    {
        Values[] storage values = _balances[owner];

        // If there is a value, return it, reverts if value is in the future
        if (hasValueAt(values, snapshotId)) {
            return getValueAt(values, snapshotId, 0);
        }

        // Try parent contract at or before the fork
        if (address(PARENT_TOKEN) != 0) {
            // TODO: this is certainly wrong, should be balanceOfAt(owner, min(PARENT_SNAPSHOT_ID, snapshotId))
            return PARENT_TOKEN.balanceOfAt(owner, PARENT_SNAPSHOT_ID);
        }

        // Default to an empty balance
        return 0;
    }

    ////////////////////////
    // Internal functions
    ////////////////////////

    //
    // Implements MTokenTransfer
    //

    /// @dev This is the actual transfer function in the token contract, it can
    ///  only be called by other functions in this contract.
    /// @param from The address holding the tokens being transferred
    /// @param to The address of the recipient
    /// @param amount The amount of tokens to be transferred
    /// @return True if the transfer was successful, reverts in any other case
    function mTransfer(
        address from,
        address to,
        uint256 amount
    )
        internal
    {
        require(to != address(0));
        // Alerts the token controller of the transfer
        require(mOnTransfer(from, to, amount));

        // If the amount being transfered is more than the balance of the
        //  account the transfer reverts
        var previousBalanceFrom = balanceOf(from);
        require(previousBalanceFrom >= amount);

        // First update the balance array with the new value for the address
        //  sending the tokens
        uint256 newBalanceFrom = previousBalanceFrom - amount;
        setValue(_balances[from], newBalanceFrom);

        // Then update the balance array with the new value for the address
        //  receiving the tokens
        uint256 previousBalanceTo = balanceOf(to);
        uint256 newBalanceTo = previousBalanceTo + amount;
        assert(newBalanceTo >= previousBalanceTo); // Check for overflow
        setValue(_balances[to], newBalanceTo);

        // An event to make the transfer easy to find on the blockchain
        Transfer(from, to, amount);
    }
}
