pragma solidity 0.4.15;

import '../Standards/ISnapshotable.sol';
import './MSnapshotPolicy.sol';


contract Snapshotable is
    MSnapshotPolicy,
    ISnapshotable
{
    ////////////////////////
    // Mutable state
    ////////////////////////

    uint256 private _nextSnapshotId;

    bool private _nextSnapshotModified;

    ////////////////////////
    // Constructor
    ////////////////////////

    function Snapshotable(uint256 start)
        internal
    {
        _nextSnapshotId = start;
        _nextSnapshotModified = true;
    }

    ////////////////////////
    // Public functions
    ////////////////////////

    function createSnapshot()
        public
        returns (uint256)
    {
        require(_nextSnapshotId < 2**256 - 1);

        // If the snapshot was not modified, return
        // the previous snapshot id. Their states
        // are identical.
        if (!_nextSnapshotModified) {
            uint256 previousSnapshot = _nextSnapshotId - 1;

            // Log the event anyway, some logic may depend
            // depend on it.
            LogSnapshotCreated(previousSnapshot);
            return previousSnapshot;
        }

        // Increment the snapshot counter
        uint256 snapshotId = _nextSnapshotId;
        _nextSnapshotId += 1;
        _nextSnapshotModified = false;

        // Log and return
        LogSnapshotCreated(snapshotId);
        return snapshotId;
    }

    ////////////////////////
    // Internal functions
    ////////////////////////

    function mixinNextSnapshotId()
        internal
        returns (uint256)
    {
        return _nextSnapshotId;
    }

    function mixinFlagSnapshotModified()
        internal
    {
        if (!_nextSnapshotModified) {
            _nextSnapshotModified = true;
        }
    }
}
