pragma solidity 0.4.15;

import "../LockedAccount.sol";
import "../LockedAccountMigration.sol";
import '../Standards/IERC677Token.sol';


contract TestLockedAccountMigrationTarget is LockedAccount, LockedAccountMigration {

    ////////////////////////
    // Mutable state
    ////////////////////////

    LockedAccount public migrationSource;

    bool public shouldMigrationFail;

    ////////////////////////
    // Constructor
    ////////////////////////

    function TestLockedAccountMigrationTarget(
        IAccessPolicy _policy,
        IEthereumForkArbiter _forkArbiter,
        string _agreementUri,
        IERC677Token _assetToken,
        Neumark _neumark,
        uint _lockPeriod,
        uint _penaltyFraction
    )
        LockedAccount(_policy, _forkArbiter, _agreementUri, _assetToken, _neumark, _lockPeriod, _penaltyFraction)
    {
    }

    ////////////////////////
    // Public functions
    ////////////////////////

    function setMigrationSource(LockedAccount source)
        public
        only(ROLE_LOCKED_ACCOUNT_ADMIN)
    {
        migrationSource = source;
    }

    function setShouldMigrationFail(bool shouldFail)
        only(ROLE_LOCKED_ACCOUNT_ADMIN)
        public
    {
        shouldMigrationFail = shouldFail;
    }

    function migrateInvestor(address investor, uint256 balance, uint256 neumarksDue, uint256 unlockDate)
        public
        onlyMigrationFrom
        returns(bool)
    {
        if (shouldMigrationFail)
            return false;

        // just move account
        accounts[investor] = Account({
            balance: balance,
            neumarksDue: neumarksDue,
            unlockDate: unlockDate
        });
        // minimal bookkeeping
        _addBalance(balance, balance);
        totalInvestors += 1;

        return true;
    }

    /// implement test migration interface
    function getMigrationFrom()
        public
        constant
        returns (address)
    {
        return address(migrationSource);
    }
}
