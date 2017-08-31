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

    string public nextForkName;
    string public nextForkUrl;
    uint256 public nextForkBlockNumber;

    uint256 public lastSignedBlockNumber;
    bytes32 public lastSignedBlockHash;
    uint256 public lastSignedTimestamp;

    function EthereumForkArbiter(IAccessPolicy accessPolicy)
        AccessControlled(accessPolicy)
        Reclaimable()
    {
    }

    function nextForkName()
        public
        returns (string)
    {
        return nextForkName;
    }

    function nextForkUrl()
        public
        returns (string)
    {
        return nextForkUrl;
    }

    function nextForkBlockNumber()
        public
        returns (uint256)
    {
        return nextForkBlockNumber;
    }

    function lastSignedBlockNumber()
        public
        returns (uint256)
    {
        return lastSignedBlockNumber;
    }

    function lastSignedBlockHash()
        public
        returns (bytes32)
    {
        return lastSignedBlockHash;
    }

    function lastSignedTimestamp()
        public
        returns (uint256)
    {
        return lastSignedTimestamp;
    }

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
}
