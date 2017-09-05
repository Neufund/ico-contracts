pragma solidity 0.4.15;

import '../Commitment/PublicCommitment.sol';


contract TestCommitment is PublicCommitment {

    ////////////////////////
    // Events
    ////////////////////////

    // this will make truffle to find this event in receipt
    event FundsLocked(address indexed investor, uint256 amount, uint256 neumarks);

    ////////////////////////
    // Constructor
    ////////////////////////

    function TestCommitment(
        IAccessPolicy accessPolicy,
        EtherToken _ethToken,
        LockedAccount _lockedAccount,
        Neumark _neumark
    )
         PublicCommitment(accessPolicy, _ethToken, _lockedAccount, _neumark)
    {
    }

    ////////////////////////
    // Public functions
    ////////////////////////

    function _succ() {
        lockedAccount.controllerSucceeded();
        finalized = true;
    }

    function _succWithLockRelease() {
        // do not call lockedAccount just finalize
        // this will allow another controller to overtake lock
        finalized = true;
    }

    function _fail() {
        lockedAccount.controllerFailed();
        finalized = true;
    }

    function _investFor(
        address investor,
        uint256 amount,
        uint256 neumarks
    )
        public
        payable
    {
        // mint new ETH-T for yourself
        require(paymentToken.deposit.value(msg.value)(address(this), amount));

        // make allowance for lock
        require(paymentToken.approve(address(lockedAccount), amount));

        // lock in lock
        lockedAccount.lock(investor, amount, neumarks);
    }
}
