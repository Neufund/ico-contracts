pragma solidity 0.4.15;

import './Standards/IEthereumForkArbiter.sol';


contract Agreement {

    IEthereumForkArbiter public ethereumForkArbiter;
    string public agreementUri;

    event AgreementAccepted(address indexed accepter);

    modifier acceptAgreement(address accepter) {
        AgreementAccepted(accepter);
        _;
    }

    function Agreement(IEthereumForkArbiter forkArbiter, string uri) {
        require(forkArbiter != IEthereumForkArbiter(0x0));
        ethereumForkArbiter = forkArbiter;
        agreementUri = uri;
    }
}
