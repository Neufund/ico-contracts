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
        // TODO: Proof or check for overflow.

        // Gas consumption (for x):
        // 0    742
        // 1    1228
        // 10   3059
        // 100  3448
        // 10³  3799
        // 10⁶  6769
        // 10⁹  12851

        // (1 - N/D) ≈ e^(-6.5/C)
        uint256 C = 1500000000;
        uint256 N = 343322036817947715929;
        uint256 D = 2**96;
        uint256 P = 2**32;

        // Hard cap
        if(x >= C) {
            return 1497744841;
        }

        // Compute C - C·(1 - N/D)^x using binomial expansion
        uint256 n = C * P;
        uint256 d = 1;
        uint256 a = 0;
        uint256 bits = 0;
        for(uint256 i = 0; i < 34;) {
            // Rescale fraction
            (n, d) = rescale(n, d);
            if(n == 0)
                break;

            // Positive term
            n *= (x - i) * N;
            i += 1;
            n /= i;
            d *= D;
            a += n / d;

            // Rescale fraction
            (n, d) = rescale(n, d);
            if(n == 0)
                break;

            // Negative term
            n *= (x - i) * N;
            i += 1;
            n /= i;
            d *= D;
            a -= n / d;
        }
        return a / P;
    }

    // Rescale a fraction so the numerator and denominator
    // are less than 2¹²⁸
    function rescale(uint256 n, uint256 d)
        internal
        constant
        returns (uint256, uint256)
    {
        // Round scaling down to 32 bit
        // (so we have at least 96 bits of accuracy left)
        uint256 bits = n | d;
        if(bits > 2**128) {
            if(bits > 2**192) {
                if(bits > 2**224) {
                    n /= 2**128;
                    d /= 2**128;
                } else {
                    n /= 2**96;
                    d /= 2**96;
                }
            } else {
                if(bits > 2**160) {
                    n /= 2**64;
                    d /= 2**64;
                } else {
                    n /= 2**32;
                    d /= 2**32;
                }
            }
        }
        return (n, d);
    }
}
