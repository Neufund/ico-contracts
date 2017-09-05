pragma solidity 0.4.15;


contract Migrations {

    ////////////////////////
    // Immutable state
    ////////////////////////

    address private OWNER;

    ////////////////////////
    // Mutable state
    ////////////////////////

    uint private _lastCompletedMigration;

    ////////////////////////
    // Modifiers
    ////////////////////////

    modifier restricted() {
        if (msg.sender == OWNER)
            _;
    }

    ////////////////////////
    // Constructor
    ////////////////////////

    function Migrations() {
        OWNER = msg.sender;
    }

    ////////////////////////
    // Public functions
    ////////////////////////

    function setCompleted(uint completed)
        public
        restricted
    {
        _lastCompletedMigration = completed;
    }

    function upgrade(address new_address)
        public
        restricted
    {
        Migrations upgraded = Migrations(new_address);
        upgraded.setCompleted(_lastCompletedMigration);
    }

    function lastCompletedMigration()
        public
        constant
        returns (uint)
    {
        return _lastCompletedMigration;
    }

    function owner()
        public
        constant
        returns (address)
    {
        return OWNER;
    }
}
