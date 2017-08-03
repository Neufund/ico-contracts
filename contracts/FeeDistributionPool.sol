pragma solidity ^0.4.11;

import 'zeppelin-solidity/contracts/token/ERC20.sol';
import 'zeppelin-solidity/contracts/ownership/Ownable.sol';

// distributes revenues to Neumark token holders coming from any token
contract FeeDistributionPool {

    // supporting just one token contract now
    // todo: support a list
    ERC20 public feeToken;
    uint256 public lastDay;
    public mapping (uint256 => uint256) payouts;

    function addRevenue(ERC20 fromToken, uint256 amount)
        public
    {
        require(amount > 0);
        // check if token is supported for revenue distribution
        require(address(feeToken) == address(fromToken));
        // check if controller made allowance
        require(fromToken.allowance(msg.sender, address(this)) >= amount);
        // transfer to self yourself
        require(fromToken.transferFrom(msg.sender, address(this), amount));
    }

    // distribute part of revenues, can be called by anyone once a day
    function distributeRevenue()
        public
    {
        uint days = block.timestamp / 1 day;
        require(days > lastDay);
        lastDay = days;
        uint256 totalFees = feeToken.balanceOf(address(this));
        uint payout = totalFees / 2;
        payouts[days] = payout; // pay max 50% daily
    }

    function claimFee(uint256 day)
    {

    }
}
