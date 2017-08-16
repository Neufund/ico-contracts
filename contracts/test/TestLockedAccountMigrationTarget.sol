pragma solidity ^0.4.11;

import "../LockedAccount.sol";
import "../LockedAccountMigration.sol";

contract TestLockedAccountMigrationTarget is LockedAccount, LockedAccountMigration {
    LockedAccount public migrationSource;
    bool public shouldMigrationFail;

    function setMigrationSource(LockedAccount source)
        onlyOwner
        public
    {
        migrationSource = source;
    }

    function setShouldMigrationFail(bool shouldFail)
        onlyOwner
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

    function TestLockedAccountMigrationTarget(ERC20 _ownedToken, Curve _neumarkCurve,
        uint _lockPeriod, uint _penaltyFraction)
        LockedAccount(_ownedToken, _neumarkCurve, _lockPeriod, _penaltyFraction)
    {
    }

}
