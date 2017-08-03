pragma solidity ^0.4.11;

import "truffle/Assert.sol";
import "truffle/DeployedAddresses.sol";
import "./helpers/SenderProxy.sol";
import "../contracts/LockedAccount.sol";

contract TestIcoContract {

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

    function TestIcoContract(LockedAccount _lock, MutableToken _ownedToken) {
        lock = _lock;
        ownedToken = _ownedToken;
    }
}

contract TestLockedAccount {
    // Truffle will send the TestContract one Ether after deploying the contract.
    uint public initialBalance = 10 ether;

    function spawnLock() returns (LockedAccount, TestIcoContract) {
        EtherToken ownedToken = new EtherToken();
        NeumarkSurrogate neumarkToken = NeumarkSurrogate(0);
        uint256 FP_SCALE = 10000; // todo do smth with this

        var locked = new LockedAccount(ownedToken, neumarkToken, 18 * 30 days, FP_SCALE / 10); //10 %
        var icoContract = new TestIcoContract(locked, ownedToken);
        locked.setController(icoContract);
        return (locked, icoContract);
    }

    function testLock() {
        var (lock, icoContract) = spawnLock();
        // new investor
        var investor = new SenderProxy();
        // mock lock time to test it
        uint timebase = block.timestamp;
        lock.mockTime(timebase);
        // only controller can lock
        uint8 rc = icoContract.investFor.value(1 ether)(address(investor), 1 ether, 0.5 ether);
        // uint8 rc = icoContract.lockFor.value(1 ether)(address(investor), 0, 0);
        Assert.equal((uint)(rc), 0, "Expected OK rc from lock()");
        // check if ownedToken supply is 1 ether
        Assert.equal(lock.totalLockedAmount(), 1 ether, "lock should own locked amount");
        Assert.equal(lock.ownedToken().totalSupply(), 1 ether, 'ownedToken should own locked amount');
        var (l_a, l_n, l_d) = lock.balanceOf(address(investor));
        Assert.equal(l_a, 1 ether, 'investor balance should equal locked eth');
        Assert.equal(l_n, 0.5 ether, 'investor neumarks due should equal neumarks');
        Assert.equal(lock.totalInvestors(), 1, 'should have 1 investor');
        // verify longstop date independently
        Assert.equal(l_d, timebase + 18 * 30 days, 'more or less 18 months in future');
        // lock someone else
        var investor2 = new SenderProxy();
        rc = icoContract.investFor.value(0.5 ether)(address(investor2), 0.5 ether, 0.1 ether);
        Assert.equal(lock.totalLockedAmount(), 1.5 ether, "lock should own locked amount");
        Assert.equal(lock.ownedToken().totalSupply(), 1.5 ether, 'ownedToken should own locked amount');
        Assert.equal(lock.totalInvestors(), 2, 'should have 2 investors');
    }

    function testUnlockWithPenalty() {
        var (lock, icoContract) = spawnLock();
        // new investor
        var investor = new SenderProxy();
        // mock lock time to test it
        uint timebase = block.timestamp;
        lock.mockTime(timebase);
        // only controller can lock
        uint8 rc = icoContract.investFor.value(1 ether)(address(investor), 1 ether, 0.5 ether);
        Assert.equal((uint)(rc), 0, "Expected OK rc from lock()");

    }
}
