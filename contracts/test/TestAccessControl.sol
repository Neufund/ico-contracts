pragma solidity 0.4.15;

import '../AccessControl/AccessControlled.sol';
import '../AccessControl/RoleBasedAccessControl.sol';

contract TestAccessControlExampleRoles {

    bytes32 public constant ROLE_EXAMPLE = keccak256("Owner");

}

contract TestAccessControl is AccessControlled, TestAccessControlExampleRoles {

    function TestAccessControl(IAccessPolicy policy)
        AccessControlled(policy)
    {
    }

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
    function TestAccessControlTruffleMixin(IAccessPolicy policy)
        TestAccessControl(policy)
    {
    }
}
