pragma solidity 0.4.15;

import '../AccessControl/AccessControlled.sol';
import '../AccessControl/RoleBasedAccessPolicy.sol';


contract TestAccessControlExampleRoles {

    ////////////////////////
    // Constants
    ////////////////////////

    // keccak256("Example")
    bytes32 internal constant ROLE_EXAMPLE = 0xb01f6215887f913abe74277c39da2c7de51baf17958191658f84959dfddab970;
}


contract TestAccessControl is AccessControlled, TestAccessControlExampleRoles {

    ////////////////
    // Types
    ////////////////

    // Łukasiewicz logic values
    enum TriState {
        Unset,
        Allow,
        Deny
    }

    ////////////////////////
    // Events
    ////////////////////////

    /// @dev just to have events ABIs as truffle will not handle events from internal transactions to other contracts
    event LogAccessChanged(
        address controller,
        address indexed subject,
        bytes32 role,
        IAccessControlled indexed object,
        TriState oldValue,
        TriState newValue
    );

    event LogAccess(
        address indexed subject,
        bytes32 role,
        IAccessControlled indexed object,
        bytes4 verb,
        bool granted
    );

    ////////////////////////
    // Constructor
    ////////////////////////

    function TestAccessControl(IAccessPolicy policy)
        AccessControlled(policy)
    {
    }

    ////////////////////////
    // Public functions
    ////////////////////////

    function someFunction()
        public
        only(ROLE_EXAMPLE)
    {
    }
}
