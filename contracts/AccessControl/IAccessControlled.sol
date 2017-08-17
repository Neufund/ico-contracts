pragma solidity 0.4.15;

import './IAccessPolicy.sol';

contract IAccessControlled {

    event AccessPolicyChanged(
        address controler,
        IAccessPolicy oldPolicy,
        IAccessPolicy newPolicy
    );

    function accessPolicy()
        public
        returns (IAccessPolicy);

}
