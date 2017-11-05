pragma solidity 0.4.15;


contract NeumarkIssuanceCurve {

    ////////////////////////
    // Constants
    ////////////////////////

    // maximum number of neumarks that may be created
    uint256 private constant NEUMARK_CAP = 1500000000000000000000000000;

    // initial neumark reward fraction (controls curve steepness)
    uint256 private constant INITIAL_REWARD_FRACTION = 6500000000000000000;

    // stop issuing new Neumarks above this Euro value (as it goes quickly to zero)
    uint256 private constant ISSUANCE_LIMIT_EUR_ULPS = 8300000000000000000000000000;

    // approximate curve linearly above this Euro value
    uint256 private constant LINEAR_APPROX_LIMIT_EUR_ULPS = 2100000000000000000000000000;
    uint256 private constant NEUMARKS_AT_LINEAR_LIMIT_ULPS = 1499832501287264827896539871;

    uint256 private constant TOT_LINEAR_NEUMARKS_ULPS = NEUMARK_CAP - NEUMARKS_AT_LINEAR_LIMIT_ULPS;
    uint256 private constant TOT_LINEAR_EUR_ULPS = ISSUANCE_LIMIT_EUR_ULPS - LINEAR_APPROX_LIMIT_EUR_ULPS;

    ////////////////////////
    // Public functions
    ////////////////////////

    /// @notice returns additional amount of neumarks issued for euroUlps at totalEuroUlps
    /// @param totalEuroUlps actual curve position from which neumarks will be issued
    /// @param euroUlps amount against which neumarks will be issued
    function incremental(uint256 totalEuroUlps, uint256 euroUlps)
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

    /// @notice returns amount of euro corresponding to burned neumarks
    /// @param totalEuroUlps actual curve position from which neumarks will be burned
    /// @param burnNeumarkUlps amount of neumarks to burn
    function incrementalInverse(uint256 totalEuroUlps, uint256 burnNeumarkUlps)
        public
        constant
        returns (uint256 euroUlps)
    {
        uint256 totalNeumarkUlps = cumulative(totalEuroUlps);
        require(totalNeumarkUlps >= burnNeumarkUlps);
        uint256 fromNmk = totalNeumarkUlps - burnNeumarkUlps;
        uint newTotalEuroUlps = cumulativeInverse(fromNmk, 0, totalEuroUlps);

        // yes, this may overflow due to non monotonic inverse function
        return totalEuroUlps - newTotalEuroUlps;
    }

    /// @notice returns amount of euro corresponding to burned neumarks
    /// @param totalEuroUlps actual curve position from which neumarks will be burned
    /// @param burnNeumarkUlps amount of neumarks to burn
    /// @param minEurUlps euro amount to start inverse search from, inclusive
    /// @param maxEurUlps euro amount to end inverse search to, inclusive
    function incrementalInverse(uint256 totalEuroUlps, uint256 burnNeumarkUlps, uint256 minEurUlps, uint256 maxEurUlps)
        public
        constant
        returns (uint256 euroUlps)
    {
        uint256 totalNeumarkUlps = cumulative(totalEuroUlps);
        require(totalNeumarkUlps >= burnNeumarkUlps);
        uint256 fromNmk = totalNeumarkUlps - burnNeumarkUlps;
        uint newTotalEuroUlps = cumulativeInverse(fromNmk, minEurUlps, maxEurUlps);

        // yes, this may overflow due to non monotonic inverse function
        return totalEuroUlps - newTotalEuroUlps;
    }

    /// @notice finds total amount of neumarks issued for given amount of Euro
    /// @dev binomial expansion does not guarantee monotonicity on uint256 precision for large euroUlps
    ///     function below is not monotonic
    function cumulative(uint256 euroUlps)
        public
        constant
        returns(uint256 neumarkUlps)
    {
        // Return the cap if euroUlps is above the limit.
        if (euroUlps >= ISSUANCE_LIMIT_EUR_ULPS) {
            return NEUMARK_CAP;
        }
        // use linear approximation above limit below
        // binomial expansion does not guarantee monotonicity on uint256 precision for large euroUlps
        if (euroUlps >= LINEAR_APPROX_LIMIT_EUR_ULPS) {
            // (euroUlps - LINEAR_APPROX_LIMIT_EUR_ULPS) is small so expression does not overflow
            return NEUMARKS_AT_LINEAR_LIMIT_ULPS + (TOT_LINEAR_NEUMARKS_ULPS * (euroUlps - LINEAR_APPROX_LIMIT_EUR_ULPS)) / TOT_LINEAR_EUR_ULPS;
        }

        // Approximate cap-cap·(1-1/D)^n using the Binomial expansion
        // http://galileo.phys.virginia.edu/classes/152.mf1i.spring02/Exponential_Function.htm
        // Function[imax, -CAP*Sum[(-IR*EUR/CAP)^i/Factorial[i], {i, imax}]]
        // which may be simplified to
        // Function[imax, -CAP*Sum[(EUR)^i/(Factorial[i]*(-d)^i), {i, 1, imax}]]
        // where d = cap/initial_reward
        uint256 d = 230769230769230769230769231; // NEUMARK_CAP / INITIAL_REWARD_FRACTION
        uint256 term = NEUMARK_CAP;
        uint256 sum = 0;
        uint256 denom = d;
        do assembly {
            // We use assembler primarily to avoid the expensive
            // divide-by-zero check solc inserts for the / operator.
            term  := div(mul(term, euroUlps), denom)
            sum   := add(sum, term)
            denom := add(denom, d)
            // sub next term as we have power of negative value in the binomial expansion
            term  := div(mul(term, euroUlps), denom)
            sum   := sub(sum, term)
            denom := add(denom, d)
        } while (term != 0);
        return sum;
    }

    /// @dev The result is rounded up.
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
            if (val == neumarkUlps) {
                return mid;
            }
            if (val < neumarkUlps) {
                min = mid;
            } else {
                max = mid - 1;
            }
        }
        assert(max == min);

        // Did we find an exact solution?
        if (cumulative(max) == neumarkUlps) {
            return max;
        }

        // NOTE: It is possible that there is no inverse
        // for example curve(0) = 0 and curve(1) = 6, so
        // there is no value y such that curve(y) = 5.
        // In this case we return a value such that curve(y) < x
        // and curve(y + 1) > x.
        assert(cumulative(max) < neumarkUlps);
        assert(cumulative(max + 1) > neumarkUlps);

        // When there is no inverse, we round up.
        // This has the effect of reversing the curve less when
        // burning Neumarks. This ensures that Neumarks can always
        // be burned. It also ensure that the total supply of Neumarks
        // remains below the cap.
        return max + 1;
    }

    function neumarkCap()
        public
        constant
        returns (uint256)
    {
        return NEUMARK_CAP;
    }

    function initialRewardFraction()
        public
        constant
        returns (uint256)
    {
        return INITIAL_REWARD_FRACTION;
    }
}
