pragma solidity 0.4.15;

import '../Snapshot/Snapshot.sol';
import '../Snapshot/DailyAndSnapshotable.sol';

contract SnapshotTest is
    Snapshot,
    DailyAndSnapshotable
{
    Values[] val;

    function curDays()
        public
        constant
        returns (uint)
    {
        return block.timestamp / 1 days;
    }

    function hasValue()
        public
        constant
        returns (bool)
    {
        return hasValue(val);
    }


    function getValue(uint256 def)
        public
        constant
        returns (uint256)
    {
        return getValue(val, def);
    }

    function hasValueAt(uint256 snapshot)
        public
        constant
        returns (bool)
    {
        return hasValueAt(val, snapshot);
    }

    function getValueAt(uint256 snapshot, uint256 def)
        public
        constant
        returns (uint256)
    {
        return getValueAt(val, snapshot, def);
    }

    function setValue(uint256 x)
        public
    {
        setValue(val, x);
    }
}
