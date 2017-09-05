pragma solidity 0.4.15;

import './PublicCommitment.sol';


contract WhitelistedCommitment is AccessRoles, CommitmentBase {

    ////////////////////////
    // Mutable State
    ////////////////////////

    // mapping of addresses allowed to participate
    mapping (address => bool) private _whitelisted;

    address[] private _whitelistedInvestors;

    // mapping of addresses allowed to participate for fixed Neumark cost
    mapping (address => uint256) private _fixedCostTickets;

    mapping (address => uint256) private _fixedCostNeumarks;

    address[] private _fixedCostInvestors;

    ////////////////////////
    // Constructor
    ////////////////////////

    function WhitelistedCommitment(
        IAccessPolicy _policy,
        EtherToken _ethToken,
        LockedAccount _lockedAccount,
        Neumark _neumark
    )
         CommitmentBase(_policy, _ethToken, _lockedAccount, _neumark)
    {
    }

    ////////////////////////
    // Public functions
    ////////////////////////

    // order of investors matter! first will get better terms on neumarks
    function setOrderedWhitelist(address[] addresses, uint256[] tickets)
        public
        only(ROLE_WHITELIST_ADMIN)
    {
        // can be set only once
        require(_fixedCostInvestors.length == 0);
        require(addresses.length == tickets.length);

        // before commitment starts
        require(currentTime() < startDate());

        // move to storage
        for (uint256 idx = 0; idx < addresses.length; idx++) {
            uint256 ticket = tickets[idx];

            // tickets of size 0 will not be accepted
            require(ticket > 0);

            // allow to invest up to ticket on fixed cost
            _fixedCostTickets[addresses[idx]] = ticket;

            // issue neumarks for given investor
            uint256 ticketEuroUlps = convertToEUR(ticket);
            _fixedCostNeumarks[addresses[idx]] = NEUMARK.issueForEuro(ticketEuroUlps);

            // also allow to invest from unordered whitelist along the curve
            _whitelisted[addresses[idx]] = true;
        }

        // leave array for easy enumeration
        _fixedCostInvestors = addresses;
    }

    function setWhitelist(address[] addresses)
        public
        only(ROLE_WHITELIST_ADMIN)
    {
        // can be set only once
        require(_whitelistedInvestors.length == 0);

        // before commitment starts
        require(currentTime() < startDate());

        // move to storage
        for (uint256 idx = 0; idx < addresses.length; idx++) {
            _whitelisted[addresses[idx]] = true;
        }

        // leave array for easy enumeration
        _whitelistedInvestors = addresses;
    }

    /// allows to abort commitment process before it starts and rollback curve
    // @remco this is a small breach of trust as we can invalidate terms any moment
    function abortCommitment()
        public
        only(ROLE_WHITELIST_ADMIN)
    {
        require(currentTime() < startDate());
        rollbackCurve();
        selfdestruct(address(msg.sender));
    }

    function whitelisted(address investor)
        public
        constant
        returns (bool)
    {
        return _whitelisted[investor];
    }

    function fixedCostInvestors(uint256 index)
        public
        constant
        returns (address)
    {
        require(index < _fixedCostInvestors.length);
        return _fixedCostInvestors[index];
    }

    function fixedCostTickets(address investor)
        public
        constant
        returns (uint256)
    {
        return _fixedCostTickets[investor];
    }

    function fixedCostNeumarks(address investor)
        public
        constant
        returns (uint256)
    {
        return _fixedCostNeumarks[investor];
    }

    function whitelistedInvestors(uint256 index)
        public
        constant
        returns (address)
    {
        require(index < _whitelistedInvestors.length);
        return _whitelistedInvestors[index];
    }

    //
    // Override Reclaimable
    //

    function reclaim(IBasicToken token)
        public
        only(ROLE_RECLAIMER)
    {
        // This contract holds Neumark during the commitment phase
        if (!isFinalized()) {
            require(token != NEUMARK);
        }
        Reclaimable.reclaim(token);
    }

    ////////////////////////
    // Internal functions
    ////////////////////////

    function rollbackCurve()
        internal
    {
        uint256 neumarks = NEUMARK.balanceOf(address(this));
        if (neumarks > 0) {
            NEUMARK.burnNeumark(neumarks);
        }
    }

    //
    // Implement MCommitment
    //

    function onCommitmentSuccessful()
        internal
    {
        // rollback unspect neumarks from fixed pool
        rollbackCurve();
    }

    function onCommitmentFailed()
        internal
    {
        // unlock all accounts in lockedAccount
        LOCKED_ACCOUNT.controllerFailed();
    }

    function giveNeumarks(address investor, uint256 amount)
        internal
        returns (uint256)
    {
        // returns 0 in case of investor has no fixed cost ticket
        uint256 fixedInvestorTicket = _fixedCostTickets[investor];

        // what is above limit for fixed price should be rewarded from curve
        uint256 whitelistReward = 0;
        uint256 remainingAmount = amount;
        if (amount > fixedInvestorTicket) {
            uint256 whitelistedAmount = amount - fixedInvestorTicket;
            uint256 whitelistedEuroUlps = convertToEUR(whitelistedAmount);
            whitelistReward = NEUMARK.issueForEuro(whitelistedEuroUlps);
            remainingAmount = fixedInvestorTicket;
        }

        // get pro rata neumark reward for any eth left
        uint256 fixedReward = 0;
        if (remainingAmount > 0) {
            uint256 fixedInvestorNeumarks = _fixedCostNeumarks[investor];
            fixedReward = proportion(fixedInvestorNeumarks, remainingAmount, fixedInvestorTicket);

            // if investor gets neumark with `k` tranches of different wei sizes a1...ak and `ticket` is total declared ticket
            // then last proportion must be: ak / (ticket - sum(a1...ak-1)) == 1
            // which gives fixedReward == fixedInvestorNeumarks, therefore we may safely do the following:
            _fixedCostNeumarks[investor] -= fixedReward;
            _fixedCostTickets[investor] -= remainingAmount;
        }

        // distribute to investor and platform operator
        return distributeAndReturnInvestorNeumarks(investor, whitelistReward + fixedReward);
    }

    function validCommitment()
        internal
        constant
        returns (bool)
    {
        // latter part of this condition is not needed because we whitelist every fixed cost investor
        // kept to make condition clear
        return (_whitelisted[msg.sender] || _fixedCostTickets[msg.sender] > 0);
    }
}
