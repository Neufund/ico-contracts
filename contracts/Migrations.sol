pragma solidity 0.4.15;


contract Migrations {

    ////////////////////////
    // Immutable state
    ////////////////////////

    address public OWNER;

    ////////////////////////
    // Mutable state
    ////////////////////////

    uint public last_completed_migration;

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
        last_completed_migration = completed;
    }

    function upgrade(address new_address)
        public
        restricted
    {
        Migrations upgraded = Migrations(new_address);
        upgraded.setCompleted(last_completed_migration);
    }
}
