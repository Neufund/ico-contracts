pragma solidity 0.4.15;

import '../Standards/ISnapshotable.sol';
import './MSnapshotPolicy.sol';


/// @title creates snapshot id on each day boundary and allows to create additional snapshots within a given day
/// @dev snapshots are encoded in single uint256, where high 128 bits represents a day number (from unix epoch) and low 128 bits represents additional snapshots within given day create via ISnapshotable
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

    uint256 private _currentSnapshotId;

    ////////////////////////
    // Constructor
    ////////////////////////

    /// @param start snapshotId from which to start generating values
    /// @dev start must be for the same day or 0, required for token cloning
    function DailyAndSnapshotable(uint256 start) internal {
        // 0 is invalid value as we are past unix epoch
        if (start > 0) {
            uint256 dayBase = snapshotAt(block.timestamp);
            require(start >= dayBase);
            // dayBase + 2**128 will not overflow as it is based on block.timestamp
            require(start < dayBase + 2**128);
            _currentSnapshotId = start;
        }
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

    //
    // Implements ISnapshotable
    //

    function createSnapshot()
        public
        returns (uint256)
    {
        uint256 dayBase = 2**128 * (block.timestamp / 1 days);

        if (dayBase > _currentSnapshotId) {
            // New day has started, create snapshot for midnight
            _currentSnapshotId = dayBase;
        } else {
            // within single day, increase counter (assume 2**128 will not be crossed)
            _currentSnapshotId += 1;
        }

        // Log and return
        LogSnapshotCreated(_currentSnapshotId);
        return _currentSnapshotId;
    }

    function currentSnapshotId()
        public
        constant
        returns (uint256)
    {
        return mCurrentSnapshotId();
    }

    ////////////////////////
    // Internal functions
    ////////////////////////

    //
    // Implements MSnapshotPolicy
    //

    function mCurrentSnapshotId()
        internal
        returns (uint256)
    {
        uint256 dayBase = 2**128 * (block.timestamp / 1 days);

        // New day has started
        if (dayBase > _currentSnapshotId) {
            _currentSnapshotId = dayBase;
            LogSnapshotCreated(dayBase);
        }

        return _currentSnapshotId;
    }
}
