pragma solidity 0.4.15;

import './IAccessPolicy.sol';
import './IAccessControlled.sol';
import './AccessControlled.sol';

contract RoleBasedAccessControl is IAccessPolicy, AccessControlled {

    ////////////////
    // Types
    ////////////////

    // Łukasiewicz logic values
    enum TriState {
        Unset,
        True,
        False
    }

    ////////////////
    // Constants
    ////////////////

    IAccessControlled public constant GLOBAL = IAccessControlled(0x0);

    ////////////////
    // State
    ////////////////

    // subject → role → object → allowed
    mapping (address => mapping(bytes32 => mapping(address => TriState))) access;

    // object → role → addresses
    mapping (address => mapping(bytes32 => address[])) accessList;

    ////////////////
    // Events
    ////////////////

    event AccessChanged(
        IAccessControlled indexed object,
        address indexed subject,
        address controller,
        bytes32 role,
        TriState oldValue,
        TriState newValue
    );

    event Access(
        IAccessControlled indexed object,
        address indexed subject,
        bytes32 role,
        bytes4 verb,
        bool granted
    );

    ////////////////
    // Constructor
    ////////////////

    function RoleBasedAccessControl()
        AccessControlled(this) // We are our own policy. This is immutable.
    {
        // Issue the glboal AccessContoler role to creator
        access[msg.sender][ROLE_ACCESS_CONTROLER][GLOBAL] = TriState.True;
    }

    ////////////////
    // Public functions
    ////////////////

    // Overrides `AccessControlled.setAccessPolicy(IAccessPolicy)`
    function setAccessPolicy(IAccessPolicy)
        public
        only(ROLE_ACCESS_CONTROLER)
    {
        // `RoleBasedAccessControl` always controls its
        // own access. Disallow changing this by overriding
        // the `AccessControlled.setAccessPolicy` function.
        revert();
    }

    // Implements `IAccessPolicy.allowed(IAccessControlled, bytes32, address, bytes4)`
    function allowed(
        address subject,
        bytes32 role,
        IAccessControlled object,
        bytes4 verb
    )
        public
        // constant // NOTE: Solidity does not allow subtyping interfaces
        returns (bool)
    {
        // Try local access first
        TriState localAccess = access[subject][role][object];
        if (localAccess != TriState.Unset) {
            bool grantedLocal = localAccess == TriState.True;

            // Log and return
            Access(object, subject, role, verb, grantedLocal);
            return grantedLocal;
        }

        // Try global state
        TriState globalAccess = access[subject][role][GLOBAL];
        bool granted = globalAccess == TriState.True;

        // Log and return
        Access(object, subject, role, verb, granted);
        return granted;
    }

    // Assign a role to a user globally
    function setUserRole(
        address subject,
        bytes32 role,
        IAccessControlled object,
        TriState newValue
    )
        public
        only(ROLE_ACCESS_CONTROLER)
    {
        setUserRolePrivate(subject, role, object, newValue);
    }

    // Atomically change a set of role assignments
    function setUserRoles(
        address[] subjects,
        bytes32[] roles,
        IAccessControlled[] objects,
        TriState[] newValues
    )
        public
        only(ROLE_ACCESS_CONTROLER)
    {
        require(subjects.length == roles.length);
        require(subjects.length == objects.length);
        require(subjects.length == newValues.length);
        for(uint i = 0; i < subjects.length; i++) {
            setUserRolePrivate(subjects[i], roles[i], objects[i], newValues[i]);
        }
    }

    function getValue(
        address subject,
        bytes32 role,
        IAccessControlled object
    )
        public
        constant
        returns (TriState)
    {
        return access[subject][role][object];
    }

    function getUsers(
        IAccessControlled object,
        bytes32 role
    )
        public
        constant
        returns (address[])
    {
        return accessList[object][role];
    }

    ////////////////
    // Private functions
    ////////////////

    function setUserRolePrivate(
        address subject,
        bytes32 role,
        IAccessControlled object,
        TriState newValue
    )
        private
    {
        // Fetch old value and short-circuit no-ops
        TriState oldValue = access[subject][role][object];
        if(oldValue == newValue) {
            return;
        }

        // Update the mapping
        access[subject][role][object] = newValue;

        // Update the list on add / remove
        address[] storage list = accessList[object][role];
        if(oldValue == TriState.Unset && newValue != TriState.Unset) {
            list.push(subject);
        }
        if(oldValue != TriState.Unset && newValue == TriState.Unset) {
            for(uint i = 0; i < list.length; i++) {
                if(list[i] == subject) {
                    list[i] = list[list.length - 1];
                    delete list[list.length - 1];
                    list.length -= 1;
                }
            }
        }

        // An access controler is not allowed to revoke his own right on this
        // contract. This prevents access controlers from locking themselves
        // out. We also require the current contract to be its own policy for
        // this to work. This is enforced elsewhere.
        if(subject == msg.sender && role == ROLE_ACCESS_CONTROLER) {
            require(allowed(subject, ROLE_ACCESS_CONTROLER, this, msg.sig));
        }

        // Log
        AccessChanged(object, subject, msg.sender, role, oldValue, newValue);
    }
}
