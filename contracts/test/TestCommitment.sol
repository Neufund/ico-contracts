pragma solidity 0.4.15;

import '../Commitment/PublicCommitment.sol';


contract TestCommitment is PublicCommitment {

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
    // Constructor
    ////////////////////////

    function TestCommitment(IAccessPolicy accessPolicy, EtherToken _ethToken, LockedAccount _lockedAccount, Neumark _neumark)
         PublicCommitment(accessPolicy, _ethToken, _lockedAccount, _neumark)
    {
    }

    ////////////////////////
    // Public functions
    ////////////////////////

    function succ()
        public
    {
        LOCKED_ACCOUNT.controllerSucceeded();
        _finalized = true;
    }

    function succWithLockRelease()
        public
    {
        // do not call lockedAccount just finalize
        // this will allow another controller to overtake lock
        _finalized = true;
    }

    function fail()
        public
    {
        LOCKED_ACCOUNT.controllerFailed();
        _finalized = true;
    }

    // a test function to change start date of ICO - may be useful for UI demo
    function changeStartDate(uint256 date)
        public
    {
        _startDate = date;
    }

    // a test function to change start date of ICO - may be useful for UI demo
    function changeEndDate(uint256 date)
        public
    {
        _endDate = date;
    }

    function changeMaxCap(uint256 _cap)
        public
    {
        _maxAbsCap = _cap;
    }

    function changeMinCap(uint256 _cap)
        public
    {
        _minAbsCap = _cap;
    }

    function investFor(address investor, uint256 amount, uint256 neumarks)
        public
        payable
    {
        // mint new ETH-T for yourself
        require(PAYMENT_TOKEN.deposit.value(msg.value)(address(this), amount));

        // make allowance for lock
        require(PAYMENT_TOKEN.approve(address(LOCKED_ACCOUNT), amount));

        // lock in lock
        LOCKED_ACCOUNT.lock(investor, amount, neumarks);
    }
}
