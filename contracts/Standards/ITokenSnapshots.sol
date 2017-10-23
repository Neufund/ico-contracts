pragma solidity 0.4.15;


/// @title access to snapshots of a token
/// @notice allows to implement complex token holder rights like revenue disbursal or voting
/// @notice snapshots are series of values with assigned ids. ids increase strictly. particular id mechanism is not assumed
contract ITokenSnapshots {

    ////////////////////////
    // Public functions
    ////////////////////////

    /// @notice Total amount of tokens at a specific `snapshotId`.
    /// @param snapshotId of snapshot at which totalSupply is queried
    /// @return The total amount of tokens at `snapshotId`
    /// @dev reverts on snapshotIds greater than currentSnapshotId()
    /// @dev returns 0 for snapshotIds less than snapshotId of first value
    function totalSupplyAt(uint256 snapshotId)
        public
        constant
        returns(uint256);

    /// @dev Queries the balance of `owner` at a specific `snapshotId`
    /// @param owner The address from which the balance will be retrieved
    /// @param snapshotId of snapshot at which the balance is queried
    /// @return The balance at `snapshotId`
    function balanceOfAt(address owner, uint256 snapshotId)
        public
        constant
        returns (uint256);

    /// @notice upper bound of series of snapshotIds for which there's a value in series
    /// @return snapshotId
    function currentSnapshotId()
        public
        constant
        returns (uint256);
}
