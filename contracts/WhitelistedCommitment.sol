pragma solidity 0.4.15;

import './PublicCommitment.sol';

contract WhitelistedCommitment is PublicCommitment {
    // mapping of addresses allowed to participate, ticket value is ignored
    mapping (address => uint256) public whitelisted;
    address[] public whitelistedInvestors;
    // mapping of addresses allowed to participate for fixed Neumark cost
    mapping (address => uint256) public fixedCostTickets;
    mapping (address => uint256) public fixedCostNeumarks;
    address[] public fixedCostInvestors;

    // order of investors matter! first will get better terms on neumarks
    function setOrderedWhitelist(address[] addresses, uint256[] ticketsETH)
        public
        onlyOwner
    {
        // can be set only once
        require(fixedCostInvestors.length == 0);
        require(addresses.length == ticketsETH.length);
        // before commitment starts
        require(currentTime() < startDate);
        // move to storage
        for(uint256 idx=0; idx < addresses.length; idx++) {
            uint256 ticket = ticketsETH[idx];
            // tickets of size 0 will not be accepted
            require(ticket > 0);
            // allow to invest up to ticket on fixed cost
            fixedCostTickets[addresses[idx]] = ticket;

            // issue neumarks for given investor
            uint256 euros = convertToEUR(ticket);
            fixedCostNeumarks[addresses[idx]] = curve.issue(euros);

            // also allow to invest from unordered whitelist along the curve
            whitelisted[addresses[idx]] = 1;
        }

        // leave array for easy enumeration
        fixedCostInvestors = addresses;
    }

    function setWhitelist(address[] addresses)
        public
        onlyOwner
    {
        // can be set only once
        require(whitelistedInvestors.length == 0);
        // before commitment starts
        require(currentTime() < startDate);
        // move to storage
        for(uint256 idx=0; idx < addresses.length; idx++) {
            whitelisted[addresses[idx]] = 1;
        }
        // leave array for easy enumeration
        whitelistedInvestors = addresses;
    }

    /// called by finalize() so may be called by ANYONE
    /// intended to be overriden
    function onCommitmentSuccessful()
        internal
    {
        // rollback unspect neumarks from fixed pool
        rollbackCurve();
    }

    /// allows to abort commitment process before it starts and rollback curve
    // @remco this is a small breach of trust as we can invalidate terms any moment
    function abortCommitment()
        public
        onlyOwner
    {
        require(currentTime()<startDate);
        rollbackCurve();
        selfdestruct(owner);
    }

    /// burns all neumarks in commitment contract possesions
    function rollbackCurve()
        internal
    {
        uint neumarks = neumarkToken.balanceOf(address(this));
        if (neumarks > 0) {
            curve.burnNeumark(neumarks);
        }
    }

    /// overrides base class to compute neumark reward for ordered whitelistfix investors
    function giveNeumarks(address investor, uint256 eth, uint256 euros)
        internal
        returns (uint256)
    {
        uint256 fixedTicket = fixedCostTickets[investor]; // returns 0 in case of investor not in mapping
        uint256 fixedNeumarks = fixedCostNeumarks[investor]; // returns 0 in case of investor not in mapping

        // what is above limit for fixed price should be rewarded from curve
        uint256 reward = 0;
        if ( eth > fixedTicket ) {
            if (fixedTicket > 0) // recompute euro if part of msg.value goes thru whitelist
                euros = convertToEUR(eth - fixedTicket);
            reward = curve.issue(euros); // PublicCommitment.giveNeumarks(investor, eth - fixedTicket, euros);
            eth = fixedTicket;
        }

        // get pro rata neumark reward for any eth left
        uint256 fixedreward = 0;
        if (eth > 0) {
            fixedreward = proportion(fixedNeumarks, eth, fixedTicket);
            // rounding errors, send out remainders
            // @remco review
            uint256 remainingBalance = neumarkToken.balanceOf(address(this));
            if (absDiff(fixedreward, remainingBalance) < 1000)
                fixedreward = remainingBalance; // send all
            // decrease ticket size and neumarks left
            fixedCostTickets[investor] -= eth;
            if (fixedreward >= 0) {
                fixedCostNeumarks[investor] -= fixedreward;
            } else {
                fixedCostNeumarks[investor] = 0;
            }
        }
        // distribute to investor and platform operator
        return distributeNeumarks(investor, reward + fixedreward);
    }

    /// overrides base class to check if msg.sender is on any of the lists
    function validPurchase()
        internal
        constant
        returns (bool)
    {
        // @todo i think the latter part of this condition is not needed because we whitelist every fixed cost investor
        return (whitelisted[msg.sender] > 0 || fixedCostTickets[msg.sender] > 0);
    }

    function WhitelistedCommitment(uint256 _startDate, uint256 _endDate, uint256 _minCommitment, uint256 _maxCommitment,
        uint256 _minTicket, uint256 _ethEurFraction, TokenWithDeposit _ethToken, LockedAccount _lockedAccount, Curve _curve)
         PublicCommitment(_startDate, _endDate, _minCommitment, _maxCommitment, _minTicket, _ethEurFraction,
             _ethToken, _lockedAccount, _curve)
    {
    }
}
