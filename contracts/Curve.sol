pragma solidity ^0.4.11;

import 'zeppelin-solidity/contracts/ownership/Ownable.sol';
import './NeumarkController.sol';

contract Curve is Ownable {

    NeumarkController public NEUMARK_CONTROLLER;

    uint256 public totalEuros;

    event NeumarksIssued(address beneficiary, uint256 euros, uint256 neumarks);
    event NeumarksBurned(address beneficiary, uint256 euros, uint256 neumarks);

    modifier checkInverse(uint256 euros, uint256 neumark)
    {
        // TODO: Error margin?
        require(rewind(euros) == neumark);
        _;
    }

    function Curve(NeumarkController neumarkController) {
        NEUMARK_CONTROLLER = neumarkController;
    }

    function issue(uint256 euros, address beneficiary)
        onlyOwner()
        returns (uint256)
    {
        require(totalEuros + euros < totalEuros);
        uint256 toIssue = incremental(euros);
        totalEuros = totalEuros + euros;
        NEUMARK_CONTROLLER.generateTokens(beneficiary, toIssue);
        NeumarksIssued(beneficiary, euros, toIssue);
        return toIssue;
    }

    function burn(uint256 euros, uint256 neumarks, address beneficiary)
        onlyOwner()
        checkInverse(euros, neumarks)
        // TODO: Client side code
        // TODO: Solve race condition?
        returns (uint256)
    {
        totalEuros -= euros;
        NEUMARK_CONTROLLER.destroyTokens(beneficiary, neumarks);
        NeumarksBurned(beneficiary, euros, neumarks);
    }

    function cumulative(uint256 euros)
        public
        constant
        returns (uint256)
    {
        return curve(euros);
    }

    function incremental(uint256 euros)
        public
        constant
        returns (uint256)
    {
        require(totalEuros + euros < totalEuros);
        uint256 from = cumulative(totalEuros);
        uint256 to = cumulative(totalEuros + euros);
        assert(to >= from); // Issuance curve needs to be monotonic
        return to - from;
    }

    function rewind(uint256 euros)
        constant
        returns (uint256)
    {
        require(totalEuros >= euros);
        uint256 from = cumulative(totalEuros - euros);
        uint256 to = cumulative(totalEuros);
        assert(to >= from); // Issuance curve needs to be monotonic
        return to - from;
    }

    function curve(uint256 x)
        public
        constant
        returns(uint256)
    {
        // TODO: Explain.
        // TODO: Proof error bounds / correctness.

        // about 1700 gas
        uint256 C = 1500000000;
        uint256 S = 2**32;
        uint256 N = 343322036817947715929;
        uint256 D = 2**96;

        // Hard cap
        if(x >= C) {
            return 1497744841;
        }

        uint256 n = C * S;
        uint256 d = 1;
        uint256 s = 0;
        for(uint256 i = 0; i < 34;) {
            // Loop: 8 multiply, 2 div, 7 add/sub ≈ 71 gas
            // TODO: check for overflow
            (n, d) = rescale(n, d);
            n *= (x - i) * N;
            i += 1;
            d *= i * D;
            s += n / d;
            (n, d) = rescale(n, d);
            n *= (x - i) * N;
            i += 1;
            d *= i * D;
            s -= n / d;
        }
        return s / S;
    }

    function rescale(uint256 n, uint256 d)
        internal
        constant
        returns (uint256, uint256)
    {
        uint256 t = 2**128;
        uint256 s = 2**32;
        while(n > t || d > t) {
            n /= s;
            d /= s;
        }
        return (n, d);
    }
}
