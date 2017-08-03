pragma solidity ^0.4.11;

contract TimeSource {
    uint256 private mockNow;

    function currentTime() public constant returns (uint256) {
        return mockNow > 0 ? mockNow : block.timestamp;
    }

    function mockTime(uint256 t) public {
        // no mocking on mainnet
        if (block.number > 3316029)
            revert();
        mockNow = t;
    }
}
