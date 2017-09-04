pragma solidity 0.4.15;

import '../NeumarkIssuanceCurve.sol';


contract CurveGas is NeumarkIssuanceCurve {

    function cumulativeWithGas(uint256 n)
        external
        returns (uint256, uint256)
    {
        uint start = msg.gas;
        uint result = cumulative(n);
        uint finish = msg.gas;
        return (result, start - finish);
    }
}
