pragma solidity 0.4.15;


contract Math {

    ////////////////////////
    // Internal functions
    ////////////////////////

    // absolute difference: |v1 - v2|
    function absDiff(uint256 v1, uint256 v2)
        internal
        constant
        returns(uint256)
    {
        return v1 > v2 ? v1 - v2 : v2 - v1;
    }

    // divide v by d, round up if remainder is 0.5 or more
    function divRound(uint256 v, uint256 d)
        internal
        constant
        returns(uint256)
    {
        return add(v, d/2) / d;
    }

    // computes decimal decimalFraction 'frac' of 'amount' with maximum precision (multiplication first)
    // both amount and decimalFraction must have 18 decimals precision, frac 10**18 represents a whole (100% of) amount
    // mind loss of precision as decimal fractions do not have finite binary expansion
    // do not use instead of division
    function decimalFraction(uint256 amount, uint256 frac)
        internal
        constant
        returns(uint256)
    {
        // it's like 1 ether is 100% proportion
        return proportion(amount, frac, 10**18);
    }

    // computes part/total of amount with maximum precision (multiplication first)
    // part and total must have the same units
    function proportion(uint256 amount, uint256 part, uint256 total)
        internal
        constant
        returns(uint256)
    {
        return divRound(mul(amount, part), total);
    }

    //
    // Open Zeppelin Math library below
    //

    function mul(uint256 a, uint256 b)
        internal
        constant
        returns (uint256)
    {
        uint256 c = a * b;
        assert(a == 0 || c / a == b);
        return c;
    }

    function sub(uint256 a, uint256 b)
        internal
        constant
        returns (uint256)
    {
        assert(b <= a);
        return a - b;
    }

    function add(uint256 a, uint256 b)
        internal
        constant
        returns (uint256)
    {
        uint256 c = a + b;
        assert(c >= a);
        return c;
    }

    function min(uint256 a, uint256 b)
        internal
        constant
        returns (uint256)
    {
        return a < b ? a : b;
    }

    function max(uint256 a, uint256 b)
        internal
        constant
        returns (uint256)
    {
        return a > b ? a : b;
    }
}
