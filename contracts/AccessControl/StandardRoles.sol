pragma solidity 0.4.15;


contract StandardRoles {

    ////////////////////////
    // Constants
    ////////////////////////

    // NOTE: Soldity somehow doesn't evaluate this compile time
    // keccak256("AccessControler")
    // AUDIT[CHF-114] Typo CONTROLER -> CONTROLLER.
    //   The name should be ROLE_ACCESS_CONTROLLER. The assigned constant
    //   must be also changed.
    bytes32 internal constant ROLE_ACCESS_CONTROLER = 0x7af7af21646173497b2ebfbff756b8658939b80bf5ac6a438a408950d80d5086;
}
