pragma solidity 0.4.15;

import './AccessControl/AccessControlled.sol';
import './AccessRoles.sol';
import './EtherToken.sol';
import './IsContract.sol';
import './MigrationSource.sol';
import './LockedAccountMigration.sol';
import './Neumark.sol';
import './Standards/IERC677Token.sol';
import './Standards/IERC677Callback.sol';
import './Reclaimable.sol';
import './ReturnsErrors.sol';
import './TimeSource.sol';


contract LockedAccount is
    AccessControlled,
    AccessRoles,
    TimeSource,
    ReturnsErrors,
    Math,
    IsContract,
    MigrationSource,
    IERC677Callback,
    Reclaimable
{

    ////////////////////////
    // Type declarations
    ////////////////////////

    // lock state
    enum LockState {
        Uncontrolled,
        AcceptingLocks,
        AcceptingUnlocks,
        ReleaseAll
    }

    struct Account {
        uint256 balance;
        uint256 neumarksDue;
        uint256 unlockDate;
    }

    ////////////////////////
    // Immutable state
    ////////////////////////

    // a token controlled by LockedAccount, read ERC20 + extensions to read what
    // token is it (ETH/EUR etc.)
    IERC677Token private ASSET_TOKEN;

    Neumark private NEUMARK;

    // longstop period in seconds
    uint256 private LOCK_PERIOD;

    // penalty: fraction of stored amount on escape hatch
    uint256 private PENALTY_FRACTION;

    ////////////////////////
    // Mutable state
    ////////////////////////

    // total amount of tokens locked
    uint256 private _totalLockedAmount;

    // total number of locked investors
    uint256 internal _totalInvestors;

    // current state of the locking contract
    LockState private _lockState;

    // controlling contract that may lock money or unlock all account if fails
    address private _controller;

    // fee distribution pool
    address private _penaltyDisbursalAddress;

    // LockedAccountMigration private migration;
    mapping(address => Account) internal _accounts;

    ////////////////////////
    // Events
    ////////////////////////

    event LogFundsLocked(
        address indexed investor,
        uint256 amount,
        uint256 neumarks
    );

    event LogFundsUnlocked(
        address indexed investor,
        uint256 amount
    );

    event LogPenaltyDisbursed(
        address indexed investor,
        uint256 amount,
        address toPool
    );

    event LogLockStateTransition(
        LockState oldState,
        LockState newState
    );

    event LogInvestorMigrated(
        address indexed investor,
        uint256 amount,
        uint256 neumarks,
        uint256 unlockDate
    );

    ////////////////////////
    // Modifiers
    ////////////////////////

    modifier onlyController() {
        require(msg.sender == address(_controller));
        _;
    }

    modifier onlyState(LockState state) {
        require(_lockState == state);
        _;
    }

    modifier onlyStates(LockState state1, LockState state2) {
        require(_lockState == state1 || _lockState == state2);
        _;
    }

    ////////////////////////
    // Constructor
    ////////////////////////

    // _assetToken - token contract with resource locked by LockedAccount, where
    // LockedAccount is allowed to make deposits
    function LockedAccount(
        IAccessPolicy policy,
        IERC677Token assetToken,
        Neumark neumark,
        uint256 lockPeriod,
        uint256 penaltyFraction
    )
        AccessControlled(policy)
        MigrationSource(policy, ROLE_LOCKED_ACCOUNT_ADMIN)
        Reclaimable()
    {
        ASSET_TOKEN = assetToken;
        NEUMARK = neumark;
        LOCK_PERIOD = lockPeriod;
        PENALTY_FRACTION = penaltyFraction;
    }

    ////////////////////////
    // Public functions
    ////////////////////////

    // deposits 'amount' of tokens on assetToken contract
    // locks 'amount' for 'investor' address
    // callable only from ICO contract that gets currency directly (ETH/EUR)
    function lock(address investor, uint256 amount, uint256 neumarks)
        public
        onlyState(LockState.AcceptingLocks)
        onlyController()
    {
        require(amount > 0);

        // check if controller made allowance
        require(ASSET_TOKEN.allowance(msg.sender, address(this)) >= amount);

        // transfer to self yourself
        require(ASSET_TOKEN.transferFrom(msg.sender, address(this), amount));
        Account storage a = _accounts[investor];
        a.balance = addBalance(a.balance, amount);
        a.neumarksDue += neumarks;
        assert(isSafeMultiplier(a.neumarksDue));
        if (a.unlockDate == 0) {

            // this is new account - unlockDate always > 0
            _totalInvestors += 1;
            a.unlockDate = currentTime() + LOCK_PERIOD;
        }
        _accounts[investor] = a;
        LogFundsLocked(investor, amount, neumarks);
    }

    // unlocks msg.sender tokens by making them withdrawable in assetToken
    // expects number of neumarks that is due to be available to be burned on
    // msg.sender balance - see comments
    // if used before longstop date, calculates penalty and distributes it as
    // revenue
    function unlock()
        public
        onlyStates(LockState.AcceptingUnlocks, LockState.ReleaseAll)
        returns (Status)
    {
        return unlockFor(msg.sender);
    }

    // this allows to unlock and allow neumarks to be burned in one transaction
    function receiveApproval(
        address from,
        uint256, // _amount,
        address _token,
        bytes _data
    )
        public
        onlyStates(LockState.AcceptingUnlocks, LockState.ReleaseAll)
        returns (bool)
    {
        require(msg.sender == _token);
        require(_data.length == 0);

        // only from neumarks
        require(_token == address(NEUMARK));

        // this will check if allowance was made and if _amount is enough to
        // unlock
        require(unlockFor(from) == Status.SUCCESS);

        // we assume external call so return value will be lost to clients
        // that's why we throw above
        return true;
    }

    /// allows to anyone to release all funds without burning Neumarks and any
    /// other penalties
    function controllerFailed()
        public
        onlyState(LockState.AcceptingLocks)
        onlyController()
    {
        changeState(LockState.ReleaseAll);
    }

    /// allows anyone to use escape hatch
    function controllerSucceeded()
        public
        onlyState(LockState.AcceptingLocks)
        onlyController()
    {
        changeState(LockState.AcceptingUnlocks);
    }

    function setController(address controller)
        public
        only(ROLE_LOCKED_ACCOUNT_ADMIN)
        onlyState(LockState.Uncontrolled)
    {
        _controller = controller;
        changeState(LockState.AcceptingLocks);
    }

    /// sets address to which tokens from unlock penalty are sent
    /// both simple addresses and contracts are allowed
    /// contract needs to implement ApproveAndCallCallback interface
    function setPenaltyDisbursal(address penaltyDisbursalAddress)
        public
        only(ROLE_LOCKED_ACCOUNT_ADMIN)
    {
        require(penaltyDisbursalAddress != address(0));

        // can be changed at any moment by admin
        _penaltyDisbursalAddress = penaltyDisbursalAddress;
    }

    function assetToken()
        public
        constant
        returns (IERC677Token)
    {
        return ASSET_TOKEN;
    }

    function neumark()
        public
        constant
        returns (Neumark)
    {
        return NEUMARK;
    }

    function lockPeriod()
        public
        constant
        returns (uint256)
    {
        return LOCK_PERIOD;
    }

    function penaltyFraction()
        public
        constant
        returns (uint256)
    {
        return PENALTY_FRACTION;
    }

    function balanceOf(address investor)
        public
        constant
        returns (uint256, uint256, uint256)
    {
        Account storage a = _accounts[investor];
        return (a.balance, a.neumarksDue, a.unlockDate);
    }

    function controller()
        public
        constant
        returns (address)
    {
        return _controller;
    }

    function lockState()
        public
        constant
        returns (LockState)
    {
        return _lockState;
    }

    function totalLockedAmount()
        public
        constant
        returns (uint256)
    {
        return _totalLockedAmount;
    }

    function totalInvestors()
        public
        constant
        returns (uint256)
    {
        return _totalInvestors;
    }

    function penaltyDisbursalAddress()
        public
        constant
        returns (address)
    {
        return _penaltyDisbursalAddress;
    }

    //
    // Overrides migration source
    //

    /// enables migration to new LockedAccount instance
    /// it can be set only once to prevent setting temporary migrations that let
    /// just one investor out
    /// may be set in AcceptingLocks state (in unlikely event that controller
    /// fails we let investors out)
    /// and AcceptingUnlocks - which is normal operational mode
    function enableMigration(IMigrationTarget migration)
        public
        onlyStates(LockState.AcceptingLocks, LockState.AcceptingUnlocks)
    {
        // will enforce other access controls
        MigrationSource.enableMigration(migration);
    }

    /// migrates single investor
    function migrate()
        public
        onlyMigrationEnabled()
    {
        // migrates
        Account memory a = _accounts[msg.sender];

        // if there is anything to migrate
        if (a.balance > 0) {

            // this will clear investor storage
            removeInvestor(msg.sender, a.balance);

            // let migration target to own asset balance that belongs to investor
            require(ASSET_TOKEN.approve(address(_migration), a.balance));
            LockedAccountMigration(_migration).migrateInvestor(
                msg.sender,
                a.balance,
                a.neumarksDue,
                a.unlockDate
            );
            LogInvestorMigrated(msg.sender, a.balance, a.neumarksDue, a.unlockDate);
        }
    }

    //
    // Overides Reclaimable
    //

    function reclaim(IBasicToken token)
        public
    {
        // This contract holds the asset token
        require(token != ASSET_TOKEN);
        Reclaimable.reclaim(token);
    }

    ////////////////////////
    // Internal functions
    ////////////////////////

    function addBalance(uint256 balance, uint256 amount)
        internal
        returns (uint256)
    {
        _totalLockedAmount = add(_totalLockedAmount, amount);
        uint256 newBalance = add(balance, amount);
        assert(isSafeMultiplier(newBalance));
        return newBalance;
    }

    function subBalance(uint256 balance, uint256 amount)
        internal
        returns (uint256)
    {
        _totalLockedAmount -= amount;
        return balance - amount;
    }

    function removeInvestor(address investor, uint256 balance)
        internal
    {
        _totalLockedAmount -= balance;
        _totalInvestors -= 1;
        delete _accounts[investor];
    }

    function changeState(LockState newState)
        internal
    {
        if (newState != _lockState) {
            LogLockStateTransition(_lockState, newState);
            _lockState = newState;
        }
    }

    function unlockFor(address investor)
        internal
        returns (Status)
    {
        Account storage a = _accounts[investor];

        // if there is anything to unlock
        if (a.balance > 0) {

            // in ReleaseAll just give money back by transfering to investor
            if (_lockState == LockState.AcceptingUnlocks) {

                // before burn happens, investor must make allowance to locked account
                if (NEUMARK.allowance(investor, address(this)) < a.neumarksDue) {
                    return logError(Status.NOT_ENOUGH_NEUMARKS_TO_UNLOCK);
                }
                if (NEUMARK.balanceOf(investor) < a.neumarksDue) {
                    return logError(Status.NOT_ENOUGH_NEUMARKS_TO_UNLOCK);
                }
                if (!NEUMARK.transferFrom(investor, address(this), a.neumarksDue)) {
                    return logError(Status.NOT_ENOUGH_NEUMARKS_TO_UNLOCK);
                }

                // burn neumarks corresponding to unspent funds
                NEUMARK.burnNeumark(a.neumarksDue);

                // take the penalty if before unlockDate
                if (currentTime() < a.unlockDate) {
                    require(_penaltyDisbursalAddress != address(0));
                    uint256 penalty = fraction(a.balance, PENALTY_FRACTION);

                    // distribute penalty
                    if (isContract(_penaltyDisbursalAddress)) {

                        // transfer to contract
                        require(
                            ASSET_TOKEN.approveAndCall(
                                _penaltyDisbursalAddress,
                                penalty,
                                ""
                            )
                        );
                    } else {

                        // transfer to address
                        require(ASSET_TOKEN.transfer(_penaltyDisbursalAddress, penalty));
                    }
                    LogPenaltyDisbursed(investor, penalty, _penaltyDisbursalAddress);
                    a.balance = subBalance(a.balance, penalty);
                }
            }

            // transfer amount back to investor - now it can withdraw
            require(ASSET_TOKEN.transfer(investor, a.balance));

            // remove balance, investor and
            LogFundsUnlocked(investor, a.balance);
            removeInvestor(investor, a.balance);
        }
        return Status.SUCCESS;
    }
}
