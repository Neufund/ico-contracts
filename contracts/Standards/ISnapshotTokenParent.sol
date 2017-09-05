pragma solidity 0.4.15;


contract ISnapshotTokenParent {

    ////////////////////////
    // Public functions
    ////////////////////////

    /// @notice Total amount of tokens at a specific `snapshot`.
    /// @param snapshot The block number when the totalSupply is queried
    /// @return The total amount of tokens at `snapshot`
    function totalSupplyAt(uint256 snapshot)
        public
        constant
        returns(uint256);

    /// @dev Queries the balance of `owner` at a specific `snapshot`
    /// @param owner The address from which the balance will be retrieved
    /// @param snapshot The block number when the balance is queried
    /// @return The balance at `snapshot`
    function balanceOfAt(address owner, uint256 snapshot)
        public
        constant
        returns (uint256);
}
