pragma solidity ^0.4.11;

import "../LockedAccount.sol";

contract TestCommitmentContract {

    LockedAccount private lock;
    MutableToken private ownedToken;

    function succ() {
        lock.controllerSucceeded();
    }

    function fail() {
        lock.controllerFailed();
    }

    function investFor(address investor, uint256 amount, uint256 neumarks)
        payable
        returns (uint8)
    {
        // mint new ETH-T for yourself
        require(ownedToken.deposit.value(msg.value)(address(this), amount));
        // make allowance for lock
        require(ownedToken.approve(address(lock), amount));
        // lock in lock
        return (uint8)(lock.lock(investor, amount, neumarks));
    }

    function invest()
        payable
        returns (uint8)
    {
        // call neumark contracts to mine
        require(msg.value > 0);
        uint256 neumarks = msg.value / 6; //emulate curve
        // mint new ETH-T for yourself
        require(ownedToken.deposit.value(msg.value)(address(this), msg.value));
        // make allowance for lock
        require(ownedToken.approve(address(lock), msg.value));
        // lock in lock
        require((uint8)(lock.lock(msg.sender, msg.value, neumarks)) == 0);
    }

    function TestCommitmentContract(LockedAccount _lock, MutableToken _ownedToken) {
        lock = _lock;
        ownedToken = _ownedToken;
    }
}
