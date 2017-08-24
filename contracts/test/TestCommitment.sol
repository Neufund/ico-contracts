pragma solidity ^0.4.11;

import '../PublicCommitment.sol';

contract TestCommitment is PublicCommitment {

    // this will make truffle to find this event in receipt
    event FundsLocked(address indexed investor, uint256 amount, uint256 neumarks);

    function _succ() {
        lockedAccount.controllerSucceeded();
    }

    function _fail() {
        lockedAccount.controllerFailed();
    }

    // a test function to change start date of ICO - may be useful for UI demo
    function _changeStartDate(uint256 date)
        public
    {
        startDate = date;
    }

    // a test function to change start date of ICO - may be useful for UI demo
    function _changeEndDate(uint256 date)
        public
    {
        endDate = date;
    }

    function _changeMaxCap(uint256 _cap)
        public
    {
        maxAbsCap = _cap;
    }

    function _changeMinCap(uint256 _cap)
        public
    {
        minAbsCap = _cap;
    }

    function _investFor(address investor, uint256 amount, uint256 neumarks)
        payable
    {
        // mint new ETH-T for yourself
        require(paymentToken.deposit.value(msg.value)(address(this), amount));
        // make allowance for lock
        require(paymentToken.approve(address(lockedAccount), amount));
        // lock in lock
        lockedAccount.lock(investor, amount, neumarks);
    }

    function TestCommitment(uint256 _startDate, uint256 _endDate, uint256 _minCommitment, uint256 _maxCommitment,
        uint256 _minTicket, uint256 _ethEurFraction, ITokenWithDeposit _ethToken, LockedAccount _lockedAccount, Curve _curve)
         PublicCommitment(_startDate, _endDate, _minCommitment, _maxCommitment, _minTicket, _ethEurFraction,
             _ethToken, _lockedAccount, _curve)
    {
    }
}
