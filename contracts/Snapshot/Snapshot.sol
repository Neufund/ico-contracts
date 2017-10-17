pragma solidity 0.4.15;

import './MSnapshotPolicy.sol';


/// @title Reads and writes snapshots
/// @dev Manages reading and writing a series of values, where each value has assigned a snapshot id for access to historical data
/// @dev may be added to any contract to provide snapshotting mechanism. should be mixed in with any of MSnapshotPolicy implementations to customize snapshot creation mechanics
/// based on MiniMe token
contract Snapshot is MSnapshotPolicy {

    ////////////////////////
    // Types
    ////////////////////////

    /// @dev `Values` is the structure that attaches a snapshot id to a
    ///  given value, the snapshot id attached is the one that last changed the
    ///  value
    struct Values {

        // `snapshotId` is the snapshot id that the value was generated at
        uint256 snapshotId;

        // `value` at a specific snapshot id
        uint256 value;
    }

    ////////////////////////
    // Internal functions
    ////////////////////////

    function hasValue(
        Values[] storage values
    )
        internal
        constant
        returns (bool)
    {
        return values.length > 0;
    }

    /// @dev makes sure that 'snapshotId' between current snapshot id (mCurrentSnapshotId) and first snapshot id. this guarantees that getValueAt returns value from one of the snapshots.
    function hasValueAt(
        Values[] storage values,
        uint256 snapshotId
    )
        internal
        constant
        returns (bool)
    {
        require(snapshotId <= mCurrentSnapshotId());
        return values.length > 0 && values[0].snapshotId <= snapshotId;
    }

    /// gets last value in the series
    function getValue(
        Values[] storage values,
        uint256 defaultValue
    )
        internal
        constant
        returns (uint256)
    {
        if (values.length == 0) {
            return defaultValue;
        } else {
            uint256 last = values.length - 1;
            return values[last].value;
        }
    }

    /// @dev `getValueAt` retrieves value at a given snapshot id
    /// @param values The series of values being queried
    /// @param snapshotId Snapshot id to retrieve the value at
    /// @return Value in series being queried
    function getValueAt(
        Values[] storage values,
        uint256 snapshotId,
        uint256 defaultValue
    )
        internal
        constant
        returns (uint256)
    {
        require(snapshotId <= mCurrentSnapshotId());

        // Empty value
        if (values.length == 0) {
            return defaultValue;
        }

        // Shortcut for the out of bounds snapshots
        uint256 last = values.length - 1;
        uint256 lastSnapshot = values[last].snapshotId;
        if (snapshotId >= lastSnapshot) {
            return values[last].value;
        }
        uint256 firstSnapshot = values[0].snapshotId;
        if (snapshotId < firstSnapshot) {
            return defaultValue;
        }
        // Binary search of the value in the array
        uint256 min = 0;
        uint256 max = last;
        while (max > min) {
            uint256 mid = (max + min + 1) / 2;
            // must always return lower indice for approximate searches
            if (values[mid].snapshotId <= snapshotId) {
                min = mid;
            } else {
                max = mid - 1;
            }
        }
        return values[min].value;
    }

    /// @dev `setValue` used to update sequence at next snapshot
    /// @param values The sequence being updated
    /// @param value The new last value of sequence
    function setValue(
        Values[] storage values,
        uint256 value
    )
        internal
    {
        // TODO: simplify or break into smaller functions

        uint256 currentSnapshotId = mCurrentSnapshotId();
        // Always create a new entry if there currently is no value
        bool empty = values.length == 0;
        if (empty) {
            // Create a new entry
            values.push(
                Values({
                    snapshotId: currentSnapshotId,
                    value: value
                })
            );
            return;
        }

        uint256 last = values.length - 1;
        bool hasNewSnapshot = values[last].snapshotId < currentSnapshotId;
        if (hasNewSnapshot) {

            // Do nothing if the value was not modified
            bool unmodified = values[last].value == value;
            if (unmodified) {
                return;
            }

            // Create new entry
            values.push(
                Values({
                    snapshotId: currentSnapshotId,
                    value: value
                })
            );
        } else {

            // We are updating the currentSnapshotId
            bool previousUnmodified = last > 0 && values[last - 1].value == value;
            if (previousUnmodified) {
                // Remove current snapshot if current value was set to previous value
                delete values[last];
                values.length--;
                return;
            }

            // Overwrite next snapshot entry
            values[last].value = value;
        }
    }
}
