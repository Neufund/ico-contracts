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

    function burnNeumark(uint256 neumarks, address beneficiary)
        onlyOwner()
        public
        returns (uint256)
    {
        burn(rewindInverse(neumarks), neumarks, beneficiary);
    }

    function burn(uint256 euros, uint256 neumarks, address beneficiary)
        onlyOwner()
        checkInverse(euros, neumarks)
        // TODO: Client side code
        // TODO: Solve race condition?
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

    function rewindInverse(uint256 neumarks)
        constant
        returns (uint256)
    {
        if(neumarks == 0) {
            return 0;
        }
        uint256 to = cumulative(totalEuros);
        require(to > neumarks);
        uint256 from = to - neumarks;
        uint256 euros = inverse(from, 0, totalEuros);
        assert(rewind(euros) == neumarks);
        return euros;
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
        // 0    468
        // 1    621
        // 10   784
        // 100  784
        // 10³  937
        // 10⁶  1416
        // 10⁹  6156
        // >    240

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
        uint256 a = 0;
        uint256 i = 0;
        while(n != 0) {

            // Positive term
            n *= (x - i) * N;
            i += 1;
            n /= i;
            n /= D;
            a += n;

            // Exit if n == 0
            if(n == 0) break;

            // Negative term
            n *= (x - i) * N;
            i += 1;
            n /= i;
            n /= D;
            a -= n;
        }
        return a / P;
    }

    function inverse(uint256 x, uint256 min, uint256 max)
        constant
        returns (uint256)
    {
        require(cummulative(min) <= x);
        require(cummulative(max) >= x);

        // Binary search
        uint256 low = min;
        uint256 high = max;
        while (high > low) {
            uint mid = (high + low + 1) / 2;
            if (cumulative(mid) <= from) {
                low = mid;
            } else {
                high = mid - 1;
            }
        }
        return min;
    }
}
