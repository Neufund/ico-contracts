pragma solidity 0.4.15;

import './Standards/IEthereumForkArbiter.sol';


contract Agreement {

    ////////////////////////
    // Immutable state
    ////////////////////////

    IEthereumForkArbiter private ETHEREUM_FORK_ARBITER;

    string private AGREEMENT_URI;

    ////////////////////////
    // Events
    ////////////////////////

    event LogAgreementAccepted(
        address indexed accepter
    );

    ////////////////////////
    // Modifiers
    ////////////////////////

    modifier acceptAgreement(address accepter) {
        LogAgreementAccepted(accepter);
        _;
    }

    ////////////////////////
    // Constructor
    ////////////////////////

    function Agreement(IEthereumForkArbiter forkArbiter, string uri) {
        require(forkArbiter != IEthereumForkArbiter(0x0));
        ETHEREUM_FORK_ARBITER = forkArbiter;
        AGREEMENT_URI = uri;
    }

    function ethereumForkArbiter()
        public
        constant
        returns (IEthereumForkArbiter)
    {
        return ETHEREUM_FORK_ARBITER;
    }

    function agreementUri()
        public
        constant
        returns (string)
    {
        return AGREEMENT_URI;
    }
}
