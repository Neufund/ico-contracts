pragma solidity 0.4.15;

import './MSnapshotPolicy.sol';


contract EveryBlock is MSnapshotPolicy {

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
        return block.number;
    }

    function mFlagSnapshotModified()
        internal
    {
    }
}
