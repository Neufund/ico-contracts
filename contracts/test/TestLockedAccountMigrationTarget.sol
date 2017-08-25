pragma solidity ^0.4.11;

import "../LockedAccount.sol";
import "../LockedAccountMigration.sol";
import '../Standards/IERC667Token.sol';

contract TestLockedAccountMigrationTarget is LockedAccount, LockedAccountMigration {
    LockedAccount public migrationSource;
    bool public shouldMigrationFail;

    function setMigrationSource(LockedAccount source)
        only(ROLE_LOCKED_ACCOUNT_ADMIN)
        public
    {
        migrationSource = source;
    }

    function setShouldMigrationFail(bool shouldFail)
        only(ROLE_LOCKED_ACCOUNT_ADMIN)
        public
    {
        shouldMigrationFail = shouldFail;
    }

    /// implement test migration interface
    function getMigrationFrom()
        public
        constant
        returns (address)
    {
        return address(migrationSource);
    }

    function migrateInvestor(address investor, uint256 balance, uint256 neumarksDue, uint256 unlockDate)
        onlyMigrationFrom
        public
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

    function TestLockedAccountMigrationTarget(IAccessPolicy _policy, IERC667Token _assetToken, Curve _neumarkCurve,
        uint _lockPeriod, uint _penaltyFraction)
        LockedAccount(_policy, _assetToken, _neumarkCurve, _lockPeriod, _penaltyFraction)
    {
    }

}
