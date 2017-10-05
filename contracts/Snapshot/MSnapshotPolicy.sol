pragma solidity 0.4.15;


/// @title Mixin for the snapshot policy which abstracts snapshot creation mechanics
/// @dev to be implemented and such implementation should be mixed in with Snapshot contract, see EveryBlock for simplest example
contract MSnapshotPolicy {

    ////////////////////////
    // Internal functions
    ////////////////////////

    // The snapshot Ids need to be monotonically increasing.
    // Whenever the snaspshot id changes, a new snapshot will
    // be created. As long as the same value is being returned,
    // this snapshot will be updated.
    //
    // Values passed to `hasValueAt` and `valuteAt` are required
    // to be strictly less than `mixinNextSnapshotId()`.
    function mNextSnapshotId()
        internal
        returns (uint256);

    function mFlagSnapshotModified()
        internal;
}
