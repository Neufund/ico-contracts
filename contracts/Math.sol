pragma solidity 0.4.15;


contract Math {

    ////////////////////////
    // Internal functions
    ////////////////////////

    function absDiff(uint256 v1, uint256 v2)
        internal
        constant
        returns(uint256)
    {
        return v1 > v2 ? v1 - v2 : v2 - v1;
    }

    function divRound(uint256 v, uint256 d)
        internal
        constant
        returns(uint256)
    {
        // round up if % is half or more
        return (v + (d/2)) / d;
    }

    // AUDIT[CHF-35] Please document how this function works.
    function fraction(uint256 amount, uint256 frac)
        internal
        constant
        returns(uint256)
    {
        return divRound(mul(amount, frac), 10**18);
    }

    function proportion(uint256 amount, uint256 part, uint256 total)
        internal
        constant
        returns(uint256)
    {
        return divRound(mul(amount, part), total);
    }

    function isSafeMultiplier(uint256 m)
        internal
        constant
        returns(bool)
    {
        return m < 2**128;
    }

    function mul(uint256 a, uint256 b)
        internal
        constant
        returns (uint256)
    {
        uint256 c = a * b;
        assert(a == 0 || c / a == b);
        return c;
    }

    function div(uint256 a, uint256 b)
        internal
        constant
        returns (uint256)
    {
        // assert(b > 0); // Solidity automatically throws when dividing by 0
        uint256 c = a / b;
        // assert(a == b * c + a % b); // There is no case in which this doesn't hold
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
