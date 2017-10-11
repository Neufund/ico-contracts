pragma solidity 0.4.15;


contract StandardRoles {

    ////////////////////////
    // Constants
    ////////////////////////

    // @notice Soldity somehow doesn't evaluate this compile time
    // @dev role which has rights to change permissions and set new policy in contract, keccak256("AccessController")
    bytes32 internal constant ROLE_ACCESS_CONTROLLER = 0xac42f8beb17975ed062dcb80c63e6d203ef1c2c335ced149dc5664cc671cb7da;
}
