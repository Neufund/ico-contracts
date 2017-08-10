pragma solidity ^0.4.11;

import 'zeppelin-solidity/contracts/ownership/Ownable.sol';
import './NeumarkController.sol';

contract Curve is Ownable {

    // TODO: Fractional Euros and Fractional Neumarks

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

    function Curve(NeumarkController neumarkController)
        Ownable()
    {
        totalEuros = 0;
        NEUMARK_CONTROLLER = neumarkController;
    }

    function issue(uint256 euros, address beneficiary)
        //onlyOwner()
        public
        returns (uint256)
    {
        require(totalEuros + euros >= totalEuros);
        uint256 toIssue = incremental(euros);
        totalEuros = totalEuros + euros;
        assert(NEUMARK_CONTROLLER.generateTokens(beneficiary, toIssue));
        NeumarksIssued(beneficiary, euros, toIssue);
        return toIssue;
    }

    function burnNeumark(uint256 neumarks, address beneficiary)
        //onlyOwner()
        public
        returns (uint256)
    {
        uint256 euros = rewindInverse(neumarks);
        burn(euros, neumarks, beneficiary);
        return euros;
    }

    function burn(uint256 euros, uint256 neumarks, address beneficiary)
        //onlyOwner()
        public
        checkInverse(euros, neumarks)
        // TODO: Client side code
        // TODO: Solve race condition?
    {
        totalEuros -= euros;
        assert(NEUMARK_CONTROLLER.destroyTokens(beneficiary, neumarks));
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
        require(totalEuros + euros >= totalEuros);
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
        require(to >= neumarks);
        uint256 fromNmk = to - neumarks;
        uint256 fromEur = inverse(fromNmk, 0, totalEuros);
        assert(totalEuros >= fromEur);
        uint256 euros = totalEuros - fromEur;
        assert(rewind(euros) == neumarks);
        return euros;
    }

    // Gas consumption (for x in EUR):
    // 0    324
    // 1    530
    // 10   530
    // 100  606
    // 10³  606
    // 10⁶  953
    // 10⁹  3426
    // CAP  4055
    // LIM  10686
    // ≥    258
    function curve(uint256 x)
        public
        constant
        returns(uint256)
    {
        // TODO: Explain.
        // TODO: Proof error bounds / correctness.
        // TODO: Proof or check for overflow.

        uint256 NMK_DECIMALS = 10**18;
        uint256 EUR_DECIMALS = 10**18;
        uint256 CAP = 1500000000;

        // At some point the curve is flat to within a small
        // fraction of a Neumark. We just make it flat.
        uint256 LIM = 83 * 10**8 * EUR_DECIMALS;
        if(x >= LIM) {
            return CAP * NMK_DECIMALS;
        }

        // 1 - 1/D ≈ e^(-6.5 / CAP·EUR_DECIMALS)
        // D = Round[1 / (1 - e^(-6.5 / CAP·EUR_DECIMALS))]
        uint256 D = 230769230769230769230769231;

        // Cap in NMK-ULP (Neumark units of least precision).
        uint256 C = CAP * NMK_DECIMALS;

        // Compute C - C·(1 - 1/D)^x using binomial expansion.
        // Assuming D ≫ x ≫ 1 so we don't bother with
        // the `x -= 1` because we will converge before this
        // has a noticable impact on `x`.
        uint256 n = C;
        uint256 a = 0;
        uint256 d = D;
        assembly {
            repeat:
                n := div(mul(n, x), d)
                jumpi(done, iszero(n))
                a := add(a, n)
                d := add(d, D)
                n := div(mul(n, x), d)
                jumpi(done, iszero(n))
                a := sub(a, n)
                d := add(d, D)
                jump(repeat)
            done:
        }
        return a;
    }


    function inverse(uint256 x, uint256 min, uint256 max)
        constant
        returns (uint256)
    {
        require(max >= min);
        require(curve(min) <= x);
        require(curve(max) >= x);

        // Binary search
        while (max > min) {
            uint256 mid = (max + min + 1) / 2;
            uint256 val = curve(mid);
            if(val == x) {
                return mid;
            }
            if(val < x) {
                min = mid;
            } else {
                max = mid - 1;
            }
        }
        assert(max == min);

        // Did we find an exact solution?
        if(curve(max) == x) {
            return x;
        }

        // NOTE: It is possible that there is no inverse
        // for example curve(0) = 0 and curve(1) = 6, so
        // there is no value y such that curve(y) = 5.
        // In this case we return a value such that curve(y) < x
        // and curve(y + 1) > x.
        assert(curve(max) < x);
        assert(curve(max + 1) > x);
        return max;
    }
}
