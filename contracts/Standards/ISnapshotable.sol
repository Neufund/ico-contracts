pragma solidity 0.4.15;


contract ISnapshotable {

    ////////////////////////
    // Events
    ////////////////////////

    event LogSnapshotCreated(uint256 snapshotId);

    ////////////////////////
    // Public functions
    ////////////////////////

    /// always creates new snapshot id which gets returned
    /// however, there is no guarantee that any snapshot will be created with this id, this depends on the implementation of MSnaphotPolicy
    function createSnapshot()
        public
        returns (uint256);

    /// last created snapshot id
    function lastSnapshotId()
        public
        constant
        returns (uint256);
}
