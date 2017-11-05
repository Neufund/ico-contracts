pragma solidity 0.4.15;

import '../NeumarkIssuanceCurve.sol';


contract CurveGas is NeumarkIssuanceCurve {

    ////////////////////////
    // External functions
    ////////////////////////

    function cumulativeWithGas(uint256 n)
        external
        constant
        returns (uint256, uint256)
    {
        uint256 start = msg.gas;
        uint256 result = cumulative(n);
        uint256 finish = msg.gas;
        return (result, start - finish);
    }

    function incrementalInverseWithGas(uint256 totalEuroUlps, uint256 neumarkUlps)
        external
        constant
        returns (uint256, uint256)
    {
        uint256 start = msg.gas;
        uint256 result = incrementalInverse(totalEuroUlps, neumarkUlps);
        uint256 finish = msg.gas;
        return (result, start - finish);
    }

    function incrementalInverseWithGas(uint256 totalEuroUlps, uint256 neumarkUlps, uint256 minEurUlps, uint256 maxEurUlps)
        external
        constant
        returns (uint256, uint256)
    {
        uint256 start = msg.gas;
        uint256 result = incrementalInverse(totalEuroUlps, neumarkUlps, minEurUlps, maxEurUlps);
        uint256 finish = msg.gas;
        return (result, start - finish);
    }

    function cumulativeInverseWithGas(uint256 neumarkUlps, uint256 minEurUlps, uint256 maxEurUlps)
        external
        constant
        returns (uint256, uint256)
    {
        uint256 start = msg.gas;
        uint256 result = cumulativeInverse(neumarkUlps, minEurUlps, maxEurUlps);
        uint256 finish = msg.gas;
        return (result, start - finish);
    }
}
