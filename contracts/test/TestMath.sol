pragma solidity 0.4.15;

import "../Math.sol";


contract TestMath is Math {

    ////////////////////////
    // Public functions
    ////////////////////////

    function _absDiff(uint256 v1, uint256 v2)
        public
        constant
        returns(uint256)
    {
        return absDiff(v1, v2);
    }

    function _divRound(uint256 v, uint256 d)
        public
        constant
        returns(uint256)
    {

        return divRound(v, d);
    }

    function _decimalFraction(uint256 amount, uint256 frac)
        public
        constant
        returns(uint256)
    {
        return decimalFraction(amount, frac);
    }

    function _proportion(uint256 amount, uint256 part, uint256 total)
        public
        constant
        returns(uint256)
    {
        return proportion(amount, part, total);
    }

    function _min(uint256 a, uint256 b)
        public
        constant
        returns (uint256)
    {
        return min(a, b);
    }

    function _max(uint256 a, uint256 b)
        public
        constant
        returns (uint256)
    {
        return max(a, b);
    }
}
