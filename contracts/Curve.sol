pragma solidity 0.4.15;

import './NeumarkController.sol';

contract Curve {

    NeumarkController public NEUMARK_CONTROLLER;

    uint256 public totalEuroUlps;

    event NeumarksIssued(
        address indexed owner,
        uint256 euros,
        uint256 neumarks);

    event NeumarksBurned(
        address indexed owner,
        uint256 euros,
        uint256 neumarks);

    function Curve(NeumarkController neumarkController) {
        totalEuroUlps = 0;
        NEUMARK_CONTROLLER = neumarkController;
    }

    function issueForEuro(uint256 euroUlps)
        public
        returns (uint256)
    {
        require(totalEuroUlps + euroUlps >= totalEuroUlps);
        address beneficiary = msg.sender;
        uint256 neumarkUlps = incremental(euroUlps);

        totalEuroUlps = totalEuroUlps + euroUlps;

        assert(NEUMARK_CONTROLLER.generateTokens(beneficiary, neumarkUlps));

        NeumarksIssued(beneficiary, euroUlps, neumarkUlps);
        return neumarkUlps;
    }

    function burnNeumark(uint256 neumarkUlps)
        public
        returns (uint256)
    {
        address owner = msg.sender;
        uint256 euroUlps = incrementalInverse(neumarkUlps);

        totalEuroUlps -= euroUlps;

        assert(NEUMARK_CONTROLLER.destroyTokens(owner, neumarkUlps));

        NeumarksBurned(owner, euroUlps, neumarkUlps);
        return euroUlps;
    }

    function incremental(uint256 euroUlps)
        public
        constant
        returns (uint256 neumarkUlps)
    {
        require(totalEuroUlps + euroUlps >= totalEuroUlps);
        uint256 from = cumulative(totalEuroUlps);
        uint256 to = cumulative(totalEuroUlps + euroUlps);
        assert(to >= from); // Issuance curve needs to be monotonic
        return to - from;
    }

    function incrementalInverse(uint256 neumarkUlps)
        public
        constant
        returns (uint256 euroUlps)
    {
        if(neumarkUlps == 0) {
            return 0;
        }
        uint256 to = cumulative(totalEuroUlps);
        require(to >= neumarkUlps);
        uint256 fromNmk = to - neumarkUlps;
        uint256 fromEur = cumulativeInverse(fromNmk, 0, totalEuroUlps);
        assert(totalEuroUlps >= fromEur);
        uint256 euros = totalEuroUlps - fromEur;
        return euros;
    }

    function cumulative(uint256 euroUlps)
        public
        constant
        returns(uint256 neumarkUlps)
    {
        uint256 cap   = 1500000000000000000000000000;
        uint256 D     =  230769230769230769230769231;
        uint256 nLim  = 8300000000000000000000000000;

        // Return the cap if n is above the limit.
        if(euroUlps >= nLim) {
            return cap;
        }

        // Approximate cap-cap·(1-1/D)^n using the Binomial theorem
        uint256 term = cap;
        uint256 sum = 0;
        uint256 denom = D;
        do assembly {
            // We use assembler primarily to avoid the expensive
            // divide-by-zero check solc inserts for the / operator.
            term  := div(mul(term, euroUlps), denom)
            sum   := add(sum, term)
            denom := add(denom, D)
            term  := div(mul(term, euroUlps), denom)
            sum   := sub(sum, term)
            denom := add(denom, D)
        } while(term != 0);
        return sum;
    }

    function cumulativeInverse(uint256 neumarkUlps, uint256 min, uint256 max)
        public
        constant
        returns (uint256 euroUlps)
    {
        require(max >= min);
        require(cumulative(min) <= neumarkUlps);
        require(cumulative(max) >= neumarkUlps);

        // Binary search
        while (max > min) {
            uint256 mid = (max + min + 1) / 2;
            uint256 val = cumulative(mid);
            if(val == neumarkUlps) {
                return mid;
            }
            if(val < neumarkUlps) {
                min = mid;
            } else {
                max = mid - 1;
            }
        }
        assert(max == min);

        // Did we find an exact solution?
        if(cumulative(max) == neumarkUlps) {
            return max;
        }

        // NOTE: It is possible that there is no inverse
        // for example curve(0) = 0 and curve(1) = 6, so
        // there is no value y such that curve(y) = 5.
        // In this case we return a value such that curve(y) < x
        // and curve(y + 1) > x.
        assert(cumulative(max) < neumarkUlps);
        assert(cumulative(max + 1) > neumarkUlps);
        return max;
    }
}
