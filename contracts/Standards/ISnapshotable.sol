pragma solidity 0.4.15;


contract ISnapshotable {

    ////////////////////////
    // Events
    ////////////////////////

    event LogSnapshotCreated(uint256 snapshotId);

    ////////////////////////
    // Public functions
    ////////////////////////

    function createSnapshot()
        public
        returns (uint256);

}
