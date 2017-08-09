pragma solidity ^0.4.11;


contract Math {

    function absDiff(uint256 v1, uint256 v2) public constant returns(uint256) {
        return v1 > v2 ? v1 - v2 : v2 - v1;
    }

    function divRound(uint256 v, uint256 d) public constant returns(uint256) {
        // round up if % is half or more
        return (v + (d/2)) / d;
    }

    function fraction(uint256 amount, uint256 frac) public constant returns(uint256) {
        return divRound(mul(amount, frac), 10**18);
    }

    function proportion(uint256 amount, uint256 part, uint256 total) public constant returns(uint256) {
        return divRound(mul(amount, part), total);
    }

    function isSafeMultiplier(uint256 m) public constant returns(bool) {
        return m < 2**128;
    }

    function mul(uint256 a, uint256 b) internal constant returns (uint256) {
      uint256 c = a * b;
      assert(a == 0 || c / a == b);
      return c;
    }

    function div(uint256 a, uint256 b) internal constant returns (uint256) {
      // assert(b > 0); // Solidity automatically throws when dividing by 0
      uint256 c = a / b;
      // assert(a == b * c + a % b); // There is no case in which this doesn't hold
      return c;
    }

    function sub(uint256 a, uint256 b) internal constant returns (uint256) {
      assert(b <= a);
      return a - b;
    }

    function add(uint256 a, uint256 b) internal constant returns (uint256) {
      uint256 c = a + b;
      assert(c >= a);
      return c;
    }
}
