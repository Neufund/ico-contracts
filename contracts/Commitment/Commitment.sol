pragma solidity 0.4.15;

import '../EtherToken.sol';
import '../EuroToken.sol';
import '../LockedAccount.sol';
import '../Math.sol';
import '../Neumark.sol';
import './TimedStateMachine.sol';
import "../AccessControl/AccessControlled.sol";
import "../Reclaimable.sol";


// Consumes MCommitment
contract Commitment is
    AccessControlled,
    TimedStateMachine,
    Reclaimable,
    Math
{
    ////////////////////////
    // Types
    ////////////////////////

    // The two tokens accepted in a pre-allocated ticket.
    enum Token {
        None,
        Ether,
        Euro
    }

    // Pre-allocated tickets with a pre-allocated neumark reward.
    struct WhitelistTicket {

        // The currency the investor wants to commited.
        Token token;

        // The amount the investor commited. The investor can invest more or
        // less than this amount. In units of least precision of the token.
        uint256 amount;

        // The comitted amount converted to Eur
        uint256 amountEur;

        // The amount of Neumark reward for this commitment (computed by
        // contract). Investor can still invest more, but that would be at
        // spot price.
        uint256 rewardNmk;
    }

    ////////////////////////
    // Constants
    ////////////////////////

    // share of Neumark reward platform operator gets
    uint256 private constant PLATFORM_SHARE = 2;

    ////////////////////////
    // Immutable state
    ////////////////////////

    // wallet that keeps Platform Operator share of neumarks
    address private PLATFORM_WALLET;

    Neumark private NEUMARK;

    EtherToken private ETHER_TOKEN;

    EuroToken private EURO_TOKEN;

    LockedAccount private ETHER_LOCK;

    LockedAccount private EURO_LOCK;

    uint256 private CAP_EUR;

    uint256 private MIN_TICKET_EUR;

    uint256 private ETH_EUR_FRACTION;

    ////////////////////////
    // Mutable state
    ////////////////////////

    // Mapping of investor to pre-allocated tickets.
    mapping (address => WhitelistTicket) private _whitelist;

    // List of pre-allocated ticket investors.
    // NOTE: The order of of the investors matters when computing the reward.
    address[] private _whitelistInvestors;

    uint256 private _whitelistEtherNmk;

    uint256 private _whitelistEuroNmk;

    ////////////////////////
    // Events
    ////////////////////////

    /// on every investment transaction
    /// `investor` invested `amount` in `paymentToken` currency which was
    /// converted to `eurEquivalent` that purchases `purchasedAmount` of
    /// `ofToken`.
    event LogFundsInvested(
        address indexed investor,
        uint256 amount,
        address paymentToken,
        uint256 eurEquivalent,
        uint256 purchasedAmount,
        address ofToken
    );

    ////////////////////////
    // Constructor
    ////////////////////////

    /// declare capital commitment into Neufund ecosystem
    /// store funds in _ethToken and lock funds in _lockedAccount while issuing
    /// Neumarks along _curve commitments can be chained via long lived
    /// _lockedAccount and _nemark
    function Commitment(
        IAccessPolicy accessPolicy,
        int256 startDate,
        address platformWallet,
        Neumark neumark,
        EtherToken etherToken,
        EuroToken euroToken,
        LockedAccount etherLock,
        LockedAccount euroLock,
        uint256 capEur,
        uint256 minTicketEur,
        uint256 ethEurFraction
    )
        AccessControlled(accessPolicy)
        TimedStateMachine(startDate)
    {
        require(platformWallet != 0x0);
        require(address(neumark) != 0x0);
        require(address(etherToken) != 0x0);
        require(address(euroToken) != 0x0);
        require(address(etherLock) != 0x0);
        require(etherLock.assetToken() == etherToken);
        require(address(euroLock) != 0x0);
        require(euroLock.assetToken() == euroToken);
        require(capEur >= 10**24); // 1 M€
        require(capEur <= 10**27); // 1 G€
        require(minTicketEur >= 10**20); // 100 €
        require(minTicketEur <= 10**23); // 100 k€
        require(ethEurFraction >= 10**20); // 100 € / ETH
        require(ethEurFraction <= 10**22); // 10 k€ / ETH
        PLATFORM_WALLET = platformWallet;
        NEUMARK = neumark;
        ETHER_TOKEN = etherToken;
        EURO_TOKEN = euroToken;
        ETHER_LOCK = etherLock;
        EURO_LOCK = euroLock;
        CAP_EUR = capEur;
        MIN_TICKET_EUR = minTicketEur;
        ETH_EUR_FRACTION = ethEurFraction;
        _whitelistEtherNmk = 0;
        _whitelistEuroNmk = 0;
    }

    ////////////////////////
    // External functions
    ////////////////////////

    function addWhitelisted(
        address[] investors,
        Token[] tokens,
        uint256[] amounts
    )
        external
        withTimedTransitions()
        onlyState(State.Before)
        only(ROLE_WHITELIST_ADMIN)
    {
        require(investors.length == tokens.length);
        require(investors.length == amounts.length);

        // Process tickets
        for (uint256 i = 0; i < investors.length; i++) {

            // Loop body is factored out to keep stack low
            addWhitelistInvestorPrivate(investors[i], tokens[i], amounts[i]);
        }

        // We don't go over the cap
        require(NEUMARK.totalEuroUlps() <= CAP_EUR);
    }

    function abort()
        external
        withTimedTransitions()
        onlyState(State.Before)
        only(ROLE_WHITELIST_ADMIN)
    {
        // Return all Neumarks that may have been reserved.
        NEUMARK.burnNeumark(NEUMARK.balanceOf(this));

        // At this point we can kill the contract, it can not have aquired any
        // other value.
        selfdestruct(msg.sender);
    }

    function commit()
        external
        payable
        withTimedTransitions()
        onlyStates3(State.Whitelist, State.Public, State.Rollback)
    {
        // Take with EtherToken allowance (if any)
        uint256 commitedWei = ETHER_TOKEN.allowance(msg.sender, this);
        ETHER_TOKEN.transferFrom(msg.sender, this, commitedWei);

        // Turn msg.value into EtherToken (if any)
        commitedWei += msg.value;
        ETHER_TOKEN.deposit.value(msg.value)();

        // Move to private function to keep stack low
        commitEtherPrivate(commitedWei);
    }

    function commitEuro()
        external
        withTimedTransitions()
        onlyStates(State.Whitelist, State.Public)
    {
        // Receive Euro tokens
        uint256 euroUlp = EURO_TOKEN.allowance(msg.sender, this);
        EURO_TOKEN.transferFrom(msg.sender, this, euroUlp);

        // Compute commited funds
        require(euroUlp > MIN_TICKET_EUR);
        uint256 remainingEur = euroUlp;
        uint256 totalNmk = 0;

        // Whitelist part
        WhitelistTicket storage ticket = _whitelist[msg.sender];
        bool whitelisted = ticket.token == Token.Euro;
        if (whitelisted) {
            uint256 ticketEur = min(remainingEur, ticket.amount);
            uint256 ticketNmk = proportion(
                ticket.rewardNmk,
                ticketEur,
                ticket.amount);
            ticket.amount -= ticketEur;
            ticket.amountEur -= ticketEur;
            ticket.rewardNmk -= ticketNmk;
            _whitelistEuroNmk -= ticketNmk;
            remainingEur -= ticketEur;
            totalNmk += ticketNmk;
        }

        // Curve
        totalNmk += NEUMARK.issueForEuro(remainingEur);

        // We don't go over the cap
        require(NEUMARK.totalEuroUlps() <= CAP_EUR);

        // Split the Neumarks
        uint256 platformNmk = divRound(totalNmk, PLATFORM_SHARE);
        assert(platformNmk <= totalNmk);
        uint256 investorNmk = totalNmk - platformNmk;

        // Issue Neumarks and distribute
        NEUMARK.transfer(msg.sender, investorNmk);
        NEUMARK.transfer(PLATFORM_WALLET, platformNmk);

        // Lock EuroToken
        EURO_TOKEN.approve(EURO_LOCK, euroUlp);
        EURO_LOCK.lock(msg.sender, euroUlp, investorNmk);

        // Log successful commitment
        LogFundsInvested(
            msg.sender,
            euroUlp,
            EURO_TOKEN,
            euroUlp,
            investorNmk,
            NEUMARK
        );
    }

    function neumarkReward(uint256 amountEth)
        external
        constant
        returns (uint256)
    {
        uint256 amountEur = convertToEur(amountEth);
        uint256 rewardNmk = NEUMARK.incremental(amountEur);
        uint256 investorNmk = divRound(rewardNmk, PLATFORM_SHARE);
        return investorNmk;
    }

    ////////////////////////
    // Public functions
    ////////////////////////

    /// converts `amount` in wei into EUR with 18 decimals required by Curve
    /// Neufund public commitment uses fixed EUR rate during commitment to level playing field and
    /// prevent strategic behavior around ETH/EUR volatility. equity PTOs will use oracles as they need spot prices
    function convertToEur(uint256 amount)
        public
        constant
        returns (uint256)
    {
        return fraction(amount, ETH_EUR_FRACTION);
    }

    ////////////////////////
    // Internal functions
    ////////////////////////

    //
    // MStateMachine
    //

    function mAfterTransition(State /* oldState */, State newState)
        internal
    {
        if (newState == State.Pause) {

            // Rollback unfufilled Ether reservations.
            NEUMARK.burnNeumark(_whitelistEtherNmk);
        }
        if (newState == State.Rollback) {

            // Rollback unfufilled Euro reservations.
            NEUMARK.burnNeumark(_whitelistEuroNmk);
        }
        if (newState == State.Finished) {

            // Enable Neumark trading in token controller
            NEUMARK.enableTransfer(true);

            // enable escape hatch and end locking funds phase
            ETHER_LOCK.controllerSucceeded();
            EURO_LOCK.controllerSucceeded();
        }
    }

    ////////////////////////
    // Private functions
    ////////////////////////

    function addWhitelistInvestorPrivate(
        address investor,
        Token token,
        uint256 amount
    )
        private
    {
        // Validate
        require(investor != 0x0);
        require(_whitelist[investor].token == Token.None);
        bool isEuro = token == Token.Euro;
        bool isEther = token == Token.Ether;
        require(isEuro || isEther);
        // Note: amount can be zero, indicating no pre-allocated NMK,
        //       but still the ability to commit before the public.
        uint256 amountEur = isEuro ? amount : convertToEur(amount);
        require(amount == 0 || amountEur >= MIN_TICKET_EUR);

        // Allocate Neumarks (will be issued to `this`)
        uint256 rewardNmk = NEUMARK.issueForEuro(amountEur);

        // Add to pre-allocated tickets
        _whitelist[investor] = WhitelistTicket({
            token: token,
            amount: amount,
            amountEur: amountEur,
            rewardNmk: rewardNmk
        });
        _whitelistInvestors.push(investor);

        // Add to totals
        if (isEther) {
            _whitelistEtherNmk += rewardNmk;
        } else {
            _whitelistEuroNmk += rewardNmk;
        }
    }

    function commitEtherPrivate(uint256 commitedWei)
        private
    {
        require(convertToEur(commitedWei) > MIN_TICKET_EUR);
        uint256 remaining = commitedWei;
        uint256 totalNmk = 0;

        // Whitelist part
        WhitelistTicket storage ticket = _whitelist[msg.sender];
        bool whitelisted = ticket.token == Token.Ether;
        if (whitelisted && state() == State.Whitelist) {
            uint256 ticketEth = min(remaining, ticket.amount);
            uint256 ticketNmk = proportion(
                ticket.rewardNmk,
                ticketEth,
                ticket.amount);
            uint256 ticketEur = proportion(
                ticket.amountEur,
                ticketEth,
                ticket.amount);
            ticket.amount -= ticketEth;
            ticket.amountEur -= ticketEur;
            ticket.rewardNmk -= ticketNmk;
            _whitelistEtherNmk -= ticketNmk;
            remaining -= ticketEth;
            totalNmk += ticketNmk;
        }

        // Curve part
        if (whitelisted || state() != State.Whitelist) {
            uint256 remainingEur = convertToEur(remaining);
            remaining = 0;
            totalNmk += NEUMARK.issueForEuro(remainingEur);
        }

        // We don't do partial tickets
        require(remaining == 0);

        // We don't go over the cap
        require(NEUMARK.totalEuroUlps() <= CAP_EUR);

        // Split the Neumarks
        uint256 platformNmk = divRound(totalNmk, PLATFORM_SHARE);
        assert(platformNmk <= totalNmk);
        uint256 investorNmk = totalNmk - platformNmk;

        // Issue Neumarks and distribute
        NEUMARK.transfer(msg.sender, investorNmk);
        NEUMARK.transfer(PLATFORM_WALLET, platformNmk);

        // Lock EtherToken
        ETHER_TOKEN.approve(ETHER_LOCK, commitedWei);
        ETHER_LOCK.lock(msg.sender, commitedWei, investorNmk);

        // Log successful commitment
        LogFundsInvested(
            msg.sender,
            commitedWei,
            ETHER_TOKEN,
            convertToEur(commitedWei),
            investorNmk,
            NEUMARK
        );
    }
}
