pragma solidity ^0.4.15;

import "truffle/Assert.sol";  //< Truffle requires this to be included.
import "../contracts/Math.sol";

contract TestMath is
    Math
{
    function testDivRound()
    {
        uint256 a = 115792089237316195423570985008687907853269984665640564039457584007913129639935;
        uint256 b = 2;

        uint256 r = divRound(a, b);
        uint256 expected = 57896044618658097711785492504343953926634992332820282019728792003956564819968;
        // https://www.wolframalpha.com/input/?i=round(115792089237316195423570985008687907853269984665640564039457584007913129639935+%2F+2)

        Assert.equal(r, expected, "divRound(2**256-1, 2) should be 2**255");
    }
}