pragma solidity 0.4.15;

import '../Snapshot/DailyAndSnapshotable.sol';
import '../SnapshotToken/StandardSnapshotToken.sol';


contract TestSnapshotToken is
    DailyAndSnapshotable,
    StandardSnapshotToken
{
    ////////////////////////
    // Mutable state
    ////////////////////////

    bool private _enableTransfers;

    bool private _enableApprovals;

    ////////////////////////
    // Constructor
    ////////////////////////

    function TestSnapshotToken(
        IClonedTokenParent parentToken,
        uint256 parentSnapshotId
    )
        StandardSnapshotToken(
            parentToken,
            parentSnapshotId
        )
        // continue snapshot series of the parent, also will prevent using incompatible scheme
        DailyAndSnapshotable(parentToken == address(0) ? 0 : parentToken.currentSnapshotId())
    {
        _enableTransfers = true;
        _enableApprovals = true;
    }

    ////////////////////////
    // Public functions
    ////////////////////////

    function deposit(uint256 amount)
        public
    {
        mGenerateTokens(msg.sender, amount);
    }

    function withdraw(uint256 amount)
        public
    {
        mDestroyTokens(msg.sender, amount);
    }

    function enableTransfers(bool enable)
        public
    {
        _enableTransfers = enable;
    }

    function enableApprovals(bool enable)
        public
    {
        _enableApprovals = enable;
    }

    ////////////////////////
    // Internal functions
    ////////////////////////

    //
    // Implements MTokenController
    //

    function mOnTransfer(
        address,
        address, // to
        uint256 // amount
    )
        internal
        returns (bool allow)
    {
        return _enableTransfers;
    }

    function mOnApprove(
        address,
        address, // spender,
        uint256 // amount
    )
        internal
        returns (bool allow)
    {
        return _enableApprovals;
    }
}
