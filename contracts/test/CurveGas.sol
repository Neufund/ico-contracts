pragma solidity 0.4.15;

import '../NeumarkIssuanceCurve.sol';


contract CurveGas is NeumarkIssuanceCurve {

    ////////////////////////
    // External functions
    ////////////////////////

    function cumulativeWithGas(uint256 n)
        external
        returns (uint256, uint256)
    {
        uint256 start = msg.gas;
        uint256 result = cumulative(n);
        uint256 finish = msg.gas;
        return (result, start - finish);
    }
}
