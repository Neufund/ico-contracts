pragma solidity 0.4.15;

import '../Standards/IBasicToken.sol';
import '../Standards/IClonedTokenParent.sol';
import '../Snapshot/Snapshot.sol';
import './Helpers/MTokenTransfer.sol';
import './Helpers/MTokenTransferController.sol';


/// @title token with snapshots and transfer functionality
/// @dev observes MTokenTransferController interface
///     observes ISnapshotToken interface
///     implementes MTokenTransfer interface
contract BasicSnapshotToken is
    MTokenTransfer,
    MTokenTransferController,
    IBasicToken,
    IClonedTokenParent,
    Snapshot
{
    ////////////////////////
    // Immutable state
    ////////////////////////

    // `PARENT_TOKEN` is the Token address that was cloned to produce this token;
    //  it will be 0x0 for a token that was not cloned
    IClonedTokenParent private PARENT_TOKEN;

    // `PARENT_SNAPSHOT_ID` is the snapshot id from the Parent Token that was
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
    /// @param parentSnapshotId at which snapshot id clone was created, set to 0 to clone at upper bound
    /// @dev please not that as long as cloned token does not overwrite value at current snapshot id, it will refer
    ///     to parent token at which this snapshot still may change until snapshot id increases. for that time tokens are coupled
    ///     this is prevented by parentSnapshotId value of parentToken.currentSnapshotId() - 1 being the maxiumum
    ///     see SnapshotToken.js test to learn consequences coupling has.
    function BasicSnapshotToken(
        IClonedTokenParent parentToken,
        uint256 parentSnapshotId
    )
        public
        Snapshot()
    {
        PARENT_TOKEN = parentToken;
        if (parentToken == address(0)) {
            require(parentSnapshotId == 0);
        } else {
            if (parentSnapshotId == 0) {
                require(parentToken.currentSnapshotId() > 0);
                PARENT_SNAPSHOT_ID = parentToken.currentSnapshotId() - 1;
            } else {
                // make sure parentSnapshotId is not from the future
                require(parentSnapshotId < parentToken.currentSnapshotId());
                PARENT_SNAPSHOT_ID = parentSnapshotId;
            }
        }
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
        return totalSupplyAtInternal(mCurrentSnapshotId());
    }

    /// @param owner The address that's balance is being requested
    /// @return The balance of `owner` at the current block
    function balanceOf(address owner)
        public
        constant
        returns (uint256 balance)
    {
        return balanceOfAtInternal(owner, mCurrentSnapshotId());
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
    // Implements ITokenSnapshots
    //

    function totalSupplyAt(uint256 snapshotId)
        public
        constant
        returns(uint256)
    {
        return totalSupplyAtInternal(snapshotId);
    }

    function balanceOfAt(address owner, uint256 snapshotId)
        public
        constant
        returns (uint256)
    {
        return balanceOfAtInternal(owner, snapshotId);
    }

    function currentSnapshotId()
        public
        constant
        returns (uint256)
    {
        return mCurrentSnapshotId();
    }

    //
    // Implements IClonedTokenParent
    //

    function parentToken()
        public
        constant
        returns(IClonedTokenParent parent)
    {
        return PARENT_TOKEN;
    }

    /// @return snapshot at wchich initial token distribution was taken
    function parentSnapshotId()
        public
        constant
        returns(uint256 snapshotId)
    {
        return PARENT_SNAPSHOT_ID;
    }

    //
    // Other public functions
    //

    /// @notice gets all token balances of 'owner'
    /// @dev intended to be called via eth_call where gas limit is not an issue
    function allBalancesOf(address owner)
        external
        constant
        returns (uint256[2][] balances)
    {
        // copy to memory
        Values[] memory values = _balances[owner];
        // in memory structs have simple layout where every item occupies uint256
        assembly {
            balances := values
        }
        return balances;
    }

    ////////////////////////
    // Internal functions
    ////////////////////////

    function totalSupplyAtInternal(uint256 snapshotId)
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
            uint256 earlierSnapshotId = PARENT_SNAPSHOT_ID > snapshotId ? snapshotId : PARENT_SNAPSHOT_ID;
            return PARENT_TOKEN.totalSupplyAt(earlierSnapshotId);
        }

        // Default to an empty balance
        return 0;
    }

    // get balance at snapshot if with continuation in parent token
    function balanceOfAtInternal(address owner, uint256 snapshotId)
        internal
        constant
        returns (uint256)
    {
        Values[] storage values = _balances[owner];

        // If there is a value, return it, reverts if value is in the future
        if (hasValueAt(values, snapshotId)) {
            return getValueAt(values, snapshotId, 0);
        }

        // Try parent contract at or before the fork
        if (PARENT_TOKEN != address(0)) {
            uint256 earlierSnapshotId = PARENT_SNAPSHOT_ID > snapshotId ? snapshotId : PARENT_SNAPSHOT_ID;
            return PARENT_TOKEN.balanceOfAt(owner, earlierSnapshotId);
        }

        // Default to an empty balance
        return 0;
    }

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
