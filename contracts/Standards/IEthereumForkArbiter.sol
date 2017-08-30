pragma solidity 0.4.15;


contract IEthereumForkArbiter {

    event ForkAnnounced(
        string name,
        string url
    );

    event ForkSigned(
        uint256 blockNumber,
        bytes32 blockHash
    );

    function nextForkName()
        public
        returns (string);

    function nextForkUrl()
        public
        returns (string);

    function lastSignedBlockNumber()
        public
        returns (string);

    function lastSignedBlockHash()
        public
        returns (string);

    function lastSignedTimestamp()
        public
        returns (string);

}
