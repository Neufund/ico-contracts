pragma solidity 0.4.15;

import './MigrationTarget.sol';


contract EuroTokenMigrationTarget is
    MigrationTarget
{
    ////////////////////////
    // Public functions
    ////////////////////////

    /// @notice accepts migration of single eur-t token holder
    /// @dev allowed to be called only from migration source, do not forget to add accessor modifier in implementation
    function migrateEuroTokenOwner(address owner, uint256 amount)
        public
        onlyMigrationSource();
}
