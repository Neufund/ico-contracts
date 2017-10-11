pragma solidity 0.4.15;

import './IAccessControlled.sol';

/// @title provides subject to role checking logic
contract IAccessPolicy {

    ////////////////////////
    // Public functions
    ////////////////////////

    /// @notice We don't make this function constant to allow for state-updating access controls such as rate limiting.
    /// @dev checks if subject belongs to requested role for particular object
    /// @param subject address to be checked against role, typically msg.sender
    /// @param role identifier of required role
    /// @param object contract instance context for role checking, typically contract requesting the check
    /// @param verb additional data, in current AccessControll implementation msg.sig
    /// @return if subject belongs to a role
    function allowed(
        address subject,
        bytes32 role,
        IAccessControlled object,
        bytes4 verb
    )
        public
        returns (bool);
}
