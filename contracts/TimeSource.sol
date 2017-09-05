pragma solidity 0.4.15;


contract TimeSource {

    ////////////////////////
    // Public functions
    ////////////////////////

    function currentTime() internal constant returns (uint256) {
        return block.timestamp;
    }
}
