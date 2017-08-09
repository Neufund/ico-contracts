pragma solidity ^0.4.11;

import 'zeppelin-solidity/contracts/token/MintableToken.sol';
import 'zeppelin-solidity/contracts/math/SafeMath.sol';
import 'zeppelin-solidity/contracts/ownership/Ownable.sol';
import './EtherToken.sol';
import './LockedAccount.sol';
import './TimeSource.sol';
import './Curve.sol';
import './Math.sol';
import './TokenWithDeposit.sol';
import './TokenOffering.sol';

/// public capital commitment for general public
contract PublicCommitment is Ownable, TimeSource, Math, TokenOffering {

    LockedAccount public lockedAccount;
    TokenWithDeposit public paymentToken;
    Neumark public neumarkToken;
    Curve public curve;

    uint256 public startDate;
    uint256 public endDate;
    uint256 public maxCap;
    uint256 public minCap;

    uint256 public constant ICO_ETHEUR_RATE = 200;

    NeumarkController internal neumarkController;
    bool internal finalized;

    /// declare capital commitment into Neufund ecosystem between _startDate and _endDate
    /// min and max amounts in this commitment is _minCommitment - _maxCommitment
    /// store funds in _ethToken and lock funds in _lockedAccount while issuing Neumarks along _curve
    /// commitments can be serialized via long lived _lockedAccount and _curve
    function PublicCommitment(uint256 _startDate, uint256 _endDate, uint256 _minCommitment,
         uint256 _maxCommitment, TokenWithDeposit _ethToken, LockedAccount _lockedAccount, Curve _curve )
    {
        require(_endDate >= _startDate);
        require(_minCommitment >= 0);
        require(_maxCommitment >= _minCommitment);

        lockedAccount = _lockedAccount;
        curve = _curve;
        neumarkController = _curve.NEUMARK_CONTROLLER();
        neumarkToken = neumarkController.TOKEN();
        paymentToken = _ethToken;

        startDate = _startDate;
        endDate = _endDate;

        // continue previous commitments on this lockedAccount
        minCap = _minCommitment + lockedAccount.totalLockedAmount();
        maxCap = _maxCommitment + lockedAccount.totalLockedAmount();
    }

    function wasSuccessful()
        constant
        public
        returns (bool)
    {
        return lockedAccount.totalLockedAmount() >= minCap;
    }

    function hasEnded()
        constant
        public
        returns(bool)
    {
        return lockedAccount.totalLockedAmount() >= maxCap || currentTime() >= endDate;
    }

    function isFinalized()
        constant
        public
        returns (bool)
    {
        return finalized;
    }

    /// when commitment end criteria are met ANYONE can finalize
    /// can be called only once
    function finalize()
        public
    {
        // must end
        require(hasEnded());
        // must not be finalized
        require(!isFinalized());
        // public commitment ends ETH locking
        if (wasSuccessful()) {
            // enable Neumark trading in token controller
            neumarkController.enableTransfers(true);
            // enable escape hatch and end locking funds phase
            lockedAccount.controllerSucceeded();
            CommitmentCompleted(true);
        } else {
            // @remco should we do smth to curve when commitment fails
            // unlock all accounts in lockedAccount
            lockedAccount.controllerFailed();
            CommitmentCompleted(false);
        }
        finalized = true;
    }

    function commit()
        payable
        public
    {
        require(msg.value > 0);
        require(!hasEnded());
        uint256 total = add(lockedAccount.totalLockedAmount(), msg.value);
        // we are not sending back the difference - only full tickets
        require(total <= maxCap);
        require(validPurchase());

        // convert ether into full euros
        uint256 fullEuros = proportion(msg.value, ICO_ETHEUR_RATE, 1 ether);
        // get neumarks
        uint256 neumarks = curve.issue(fullEuros, msg.sender);
        //send Money to ETH-T contract
        paymentToken.deposit.value(msg.value)(address(this), msg.value);
        // make allowance for lock
        paymentToken.approve(address(lockedAccount), msg.value);
        // lock in lock
        lockedAccount.lock(msg.sender, msg.value, neumarks);
        FundsInvested(msg.sender, msg.value, paymentToken, fullEuros, neumarks, neumarkToken);
    }

    function validPurchase()
        internal
        constant
        returns (bool)
    {
        return true;
    }


}
