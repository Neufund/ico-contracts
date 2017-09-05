pragma solidity 0.4.15;

import './Standards/IEthereumForkArbiter.sol';


contract Agreement {

    ////////////////////////
    // Immutable state
    ////////////////////////

    IEthereumForkArbiter public ethereumForkArbiter;

    string public agreementUri;

    ////////////////////////
    // Events
    ////////////////////////

    event AgreementAccepted(
        address indexed accepter
    );

    ////////////////////////
    // Modifiers
    ////////////////////////

    modifier acceptAgreement(address accepter) {
        AgreementAccepted(accepter);
        _;
    }

    ////////////////////////
    // Constructor
    ////////////////////////

    function Agreement(IEthereumForkArbiter forkArbiter, string uri) {
        require(forkArbiter != IEthereumForkArbiter(0x0));
        ethereumForkArbiter = forkArbiter;
        agreementUri = uri;
    }
}
