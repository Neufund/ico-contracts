pragma solidity 0.4.15;

import '../../Standards/ISnapshotable.sol';
import '../MSnapshotPolicy.sol';


/// @title creates snapshot on demand via ISnapshotable interface
contract Snapshotable is
    MSnapshotPolicy,
    ISnapshotable
{
    ////////////////////////
    // Mutable state
    ////////////////////////

    uint256 private _currentSnapshotId;

    ////////////////////////
    // Constructor
    ////////////////////////

    function Snapshotable(uint256 start)
        internal
    {
        _currentSnapshotId = start;
    }

    ////////////////////////
    // Public functions
    ////////////////////////

    function createSnapshot()
        public
        returns (uint256)
    {
        require(_currentSnapshotId < 2**256 - 1);

        // Increment the snapshot counter
        _currentSnapshotId += 1;

        // Log and return
        LogSnapshotCreated(_currentSnapshotId);
        return _currentSnapshotId;
    }

    ////////////////////////
    // Internal functions
    ////////////////////////

    function mixinNextSnapshotId()
        internal
        returns (uint256)
    {
        return _currentSnapshotId;
    }
}
