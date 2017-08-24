pragma solidity ^0.4.11;

import './Zeppelin/Ownable.sol';
import './NeumarkController.sol';

contract Curve is Ownable {

    // TODO: Fractional Euros and Fractional Neumarks

    NeumarkController public NEUMARK_CONTROLLER;

    uint256 public totalEuroUlps;

    event NeumarksIssued(address beneficiary, uint256 euros, uint256 neumarks);
    event NeumarksBurned(address beneficiary, uint256 euros, uint256 neumarks);

    modifier checkInverse(uint256 euroUlps, uint256 neumarkUlps)
    {
        // TODO: Error margin?
        require(rewind(euroUlps) == neumarkUlps);
        _;
    }

    function Curve(NeumarkController neumarkController)
        Ownable()
    {
        totalEuroUlps = 0;
        NEUMARK_CONTROLLER = neumarkController;
    }

    // issues to msg.sender, further neumarks distribution happens there
    function issue(uint256 euroUlps)
        //onlyOwner()
        public
        returns (uint256)
    {
        return issueTo(euroUlps, msg.sender);
    }

    function issueTo(uint256 euroUlps, address beneficiary)
        //onlyOwner()
        public // I do not see any case where this function is public
        returns (uint256)
    {
        require(totalEuroUlps + euroUlps >= totalEuroUlps);
        uint256 neumarkUlps = incremental(euroUlps);
        totalEuroUlps = totalEuroUlps + euroUlps;
        assert(NEUMARK_CONTROLLER.generateTokens(beneficiary, neumarkUlps));
        NeumarksIssued(beneficiary, euroUlps, neumarkUlps);
        return neumarkUlps;
    }

    function burnNeumarkFrom(uint256 neumarkUlps, address beneficiary)
        // @remco I do not see use case where we burn someone's neumark
        //onlyOwner()
        public
        returns (uint256)
    {
        uint256 euroUlps = rewindInverse(neumarkUlps);
        burn(euroUlps, neumarkUlps, beneficiary);
        return euroUlps;
    }

    function burnNeumark(uint256 neumarkUlps)
        // @remco I do not see use case where we burn someone's neumark
        //onlyOwner()
        public
        returns (uint256)
    {
        return burnNeumarkFrom(neumarkUlps, msg.sender);
    }

    function burn(uint256 euroUlps, uint256 neumarkUlps, address beneficiary)
        //onlyOwner()
        //@remco - this should be internal function, i do not see an use case for any client to call it
        public
        // TODO: checkInverse(euroUlps, neumarkUlps)
        // TODO: Client side code
        // TODO: Solve race condition?
    {
        totalEuroUlps -= euroUlps;
        assert(NEUMARK_CONTROLLER.destroyTokens(beneficiary, neumarkUlps));
        NeumarksBurned(beneficiary, euroUlps, neumarkUlps);
    }

    function cumulative(uint256 euroUlps)
        public
        constant
        returns (uint256)
    {
        return curve(euroUlps);
    }

    function incremental(uint256 euroUlps)
        public
        constant
        returns (uint256)
    {
        require(totalEuroUlps + euroUlps >= totalEuroUlps);
        uint256 from = cumulative(totalEuroUlps);
        uint256 to = cumulative(totalEuroUlps + euroUlps);
        assert(to >= from); // Issuance curve needs to be monotonic
        return to - from;
    }

    function rewind(uint256 euroUlps)
        constant
        returns (uint256)
    {
        require(totalEuroUlps >= euroUlps);
        uint256 from = cumulative(totalEuroUlps - euroUlps);
        uint256 to = cumulative(totalEuroUlps);
        assert(to >= from); // Issuance curve needs to be monotonic
        return to - from;
    }

    function rewindInverse(uint256 neumarkUlps)
        constant
        returns (uint256)
    {
        if(neumarkUlps == 0) {
            return 0;
        }
        uint256 to = cumulative(totalEuroUlps);
        require(to >= neumarkUlps);
        uint256 fromNmk = to - neumarkUlps;
        uint256 fromEur = inverse(fromNmk, 0, totalEuroUlps);
        assert(totalEuroUlps >= fromEur);
        uint256 euros = totalEuroUlps - fromEur;
        // TODO: Inverse is not exact!
        // assert(rewind(euros) == neumarkUlps);
        return euros;
    }

    function curve(uint256 n)
        public
        constant
        returns(uint256)
    {
        uint256 cap   = 1500000000000000000000000000;
        uint256 D     =  230769230769230769230769231;
        uint256 nLim  = 8300000000000000000000000000;

        // Return the cap if n is above the limit.
        if(n >= nLim) {
            return cap;
        }

        // Approximate cap-cap·(1-1/D)^n using the Binomial theorem
        uint256 term = cap;
        uint256 sum = 0;
        uint256 denom = D;
        do assembly {
            // We use assembler primarily to avoid the expensive
            // divide-by-zero check solc inserts for the / operator.
            term  := div(mul(term, n), denom)
            sum   := add(sum, term)
            denom := add(denom, D)
            term  := div(mul(term, n), denom)
            sum   := sub(sum, term)
            denom := add(denom, D)
        } while(term != 0);
        return sum;
    }

    function inverse(uint256 neumarkUlps, uint256 min, uint256 max)
        constant
        returns (uint256)
    {
        require(max >= min);
        require(curve(min) <= neumarkUlps);
        require(curve(max) >= neumarkUlps);

        // Binary search
        while (max > min) {
            uint256 mid = (max + min + 1) / 2;
            uint256 val = curve(mid);
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
        if(curve(max) == neumarkUlps) {
            return max;
        }

        // NOTE: It is possible that there is no inverse
        // for example curve(0) = 0 and curve(1) = 6, so
        // there is no value y such that curve(y) = 5.
        // In this case we return a value such that curve(y) < x
        // and curve(y + 1) > x.
        assert(curve(max) < neumarkUlps);
        assert(curve(max + 1) > neumarkUlps);
        return max;
    }
}
