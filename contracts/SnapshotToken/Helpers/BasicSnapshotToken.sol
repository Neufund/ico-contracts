pragma solidity 0.4.15;

import '../../Snapshot/Snapshot.sol';
import '../../Standards/ISnapshotToken.sol';
import './MMint.sol';


contract BasicSnapshotToken is
    ISnapshotToken,
    MMint,
    Snapshot
{
    ////////////////////////
    // Immutable state
    ////////////////////////

    // `parentToken` is the Token address that was cloned to produce this token;
    //  it will be 0x0 for a token that was not cloned
    ISnapshotTokenParent private PARENT_TOKEN;

    // `parentSnapShotBlock` is the block number from the Parent Token that was
    //  used to determine the initial distribution of the Clone Token
    uint256 private PARENT_SNAPSHOT;

    ////////////////////////
    // Mutable state
    ////////////////////////

    // `balances` is the map that tracks the balance of each address, in this
    //  contract when the balance changes the block number that the change
    //  occurred is also included in the map
    mapping (address => Values[]) private _balances;

    // Tracks the history of the `totalSupply` of the token
    Values[] private _totalSupplyValues;

    ////////////////////////
    // Constructor
    ////////////////////////

    /// @notice Constructor to create a MiniMeToken
    /// @param parentToken Address of the parent token, set to 0x0 if it is a
    ///  new token
    function BasicSnapshotToken(
        ISnapshotTokenParent parentToken,
        uint256 parentSnapshot
    )
        public
        Snapshot()
    {
        PARENT_TOKEN = parentToken;
        PARENT_SNAPSHOT = parentSnapshot;
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
    /// @return Whether the transfer was successful or not
    function transfer(address to, uint256 amount)
        public
        returns (bool success)
    {
        return mTransfer(msg.sender, to, amount);
    }

    //
    // Implements ISnapshotTokenParent
    //

    /// @notice Total amount of tokens at a specific `snapshot`.
    /// @param snapshot The block number when the totalSupply is queried
    /// @return The total amount of tokens at `snapshot`
    function totalSupplyAt(uint256 snapshot)
        public
        constant
        returns(uint256)
    {
        Values[] storage values = _totalSupplyValues;

        // If there is a value, return it
        if (hasValueAt(values, snapshot)) {
            return getValueAt(values, snapshot, 0);
        }

        // Try parent contract at or before the fork
        if (address(PARENT_TOKEN) != 0) {
            return PARENT_TOKEN.totalSupplyAt(PARENT_SNAPSHOT);
        }

        // Default to an empty balance
        return 0;
    }

    /// @dev Queries the balance of `owner` at a specific `snapshot`
    /// @param owner The address from which the balance will be retrieved
    /// @param snapshot The block number when the balance is queried
    /// @return The balance at `snapshot`
    function balanceOfAt(address owner, uint256 snapshot)
        public
        constant
        returns (uint256)
    {
        Values[] storage values = _balances[owner];

        // If there is a value, return it
        if (hasValueAt(values, snapshot)) {
            return getValueAt(values, snapshot, 0);
        }

        // Try parent contract at or before the fork
        if (address(PARENT_TOKEN) != 0) {
            return PARENT_TOKEN.balanceOfAt(owner, PARENT_SNAPSHOT);
        }

        // Default to an empty balance
        return 0;
    }

    ////////////////////////
    // Internal functions
    ////////////////////////

    //
    // Implements MMint
    //

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
        returns(bool)
    {
        if (amount == 0) {
            return true;
        }

        // If the amount being transfered is more than the balance of the
        //  account the transfer fails
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
        return true;
    }

    /// @notice Generates `amount` tokens that are assigned to `owner`
    /// @param owner The address that will be assigned the new tokens
    /// @param amount The quantity of tokens generated
    /// @return True if the tokens are generated correctly
    function mGenerateTokens(address owner, uint256 amount)
        internal
        returns (bool)
    {
        uint256 curTotalSupply = totalSupply();
        uint256 newTotalSupply = curTotalSupply + amount;
        require(newTotalSupply >= curTotalSupply); // Check for overflow

        uint256 previousBalanceTo = balanceOf(owner);
        uint256 newBalanceTo = previousBalanceTo + amount;
        assert(newBalanceTo >= previousBalanceTo); // Check for overflow

        setValue(_totalSupplyValues, newTotalSupply);
        setValue(_balances[owner], newBalanceTo);

        Transfer(0, owner, amount);
        return true;
    }

    /// @notice Burns `amount` tokens from `owner`
    /// @param owner The address that will lose the tokens
    /// @param amount The quantity of tokens to burn
    /// @return True if the tokens are burned correctly
    function mDestroyTokens(address owner, uint256 amount)
        internal
        returns (bool)
    {
        uint256 curTotalSupply = totalSupply();
        require(curTotalSupply >= amount);

        uint256 previousBalanceFrom = balanceOf(owner);
        require(previousBalanceFrom >= amount);

        uint256 newTotalSupply = curTotalSupply - amount;
        uint256 newBalanceFrom = previousBalanceFrom - amount;
        setValue(_totalSupplyValues, newTotalSupply);
        setValue(_balances[owner], newBalanceFrom);

        Transfer(owner, 0, amount);
        return true;
    }
}
