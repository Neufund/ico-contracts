pragma solidity ^0.4.11;

import "truffle/Assert.sol";
import "truffle/DeployedAddresses.sol";
import "./helpers/SenderProxy.sol";
import "../contracts/LockedAccount.sol";

contract LockProxy is SenderProxy {
    function unlock() returns (uint8) {
        return (uint8)((LockedAccount)(_t).unlock());
    }
}

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

    function spawnLock() returns (LockedAccount, TestIcoContract, Curve) {
        EtherToken ownedToken = new EtherToken();
        NeumarkFactory nf = new NeumarkFactory();
        var nt = new Neumark(nf);
        var neumarkController = new NeumarkController(nt);
        nt.changeController(neumarkController);
        var curve = new Curve(neumarkController);

        uint256 FP_SCALE = 10000; // todo do smth with this
        var locked = new LockedAccount(ownedToken, curve, 18 * 30 days, FP_SCALE / 10); //10 %
        var icoContract = new TestIcoContract(locked, ownedToken);
        var feePool = new FeeDistributionPool(ownedToken, nt);
        locked.setPenaltyDistribution(feePool);
        locked.setController(icoContract);
        return (locked, icoContract, curve);
    }

    function testLock() {
        var (lock, icoContract, curve) = spawnLock();
        // new investor
        var investor = new LockProxy();
        investor._target(lock);
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
        var (lock, icoContract, curve) = spawnLock();
        // new investor
        var investor = new LockProxy();
        investor._target(lock);
        // mock lock time to test it
        uint timebase = block.timestamp;
        lock.mockTime(timebase);
        // issue real neumarks - we may burn same amount
        uint256 neumarks = curve.issue(1 ether, address(investor));
        Assert.equal(curve.NEUMARK_CONTROLLER().TOKEN().balanceOf(address(investor)), neumarks + 1, 'neumarks must be allocated');
        // only controller can lock
        uint8 rc = icoContract.investFor.value(1 ether)(address(investor), 1 ether, neumarks);
        Assert.equal((uint)(rc), 0, "Expected OK rc from lock()");
        // move time forward within longstop date
        lock.mockTime(timebase + 1 days);
        // controller says yes
        icoContract.succ();
        // only investor can unlock and must burn tokens
        rc = investor.unlock();
        Assert.equal((uint)(rc), 0, "Expected OK rc from unlock()");
        // check if ownedToken supply is 1 ether
        Assert.equal(lock.totalLockedAmount(), 0 ether, "all money sent to pool and to investor");
        Assert.equal(lock.ownedToken().totalSupply(), 1 ether, 'ownedToken should still hold 1 ether');
        var (l_a, l_n, l_d) = lock.balanceOf(address(investor));
        Assert.equal(l_d, 0, 'investor account deleted');
        Assert.equal(lock.totalInvestors(), 0, 'should have no investors');
        Assert.equal(lock.ownedToken().balanceOf(investor) + lock.ownedToken().balanceOf(lock.feePool()), 1 ether, "investor + penalty == 1 ether");

    }
}
