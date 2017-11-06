pragma solidity 0.4.15;


contract Migrations {

    ////////////////////////
    // Immutable state
    ////////////////////////

    address private OWNER;

    ////////////////////////
    // Mutable state
    ////////////////////////

    uint256 private _lastCompletedMigration;

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

    function Migrations() public {
        OWNER = msg.sender;
    }

    ////////////////////////
    // Public functions
    ////////////////////////

    function setCompleted(uint256 completed)
        public
        restricted
    {
        _lastCompletedMigration = completed;
    }

    function upgrade(address newAddress)
        public
        restricted
    {
        Migrations upgraded = Migrations(newAddress);
        upgraded.setCompleted(_lastCompletedMigration);
    }

    function lastCompletedMigration()
        public
        constant
        returns (uint256)
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
