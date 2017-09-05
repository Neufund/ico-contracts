pragma solidity 0.4.15;

import './IAccessControlled.sol';
import './StandardRoles.sol';


contract AccessControlled is IAccessControlled, StandardRoles {

    ////////////////////////
    // Mutable state
    ////////////////////////

    IAccessPolicy private _accessPolicy;

    ////////////////////////
    // Modifiers
    ////////////////////////

    modifier only(bytes32 role) {
        require(_accessPolicy.allowed(msg.sender, role, this, msg.sig));
        _;
    }

    ////////////////////////
    // Constructor
    ////////////////////////

    function AccessControlled(IAccessPolicy policy) {
        require(address(policy) != 0x0);
        _accessPolicy = policy;
    }

    ////////////////////////
    // Public functions
    ////////////////////////

    function setAccessPolicy(IAccessPolicy newPolicy)
        public
        only(ROLE_ACCESS_CONTROLER)
    {
        // The access controler also needs to have this
        // role under the new policy. This provides some
        // protection agains locking yourself out.
        require(newPolicy.allowed(msg.sender, ROLE_ACCESS_CONTROLER, this, msg.sig));

        // We can now safely set the new policy without foot shooting.
        IAccessPolicy oldPolicy = _accessPolicy;
        _accessPolicy = newPolicy;

        // Log event
        AccessPolicyChanged(msg.sender, oldPolicy, newPolicy);
    }

    function accessPolicy()
        public
        constant
        returns (IAccessPolicy)
    {
        return _accessPolicy;
    }
}
