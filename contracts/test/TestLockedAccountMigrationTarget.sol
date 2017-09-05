pragma solidity 0.4.15;

import "../LockedAccount.sol";
import "../LockedAccountMigration.sol";
import '../Standards/IERC677Token.sol';


contract TestLockedAccountMigrationTarget is LockedAccount, LockedAccountMigration {

    ////////////////////////
    // Immutable state
    ////////////////////////

    IERC677Token private ASSET_TOKEN;

    ////////////////////////
    // Mutable state
    ////////////////////////

    LockedAccount private _migrationSource;

    bool private _shouldMigrationFail;

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

    function setShouldMigrationFail(bool shouldFail)
        only(ROLE_LOCKED_ACCOUNT_ADMIN)
        public
    {
        _shouldMigrationFail = shouldFail;
    }

    function migrateInvestor(address investor, uint256 balance, uint256 neumarksDue, uint256 unlockDate)
        public
        onlyMigrationFrom
        returns(bool)
    {
        if (_shouldMigrationFail)
            return false;
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

        return true;
    }

    /// implement test migration interface
    function getMigrationFrom()
        public
        constant
        returns (address)
    {
        return address(_migrationSource);
    }
}
