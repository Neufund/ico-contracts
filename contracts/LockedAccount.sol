pragma solidity ^0.4.10;

contract TimeSource {
    uint256 private mockNow;

    function currentTime() public constant returns (uint256) {
        return mockNow > 0 ? mockNow : block.timestamp;
    }

    function mockTime(uint256 t) public {
        // no mocking on mainnet
        if (block.number > 3316029)
            throw;
        mockNow = t;
    }
}

contract Ownable {
    // replace with proper zeppelin smart contract
    address public owner;

    function Ownable() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        if (msg.sender != owner)
        throw;
        _;
    }

    function transferOwnership(address newOwner) onlyOwner {
        if (newOwner != address(0))
        owner = newOwner;
    }
}

contract ERC20Basic {
  uint256 public totalSupply;
  function balanceOf(address who) constant returns (uint256);
  function transfer(address to, uint256 value) returns (bool);
  event Transfer(address indexed from, address indexed to, uint256 value);
}

contract MutableToken is ERC20Basic {
  function deposit(address to, uint256 amount) returns (bool);
  function withdraw(uint256 amount);
}

library Math {
  // scale of the emulated fixed point operations
  uint constant public FP_SCALE = 10000;

  // todo: should be a library
  function divRound(uint v, uint d) internal constant returns(uint) {
    // round up if % is half or more
    return (v + (d/2)) / d;
  }

  function absDiff(uint v1, uint v2) public constant returns(uint) {
    return v1 > v2 ? v1 - v2 : v2 - v1;
  }

  function safeMul(uint a, uint b) public constant returns (uint) {
    uint c = a * b;
    if (a == 0 || c / a == b)
      return c;
    else
      throw;
  }

  function safeAdd(uint a, uint b) internal constant returns (uint) {
    uint c = a + b;
    if (!(c>=a && c>=b))
      throw;
    return c;
  }
}

contract NeumarkSurrogate is ERC20Basic {
    // will burn tokens of 'who' that were pre-approved to be burned for the 'sender'
    function burn(address who, uint256 amount);
    function addRevenue(ERC20Basic fromToken, uint256 amount);
}

contract LockedAccountMigration {
  modifier onlyOldLockedAccount() {
    require(msg.sender == getOldLockedAccount());
    _;
  }

  // only old locked account can call migrate function
  function getOldLockedAccount() public constant returns (address);

  // migrate employee to new ESOP contract, throws if not possible
  // in simplest case new ESOP contract should derive from this contract and implement abstract methods
  // employees list is available for inspection by employee address
  // poolOptions and extraOption is amount of options transferred out of old ESOP contract
  function migrate(address investor, uint balance, uint neumarkCost, uint32 longstopDate) onlyOldLockedAccount public;
}

contract LockedAccount is Ownable, TimeSource {
    // total amount of tokens locked
    uint public totalLocked;
    // total number of locked investors
    uint public totalInvestors;
    // a token controlled by LockedAccount, read ERC20 + extensions to read what token is it (ETH/EUR etc.)
    MutableToken public ownedToken;
    // if true funds can be unlocked unconditionally and locking is not possible
    bool public isUnlocked;
    // longstop period in seconds
    uint public constant LONGSTOP_PERIOD;
    // penalty with Math.FP_SCALE()
    uint public constant PENALTY_PRC;
    // govering ICO contract that may lock money or unlock all account if fails
    address public governingICO;

    NeumarkSurrogate private neumarkToken;
    LockedAccountMigration private migration;
    mapping(address => Account) accounts;

    struct Account {
        uint256 balance;
        uint256 neumarksDue;
        uint256 longstopDate;
    }

    //events
    event FundsLocked(address indexed investor, uint256 amount, uint256 neumarks);
    event FundsUnlocked(address indexed investor, uint256 amount);

    //enums
    enum ReturnCodes { OK, InvalidEmployeeState, TooLate, InvalidParameters, TooEarly  }

    //modifiers
    modifier onlyICO {
        requires(msg.sender == governingICO);
        _;
    }

    modifier notUnlocked {
        requires(!isUnlocked);
        _;
    }

    // deposits 'amount' of tokens on MutableToken ownedToken contracts
    // locks 'amount' for 'investor' address
    // callable only from ICO contract that gets currency directly (ETH/EUR)
    function lock(address investor, uint256 amount, uint256 neumarks)
        onlyICO
        acceptsLocks
        public
        returns (ReturnCodes)
    {
        requires(amount > 0);
        requires(ownedToken.deposit(address(this), amount));
        Account a = accounts[investor];
        a.balance = _addBalance(a.balance, amount);
        a.neumarks += neumarks;
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
        acceptsUnlocks
        public
        returns (ReturnCodes)
    {
        Account a = accounts[msg.sender];
        // if there is anything to unlock
        if (a.balance > 0) {
            // in allReleased just give money back by transfering to msg.sender
            if (!allReleased) {
                // burn neumarks corresponding to unspent funds
                // address(this) has right to burn Neumarks OR it was pre approved by msg.sender: @remco?
                if(!neumarkToken.burn(msg.sender, a.neumarks))
                    return _logerror(ReturnCodes.CannotBurnNeumarks);
                // take the penalty if before longstopdate
                if (currentTime() < a.longstopDate) {
                    uint256 penalty = Math.divRound(Math.safeMul(a.balance, PENALTY_PRC), Math.FP_SCALE());
                    // transfer penalty to neumark contract
                    requires(ownedToken.transfer(address(neumarkToken), penalty));
                    // distribute revenue via Neumark contract
                    requires(neumarkToken.addRevenue(ownedToken, penalty));
                    a.balance = _subBalance(a.balance, penalty);
                }
            }
            // transfer amount back to investor - now it can withdraw
            requires(ownedToken.transfer(msg.sender, a.balance));
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
        Account a = accounts[investor];
        return (a.balance, a.neumarks, a.longstopDate);
    }

    // todo: move to test that derive from LockedAccount
    // invests in equity token ICO
    function invest(address ico, uint256 amount)
        acceptsUnlocks
        public
        returns (ReturnCodes)
    {
        requires(amount > 0);
        requires(ico != address(0));
        Account a = accounts[msg.sender];
        if (amount > a.balance)
            return _logerror(ReturnCodes.NoFunds);
        //if (canInvest(ico) {
            // or whatever interface we'll have here to notify of balance change!
        //    ico.invest(amount);
        //}
        // decrease neumarks due pro rata - high precision may overflow @todo testing
        uint256 freedNeumarks = Math.divRound(Math.safeMul(amount, a.neumarksDue), a.balance);
        a.balance -= amount;
        // possible precision problems
        if (a.balance == 0 || a.neumarksDue < freedNeumarks)
            a.neumarksDue = 0;
        else
            a.neumarksDue -= freedNeumarks;
        accounts[msg.sender] = a;
        return ReturnCodes.OK;
    }

    // todo: not implemented
    function migrate()
        public
    {
        requires(address(migration) != 0);
        // migrates
    }

    // allows to anyone to release all funds without burning Neumarks
    function unlockAll()
        onlyOwner
    {
        requires(!allReleased);
    }

    // todo: not implemented
    function init(ERC20 pOwnedToken, NeumarkSurrogate pNeumarkToken,
        uint32 pPenaltyPermille, uint32 longstopPeriod)
        onlyOwner
        onlyUnitialized
    {

    }

    function changeNeumarkToken(NeumarkSurrogate newNeumarkToken)
        onlyOwner
        onlyInitialized
    {

    }

    function enableMigration(LockedAccountMigration migration)
        onlyOwner
        onlyInitialized
    {
        // enables investors to migrate
    }

    function _addBalance(uint balance, uint amount) private returns (uint) {
        totalLocked = Math.safeAdd(totalLocked, amount);
        return Math.safeAdd(balance, amount);
    }

    function _subBalance(uint balance, uint amount) private returns (uint) {
        totalLocked = Math.safeSub(totalLocked, amount);
        return Math.safeSub(balance, amount);
    }

    function _logerror(ReturnCodes c) private returns (ReturnCodes) {
        ReturnCode(c);
        return c;
    }
}
