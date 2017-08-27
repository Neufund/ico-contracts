pragma solidity 0.4.15;

import './PublicCommitment.sol';

contract WhitelistedCommitment is AccessControlled, AccessRoles, PublicCommitment {

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

    /// overrides base class to compute neumark reward for ordered whitelistfix investors
    function giveNeumarks(address investor, uint256 eth, uint256 euros)
        internal
        returns (uint256)
    {
        uint256 fixedRemainingTicket = fixedCostTickets[investor]; // returns 0 in case of investor not in mapping
        uint256 fixedRemainingNeumarks = fixedCostNeumarks[investor]; // returns 0 in case of investor not in mapping

        // what is above limit for fixed price should be rewarded from curve
        uint256 reward = 0;
        if ( eth > fixedRemainingTicket ) {
            if (fixedRemainingTicket > 0) // recompute euro if part of msg.value goes thru whitelist
                euros = convertToEUR(eth - fixedRemainingTicket);
            reward = curve.issue(euros);
            eth = fixedRemainingTicket;
        }

        // get pro rata neumark reward for any eth left
        uint256 fixedreward = 0;
        if (eth > 0) {
            fixedreward = proportion(fixedRemainingNeumarks, eth, fixedRemainingTicket);
            // decrease ticket size and neumarks left
            if ((fixedreward > fixedRemainingNeumarks)
                || (fixedRemainingNeumarks - fixedreward < 10))
            {
                // give rest of the neumarks
                fixedreward = fixedRemainingNeumarks;
                // zero whole ticket
                fixedCostNeumarks[investor] = 0;
                fixedCostTickets[investor] = 0;
            } else {
                fixedCostNeumarks[investor] -= fixedreward;
                // this will not overflow, we check fixedCostTickets[investor] > eth earlier
                fixedCostTickets[investor] -= eth;
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

    function WhitelistedCommitment(IAccessPolicy _policy, EtherToken _ethToken,
        LockedAccount _lockedAccount, Curve _curve)
         PublicCommitment(_ethToken, _lockedAccount, _curve)
         AccessControlled(_policy)
    {
    }
}
