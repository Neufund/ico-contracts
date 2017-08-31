pragma solidity 0.4.15;

import './IAccessControlled.sol';


contract IAccessPolicy {

    // Note: we don't make this function constant to allow for
    //       state-updating access controls such as rate limiting.
    function allowed(
        address subject,
        bytes32 role,
        IAccessControlled object,
        bytes4 verb
    )
        public
        returns (bool);
}
