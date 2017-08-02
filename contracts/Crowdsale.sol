pragma solidity ^0.4.11;

import 'zeppelin-solidity/contracts/token/MintableToken.sol';
import 'zeppelin-solidity/contracts/math/SafeMath.sol';
import './NeumarkController.sol';
import './EtherToken.sol';
import './LockedAccount.sol';


contract Crowdsale{
  using SafeMath for uint256;

  // start and end block where investments are allowed (both inclusive)
  uint public startBlock;
  uint public endBlock;

  // address where funds are collected
  address public wallet;

  // how many token units a buyer gets per wei
  uint256 public rate;

  // amount of raised money in wei
  uint256 public weiRaised;

  function Crowdsale(EtherToken ethToken, NeumarkController Neumark, LockedAccount locked ) //uint256 _startTime, uint _endTime, uint _maxCap, uint _minCap,
  {
    /*require(_startTime >= block.timestamp);
    require(_endTime >= _startTime);
    require(_minCap >= 0);
    require(_maxCap >= _minCap);

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

  function validPurchase() internal constant returns (bool) {
    bool nonZeroPurchase = msg.value != 0;
    return nonZeroPurchase;
    // TODO: Add Capsize check
    // TODO: Add ICO preiod check
  }


}
