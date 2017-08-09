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


contract Crowdsale is Ownable, TimeSource, Math {
    //events
    event CommitmentCompleted(bool isSuccess, uint256 totalCommitedAmount);
    event Commited(address indexed investor, uint256 amount, uint256 neumarks, uint256 eurEquivalent);

    LockedAccount public lockedAccount;
    TokenWithDeposit public ownedToken;
    Neumark public neumarkToken;
    NeumarkController public neumarkController;
    Curve public curve;

    uint256 public startDate;
    uint256 public endDate;
    uint256 public maxCap;
    uint256 public minCap;

    uint256 public constant ICO_ETHEUR_RATE = 200;

    function Crowdsale(uint256 _startDate, uint256 _endDate, uint256 _minCap,
         uint256 _maxCap, EtherToken _ethToken, LockedAccount _locked, Curve _curve )
    {
        require(_endDate >= _startDate);
        require(_minCap >= 0);
        require(_maxCap >= _minCap);

        startDate = _startDate;
        endDate = _endDate;
        maxCap = _maxCap;
        minCap = _minCap;

        lockedAccount = _locked;
        curve = _curve;
        neumarkController = _curve.NEUMARK_CONTROLLER();
        neumarkToken = neumarkController.TOKEN();
        ownedToken = _ethToken;
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

    function finalize()
        public
    {
        require(hasEnded());
        if (wasSuccessful()) {
            // maybe do smth to neumark controller like enable trading
            neumarkController.enableTransfers(true);
            // enable escape hatch
            lockedAccount.controllerSucceeded();
            CommitmentCompleted(true, lockedAccount.totalLockedAmount());
        } else {
            // kill/block neumark contract
            // unlock all accounts in lockedAccount
            lockedAccount.controllerFailed();
            CommitmentCompleted(true, lockedAccount.totalLockedAmount());
        }
    }

    // a test function to change start date of ICO - may be useful for UI demo
    function _changeStartDate(uint256 date)
        onlyOwner
        public
    {
        startDate = date;
    }

    // a test function to change start date of ICO - may be useful for UI demo
    function _changeEndDate(uint256 date)
        onlyOwner
        public
    {
        endDate = date;
    }

    function _changeMaxCap(uint256 _cap)
        onlyOwner
        public
    {
        maxCap = _cap;
    }

    function _changeMinCap(uint256 _cap)
        onlyOwner
        public
    {
        minCap = _cap;
    }

    function commit()
        payable
        public
    {
        require(validPurchase(msg.value));
        require(!hasEnded());

        // convert ether into full euros
        uint256 fullEuros = proportion(msg.value, ICO_ETHEUR_RATE, 1 ether);
        // get neumarks
        uint256 neumark = curve.issue(fullEuros, msg.sender);
        //send Money to ETH-T contract
        ownedToken.deposit.value(msg.value)(address(this), msg.value);
        // make allowance for lock
        ownedToken.approve(address(lockedAccount), msg.value);
        // lock in lock
        lockedAccount.lock(msg.sender, msg.value, neumark);
        Commited(msg.sender, msg.value, neumark, fullEuros);
    }

    function validPurchase(uint256 amount)
        internal
        constant
        returns (bool)
    {
        return (amount > 0) && (lockedAccount.totalLockedAmount() + amount <= maxCap);
    }


}
//TODO Change name of contract to CommitmentContract
