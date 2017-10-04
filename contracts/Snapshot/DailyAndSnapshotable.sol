pragma solidity 0.4.15;

import '../Standards/ISnapshotable.sol';
import './MSnapshotPolicy.sol';


contract DailyAndSnapshotable is
    MSnapshotPolicy,
    ISnapshotable
{
    ////////////////////////
    // Constants
    ////////////////////////

    // Floor[2**128 / 1 days]
    uint256 private MAX_TIMESTAMP = 3938453320844195178974243141571391;

    ////////////////////////
    // Mutable state
    ////////////////////////

    uint256 private _nextSnapshotId;

    bool private _nextSnapshotModified;

    ////////////////////////
    // Constructor
    ////////////////////////

    function DailyAndSnapshotable() {
        uint256 dayBase = 2**128 * (block.timestamp / 1 days);
        _nextSnapshotId = dayBase + 1;
        _nextSnapshotModified = false;
    }

    ////////////////////////
    // Public functions
    ////////////////////////

    function snapshotAt(uint256 timestamp)
        public
        constant
        returns (uint256)
    {
        require(timestamp < MAX_TIMESTAMP);

        uint256 dayBase = 2**128 * (timestamp / 1 days);
        return dayBase;
    }

    function createSnapshot()
        public
        returns (uint256)
    {
        uint256 dayBase = 2**128 * (block.timestamp / 1 days);

        // New day has started, create snapshot for midnight
        if (dayBase > _nextSnapshotId) {
            _nextSnapshotId = dayBase + 1;
            _nextSnapshotModified = false;

            LogSnapshotCreated(dayBase);
            return dayBase;
        }

        // Same day, no modifications
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

    //
    // Implements MSnapshotPolicy
    //

    function mNextSnapshotId()
        internal
        returns (uint256)
    {
        uint256 dayBase = 2**128 * (block.timestamp / 1 days);

        // New day has started
        if (dayBase > _nextSnapshotId) {
            _nextSnapshotId = dayBase + 1;
            _nextSnapshotModified = false;

            LogSnapshotCreated(dayBase);
            return _nextSnapshotId;
        }

        // Within same day
        return _nextSnapshotId;
    }

    function mFlagSnapshotModified()
        internal
    {
        if (!_nextSnapshotModified) {
            _nextSnapshotModified = true;
        }
    }
}
