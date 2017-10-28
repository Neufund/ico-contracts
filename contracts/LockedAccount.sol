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
import './TimeSource.sol';


contract LockedAccount is
    AccessControlled,
    AccessRoles,
    TimeSource,
    Math,
    IsContract,
    MigrationSource,
    IERC677Callback,
    Reclaimable
{

    ////////////////////////
    // Type declarations
    ////////////////////////

    // state space of LockedAccount
    enum LockState {
        // controller is not yet set
        Uncontrolled,
        // new funds lockd are accepted from investors
        AcceptingLocks,
        // funds may be unlocked by investors, final state
        AcceptingUnlocks,
        // funds may be unlocked by investors, without any constraints, final state
        ReleaseAll
    }

    // represents locked account of the investor
    struct Account {
        // funds locked in the account
        uint256 balance;
        // neumark amount that must be returned to unlock
        uint256 neumarksDue;
        // date with which unlock may happen without penalty
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

    /// @notice logged when funds are locked by investor
    /// @param investor address of investor locking funds
    /// @param amount amount of newly locked funds
    /// @param amount of neumarks that must be returned to unlock funds
    event LogFundsLocked(
        address indexed investor,
        uint256 amount,
        uint256 neumarks
    );

    /// @notice logged when investor unlocks funds
    /// @param investor address of investor unlocking funds
    /// @param amount amount of unlocked funds
    /// @param neumarks amount of Neumarks that was burned
    event LogFundsUnlocked(
        address indexed investor,
        uint256 amount,
        uint256 neumarks
    );

    /// @notice logged when unlock penalty is disbursed to Neumark holders
    /// @param disbursalPoolAddress address of disbursal pool receiving penalty
    /// @param amount penalty amount
    /// @param assetToken address of token contract penalty was paid with
    /// @param investor addres of investor paying penalty
    /// @dev assetToken and investor parameters are added for quick tallying penalty payouts
    event LogPenaltyDisbursed(
        address indexed disbursalPoolAddress,
        uint256 amount,
        address assetToken,
        address investor
    );

    /// @notice logs Locked Account state transitions
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

    /// @notice creates new LockedAccount instance
    /// @param policy governs execution permissions to admin functions
    /// @param assetToken token contract representing funds locked
    /// @param neumark Neumark token contract
    /// @param lockPeriod period for which funds are locked, in seconds
    /// @param penaltyFraction decimal fraction of unlocked amount paid as penalty,
    ///     if unlocked before lockPeriod is over
    /// @dev this implementation does not allow spending funds on ICOs but provides
    ///     a migration mechanism to final LockedAccount with such functionality
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

    /// @notice locks funds of investors for a period of time
    /// @param investor funds owner
    /// @param amount amount of funds locked
    /// @param neumarks amount of neumarks that needs to be returned by investor to unlock funds
    /// @dev callable only from controller (Commitment) contract
    function lock(address investor, uint256 amount, uint256 neumarks)
        public
        onlyState(LockState.AcceptingLocks)
        onlyController()
    {
        require(amount > 0);
        // transfer to itself from Commitment contract allowance
        assert(ASSET_TOKEN.transferFrom(msg.sender, address(this), amount));

        Account storage account = _accounts[investor];
        account.balance = addBalance(account.balance, amount);
        account.neumarksDue = add(account.neumarksDue, neumarks);

        if (account.unlockDate == 0) {
            // this is new account - unlockDate always > 0
            _totalInvestors += 1;
            account.unlockDate = currentTime() + LOCK_PERIOD;
        }
        LogFundsLocked(investor, amount, neumarks);
    }

    /// @notice unlocks investors funds, see unlockInvestor for details
    /// @dev function requires that proper allowance on Neumark is made to LockedAccount by msg.sender
    ///     except in ReleaseAll state which does not burn Neumark
    function unlock()
        public
        onlyStates(LockState.AcceptingUnlocks, LockState.ReleaseAll)
    {
        unlockInvestor(msg.sender);
    }

    /// @notice unlocks investors funds, see unlockInvestor for details
    /// @dev this ERC667 callback by Neumark contract after successful approve
    ///     allows to unlock and allow neumarks to be burned in one transaction
    function receiveApproval(
        address from,
        uint256, // _amount,
        address _token,
        bytes _data
    )
        public
        onlyState(LockState.AcceptingUnlocks)
        returns (bool)
    {
        require(msg.sender == _token);
        require(_data.length == 0);

        // only from neumarks
        require(_token == address(NEUMARK));

        // this will check if allowance was made and if _amount is enough to
        //  unlock, reverts on any error condition
        unlockInvestor(from);

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
        Account storage account = _accounts[investor];
        return (account.balance, account.neumarksDue, account.unlockDate);
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
        Account memory account = _accounts[msg.sender];

        // return on non existing accounts silentl
        if (account.balance == 0) {
            return;
        }

        // this will clear investor storage
        removeInvestor(msg.sender, account.balance);

        // let migration target to own asset balance that belongs to investor
        assert(ASSET_TOKEN.approve(address(_migration), account.balance));
        bool migrated = LockedAccountMigration(_migration).migrateInvestor(
            msg.sender,
            account.balance,
            account.neumarksDue,
            account.unlockDate
        );
        assert(migrated);
        LogInvestorMigrated(msg.sender, account.balance, account.neumarksDue, account.unlockDate);
    }

    //
    // Overrides Reclaimable
    //

    /// @notice allows locked account to reclaim tokens wrongly sent to its address
    /// @dev as LockedAccount by design has balance of assetToken (in the name of investors)
    ///     such reclamation is not allowed
    function reclaim(IBasicToken token)
        public
    {
        // forbid reclaiming locked tokens
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
        uint256 newBalance = balance + amount;
        return newBalance;
    }

    ////////////////////////
    // Private functions
    ////////////////////////

    function subBalance(uint256 balance, uint256 amount)
        private
        returns (uint256)
    {
        _totalLockedAmount -= amount;
        return balance - amount;
    }

    function removeInvestor(address investor, uint256 balance)
        private
    {
        subBalance(balance, balance);
        _totalInvestors -= 1;
        delete _accounts[investor];
    }

    function changeState(LockState newState)
        private
    {
        assert(newState != _lockState);
        LogLockStateTransition(_lockState, newState);
        _lockState = newState;
    }


    /// @notice unlocks 'investor' tokens by making them withdrawable from assetToken
    /// @dev expects number of neumarks that is due on investor's account to be approved for LockedAccount for transfer
    /// @dev there are 3 unlock modes depending on contract and investor state
    ///     in 'AcceptingUnlocks' state Neumarks due will be burned and funds transferred to investors address in assetToken,
    ///         before unlockDate, penalty is deduced and distributed
    ///     in 'ReleaseAll' neumarks are not burned and unlockDate is not observed, funds are unlocked unconditionally
    function unlockInvestor(address investor)
        private
    {
        // use memory storage to obtain copy and be able to erase storage
        Account memory accountInMem = _accounts[investor];

        // silently return on non-existing accounts
        if (accountInMem.balance == 0) {
            return;
        }
        // remove investor account before external calls
        removeInvestor(investor, accountInMem.balance);

        // Neumark burning and penalty processing only in AcceptingUnlocks state
        if (_lockState == LockState.AcceptingUnlocks) {
            // transfer Neumarks to be burned to itself via allowance mechanism
            //  not enough allowance results in revert which is acceptable state so 'require' is used
            require(NEUMARK.transferFrom(investor, address(this), accountInMem.neumarksDue));

            // burn neumarks corresponding to unspent funds
            NEUMARK.burnNeumark(accountInMem.neumarksDue);

            // take the penalty if before unlockDate
            if (currentTime() < accountInMem.unlockDate) {
                require(_penaltyDisbursalAddress != address(0));
                uint256 penalty = fraction(accountInMem.balance, PENALTY_FRACTION);

                // distribute penalty
                if (isContract(_penaltyDisbursalAddress)) {
                    require(
                        ASSET_TOKEN.approveAndCall(_penaltyDisbursalAddress,penalty, "")
                    );
                } else {
                    // transfer to simple address
                    assert(ASSET_TOKEN.transfer(_penaltyDisbursalAddress, penalty));
                }
                LogPenaltyDisbursed(_penaltyDisbursalAddress, penalty, ASSET_TOKEN, investor);
                accountInMem.balance -= penalty;
            }
        }
        if (_lockState == LockState.ReleaseAll) {
            accountInMem.neumarksDue = 0;
        }
        // transfer amount back to investor - now it can withdraw
        assert(ASSET_TOKEN.transfer(investor, accountInMem.balance));
        LogFundsUnlocked(investor, accountInMem.balance, accountInMem.neumarksDue);
    }
}
