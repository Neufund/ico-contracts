pragma solidity 0.4.15;

import './PublicCommitment.sol';
import '../Standards/IERC677Token.sol';


contract WhitelistedCommitment is AccessRoles, CommitmentBase {

    ////////////////////////
    // Types
    ////////////////////////

    // The two tokens accepted in a pre-allocated ticket.
    enum TokenType {
        None,
        EtherToken,
        EuroToken
    }

    // Pre-allocated tickets with a pre-allocated neumark reward.
    struct PreAllocatedTicket {

        // The currency the investor wants to commited.
        TokenType ticketToken;

        // The amount the investor commited. The investor can invest more or
        // less than this amount.
        uint256 ticketSize;

        // The amount of Neumark reward for this commitment (computed by
        // contract). Investor can still invest more, but that would be at
        // spot price.
        uint256 neumarkReward;
    }

    ////////////////////////
    // Constants
    ////////////////////////

    uint256 private MIN_PRE_ALLOCATED_TICKET_SIZE_EURO_ULPS = 1;

    ////////////////////////
    // Immutable state
    ////////////////////////

    LockedAccount private EURO_LOCK;

    IERC677Token private EURO_TOKEN;

    ////////////////////////
    // Mutable State
    ////////////////////////

    bool _preAllocatedTicketsSet;

    bool _whiteListSet;

    // Mapping of investor to pre-allocated tickets.
    mapping (address => PreAllocatedTicket) private _preAllocatedTickets;

    // List of pre-allocated ticket investors.
    // NOTE: The order of of the investors matters when computing the reward.
    address[] private _preAllocatedTicketInvestors;

    // Set of whitelisted investors.
    mapping (address => bool) private _whitelisted;

    // List of whitelisted investors.
    address[] private _whitelistedInvestors;

    ////////////////////////
    // Constructor
    ////////////////////////

    function WhitelistedCommitment(
        IAccessPolicy policy,
        EtherToken ethToken,
        LockedAccount lockedAccount,
        Neumark neumark,
        uint256 startDate,
        uint256 endDate,
        uint256 minAbsCap,
        uint256 maxAbsCap,
        uint256 minTicket,
        uint256 ethEurFraction,
        address platformOperatorWallet
    )
         CommitmentBase(
            policy,
            ethToken,
            lockedAccount,
            neumark,
            startDate,
            endDate,
            minAbsCap,
            maxAbsCap,
            minTicket,
            ethEurFraction,
            platformOperatorWallet
        )
    {
        require(euroLock.assetToken() == EURO_TOKEN);
        EURO_LOCK = euroLock;
        EURO_TOKEN = euroToken;
        _preAllocatedTicketsSet = false;
        _whiteListSet = false;
    }

    ////////////////////////
    // Public functions
    ////////////////////////

    // order of investors matter! first will get better terms on neumarks
    function setPreAllocatedTickets(
        address[] investors,
        TokenType[] ticketTokens,
        uint256[] ticketSizes
    )
        public
        only(ROLE_WHITELIST_ADMIN)
    {
        require(investors.length == ticketTokens.length);
        require(investors.length == ticketSizes.length);

        // Can be called only once before commitment starts
        require(_preAllocatedTicketsSet == false);
        require(currentTime() < startDate());
        _preAllocatedTicketsSet = true;

        // Process tickets
        for (uint256 i = 0; i < investors.length; i++) {

            // Fetch input
            address investor = investors[i];
            TokenType ticketToken = ticketTokens[i];
            uint256 ticketSize = ticketSizes[i];
            bool isEuro = ticketToken == TokenType.EuroToken;
            bool isEther = ticketToken == TokenType.EtherToken;

            // Validate
            require(investor != 0x0);
            require(isEuro || isEther);
            require(ticketSize > 0);

            // Compute euro equivalent amount for ticket
            uint256 euroUlps = isEther ? convertToEUR(ticketSize) : ticketSize;
            require(euroUlps >= MIN_PRE_ALLOCATED_TICKET_SIZE_EURO_ULPS);

            // Allocate Neumarks (will be issued to `this`)
            uint256 neumarkReward = NEUMARK.issueForEuro(euroUlps);

            // Add to pre-allocated tickets
            _preAllocatedTickets[investor] = PreAllocatedTicket({
                ticketToken: ticketToken,
                ticketSize: ticketSize,
                neumarkReward: neumarkReward
            });
            _preAllocatedTicketInvestors.push(investor);

            // Also add pre-allocated investors to whitelist
            _whitelisted[investor] = true;
            _whitelistedInvestors.push(investor);
        }
    }

    function setWhitelist(address[] investors)
        public
        only(ROLE_WHITELIST_ADMIN)
    {
        // Can be called only once before commitment starts
        require(_whiteListSet == false);
        require(currentTime() < startDate());
        _whiteListSet = true;

        // Process tickets
        for (uint256 i = 0; i < investors.length; i++) {

            // Fetch input
            address investor = investors[i];

            // Validate
            require(investor != 0x0);

            // Add to whitelisted investors
            _whitelisted[investor] = true;
            _whitelistedInvestors.push(investor);
        }
    }

    function commitEuro()
        public
    {
        // Must be in ongoing
        require(_startDate > 0);
        require(currentTime() >= _startDate);
        require(!hasEnded());

        // must control locked account
        require(address(EURO_LOCK.controller()) == address(this));

        // Receive EuroTokens (Eur an Nmk in units of least precision)
        address investor = msg.sender;
        uint256 investedEur = EURO_TOKEN.allowance(investor, this);
        uint256 remainingEur = investedEur;
        uint256 nmkCreated = 0;

        // Fetch investors pre-allocated ticket. This will return zeroed out
        // data if the investor had no pre-allocated ticket.
        PreAllocatedTicket storage ticket = _preAllocatedTickets[investor];
        if (ticket.ticketToken == TokenType.EuroToken) {
            // We try to pay as much as possible from the ticket
            uint256 ticketEur = min(remainingEur, ticket.ticketSize);
            uint256 ticketNmk = proportion(
                ticket.neumarkReward,
                ticketEur,
                ticket.ticketSize
            );
            ticket.ticketSize -= ticketEur;
            ticket.neumarkReward -= ticketNmk;
            remainingEur -= ticketEur;
            nmkCreated += ticketNmk;
        }

        // The remainder (if any) receives Neumark reward at spot price.
        nmkCreated += NEUMARK.issueForEuro(remainingEur);

        // Distribute to investor and platform operator
        uint256 investorNmk = distributeAndReturnInvestorNeumarks(
            investor, nmkCreated);

        // Send EURO_TOKENs to EURO_LOCK contract
        EURO_TOKEN.transferFrom(investor, this, investedEur);
        EURO_TOKEN.approve(EURO_LOCK, investedEur);
        EURO_LOCK.lock(investor, investedEur, investorNmk);

        LogFundsInvested(
            msg.sender,
            investedEur,
            EURO_TOKEN,
            investedEur,
            investorNmk,
            NEUMARK
        );
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

    function preAllocatedByInvestor(address investor)
        public
        constant
        returns (
            TokenType ticketToken,
            uint256 ticketSize,
            uint256 neumarkReward
        )
    {
        PreAllocatedTicket memory ticket = _preAllocatedTickets[investor];
        return (ticket.ticketToken, ticket.ticketSize, ticket.neumarkReward);
    }

    function preAllocatedByIndex(uint256 index)
        public
        constant
        returns (
            address investor,
            TokenType ticketToken,
            uint256 ticketSize,
            uint256 neumarkReward
        )
    {
        require(index < _preAllocatedTicketInvestors.length);
        investor = _preAllocatedTicketInvestors[index];
        PreAllocatedTicket memory ticket = _preAllocatedTickets[investor];
        return (
            investor,
            ticket.ticketToken,
            ticket.ticketSize,
            ticket.neumarkReward
        );
    }

    function whitelisted(address investor)
        public
        constant
        returns (bool)
    {
        return _whitelisted[investor];
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

    function giveNeumarks(
        address investor,
        uint256 investmentWei
    )
        internal
        returns (uint256)
    {
        uint256 remainingWei = investmentWei;
        uint256 neumarkUlps = 0;

        // Fetch investors pre-allocated ticket. This will return zeroed out
        // data if the investor had no pre-allocated ticket.
        PreAllocatedTicket storage ticket = _preAllocatedTickets[investor];
        if (ticket.ticketToken == TokenType.EtherToken) {
            // We try to pay as much as possible from the ticket
            uint256 ticketWei = min(remainingWei, ticket.ticketSize);
            uint256 ticketNmk = proportion(
                ticket.neumarkReward,
                ticketWei,
                ticket.ticketSize
            );
            ticket.ticketSize -= ticketWei;
            ticket.neumarkReward -= ticketNmk;
            remainingWei -= ticketWei;
            neumarkUlps += ticketNmk;
        }

        // The remainder (if any) receives Neumark reward at spot price.
        uint256 remainingEuroUlps = convertToEUR(remainingWei);
        neumarkUlps += NEUMARK.issueForEuro(remainingEuroUlps);

        // Distribute to investor and platform operator
        return distributeAndReturnInvestorNeumarks(investor, neumarkUlps);
    }

    function validCommitment()
        internal
        constant
        returns (bool)
    {
        // Pre-allocated investors are also whitelisted
        return (_whitelisted[msg.sender]);
    }
}
