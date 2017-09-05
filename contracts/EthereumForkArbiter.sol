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

    string private nextForkName;

    string private nextForkUrl;

    uint256 private nextForkBlockNumber;

    uint256 private lastSignedBlockNumber;

    bytes32 private lastSignedBlockHash;

    uint256 private lastSignedTimestamp;

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
        nextForkName = name;
        nextForkUrl = url;
        nextForkBlockNumber = blockNumber;

        // Log
        ForkAnnounced(nextForkName, nextForkUrl, nextForkBlockNumber);
    }

    /// @notice Declare that the current fork (as identified by a blockhash) is the valid fork. The valid fork is always the one with the most recent signature.
    function signFork(uint256 number, bytes32 hash)
        public
        only(ROLE_FORK_ARBITER)
    {
        require(block.blockhash(number) == hash);

        // Reset announcement
        delete nextForkName;
        delete nextForkUrl;
        delete nextForkBlockNumber;

        // Store signature
        lastSignedBlockNumber = number;
        lastSignedBlockHash = hash;
        lastSignedTimestamp = block.timestamp;

        // Log
        ForkSigned(lastSignedBlockNumber, lastSignedBlockHash);
    }

    function nextForkName()
        public
        constant
        returns (string)
    {
        return nextForkName;
    }

    function nextForkUrl()
        public
        constant
        returns (string)
    {
        return nextForkUrl;
    }

    function nextForkBlockNumber()
        public
        constant
        returns (uint256)
    {
        return nextForkBlockNumber;
    }

    function lastSignedBlockNumber()
        public
        constant
        returns (uint256)
    {
        return lastSignedBlockNumber;
    }

    function lastSignedBlockHash()
        public
        constant
        returns (bytes32)
    {
        return lastSignedBlockHash;
    }

    function lastSignedTimestamp()
        public
        constant
        returns (uint256)
    {
        return lastSignedTimestamp;
    }
}
