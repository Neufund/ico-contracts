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

    // AUDIT[CHF-125] Drop ReturnsErrors from LockedAccount.
    //   The Status enum has only 2 used values. Use true/false in unlockFor()
    //   instead of confusing status codes.
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
    // AUDIT[CHF-101] Consider using StateMachine.
    //   This contract controls internal state similarly to StateMachine
    //   contract. Consider using StateMachine abstract contract here.
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

    // AUDIT[CHF-113] Add comments documenting events' parameters.
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
        // AUDIT[CHF-103] transferFrom() SHOULD always return true.
        //   Use assert() instead of require() as in other places.
        require(ASSET_TOKEN.transferFrom(msg.sender, address(this), amount));
        Account storage a = _accounts[investor];
        a.balance = addBalance(a.balance, amount);

        // AUDIT[CHF-106] Unsafe math in LockedAccount.lock().
        //   I think this assumes that amount of neumarks is never bigger
        //   than amount of tokens, because this is the way Commitment works.
        //   But this assumption is never confirmed here.
        //   Use add() here as well.
        a.neumarksDue += neumarks;

        // AUDIT[CHF-107] Unnecessary assert() in LockedAccount.lock().
        //   Assert similar to the one in addBalance() with unknown reason.
        assert(isSafeMultiplier(a.neumarksDue));
        if (a.unlockDate == 0) {

            // this is new account - unlockDate always > 0
            _totalInvestors += 1;
            // AUDIT[CHF-108] Possible incorrect lock period.
            //   If the amount of tokens locked can be increased by an investor
            //   multiple times, should not the lock period be bumped
            //   in each lock() call?
            a.unlockDate = currentTime() + LOCK_PERIOD;
        }

        // AUDIT[CHF-108] Unnecessary storage update in LockedAccount.lock().
        //   The following line is not needed because `a` is already the
        //   reference to the storage location.
        //   Please observer gas cost changes. I noticed that the cost of
        //   Commitment.commit() increased after removing the following line.
        _accounts[investor] = a;
        LogFundsLocked(investor, amount, neumarks);
    }

    // AUDIT[CHF-109] Update comment of LockedAccount.unlock().
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
        // AUDIT[CHF-127] LockedAccount.unlock() should properly fail.
        //   This function will return false on failure, what is hard to
        //   recognize by external users from successful transactions.
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
            bool migrated = LockedAccountMigration(_migration).migrateInvestor(
                msg.sender,
                a.balance,
                a.neumarksDue,
                a.unlockDate
            );
            assert(migrated);
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

        // AUDIT[CHF-104] Safe addition not needed in addBalance().
        //   Because always balance <= _totalLockedAmount, the second use
        //   of add() is not required.
        uint256 newBalance = add(balance, amount);

        // AUDIT[CHF-105] Remove assert() from addBalance().
        assert(isSafeMultiplier(newBalance));
        return newBalance;
    }

    // AUDIT[CHF-131] Make function subBalance() private.
    function subBalance(uint256 balance, uint256 amount)
        internal
        returns (uint256)
    {
        _totalLockedAmount -= amount;
        return balance - amount;
    }

    // AUDIT[CHF-130] Make function removeInvestor() private.
    function removeInvestor(address investor, uint256 balance)
        internal
    {
        // AUDIT[CHF-121] Reuse subBalance() in removeInvestor().
        //   Use subBalance() function instead of
        //   `_totalLockedAmount -= balance` expression.
        _totalLockedAmount -= balance;
        _totalInvestors -= 1;
        delete _accounts[investor];
    }

    function changeState(LockState newState)
        internal
    {
        // AUDIT[CHF-128] Unnecessary condition in changeState().
        //   Make the function private and remove the `newState != _lockState`
        //   check.
        if (newState != _lockState) {
            LogLockStateTransition(_lockState, newState);
            _lockState = newState;
        }
    }

    // AUDIT[CHF-129] Make function unlockFor() private.
    function unlockFor(address investor)
        internal
        returns (Status)
    {
        Account storage a = _accounts[investor];

        // if there is anything to unlock
        if (a.balance > 0) {

            // AUDIT[CHF-110] Misplaced comment in LockedAccount.unlockFor().
            //   This comment describes the code after the if ().
            // in ReleaseAll just give money back by transferring to investor
            if (_lockState == LockState.AcceptingUnlocks) {

                // AUDIT[CHF-126] Unnecessary allowance checks.
                //   The 2 following allowance checks are not required for
                //   correctness. They only affect the final result of
                //   unlock() function. If removed the code will be simpler
                //   and more consistent.
                // before burn happens, investor must make allowance to locked account
                if (NEUMARK.allowance(investor, address(this)) < a.neumarksDue) {
                    return logError(Status.NOT_ENOUGH_NEUMARKS_TO_UNLOCK);
                }
                if (NEUMARK.balanceOf(investor) < a.neumarksDue) {
                    return logError(Status.NOT_ENOUGH_NEUMARKS_TO_UNLOCK);
                }
                // AUDIT[CHF-112] transferFrom() never returns false.
                //   This check has not effect. Replace it with
                //
                //       assert(NEUMARK.transferFrom(...));
                //
                if (!NEUMARK.transferFrom(investor, address(this), a.neumarksDue)) {
                    return logError(Status.NOT_ENOUGH_NEUMARKS_TO_UNLOCK);
                }

                // burn neumarks corresponding to unspent funds
                NEUMARK.burnNeumark(a.neumarksDue);

                // take the penalty if before unlockDate
                if (currentTime() < a.unlockDate) {
                    // AUDIT[CHF-115] Unlocking may be blocked by admin.
                    //   The unlocking before the unlock date may be blocked
                    //   by the contract admin (and it blocked by default)
                    //   because the admin may not set the "penalty disbursal
                    //   address".
                    require(_penaltyDisbursalAddress != address(0));
                    uint256 penalty = fraction(a.balance, PENALTY_FRACTION);

                    // distribute penalty
                    if (isContract(_penaltyDisbursalAddress)) {

                        // transfer to contract
                        // AUDIT[CHF-118] Unlocking may be blocked by admin (2).
                        //   The admin can create a contract that always returns
                        //   false in receiveApproval() callback. This way
                        //   unlocking before unlock date may be blocked by
                        //   admin.
                        require(
                            ASSET_TOKEN.approveAndCall(
                                _penaltyDisbursalAddress,
                                penalty,
                                ""
                            )
                        );
                    } else {

                        // transfer to address
                        // AUDIT[CHF-119] transfer() SHOULD always return true.
                        //   Use assert() instead of require().
                        require(ASSET_TOKEN.transfer(_penaltyDisbursalAddress, penalty));
                    }
                    // AUDIT[CHF-124] Combine events in unlockFor().
                    //   The information from this event can be added to
                    //   LogFundsUnlocked event. Then this event can be
                    //   removed.
                    LogPenaltyDisbursed(investor, penalty, _penaltyDisbursalAddress);

                    // AUDIT[CHF-120] Do not use storage for local values.
                    //   Use local variable to track investor's balance.
                    a.balance = subBalance(a.balance, penalty);
                }
            }

            // transfer amount back to investor - now it can withdraw
            // AUDIT[CHF-111] Replace require() with assert() in unlockFor().
            //   Use assert() for Token.transfer() check.
            require(ASSET_TOKEN.transfer(investor, a.balance));

            // remove balance, investor and
            // AUDIT[CHF-123] Missing information in LogFundsUnlocked.
            //   For consistency with LogFundsLocked, you should add information
            //   about amount of burnt Neumark tokens to LogFundsUnlocked event.
            LogFundsUnlocked(investor, a.balance);

            // AUDIT[CHF-122] Update state before sending logs.
            //   See CodeStyle.md.
            removeInvestor(investor, a.balance);
        }
        return Status.SUCCESS;
    }
}
