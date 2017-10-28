pragma solidity 0.4.15;

import "../LockedAccount.sol";
import "../LockedAccountMigration.sol";


contract TestLockedAccountMigrationTarget is
    LockedAccount,
    LockedAccountMigration
{

    ////////////////////////
    // Immutable state
    ////////////////////////

    IERC677Token private ASSET_TOKEN;

    ////////////////////////
    // Mutable state
    ////////////////////////

    LockedAccount private _migrationSource;

    ////////////////////////
    // Constructor
    ////////////////////////

    function TestLockedAccountMigrationTarget(
        IAccessPolicy _policy,
        IERC677Token _assetToken,
        Neumark _neumark,
        uint256 _lockPeriod,
        uint256 _penaltyFraction
    )
        LockedAccount(
            _policy,
            _assetToken,
            _neumark,
            _lockPeriod,
            _penaltyFraction
        )
    {
        ASSET_TOKEN = _assetToken;
    }

    ////////////////////////
    // Public functions
    ////////////////////////

    function setMigrationSource(LockedAccount source)
        public
        only(ROLE_LOCKED_ACCOUNT_ADMIN)
    {
        _migrationSource = source;
    }

    //
    // Implements LockedAccountMigrationTarget
    //

    function migrateInvestor(
        address investor,
        uint256 balance,
        uint256 neumarksDue,
        uint256 unlockDate
    )
        public
        onlyMigrationSource()
    {
        // transfer assets
        require(ASSET_TOKEN.transferFrom(msg.sender, address(this), balance));
        // just move account
        _accounts[investor] = Account({
            balance: balance,
            neumarksDue: neumarksDue,
            unlockDate: unlockDate
        });
        // minimal bookkeeping
        addBalance(balance, balance);
        _totalInvestors += 1;

    }

    //
    // Implements IMigrationTarget
    //

    function currentMigrationSource()
        public
        constant
        returns (address)
    {
        return address(_migrationSource);
    }
}
