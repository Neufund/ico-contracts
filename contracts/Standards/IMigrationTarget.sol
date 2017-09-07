pragma solidity 0.4.15;


/// @notice implemented in the contract that is the target of state migration
/// @dev actual implementation must provide actual function that will be called by source to migrate state
contract IMigrationTarget {

    ////////////////////////
    // Public functions
    ////////////////////////

    // should return migration source address
    function currentMigrationSource()
        public
        constant
        returns (address);
}
