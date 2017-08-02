pragma solidity ^0.4.11;

import 'zeppelin-solidity/contracts/ownership/Ownable.sol';
import './NeumarkController.sol';

contract Curve is Ownable {

    NeumarkController public NEUMARK_CONTROLLER;

    uint256 public totalEuros;

    event NeumarksIssued(address beneficiary, uint256 euros, uint256 neumarks);

    function issueNeumarks(uint256 euros, address beneficiary)
        onlyOwner
        returns (uint256)
    {
        require(totalEuros + euros < totalEuros);

        uint256 toIssue = incrementalNeumarks(euros);

        totalEuros = totalEuros + euros;

        //NEUMARK_CONTROLLER.generateTokens(toIssue, beneficiary);

        //NeumarksIssued(beneficiary, euros, toIssue);
    }

    function cumulativeNeumarks(uint256 euros)
        public
        constant
        returns (uint256)
    {
        return euros;
    }

    function incrementalNeumarks(uint256 euros)
        public
        constant
        returns (uint256)
    {
        require(totalEuros + euros < totalEuros);
        uint256 from = 0;//issued(totalEuros);
        uint256 to = 0;//issued(totalEuros + euros);

        // Issuance curve needs to be monotonic
        assert(to >= from);
        return to - from;
    }
}
