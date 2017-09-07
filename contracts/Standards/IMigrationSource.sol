pragma solidity 0.4.15;

import './IMigrationTarget.sol';


/// @notice implemented in the contract that stores state to be migrated
/// @notice should contract is called migration source
/// @dev migration target implements IMigrationTarget interface, when it is passed in 'enableMigration' function
/// @dev 'migrate' function may be called to migrate part of state owned by msg.sender
/// @dev in legal terms this corresponds to amending/changing agreement terms by co-signature of signatories
contract IMigrationSource {

    ////////////////////////
    // Events
    ////////////////////////

    event MigrationEnabled(
        address target
    );

    ////////////////////////
    // Public functions
    ////////////////////////

    /// @notice should migrate state owned by msg.sender
    /// @dev intended flow is to: read source state, clear source state, call migrate function on target, log success event
    function migrate()
        public;

    /// @notice should enable migration to migration target
    /// @dev should limit access to specific role in implementation
    function enableMigration(IMigrationTarget migration)
        public;

    /// @notice returns current migration target
    function currentMigrationTarget()
        public
        constant
        returns (IMigrationTarget);
}
