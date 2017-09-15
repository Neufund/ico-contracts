pragma solidity 0.4.15;

import "../LockedAccount.sol";


contract TestLockedAccountController {

    ////////////////////////
    // Events
    ////////////////////////

    // this will make truffle to find this event in receipt
    event LogFundsLocked(
        address indexed investor,
        uint256 amount,
        uint256 neumarks
    );

    ////////////////////////
    // Immutable state
    ////////////////////////

    LockedAccount private LOCKED_ACCOUNT;

    ////////////////////////
    // Constructor
    ////////////////////////

    function TestLockedAccountController(LockedAccount lockedAccount) {
        LOCKED_ACCOUNT = lockedAccount;
    }

    ////////////////////////
    // Public functions
    ////////////////////////

    function succ()
        public
    {
        LOCKED_ACCOUNT.controllerSucceeded();
    }

    function succWithLockRelease()
        public
    {
        // do not call lockedAccount just finalize
    }

    function fail()
        public
    {
        LOCKED_ACCOUNT.controllerFailed();
    }

    // must deposit token for this contract and then call investFor
    function investFor(address investor, uint256 amount, uint256 neumarks)
        public
    {
        // require(PAYMENT_TOKEN.deposit.value(msg.value)(address(this), amount));

        // make allowance for lock
        require(LOCKED_ACCOUNT.assetToken().approve(address(LOCKED_ACCOUNT), amount));
        // lock in lock
        LOCKED_ACCOUNT.lock(investor, amount, neumarks);
    }
}
