pragma solidity 0.4.15;

import '../EtherToken.sol';
import '../EuroToken.sol';
import '../LockedAccount.sol';
import '../Math.sol';
import '../Neumark.sol';
import './TimedStateMachine.sol';
import "../AccessControl/AccessControlled.sol";
import "../Agreement.sol";
import "../Reclaimable.sol";


/// @title processes capital commitments into Neufund ecosystem
contract Commitment is
    AccessControlled,
    Agreement,
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

        // The currency the investor wants and is allowed to committed.
        Token token;

        // The amount the investor committed. The investor can invest more or
        // less than this amount. In units of least precision of the token.
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
    // actually this is a divisor that splits Neumark reward in two parts
    // the results of division belongs to platform operator, the remaining reward part belongs to investor
    uint256 private constant PLATFORM_SHARE = 2; // 50:50 division

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

    // maximum amount of EuroToken that can be committed to generate Neumark reward
    // indirectly this is cap for Neumark amount generated as it is checked against NEUMARK.totalEuroUlps()
    uint256 private CAP_EUR;

    // minimum amount of EuroToken that may be committed
    uint256 private MIN_TICKET_EUR;

    // fixed ETH/EUR price during the commitment, used to convert ETH into EUR, see convertToEur
    uint256 private ETH_EUR_FRACTION;

    ////////////////////////
    // Mutable state
    ////////////////////////

    // Mapping of investor to pre-allocated tickets.
    mapping (address => WhitelistTicket) private _whitelist;

    // List of pre-allocated ticket investors.
    // NOTE: The order of of the investors matters when computing the reward.
    address[] private _whitelistInvestors;

    // amount of Neumarks reserved for Ether whitelist investors
    uint256 private _whitelistEtherNmk = 0;

    // amount of Neumarks reserved for Euro whitelist investors
    uint256 private _whitelistEuroNmk = 0;

    ////////////////////////
    // Events
    ////////////////////////

    /// on every commitment transaction
    /// `investor` committed `amount` in `paymentToken` currency which was
    /// converted to `eurEquivalent` that generates `grantedAmount` of
    /// `ofToken`.
    event LogFundsCommitted(
        address indexed investor,
        address indexed paymentToken,
        uint256 amount,
        uint256 eurEquivalent,
        uint256 grantedAmount,
        address ofToken
    );

    ////////////////////////
    // Constructor
    ////////////////////////

    /// @param accessPolicy access policy instance controlling access to admin public functions
    /// @param forkArbiter indicates supported fork
    /// @param startDate timestamp of Whitelist state beginning, see TimedStateMachine constructor
    /// @param platformWallet address of wallet storing platform operator's Neumarks
    /// @param neumark Neumark token contract
    /// @param etherToken ether-encapsulating token contract
    /// @param euroToken euro pegged stable coin
    /// @param etherLock manages locking mechanism for ether investors
    /// @param euroLock manages locking mechanism for euro token investors
    /// @param capEurUlps maxium amount of euro tokens committed
    /// @param minTicketEurUlps minimum ticket size
    /// @param ethEurFraction Ether to Euro rate, fixed during commitment
    function Commitment(
        IAccessPolicy accessPolicy,
        IEthereumForkArbiter forkArbiter,
        int256 startDate,
        address platformWallet,
        Neumark neumark,
        EtherToken etherToken,
        EuroToken euroToken,
        LockedAccount etherLock,
        LockedAccount euroLock,
        uint256 capEurUlps,
        uint256 minTicketEurUlps,
        uint256 ethEurFraction
    )
        AccessControlled(accessPolicy)
        Agreement(accessPolicy, forkArbiter)
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
        // Euro is represented internally with 18 decimals
        require(capEurUlps >= 10**18*10**6); // 1 M€
        require(capEurUlps <= 10**18*10**9); // 1 G€
        require(minTicketEurUlps >= 10**18*10**2); // 100 €
        require(minTicketEurUlps <= 10**18*10**5); // 100 k€
        require(ethEurFraction >= 10**18*10**2); // 100 € / ETH
        require(ethEurFraction <= 10**18*10**4); // 10 k€ / ETH
        PLATFORM_WALLET = platformWallet;
        NEUMARK = neumark;
        ETHER_TOKEN = etherToken;
        EURO_TOKEN = euroToken;
        ETHER_LOCK = etherLock;
        EURO_LOCK = euroLock;
        CAP_EUR = capEurUlps;
        MIN_TICKET_EUR = minTicketEurUlps;
        ETH_EUR_FRACTION = ethEurFraction;
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

        for (uint256 i = 0; i < investors.length; ++i) {
            addWhitelistInvestorPrivate(investors[i], tokens[i], amounts[i]);
        }

        // We don't go over the cap
        require(NEUMARK.totalEuroUlps() <= CAP_EUR);
    }

    /// @notice used by WHITELIST_ADMIN to kill commitment process before it starts
    ///     @dev by selfdestruct we make all LockContracts controlled by this contract dysfunctional
    function abort()
        external
        withTimedTransitions()
        onlyState(State.Before)
        only(ROLE_WHITELIST_ADMIN)
    {
        // Return all Neumarks that may have been reserved.
        // AUDIT[CHF-45] Naming inconsistency: issueForEuro vs burnNeumark.
        //   Either use issueNeumarksForEuro() or burn(). I prefer burn().
        NEUMARK.burnNeumark(NEUMARK.balanceOf(this));

        // At this point we can kill the contract, it can not have aquired any
        // other value.
        selfdestruct(msg.sender);
    }

    function commit()
        external
        payable
        withTimedTransitions()
        onlyStates(State.Whitelist, State.Public)
        acceptAgreement(msg.sender) // agreement accepted by act of reserving funds in this function
    {
        // Take with EtherToken allowance (if any)
        uint256 allowedWei = ETHER_TOKEN.allowance(msg.sender, this);
        uint256 committedWei = add(allowedWei, msg.value);
        uint256 committedEurUlp = convertToEur(committedWei);
        // check against minimum ticket before proceeding
        require(committedEurUlp >= MIN_TICKET_EUR);

        if (allowedWei > 0) {
            assert(ETHER_TOKEN.transferFrom(msg.sender, this, allowedWei));
        }
        if (msg.value > 0) {
            ETHER_TOKEN.deposit.value(msg.value)();
        }

        // calculate Neumark reward and update Whitelist ticket
        var (investorNmk, ticketNmk) = commitToken(committedEurUlp, Token.Ether);
        // AUDIT[CHF-58] Move NMK counters updates to Commitment.commitToken().
        //   The Commitment.commitToken() has all the logic related to whitelist
        //   checking. Move the _whitelistEtherNmk subtraction from here and
        //   _whitelistEuroNmk subtraction from commitEuro() there to
        //   commitToken() too. This will also simplify the return type of
        //   commitToken().
        _whitelistEtherNmk = sub(_whitelistEtherNmk, ticketNmk);

        // Lock EtherToken
        ETHER_TOKEN.approve(ETHER_LOCK, committedWei);
        ETHER_LOCK.lock(msg.sender, committedWei, investorNmk);

        // Log successful commitment
        LogFundsCommitted(
            msg.sender,
            ETHER_TOKEN,
            committedWei,
            committedEurUlp,
            investorNmk,
            NEUMARK
        );
    }

    function commitEuro()
        external
        withTimedTransitions()
        onlyStates(State.Whitelist, State.Public)
        acceptAgreement(msg.sender) // agreement accepted by act of reserving funds in this function
    {
        // receive Euro tokens
        uint256 committedEurUlp = EURO_TOKEN.allowance(msg.sender, this);
        // check against minimum ticket before proceeding
        require(committedEurUlp >= MIN_TICKET_EUR);

        assert(EURO_TOKEN.transferFrom(msg.sender, this, committedEurUlp));

        // calculate Neumark reward and update Whitelist ticket
        var (investorNmk, ticketNmk) = commitToken(committedEurUlp, Token.Euro);
        _whitelistEuroNmk = sub(_whitelistEuroNmk, ticketNmk);

        // Lock EuroToken
        EURO_TOKEN.approve(EURO_LOCK, committedEurUlp);
        EURO_LOCK.lock(msg.sender, committedEurUlp, investorNmk);

        // Log successful commitment
        LogFundsCommitted(
            msg.sender,
            EURO_TOKEN,
            committedEurUlp,
            committedEurUlp,
            investorNmk,
            NEUMARK
        );
    }

    function estimateNeumarkReward(uint256 amountEth)
        external
        constant
        returns (uint256)
    {
        uint256 amountEur = convertToEur(amountEth);
        uint256 rewardNmk = NEUMARK.incremental(amountEur);
        // AUDIT[CHF-47] Investor's share calculation inconsistency.
        //   Here the investor's share is calculated first,
        //   in whitelistTicket() and commitToken() the platform's share is
        //   calculated first and investor's share is the remaining.
        //   Example:
        //     rewardNmk = 101
        //   In estimateNeumarkReward():
        //     investorNmk = divRound(101, 2) = 51
        //   In whitelistTicket(), commitToken():
        //     platformNmk = divRound(101, 2) = 51
        //     investorNmk = 101 - 51 = 50
        uint256 investorNmk = divRound(rewardNmk, PLATFORM_SHARE);
        return investorNmk;
    }

    ////////////////////////
    // Public functions
    ////////////////////////

    /// converts `amount` in wei into EUR with 18 decimals required by Curve
    /// Neufund public commitment uses fixed EUR rate during commitment to level playing field and
    /// prevent strategic behavior around ETH/EUR volatility. equity TOs will use oracles as they need spot prices
    ///
    /// Note: Considering the max possible ETH_EUR_FRACTION value, the max
    ///       amount of ETH (not wei) that is safe to be passed as the argument
    ///       is ~10**37 (~2**123).
    // AUDIT[CHF-43] Consistent amount unit names.
    //   Use suffix `Upls` whenever function/variable represents Euro units of
    //   last precision (probably everywhere).
    //   Also, consider consistent naming instead of mixture of
    //   amount, amountEur, euro, euroUlps, amountEth, amountEthWeis, etc.
    function convertToEur(uint256 amount)
        public
        constant
        returns (uint256)
    {
        require(amount < 2**123);
        return fraction(amount, ETH_EUR_FRACTION);
    }

    function platformWalletAddress()
        public
        constant
        returns (address)
    {
        return PLATFORM_WALLET;
    }

    function neumark()
        public
        constant
        returns (Neumark)
    {
        return NEUMARK;
    }

    function etherLock()
        public
        constant
        returns (LockedAccount)
    {
        return ETHER_LOCK;
    }

    function euroLock()
        public
        constant
        returns (LockedAccount)
    {
        return EURO_LOCK;
    }

    function maxCapEur()
        public
        constant
        returns (uint256)
    {
        return CAP_EUR;
    }

    function minTicketEur()
        public
        constant
        returns (uint256)
    {
        return MIN_TICKET_EUR;
    }

    function platformOperatorNeumarkRewardShare()
        public
        constant
        returns (uint256)
    {
        return PLATFORM_SHARE;
    }

    // may be used to enumerate investors in whitelist
    function whitelistInvestor(uint256 atWhitelistPosition)
        public
        constant
        returns (address)
    {
        return _whitelistInvestors[atWhitelistPosition];
    }

    // ticket information for particular investors
    function whitelistTicket(address investor)
        public
        constant
        returns (Token token, uint256 ticketEur, uint256 neumarkReward)
    {
        WhitelistTicket storage ticket = _whitelist[investor];
        uint256 platformNmk = divRound(ticket.rewardNmk, PLATFORM_SHARE);
        uint256 investorNmk = sub(ticket.rewardNmk, platformNmk);
        return (ticket.token, ticket.amountEur, investorNmk);
    }

    ////////////////////////
    // Internal functions
    ////////////////////////

    //
    // Implements StateMachine
    //

    function mAfterTransition(State /* oldState */, State newState)
        internal
    {
        if (newState == State.Public) {

            // Rollback unfufilled Ether reservations.
            NEUMARK.burnNeumark(_whitelistEtherNmk);
            _whitelistEtherNmk = 0;
        }
        if (newState == State.Finished) {

            // Rollback unfulfilled Euro reservations.
            NEUMARK.burnNeumark(_whitelistEuroNmk);
            _whitelistEuroNmk = 0;

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

        // Register the investor on the list of investors to keep them
        // in order.
        _whitelistInvestors.push(investor);

        // Create a ticket without NEUMARK reward information and add it to
        // the pre-allocated tickets.
        _whitelist[investor] = WhitelistTicket({
            token: token,
            amountEur: amountEur,
            rewardNmk: 0
        });

        // Allocate Neumarks (will be issued to `this`).
        // Because `_whitelist[investor].token == Token.None` does not not hold
        // any more, this function is protected against reentrancy attack
        // conducted from NEUMARK.issueForEuro().
        uint256 rewardNmk = NEUMARK.issueForEuro(amountEur);

        // Record the number of Neumarks for investor.
        _whitelist[investor].rewardNmk = rewardNmk;

        // Add to totals
        if (isEuro) {
            _whitelistEuroNmk = add(_whitelistEuroNmk, rewardNmk);
        } else {
            _whitelistEtherNmk = add(_whitelistEtherNmk, rewardNmk);
        }
    }

    /// @dev Token.None should not be passed to 'tokenType' parameter
    function commitToken(uint256 committedEuroUlp, Token tokenType)
        private
        returns (uint256 investorNmk, uint256 ticketNmk)
    {
        // We don't go over the cap
        require(add(NEUMARK.totalEuroUlps(), committedEuroUlp) <= CAP_EUR);

        // Compute committed funds
        uint256 remainingEur = committedEuroUlp;
        uint256 totalNmk = 0;

        // Whitelist part
        WhitelistTicket storage ticket = _whitelist[msg.sender];

        bool whitelisted = ticket.token == tokenType;
        require(whitelisted || state() == State.Public);

        bool whitelistActiveForToken = tokenType == Token.Euro || state() == State.Whitelist;
        if (whitelisted && whitelistActiveForToken) {
            uint256 ticketEur = min(remainingEur, ticket.amountEur);
            ticketNmk = proportion(
                ticket.rewardNmk,
                ticketEur,
                ticket.amountEur
            );
            ticket.amountEur = sub(ticket.amountEur, ticketEur);
            ticket.rewardNmk = sub(ticket.rewardNmk, ticketNmk);
            remainingEur = sub(remainingEur, ticketEur);

            totalNmk += ticketNmk;
        }

        // issue Neumarks against curve for amount left after pre-defined ticket was realized
        if (remainingEur > 0) {
            totalNmk = add(totalNmk, NEUMARK.issueForEuro(remainingEur));
            remainingEur = 0; // not used later but we should keep variable semantics
        }

        // Split the Neumarks
        // AUDIT[CHF-52] Simplify calculating the platform share.
        //   1. In this case where PLATFORM_SHARE is 2, divRound actually means
        //      "div round up".
        //   2. Considering 18 decimals of Neumark token, using divRound()
        //      increases complexity without measurable benefits.
        //      Use DIV with rounding towards 0 for computing the platform
        //      share as this:
        //
        //          uint256 platformNmk = totalNmk / PLATFORM_SHARE;
        //          investorNmk = totalNmk - platformNmk;
        //
        //   See also AUDIT[CHF-47].
        uint256 platformNmk = divRound(totalNmk, PLATFORM_SHARE);
        investorNmk = totalNmk - platformNmk;

        // Issue Neumarks and distribute
        NEUMARK.distributeNeumark(msg.sender, investorNmk);
        NEUMARK.distributeNeumark(PLATFORM_WALLET, platformNmk);

        return (investorNmk, ticketNmk);
    }
}
