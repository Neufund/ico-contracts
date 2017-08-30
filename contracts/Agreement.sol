pragma solidity 0.4.15;

import './Standards/IEthereumForkArbiter.sol';


contract Agreement {

    IEthereumForkArbiter ethereumForkArbiter;
    string public agreementUri;

    function Agreement(IEthereumForkArbiter forkArbiter, string uri) {
        require(forkArbiter != IEthereumForkArbiter(0x0));
        ethereumForkArbiter = forkArbiter;
        agreementUri = uri;
    }
}
