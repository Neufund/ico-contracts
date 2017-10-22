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
        uint256 amountEurUlps;

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
    uint256 private constant PLATFORM_NEUMARK_SHARE = 2; // 50:50 division

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
    uint256 private CAP_EUR_ULPS;

    // minimum amount of EuroToken that may be committed
    uint256 private MIN_TICKET_EUR_ULPS;

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
        CAP_EUR_ULPS = capEurUlps;
        MIN_TICKET_EUR_ULPS = minTicketEurUlps;
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
        require(NEUMARK.totalEuroUlps() <= CAP_EUR_ULPS);
    }

    /// @notice used by WHITELIST_ADMIN to kill commitment process before it starts
    /// @dev by selfdestruct we make all LockContracts controlled by this contract dysfunctional
    function abort()
        external
        withTimedTransitions()
        onlyState(State.Before)
        only(ROLE_WHITELIST_ADMIN)
    {
        // Return all Neumarks that may have been reserved.
        NEUMARK.burn(NEUMARK.balanceOf(this));

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
        uint256 allowedAmount = ETHER_TOKEN.allowance(msg.sender, this);
        uint256 committedAmount = add(allowedAmount, msg.value);
        uint256 committedEurUlps = convertToEur(committedAmount);
        // check against minimum ticket before proceeding
        require(committedEurUlps >= MIN_TICKET_EUR_ULPS);

        if (allowedAmount > 0) {
            assert(ETHER_TOKEN.transferFrom(msg.sender, this, allowedAmount));
        }
        if (msg.value > 0) {
            ETHER_TOKEN.deposit.value(msg.value)();
        }

        // calculate Neumark reward and update Whitelist ticket
        uint256 investorNmk = getInvestorNeumarkReward(committedEurUlps, Token.Ether);

        // Lock EtherToken
        ETHER_TOKEN.approve(ETHER_LOCK, committedAmount);
        ETHER_LOCK.lock(msg.sender, committedAmount, investorNmk);

        // Log successful commitment
        LogFundsCommitted(
            msg.sender,
            ETHER_TOKEN,
            committedAmount,
            committedEurUlps,
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
        uint256 committedEurUlps = EURO_TOKEN.allowance(msg.sender, this);
        // check against minimum ticket before proceeding
        require(committedEurUlps >= MIN_TICKET_EUR_ULPS);

        assert(EURO_TOKEN.transferFrom(msg.sender, this, committedEurUlps));

        // calculate Neumark reward and update Whitelist ticket
        uint256 investorNmk = getInvestorNeumarkReward(committedEurUlps, Token.Euro);

        // Lock EuroToken
        EURO_TOKEN.approve(EURO_LOCK, committedEurUlps);
        EURO_LOCK.lock(msg.sender, committedEurUlps, investorNmk);

        // Log successful commitment
        LogFundsCommitted(
            msg.sender,
            EURO_TOKEN,
            committedEurUlps,
            committedEurUlps,
            investorNmk,
            NEUMARK
        );
    }

    function estimateNeumarkReward(uint256 amount)
        external
        constant
        returns (uint256)
    {
        uint256 amountEurUlps = convertToEur(amount);
        uint256 rewardNmk = NEUMARK.incremental(amountEurUlps);
        var (, investorNmk) = calculateNeumarkDistribtion(rewardNmk);
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
    function convertToEur(uint256 amount)
        public
        constant
        returns (uint256)
    {
        require(amount < 2**123);
        return decimalFraction(amount, ETH_EUR_FRACTION);
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
        return CAP_EUR_ULPS;
    }

    function minTicketEur()
        public
        constant
        returns (uint256)
    {
        return MIN_TICKET_EUR_ULPS;
    }

    function platformOperatorNeumarkRewardShare()
        public
        constant
        returns (uint256)
    {
        return PLATFORM_NEUMARK_SHARE;
    }

    // used to enumerate investors in whitelist
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
        returns (Token token, uint256 ticketEurUlps, uint256 /*investorNmk*/)
    {
        WhitelistTicket storage ticket = _whitelist[investor];
        //  could also use ( , investorNmk) but parser has problems in solium TODO fix solium
        var (, investorNmk) = calculateNeumarkDistribtion(ticket.rewardNmk);
        return (ticket.token, ticket.amountEurUlps, investorNmk);
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
            NEUMARK.burn(_whitelistEtherNmk);
            _whitelistEtherNmk = 0;
        }
        if (newState == State.Finished) {

            // Rollback unfulfilled Euro reservations.
            NEUMARK.burn(_whitelistEuroNmk);
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
        uint256 amountEurUlps = isEuro ? amount : convertToEur(amount);
        require(amount == 0 || amountEurUlps >= MIN_TICKET_EUR_ULPS);

        // Register the investor on the list of investors to keep them
        // in order.
        _whitelistInvestors.push(investor);

        // Create a ticket without NEUMARK reward information and add it to
        // the pre-allocated tickets.
        _whitelist[investor] = WhitelistTicket({
            token: token,
            amountEurUlps: amountEurUlps,
            rewardNmk: 0
        });

        // Allocate Neumarks (will be issued to `this`).
        // Because `_whitelist[investor].token == Token.None` does not not hold
        // any more, this function is protected against reentrancy attack
        // conducted from NEUMARK.issueForEuro().
        uint256 rewardNmk = NEUMARK.issueForEuro(amountEurUlps);

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
    function getInvestorNeumarkReward(uint256 committedEurUlps, Token tokenType)
        private
        returns (uint256)
    {
        // We don't go over the cap
        require(add(NEUMARK.totalEuroUlps(), committedEurUlps) <= CAP_EUR_ULPS);

        // Compute committed funds
        uint256 remainingEurUlps = committedEurUlps;
        uint256 rewardNmk = 0;
        uint256 ticketNmk = 0;

        // Whitelist part
        WhitelistTicket storage ticket = _whitelist[msg.sender];

        bool whitelisted = ticket.token == tokenType;
        require(whitelisted || state() == State.Public);

        bool whitelistActiveForToken = tokenType == Token.Euro || state() == State.Whitelist;
        if (whitelisted && whitelistActiveForToken) {
            uint256 ticketEurUlps = min(remainingEurUlps, ticket.amountEurUlps);
            ticketNmk = proportion(
                ticket.rewardNmk,
                ticketEurUlps,
                ticket.amountEurUlps
            );
            ticket.amountEurUlps = sub(ticket.amountEurUlps, ticketEurUlps);
            ticket.rewardNmk = sub(ticket.rewardNmk, ticketNmk);
            remainingEurUlps = sub(remainingEurUlps, ticketEurUlps);

            rewardNmk += ticketNmk;
        }

        // issue Neumarks against curve for amount left after pre-defined ticket was realized
        if (remainingEurUlps > 0) {
            rewardNmk = add(rewardNmk, NEUMARK.issueForEuro(remainingEurUlps));
            remainingEurUlps = 0; // not used later but we should keep variable semantics
        }

        // Split the Neumarks
        var (platformNmk, investorNmk) = calculateNeumarkDistribtion(rewardNmk);

        // Issue Neumarks and distribute
        NEUMARK.distributeNeumark(msg.sender, investorNmk);
        NEUMARK.distributeNeumark(PLATFORM_WALLET, platformNmk);

        if (ticketNmk > 0) {
            if (tokenType == Token.Euro) {
                _whitelistEuroNmk = sub(_whitelistEuroNmk, ticketNmk);
            } else {
                _whitelistEtherNmk = sub(_whitelistEtherNmk, ticketNmk);
            }
        }
        return investorNmk;
    }

    // calculates investor's and platform operator's neumarks from total reward
    function calculateNeumarkDistribtion(uint256 rewardNmk)
        private
        returns (uint256 platformNmk, uint256 investorNmk)
    {
        // round down - platform may get 1 wei less than investor
        platformNmk = rewardNmk / PLATFORM_NEUMARK_SHARE;
        // rewardNmk > platformNmk always
        return (platformNmk, rewardNmk - platformNmk);
    }
}
