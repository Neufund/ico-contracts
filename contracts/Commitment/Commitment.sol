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


// Consumes MCommitment
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

        // The currency the investor wants and is allowed to commited.
        Token token;

        // The amount the investor commited. The investor can invest more or
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
    // AUDIT[CHF-48] Explain what the value actually means and that it cannot
    //   be 0.
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

    // AUDIT[CHF-25] Commitment constants are not documented.
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

    // amount of Neumarks reserved for Ether whitelist investors
    uint256 private _whitelistEtherNmk;

    // amount of Neumarks reserved for Euro whitelist investors
    uint256 private _whitelistEuroNmk;

    ////////////////////////
    // Events
    ////////////////////////

    /// on every commitment transaction
    /// `investor` commited `amount` in `paymentToken` currency which was
    /// converted to `eurEquivalent` that generates `grantedAmount` of
    /// `ofToken`.
    // AUDIT[CHF-23]: Typo: commited -> committed.
    //               This typo is all over the place but here is very important,
    //               because the name LogFundsCommited is public and will be
    //               used by external applications.
    //               The typo "commited" should be fixed everywhere with
    //               a single find&replace pass.
    event LogFundsCommited(
        address indexed investor,
        uint256 amount,

        // AUDIT[CHF-28] Group indexed arguments.
        //   On the Ethereum RPC level this value is going to be
        //   passed as a LOG topic together with the first indexed argument
        //   `investor`. This might be confusing that the order of values in RPC
        //   is different that the oder of arguments in this declaration.
        //   Consider putting indexed arguments before non-indexed ones.
        address indexed paymentToken,
        uint256 eurEquivalent,
        uint256 grantedAmount,

        // AUDIT[CHF-29] Consider removing ofToken argument.
        //   In every invoke of this event NEUMARK token address is always
        //   passed as the value of this argument.
        address ofToken
    );

    ////////////////////////
    // Constructor
    ////////////////////////

    /// AUDIT[CHF-27] This comment is out-dated.
    /// declare capital commitment into Neufund ecosystem
    /// store funds in _ethToken and lock funds in _lockedAccount while issuing
    /// Neumarks along _curve commitments can be chained via long lived
    /// _lockedAccount and _nemark
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
        uint256 capEur,
        uint256 minTicketEur,
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
        // AUDIT[CHF-24] EUR token decimals not documented.
        //   It is not documented here or in constants section than the EUR
        //   amounts have 18 decimal places. The only comment about this is
        //   in convertToEur().
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

        // AUDIT[CHF-26] These initializations can be moved to declarations,
        //   or ignored, because solidity initializes all storage variables
        //   with 0 by default.
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

        // AUDIT[CHF-32] Hidden time constraint on whitelist admin.
        //   The whitelist admin has only 1 day (minimum) to fill the whitelist.
        //   This adds dependency of the performance of an external entity
        //   to the system.
        //   Moreover, the information that this period last minimum 1 day
        //   is kept in some other file.
        withTimedTransitions()
        onlyState(State.Before)
        only(ROLE_WHITELIST_ADMIN)
    {
        require(investors.length == tokens.length);
        require(investors.length == amounts.length);

        // Process tickets
        // AUDIT[CHF-30] Use ++i instead of i++.
        //   This will save 1 (literally one) unit of gas if
        //   the investors array is not empty. Yupi!!
        //   The same can be applied in RoleBasedAccessControl lines 164, 225.
        for (uint256 i = 0; i < investors.length; i++) {

            // Loop body is factored out to keep stack low
            // AUDIT[CHF-31] Invalid assumption about EVM stack space.
            //   This pattern will not save you any EVM stack space (probably
            //   the opposite). Solidity does not use CALLs to execute private
            //   functions. It will just JUMP to the referenced function
            //   staying on the same call depth -- so the stack space is
            //   shared.
            //   To use a separated call for execution of this function you have
            //   to use `this.addWhitelistInvestorPrivate()`, but
            //   addWhitelistInvestorPrivate() has to be public.
            addWhitelistInvestorPrivate(investors[i], tokens[i], amounts[i]);
        }

        // We don't go over the cap
        require(NEUMARK.totalEuroUlps() <= CAP_EUR);
    }

    // AUDIT[CHF-44] Explain why Commitment.abort() function is needed.
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

        // AUDIT[CHF-55] Accepting agreement confusion.
        //   This will automatically put the msg.sender in the list of addresses
        //   accepting the agreement. Shouldn't the order of actions be
        //   different? Accepting the agreement being a precondition of commit()
        //   action?
        acceptAgreement(msg.sender)
    {
        // Take with EtherToken allowance (if any)
        uint256 commitedWei = ETHER_TOKEN.allowance(msg.sender, this);

        // AUDIT[CHF-54] Unnecessary call to ETHER_TOKEN.transferFrom().
        //   When commitedWei is 0, calling ETHER_TOKEN.transferFrom() will
        //   - waste some amount of gas,
        //   - produce Transfer event with value 0.
        //   Checking the value of commitedWei before calling transferFrom()
        //   seems reasonable.
        assert(ETHER_TOKEN.transferFrom(msg.sender, this, commitedWei));

        // Turn msg.value into EtherToken (if any)
        // AUDIT[CHF-56] Unnecessary call to ETHER_TOKEN.deposit().
        //   Similar to AUDIT[CHF-54]. When msg.value is 0, calling
        //   ETHER_TOKEN.deposit() will
        //   - waste some amount of gas,
        //   - produce LogDeposit event with value 0.
        //   - produce Transfer event from address 0 with value 0.
        // Wrap the following code with `if (msg.value > 0)` condition.
        commitedWei = add(commitedWei, msg.value);
        ETHER_TOKEN.deposit.value(msg.value)();

        // Get Neumark reward
        uint256 commitedEur = convertToEur(commitedWei);
        // AUDIT[CHF-57] Comment about 0-value commitment.
        //   Add a comment that commitToken() will fail if commitedEur is 0
        //   or smaller than MIN_TICKET_EUR.
        var (investorNmk, ticketNmk) = commitToken(commitedEur, Token.Ether);
        // AUDIT[CHF-58] Move NMK counters updates to Commitment.commitToken().
        //   The Commitment.commitToken() has all the logic related to whitelist
        //   checking. Move the _whitelistEtherNmk subtraction from here and
        //   _whitelistEuroNmk subtraction from commitEuro() there to
        //   commitToken() too. This will also simplify the return type of
        //   commitToken().
        _whitelistEtherNmk = sub(_whitelistEtherNmk, ticketNmk);

        // Lock EtherToken
        // AUDIT[CHF-60] Consider using ERC223-like transfer pattern.
        //   The onTokenTransfer() callback can be implemented in the
        //   LockedAccount contract to lock tokens received by ERC223-like
        //   transfers. Still we will have 2 calls to lock tokens, but
        //   whole complexity would be encapsulated in the LockedAccount.
        //   This also applies to Commitment.commitEuro().
        ETHER_TOKEN.approve(ETHER_LOCK, commitedWei);
        ETHER_LOCK.lock(msg.sender, commitedWei, investorNmk);

        // Log successful commitment
        LogFundsCommited(
            msg.sender,
            commitedWei,
            ETHER_TOKEN,
            commitedEur,
            investorNmk,
            NEUMARK
        );
    }

    function commitEuro()
        external
        withTimedTransitions()
        onlyStates(State.Whitelist, State.Public)
        acceptAgreement(msg.sender)
    {
        // Receive Euro tokens
        uint256 euroUlp = EURO_TOKEN.allowance(msg.sender, this);
        assert(EURO_TOKEN.transferFrom(msg.sender, this, euroUlp));

        // Get Neumark reward
        var (investorNmk, ticketNmk) = commitToken(euroUlp, Token.Euro);
        _whitelistEuroNmk = sub(_whitelistEuroNmk, ticketNmk);

        // Lock EuroToken
        EURO_TOKEN.approve(EURO_LOCK, euroUlp);
        EURO_LOCK.lock(msg.sender, euroUlp, investorNmk);

        // Log successful commitment
        LogFundsCommited(
            msg.sender,
            euroUlp,
            EURO_TOKEN,
            euroUlp,
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

    // AUDIT[CHF-46] What is this function for?
    function whitelistInvestor(uint256 atWhitelistPosition)
        public
        constant
        returns (address)
    {
        return _whitelistInvestors[atWhitelistPosition];
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
        if (newState == State.Public) {

            // Rollback unfufilled Ether reservations.
            NEUMARK.burnNeumark(_whitelistEtherNmk);

            // AUDIT[CHF-61] Zero NMK counters in Commitment.mAfterTransition()
            //   For sanity zero _whitelistEtherNmk after burning tokens,
            //   you will also get some gas back.
            //   The same applies to _whitelistEuroNmk when
            //   newState == State.Finished.
        }
        if (newState == State.Finished) {

            // Rollback unfulfilled Euro reservations.
            NEUMARK.burnNeumark(_whitelistEuroNmk);

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

        // AUDIT[CHF-34] Undocumented enum feature used.
        //   In the following line you are relaying on the undocumented enum
        //   feature that the first element of an enum is also the "zero"
        //   element and storage variables of enum types are initialized to
        //   "zero" elements.
        //   This is correct: confirmed by solidity developers and community
        //   (https://ethereum.stackexchange.com/questions/21775/what-is-the-zero-value-for-an-enum).
        //   Moreover, considering EVM internals there is no
        //   practical way for solidity to implement this differently.
        //   A contribution to solidity documentation describing this behavior
        //   would be a nice addition to this ICO project.
        require(_whitelist[investor].token == Token.None);
        bool isEuro = token == Token.Euro;
        bool isEther = token == Token.Ether;
        require(isEuro || isEther);
        // Note: amount can be zero, indicating no pre-allocated NMK,
        //       but still the ability to commit before the public.
        uint256 amountEur = isEuro ? amount : convertToEur(amount);
        require(amount == 0 || amountEur >= MIN_TICKET_EUR);

        // AUDIT[CHF-42] Protect against reentrancy attack.
        //   Although the NEUMARK.issueForEuro() is trusted code,
        //   you should change the order of operations in this function.
        //   The general rules are described in
        //   "Order of operations within an external or public function"
        //   in CodeStyle.md file.
        //
        //   At least `_whitelist[investor].token = token` should be set before
        //   calling NEUMARK.issueForEuro().
        //
        //   The proposed code changes are in audit/CHF-42.patch.
        //
        //   Also, having a unit test case for reentracy attack on
        //   Commitment.addWhitelisted() (by mocking NEUMARK contract)
        //   would be nice.

        // Allocate Neumarks (will be issued to `this`)
        uint256 rewardNmk = NEUMARK.issueForEuro(amountEur);

        // Add to pre-allocated tickets
        _whitelist[investor] = WhitelistTicket({
            token: token,
            amountEur: amountEur,
            rewardNmk: rewardNmk
        });
        _whitelistInvestors.push(investor);

        // Add to totals
        // AUDIT[CHF-41] Use isEuro instead of isEther.
        //   For consistency, use only isEuro to make decision about conditional
        //   code execution. This will make the code paths for EUR case always
        //   the first branch and for ETH always the second.
        if (isEther) {
            _whitelistEtherNmk = add(_whitelistEtherNmk, rewardNmk);
        } else {
            _whitelistEuroNmk = add(_whitelistEuroNmk, rewardNmk);
        }
    }

    function commitToken(uint256 euroUlp, Token tokenType)
        private
        returns (uint256 investorNmk, uint256 ticketNmk)
    {
        // Compute commited funds
        require(euroUlp >= MIN_TICKET_EUR);
        uint256 remainingEur = euroUlp;
        uint256 totalNmk = 0;

        // Whitelist part
        WhitelistTicket storage ticket = _whitelist[msg.sender];

        // AUDIT[CHF-50] Locally wrong "whitelisted" condition check.
        //   This condition check is not valid for tokenType being Token.None.
        //   Add assert(tokenType != Token.None) or add a comment stating
        //   that passing Token.None is not allowed.
        bool whitelisted = ticket.token == tokenType;
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
            totalNmk = add(totalNmk, ticketNmk);
        }

        // Curve
        if (whitelisted || state() == State.Public) {
            totalNmk = add(totalNmk, NEUMARK.issueForEuro(remainingEur));
            remainingEur = 0;
        }

        // We don't do partial tickets
        require(remainingEur == 0);

        // We don't go over the cap
        require(NEUMARK.totalEuroUlps() <= CAP_EUR);

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

        // AUDIT[CHF-51] Start trusting in math.
        //   If you don't trust that divRound() guarantees the following
        //   post-condition, it's time to take a step back.
        //   Please remove this assert.
        assert(platformNmk <= totalNmk);

        // AUDIT[CHF-49] Safe Math.sub() unnecessary below.
        //   It is guaranteed that totalNmk >= platformNmk.
        //   The same issue is in whitelistTicket().
        investorNmk = sub(totalNmk, platformNmk);

        // Issue Neumarks and distribute
        NEUMARK.distributeNeumark(msg.sender, investorNmk);
        NEUMARK.distributeNeumark(PLATFORM_WALLET, platformNmk);

        return (investorNmk, ticketNmk);
    }
}
