pragma solidity 0.4.15;

import "../Zeppelin/StandardToken.sol";
import '../Standards/IMigrationSource.sol';
import "../EuroTokenMigrationTarget.sol";


contract TestEuroTokenMigrationTarget is
    StandardToken,
    EuroTokenMigrationTarget
{
    ////////////////////////
    // Immutable state
    ////////////////////////

    address private MIGRATION_SOURCE;

    ////////////////////////
    // Constructor
    ////////////////////////

    function TestEuroTokenMigrationTarget(address migrationSource)
        public
    {
        MIGRATION_SOURCE = migrationSource;
    }

    ////////////////////////
    // Public Methods
    ////////////////////////

    //
    // Implements EuroTokenMigrationTarget

    function migrateEuroTokenOwner(address owner, uint256 amount)
        public
        onlyMigrationSource()
    {
        deposit(owner, amount);
    }

    //
    // Implements IMigrationTarget
    //

    function currentMigrationSource()
        public
        constant
        returns (address)
    {
        return address(MIGRATION_SOURCE);
    }

    ////////////////////////
    // Private Methods
    ////////////////////////

    function deposit(address to, uint256 amount) private {
        require(to != address(0));
        _balances[to] = add(_balances[to], amount);
        _totalSupply = add(_totalSupply, amount);
        Transfer(address(0), to, amount);
    }
}
