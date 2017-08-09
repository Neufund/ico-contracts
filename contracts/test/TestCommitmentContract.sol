pragma solidity ^0.4.11;

import "../LockedAccount.sol";
import '../TokenWithDeposit.sol';

contract TestCommitmentContract is ReturnsErrors {

    LockedAccount private lock;
    TokenWithDeposit private ownedToken;

    function succ() {
        lock.controllerSucceeded();
    }

    function fail() {
        lock.controllerFailed();
    }

    function investFor(address investor, uint256 amount, uint256 neumarks)
        payable
    {
        // mint new ETH-T for yourself
        require(ownedToken.deposit.value(msg.value)(address(this), amount));
        // make allowance for lock
        require(ownedToken.approve(address(lock), amount));
        // lock in lock
        lock.lock(investor, amount, neumarks);
    }

    function invest()
        payable
        returns (Status)
    {
        // call neumark contracts to mine
        require(msg.value > 0);
        uint256 neumarks = msg.value / 6; //emulate curve
        // mint new ETH-T for yourself
        require(ownedToken.deposit.value(msg.value)(address(this), msg.value));
        // make allowance for lock
        require(ownedToken.approve(address(lock), msg.value));
        // lock in lock
        lock.lock(msg.sender, msg.value, neumarks);
        return Status.SUCCESS;
    }

    function TestCommitmentContract(LockedAccount _lock, TokenWithDeposit _ownedToken) {
        lock = _lock;
        ownedToken = _ownedToken;
    }
}
