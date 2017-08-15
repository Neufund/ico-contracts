pragma solidity ^0.4.11;

contract TimeSource {
    function currentTime() internal constant returns (uint256) {
        return block.timestamp;
    }
}
