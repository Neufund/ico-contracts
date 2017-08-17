pragma solidity 0.4.15;

import '../Curve.sol';

contract CurveGas is Curve {

    function CurveGas(NeumarkController controller)
        public
        Curve(controller)
    {
    }

    function curveGas(uint256 n)
        external
        returns (uint256, uint256)
    {
        uint start = msg.gas;
        uint result = curve(n);
        uint finish = msg.gas;
        return (result, start - finish);
    }
}
