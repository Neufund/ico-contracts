pragma solidity ^0.4.11;

import 'zeppelin-solidity/contracts/token/MintableToken.sol';
import 'zeppelin-solidity/contracts/math/SafeMath.sol';
import './NeumarkController.sol';
import './EtherToken.sol';
import './LockedAccount.sol';
import './Neumark.sol';


contract Crowdsale{
  using SafeMath for uint256;

  uint256 public constant startDate = 1501681287;
  uint256 public constant endDate = 1501681287 + 30 days;
  uint256 public constant maxCap = 10000 ether;
  uint256 public constant minCap = 1 ether;

  LockedAccount public lockedAccount;
  MutableToken public ownedToken;
  Neumark public neumarkToken;
  NeumarkController public NeumarkCont;

  function Crowdsale(uint256 _startTime, uint _endTime, uint _maxCap, uint _minCap, EtherToken _ethToken, NeumarkController _neumarkController, LockedAccount _locked )
  {
    require(_startTime >= block.timestamp);
    require(_endTime >= _startTime);
    require(_minCap >= 0);
    require(_maxCap >= _minCap);

    lockedAccount = _locked;
    neumarkToken = _neumarkController.TOKEN();
    NeumarkCont = _neumarkController;
    ownedToken = _ethToken;
    /*
    uint startTime = _startTime;
    uint endTime = _endTime;
    uint maxCap = _maxCap;
    uint minCap  = _minCap;

  }
  function commit(address beneficiary) payable {
/*      require(beneficiary != 0x0);
      require(validPurchase());

      uint256 weiAmount = msg.value;

      // calculate token amount to be created
      uint256 tokens = weiAmount.mul(1);

      // update state
      weiRaised = weiRaised.add(weiAmount);


      forwardFunds(); */
  }

 /* function wasSuccessful() public return (bool) {

  }

  function hasEnded() public returns(bool) {

  }

  function finalize() public {

  }*/

  function commit() payable {
      require(validPurchase());
      //TODO: Get Neumark value from Curve contract
      uint256 neumark = msg.value / 6;
      NeumarkCont.generateTokens(msg.sender, neumark);
      //send Money to ETH-T contract
      ownedToken.deposit.value(msg.value)(address(this), msg.value);
      // make allowance for lock
      ownedToken.approve(address(lockedAccount), msg.value);
      // lock in lock
      lockedAccount.lock(msg.sender, msg.value, neumark);

  }

  function validPurchase() internal constant returns (bool) {
    bool nonZeroPurchase = msg.value != 0;
    return nonZeroPurchase;
    // TODO: Add Capsize check
    // TODO: Add ICO preiod check
  }


}
