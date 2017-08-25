pragma solidity 0.4.15;

import './PublicCommitment.sol';

contract WhitelistedCommitment is AccessControlled, AccessRoles, PublicCommitment {

    // mapping of addresses allowed to participate, ticket value is ignored
    mapping (address => uint256) public whitelisted;
    address[] public whitelistedInvestors;
    // mapping of addresses allowed to participate for fixed Neumark cost
    mapping (address => uint256) public fixedCost;
    address[] public fixedCostInvestors;

    uint256 public totalFixedCostAmount;

    uint256 public totalFixedCostNeumarks;


    function setFixed(address[] addresses, uint256[] ticketsETH)
        public
        only(ROLE_WHITELIST_ADMIN)
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
            fixedCost[addresses[idx]] = ticket;
            // also allow to invest from whitelist along the curve
            whitelisted[addresses[idx]] = 1;
            totalFixedCostAmount = add(totalFixedCostAmount, ticket);
        }
        // issue neumarks for fixed price investors
        uint256 euros = convertToEUR(totalFixedCostAmount);
        // stored in this smart contract balance
        totalFixedCostNeumarks = curve.issue(euros);
        // leave array for easy enumeration
        fixedCostInvestors = addresses;
    }

    function setWhitelist(address[] addresses)
        public
        only(ROLE_WHITELIST_ADMIN)
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
    function onCommitmentSuccesful()
        internal
    {
        // do nothing as public commitment should continue this one
        // mind that overriden function should not be called
    }

    /// allows to abort commitment process before it starts and rollback curve
    // @remco this is a small breach of trust as we can invalidate terms any moment
    function abortCommitment()
        public
        only(ROLE_WHITELIST_ADMIN)
    {
        require(currentTime()<startDate);
        rollbackCurve();
        selfdestruct(address(0));
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
    event Debug(uint256 value);
    /// overrides base class to compute neumark reward for fixed price investors
    function giveNeumarks(address investor, uint256 eth, uint256 euros)
        internal
        returns (uint256)
    {
        uint256 fixedTicket = fixedCost[investor]; // returns 0 in case of investor not in mapping
        Debug(fixedTicket);
        Debug(eth);
        // what is above limit for fixed price should be rewarded from curve
        uint256 reward = 0;
        if ( eth > fixedTicket ) {
            if (fixedTicket > 0) // recompute euro if part of msg.value goes thru whitelist
                euros = convertToEUR(eth - fixedTicket);
            reward = curve.issue(euros); // PublicCommitment.giveNeumarks(investor, eth - fixedTicket, euros);
            eth = fixedTicket;
        }
        Debug(eth);
        // get pro rata neumark reward for any eth left
        uint256 fixedreward = 0;
        if (eth > 0) {
            fixedreward = proportion(totalFixedCostNeumarks, eth, totalFixedCostAmount);
            // rounding errors, send out remainders
            // @remco review
            uint256 remainingBalance = neumarkToken.balanceOf(address(this));
            if (absDiff(fixedreward, remainingBalance) < 1000)
                fixedreward = remainingBalance; // send all
            // decrease ticket size
            fixedCost[investor] -= eth;
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
        return (whitelisted[msg.sender] > 0 || fixedCost[msg.sender] > 0);
    }

    function WhitelistedCommitment(uint256 _startDate, uint256 _endDate, uint256 _minCommitment, uint256 _maxCommitment,
        uint256 _minTicket, uint256 _ethEurFraction, TokenWithDeposit _ethToken, LockedAccount _lockedAccount,
        Curve _curve, IAccessPolicy _policy)
         PublicCommitment(_startDate, _endDate, _minCommitment, _maxCommitment, _minTicket, _ethEurFraction,
             _ethToken, _lockedAccount, _curve)
        AccessControlled(_policy)
    {
    }
}
