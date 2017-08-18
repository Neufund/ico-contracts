pragma solidity 0.4.15;

contract StandardRoles {

    // NOTE: Soldity somehow doesn't evaluate this compile time
    bytes32 public constant ROLE_ACCESS_CONTROLER = keccak256("AccessControler");
}
