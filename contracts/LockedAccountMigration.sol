pragma solidity 0.4.15;


/// implemented in the contract that is the target of LockedAccount migration
/// migration process is removing investors balance from source LockedAccount fully
/// target should re-create investor with the same balance, totalLockedAmount and totalInvestors are invariant during migration
contract LockedAccountMigration {

    ////////////////////////
    // Modifiers
    ////////////////////////

    // migration target is force to apply this modifier to migrate function implementation
    modifier onlyMigrationFrom() {
        require(msg.sender == getMigrationFrom());
        _;
    }

    ////////////////////////
    // Public functions
    ////////////////////////

    // implemented in migration target, yes modifiers are inherited from base class
    function migrateInvestor(
        address investor,
        uint256 balance,
        uint256 neumarksDue,
        uint256 unlockDate
    )
        public
        onlyMigrationFrom
        returns(bool);

    // should return migration source address
    function getMigrationFrom()
        public
        constant
        returns (address);
}
