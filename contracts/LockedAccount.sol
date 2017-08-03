pragma solidity ^0.4.11;

import 'zeppelin-solidity/contracts/token/ERC20Basic.sol';
import 'zeppelin-solidity/contracts/math/SafeMath.sol';
import 'zeppelin-solidity/contracts/ownership/Ownable.sol';
import './TimeSource.sol';
import './EtherToken.sol';

contract NeumarkSurrogate is ERC20Basic {
    // will burn tokens of 'who' that were pre-approved to be burned for the 'sender'
    function burn(address who, uint256 amount) returns (bool);
    function addRevenue(ERC20Basic fromToken, uint256 amount) returns (bool);
}

/* contract LockedAccountMigration {
  modifier onlyOldLockedAccount() {
    require(msg.sender == getOldLockedAccount());
    _;
  }

  // only old locked account can call migrate function
  function getOldLockedAccount() public constant returns (address);
  function migrate(address investor, uint balance, uint neumarkCost, uint32 longstopDate) onlyOldLockedAccount public;
} */

contract LockedAccount is Ownable, TimeSource {
    using SafeMath for uint256;
    //events
    event FundsLocked(address indexed investor, uint256 amount, uint256 neumarks);
    event FundsUnlocked(address indexed investor, uint256 amount);

    // event raised when return code from a function is not OK, when OK is returned one of events above is raised
    event ReturnCode(ReturnCodes rc);

    //enums
    // use retrun codes until revert opcode is implemented
    enum ReturnCodes { OK, CannotBurnNeumarks, NoFunds }
    enum LockState {Uncontrolled, AcceptingLocks, AcceptingUnlocks, ReleaseAll }

    // total amount of tokens locked
    uint public totalLockedAmount;
    // total number of locked investors
    uint public totalInvestors;
    // a token controlled by LockedAccount, read ERC20 + extensions to read what token is it (ETH/EUR etc.)
    ERC20 public ownedToken;
    // current state of the locking contract
    LockState public lockState;
    // longstop period in seconds
    uint public LONGSTOP_PERIOD;
    // penalty with Math.FP_SCALE()
    uint public PENALTY_PRC;
    // govering ICO contract that may lock money or unlock all account if fails
    address public controller;
    // scale of the emulated fixed point operations
    // todo: use some nice lib for percentages etc.
    uint constant public FP_SCALE = 10000;

    NeumarkSurrogate private neumarkToken;
    // LockedAccountMigration private migration;
    mapping(address => Account) accounts;

    struct Account {
        uint256 balance;
        uint256 neumarksDue;
        uint256 longstopDate;
    }

    //modifiers
    modifier onlycontroller {
        require(msg.sender == controller);
        _;
    }

    modifier onlyState(LockState state) {
        require(lockState == state);
        _;
    }

    modifier onlyStates(LockState state1, LockState state2) {
        require(lockState == state1 || lockState == state2);
        _;
    }

    // deposits 'amount' of tokens on MutableToken ownedToken contracts
    // locks 'amount' for 'investor' address
    // callable only from ICO contract that gets currency directly (ETH/EUR)
    function lock(address investor, uint256 amount, uint256 neumarks)
        onlycontroller
        onlyState(LockState.AcceptingLocks)
        public
        returns (ReturnCodes)
    {
        require(amount > 0);
        // check if controller made allowance
        require(ownedToken.allowance(msg.sender, address(this)) >= amount);
        // transfer to self yourself
        require(ownedToken.transferFrom(msg.sender, address(this), amount));
        Account storage a = accounts[investor];
        a.balance = _addBalance(a.balance, amount);
        a.neumarksDue += neumarks;
        if (a.longstopDate == 0) {
            // this is new account - longstopDate always > 0
            totalInvestors += 1;
            a.longstopDate = currentTime() + LONGSTOP_PERIOD;
        }
        accounts[investor] = a;
        FundsLocked(investor, amount, neumarks);
        return ReturnCodes.OK;
    }

    // unlocks msg.sender tokens by making them withdrawable in ownedToken
    // expects number of neumarks that is due to be available to be burned on msg.sender balance - see comments
    // if used before longstop date, calculates penalty and distributes it as revenue
    function unlock()
        onlyStates(LockState.AcceptingUnlocks, LockState.ReleaseAll)
        public
        returns (ReturnCodes)
    {
        Account storage a = accounts[msg.sender];
        // if there is anything to unlock
        if (a.balance > 0) {
            // in ReleaseAll just give money back by transfering to msg.sender
            if (lockState == LockState.AcceptingUnlocks) {
                // burn neumarks corresponding to unspent funds
                // address(this) has right to burn Neumarks OR it was pre approved by msg.sender: @remco?
                if(!neumarkToken.burn(msg.sender, a.neumarksDue))
                    return _logerror(ReturnCodes.CannotBurnNeumarks);
                // take the penalty if before longstopdate
                if (currentTime() < a.longstopDate) {
                    // todo: should use divRound
                    uint256 penalty = a.balance.mul(PENALTY_PRC).div(FP_SCALE); // Math.divRound(Math.mul(a.balance, PENALTY_PRC), FP_SCALE);
                    // transfer penalty to neumark contract
                    require(ownedToken.transfer(address(neumarkToken), penalty));
                    // distribute revenue via Neumark contract
                    require(neumarkToken.addRevenue(ownedToken, penalty));
                    a.balance = _subBalance(a.balance, penalty);
                }
            }
            // transfer amount back to investor - now it can withdraw
            require(ownedToken.transfer(msg.sender, a.balance));
        }
        // remove balance, investor and
        FundsUnlocked(msg.sender, a.balance);
        _subBalance(a.balance, a.balance);
        totalInvestors -= 1;
        delete accounts[msg.sender];
        return ReturnCodes.OK;
    }

    function balanceOf(address investor)
        constant
        public
        returns (uint256, uint256, uint256)
    {
        Account storage a = accounts[investor];
        return (a.balance, a.neumarksDue, a.longstopDate);
    }

    // todo: move to test that derive from LockedAccount
    // invests in equity token ICO
    function invest(address ico, uint256 amount)
        onlyState(LockState.AcceptingUnlocks)
        public
        returns (ReturnCodes)
    {
        require(amount > 0);
        require(ico != address(0));
        Account storage a = accounts[msg.sender];
        if (amount > a.balance)
            return _logerror(ReturnCodes.NoFunds);
        //if (canInvest(ico) {
            // or whatever interface we'll have here to notify of balance change!
        //    ico.invest(amount);
        //}
        // decrease neumarks due pro rata - high precision may overflow @todo testing
        // todo: should use divRound
        uint256 freedNeumarks = amount.mul(a.neumarksDue).div(a.balance); // Math.divRound(Math.mul(amount, a.neumarksDue), a.balance);
        a.balance -= amount;
        // possible precision problems
        if (a.balance == 0 || a.neumarksDue < freedNeumarks)
            a.neumarksDue = 0;
        else
            a.neumarksDue -= freedNeumarks;
        accounts[msg.sender] = a;
        return ReturnCodes.OK;
    }

    // allows to anyone to release all funds without burning Neumarks
    function controllerFailed()
        onlyState(LockState.AcceptingLocks)
        onlycontroller
        public
    {
        lockState = LockState.ReleaseAll;
    }

    function controllerSucceeded()
        onlyState(LockState.AcceptingLocks)
        onlycontroller
        public
    {
        lockState = LockState.AcceptingUnlocks;
    }

    // todo: not implemented
    /* function migrate()
        public
    {
        requires(address(migration) != 0);
        // migrates
    }*/

    function setController(address _controller)
        onlyOwner
        onlyState(LockState.Uncontrolled)
        public
    {
        require(controller == address(0));
        controller = _controller;
        lockState = LockState.AcceptingLocks;
    }

    // _ownedToken - token contract with resource locked by LockedAccount, where LockedAccount is allowed to make deposits
    // _neumarkToken - neumark token contract where LockedAccount is allowed to burn tokens and add revenue
    // _controller - typically ICO contract: can lock, release all locks, enable escape hatch
    function LockedAccount(ERC20 _ownedToken, NeumarkSurrogate _neumarkToken,
        uint _longstopPeriod, uint _penaltyPrc)
    {
        ownedToken = _ownedToken;
        neumarkToken = _neumarkToken;
        LONGSTOP_PERIOD = _longstopPeriod;
        PENALTY_PRC = _penaltyPrc;
    }

    /* function changeNeumarkToken(NeumarkSurrogate newNeumarkToken)
        onlyOwner
        onlyInitialized
    {

    }

    function enableMigration(LockedAccountMigration migration)
        onlyOwner
        onlyInitialized
    {

    } */

    function _addBalance(uint balance, uint amount) private returns (uint) {
        totalLockedAmount = totalLockedAmount.add(amount);
        return balance.add(amount);
    }

    function _subBalance(uint balance, uint amount) private returns (uint) {
        totalLockedAmount = totalLockedAmount.sub(amount);
        return balance.sub(amount);
    }

    function _logerror(ReturnCodes c) private returns (ReturnCodes) {
        ReturnCode(c);
        return c;
    }
}
