pragma solidity 0.4.15;

import './MigrationTarget.sol';


contract EuroTokenMigrationTarget is
    MigrationTarget
{
    ////////////////////////
    // Events
    ////////////////////////

    /// @notice intended to be logged on successful migration
    event OwnerMigrated(
        address indexed owner,
        uint256 amount
    );

    ////////////////////////
    // Public functions
    ////////////////////////

    /// @notice accept migration of single eur-t token holder
    /// @dev allowed to be called only from migration source
    function migrateOwner(address owner, uint256 amount)
        public
        onlyMigrationSource
        returns (bool);
}
