pragma solidity 0.4.15;

import '../AccessControl/AccessControlled.sol';
import '../Agreement.sol';


contract TestAgreement is
    AccessControlled,
    Agreement
{
    ////////////////////////
    // Constructor
    ////////////////////////

    function TestAgreement(IAccessPolicy accessPolicy, IEthereumForkArbiter forkArbiter)
        AccessControlled(accessPolicy)
        Agreement(accessPolicy, forkArbiter)
    {
    }

    ////////////////////////
    // Public functions
    ////////////////////////

    function signMeUp()
        public
        acceptAgreement(msg.sender)
    {
    }

    function signMeUpAgain()
        public
        acceptAgreement(msg.sender)
    {
    }
}
