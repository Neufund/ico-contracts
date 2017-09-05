pragma solidity 0.4.15;

import '../AccessControl/AccessControlled.sol';
import '../AccessControl/RoleBasedAccessControl.sol';


contract TestAccessControlExampleRoles {

    ////////////////////////
    // Constants
    ////////////////////////

    // keccak256("Example")
    bytes32 internal constant ROLE_EXAMPLE = 0xb01f6215887f913abe74277c39da2c7de51baf17958191658f84959dfddab970;
}


contract TestAccessControl is AccessControlled, TestAccessControlExampleRoles {

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


// derives from RoleBasedAccessControl just to have events ABIs as truffle will not handle
// events from internal transactions to other contracts
// do not change derivation order, RoleBasedAccessControl must be first for tests to pass
contract TestAccessControlTruffleMixin is RoleBasedAccessControl, TestAccessControl {

    ////////////////////////
    // Constructor
    ////////////////////////

    function TestAccessControlTruffleMixin(IAccessPolicy policy)
        TestAccessControl(policy)
    {
    }
}
