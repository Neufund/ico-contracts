pragma solidity 0.4.15;

import './IAccessControlled.sol';
import './StandardRoles.sol';


/// @title Granular code execution permissions
/// @notice Intended to replace existing Ownable pattern with more granular permissions set to execute smart contract functions
///     for each function where 'only' modifier is applied, IAccessPolicy implementation is called to evaluate if msg.sender belongs to required role for contract being called.
///     Access evaluation specific belong to IAccessPolicy implementation, see RoleBasedAccessPolicy for details.
/// @dev Should be inherited by a contract requiring such permissions controll. IAccessPolicy must be provided in constructor. Access policy may be replaced to a different one
///     by msg.sender with ROLE_ACCESS_CONTROLLER role
contract AccessControlled is IAccessControlled, StandardRoles {

    ////////////////////////
    // Mutable state
    ////////////////////////

    IAccessPolicy private _accessPolicy;

    ////////////////////////
    // Modifiers
    ////////////////////////

    /// @dev limits function execution only to senders assigned to required 'role'
    modifier only(bytes32 role) {
        require(_accessPolicy.allowed(msg.sender, role, this, msg.sig));
        _;
    }

    ////////////////////////
    // Constructor
    ////////////////////////

    function AccessControlled(IAccessPolicy policy) internal {
        require(address(policy) != 0x0);
        _accessPolicy = policy;
    }

    ////////////////////////
    // Public functions
    ////////////////////////

    //
    // Implements IAccessControlled
    //

    function setAccessPolicy(IAccessPolicy newPolicy, address newAccessController)
        public
        only(ROLE_ACCESS_CONTROLLER)
    {
        // ROLE_ACCESS_CONTROLLER must be present
        // under the new policy. This provides some
        // protection against locking yourself out.
        require(newPolicy.allowed(newAccessController, ROLE_ACCESS_CONTROLLER, this, msg.sig));

        // We can now safely set the new policy without foot shooting.
        IAccessPolicy oldPolicy = _accessPolicy;
        _accessPolicy = newPolicy;

        // Log event
        LogAccessPolicyChanged(msg.sender, oldPolicy, newPolicy);
    }

    function accessPolicy()
        public
        constant
        returns (IAccessPolicy)
    {
        return _accessPolicy;
    }
}
