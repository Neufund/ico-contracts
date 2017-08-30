pragma solidity 0.4.15;


contract IEthereumForkArbiter {

    event ForkAnnounced(
        string name,
        string url,
        uint256 blockNumber
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

    function nextForkBlockNumber()
        public
        returns (uint256);

    function lastSignedBlockNumber()
        public
        returns (uint256);

    function lastSignedBlockHash()
        public
        returns (bytes32);

    function lastSignedTimestamp()
        public
        returns (uint256);

}
