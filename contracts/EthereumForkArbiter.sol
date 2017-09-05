pragma solidity 0.4.15;

import './AccessControl/AccessControlled.sol';
import './AccessRoles.sol';
import './Reclaimable.sol';
import './Standards/IEthereumForkArbiter.sol';


contract EthereumForkArbiter is
    IEthereumForkArbiter,
    AccessControlled,
    AccessRoles,
    Reclaimable
{
    ////////////////////////
    // Mutable state
    ////////////////////////

    string private _nextForkName;

    string private _nextForkUrl;

    uint256 private _nextForkBlockNumber;

    uint256 private _lastSignedBlockNumber;

    bytes32 private _lastSignedBlockHash;

    uint256 private _lastSignedTimestamp;

    ////////////////////////
    // Constructor
    ////////////////////////

    function EthereumForkArbiter(IAccessPolicy accessPolicy)
        AccessControlled(accessPolicy)
        Reclaimable()
    {
    }

    ////////////////////////
    // Public functions
    ////////////////////////

    /// @notice Announce that a particular future Ethereum fork will the one taken by the contract. The contract on the other branch should be considered invalid. Once the fork has happened, it will additionally be confirmed by signing a block on the fork. Notice that forks may happen unannounced.
    function announceFork(
        string name,
        string url,
        uint256 blockNumber
    )
        public
        only(ROLE_FORK_ARBITER)
    {
        require(blockNumber == 0 || blockNumber > block.number);

        // Store announcement
        _nextForkName = name;
        _nextForkUrl = url;
        _nextForkBlockNumber = blockNumber;

        // Log
        ForkAnnounced(_nextForkName, _nextForkUrl, _nextForkBlockNumber);
    }

    /// @notice Declare that the current fork (as identified by a blockhash) is the valid fork. The valid fork is always the one with the most recent signature.
    function signFork(uint256 number, bytes32 hash)
        public
        only(ROLE_FORK_ARBITER)
    {
        require(block.blockhash(number) == hash);

        // Reset announcement
        delete _nextForkName;
        delete _nextForkUrl;
        delete _nextForkBlockNumber;

        // Store signature
        _lastSignedBlockNumber = number;
        _lastSignedBlockHash = hash;
        _lastSignedTimestamp = block.timestamp;

        // Log
        ForkSigned(_lastSignedBlockNumber, _lastSignedBlockHash);
    }

    function nextForkName()
        public
        constant
        returns (string)
    {
        return _nextForkName;
    }

    function nextForkUrl()
        public
        constant
        returns (string)
    {
        return _nextForkUrl;
    }

    function nextForkBlockNumber()
        public
        constant
        returns (uint256)
    {
        return _nextForkBlockNumber;
    }

    function lastSignedBlockNumber()
        public
        constant
        returns (uint256)
    {
        return _lastSignedBlockNumber;
    }

    function lastSignedBlockHash()
        public
        constant
        returns (bytes32)
    {
        return _lastSignedBlockHash;
    }

    function lastSignedTimestamp()
        public
        constant
        returns (uint256)
    {
        return _lastSignedTimestamp;
    }
}
