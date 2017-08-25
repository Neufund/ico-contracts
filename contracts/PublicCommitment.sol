pragma solidity 0.4.15;

import './EtherToken.sol';
import './LockedAccount.sol';
import './TimeSource.sol';
import './Curve.sol';
import './Math.sol';
import './Standards/ITokenWithDeposit.sol';
import './TokenOffering.sol';

/// public capital commitment for general public
contract PublicCommitment is TimeSource, Math, TokenOffering {

    // locks investors capital
    LockedAccount public lockedAccount;
    ITokenWithDeposit public paymentToken;
    Neumark public neumarkToken;
    Curve public curve;

    uint256 public startDate;
    uint256 public endDate;
    uint256 public minCommitment;
    uint256 public maxCommitment;
    uint256 public minTicket;

    uint256 public ethEURFraction;

    uint256 public minAbsCap;
    uint256 public maxAbsCap;

    bool public finalized;
    bool public capsInitialized;

    NeumarkController internal neumarkController;
    // wallet that keeps Platform Operator share of neumarks
    // todo: take from Universe
    address internal platformOperatorWallet = address(0x55d7d863a155F75c5139E20DCBDA8d0075BA2A1c);

    function setCommitmentTerms(uint256 _startDate, uint256 _endDate, uint256 _minCommitment, uint256 _maxCommitment,
        uint256 _minTicket, uint256 _ethEurFraction)
        public
    {
        // set only once
        require(endDate == 0);
        require(_startDate > 0);
        require(_endDate >= _startDate);
        require(_minCommitment >= 0);
        require(_maxCommitment >= _minCommitment);
        ethEURFraction = _ethEurFraction;
        minTicket = _minTicket;

        startDate = _startDate;
        endDate = _endDate;

        minCommitment = _minCommitment;
        maxCommitment = _maxCommitment;
    }

    function commit()
        payable
        public
    {
        // first commit checks lockedAccount and generates status code event
        require(address(lockedAccount.controller()) == address(this));
        require(currentTime() >= startDate);
        // on first commit caps will be frozen
        if (!capsInitialized) {
            initializeCaps();
        }
        require(msg.value >= minTicket);
        require(!hasEnded());
        uint256 total = add(lockedAccount.totalLockedAmount(), msg.value);
        // we are not sending back the difference - only full tickets
        require(total <= maxAbsCap);
        require(validPurchase());

        // convert ether into full euros
        uint256 euros = convertToEUR(msg.value);
        // get neumarks
        uint256 neumarks = giveNeumarks(msg.sender, msg.value, euros);
        //send Money to ETH-T contract
        paymentToken.deposit.value(msg.value)(address(this), msg.value);
        // make allowance for lock
        paymentToken.approve(address(lockedAccount), msg.value);
        // lock in lock
        lockedAccount.lock(msg.sender, msg.value, neumarks);
        FundsInvested(msg.sender, msg.value, paymentToken, euros, neumarks, neumarkToken);
    }

    /// overrides TokenOffering
    function wasSuccessful()
        constant
        public
        returns (bool)
    {
        return lockedAccount.totalLockedAmount() >= minAbsCap;
    }

    /// overrides TokenOffering
    function hasEnded()
        constant
        public
        returns(bool)
    {
        // todo: add finalized check
        return capsInitialized && (lockedAccount.totalLockedAmount() >= maxAbsCap || currentTime() >= endDate);
    }

    /// overrides TokenOffering
    function isFinalized()
        constant
        public
        returns (bool)
    {
        return finalized;
    }

    /// converts `amount` in wei into EUR with 18 decimals required by Curve
    /// Neufund public commitment uses fixed EUR rate during commitment to level playing field and
    /// prevent strategic behavior around ETH/EUR volatility. equity PTOs will use oracles as they need spot prices
    function convertToEUR(uint256 amount)
        public
        constant
        returns (uint256)
    {
        return fraction(amount, ethEURFraction);
    }

    /// when commitment end criteria are met ANYONE can finalize
    /// can be called only once, not intended for override
    function finalize()
        public
    {
        // must end
        require(hasEnded());
        // must not be finalized
        require(!isFinalized());
        // public commitment ends ETH locking
        if (wasSuccessful()) {
            onCommitmentSuccessful();
            CommitmentCompleted(true);
        } else {
            onCommitmentFailed();
            CommitmentCompleted(false);
        }
        finalized = true;
    }

    /// if this is first commitment or before, caps must be finalized from lockedAccount
    /// as we require that next commitment phase sets caps based on results of previous commitment phase
    // ANYONE can call it
    function initializeCaps()
        public
    {
        require(!capsInitialized);
        require(currentTime() >= startDate);
        // continue previous commitments on this lockedAccount
        minAbsCap = minCommitment + lockedAccount.totalLockedAmount();
        maxAbsCap = maxCommitment + lockedAccount.totalLockedAmount();
        capsInitialized = true;
    }

    /// called by finalize() so may be called by ANYONE
    /// intended to be overriden
    function onCommitmentSuccessful()
        internal
    {
        // enable Neumark trading in token controller
        neumarkController.enableTransfers(true);
        // enable escape hatch and end locking funds phase
        lockedAccount.controllerSucceeded();
    }

    /// called by finalize() so may be called by ANYONE
    /// intended to be overriden
    function onCommitmentFailed()
        internal
    {
        // @remco should we do smth to curve when commitment fails
        // unlock all accounts in lockedAccount
        lockedAccount.controllerFailed();
    }

    /// awards investor with Neumarks computed along curve for `euros` amount
    /// this function modifies state of curve
    function giveNeumarks(address investor, uint256 eth, uint256 euros)
        internal
        returns (uint256)
    {
        // issue to self
        return distributeNeumarks(investor, curve.issue(euros));
    }

    /// distributes neumarks on `this` balance to investor and platform operator: half half
    /// returns amount of investor part
    function distributeNeumarks(address investor, uint256 neumarks)
        internal
        returns (uint256)
    {
        // distribute half half
        uint256 investorNeumarks = divRound(neumarks, 2);
        // @ remco is there a better way to distribute?
        bool isEnabled = neumarkToken.transfersEnabled();
        if (!isEnabled)
            neumarkController.enableTransfers(true);
        require(neumarkToken.transfer(investor, investorNeumarks));
        require(neumarkToken.transfer(platformOperatorWallet, neumarks - investorNeumarks));
        neumarkController.enableTransfers(isEnabled);
        return investorNeumarks;
    }

    /// validates amount and investor as taken from msg
    function validPurchase()
        internal
        constant
        returns (bool)
    {
        return true;
    }

    /// default function not callable. prevent investors without transaction data
    function () { revert(); }

    /// declare capital commitment into Neufund ecosystem between _startDate and _endDate
    /// min and max amounts in this commitment is _minCommitment - _maxCommitment
    /// store funds in _ethToken and lock funds in _lockedAccount while issuing Neumarks along _curve
    /// commitments can be serialized via long lived _lockedAccount and _curve
    function PublicCommitment(
        EtherToken _ethToken,
        LockedAccount _lockedAccount,
        Curve _curve
    )
    {
        require(address(_ethToken) == address(_lockedAccount.assetToken()));
        lockedAccount = _lockedAccount;
        curve = _curve;
        neumarkController = _curve.NEUMARK_CONTROLLER();
        neumarkToken = neumarkController.TOKEN();
        paymentToken = _ethToken;
    }
}
