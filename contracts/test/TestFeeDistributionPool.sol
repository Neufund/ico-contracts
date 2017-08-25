pragma solidity ^0.4.11;

import 'zeppelin-solidity/contracts/token/ERC20.sol';
import 'zeppelin-solidity/contracts/ownership/Ownable.sol';
import '../Standards/ISnapshotToken.sol';
import '../Math.sol';
import '../TimeSource.sol';

// this contract allows distibution of fees in form of a token balance (feeToken)
// to token holders of token providing checkpointed interface (like ISnapshotToken)
// should provide any payment scheme via library (tranches, all out, exponentially dimnishing)
// created for each feeToken <-> distributionToken pair
contract FeeDistributionPool is Math, TimeSource {

    ERC20 public feeToken;
    uint256 public lastDay;
    ISnapshotToken public distributionToken;
    mapping (uint256 => uint256) public payouts;

    mapping (uint256 => mapping (address => bool)) private withdrawals;

    function addFee(uint256 amount)
        public
    {
        require(amount > 0);
        // check if controller made allowance
        require(feeToken.allowance(msg.sender, address(this)) >= amount);
        // transfer to self yourself
        require(feeToken.transferFrom(msg.sender, address(this), amount));
    }

    function currentDay()
        constant
        public
        returns (uint)
    {
        return currentTime() / 1 days;
    }

    // distribute part of revenues, can be called by anyone once a day
    function distributeRevenue()
        public
    {
        uint currDay = currentDay();
        require(currDay > lastDay);
        lastDay = currDay;
        uint256 totalFees = feeToken.balanceOf(address(this));
        uint payout = totalFees / 2;
        payouts[currDay] = payout; // pay max 50% daily
    }

    // this will transfer revenue to the msg.sender and make it available to withdraw
    // allows to claim fees for a given day
    function claimFee(uint256 day)
        public
        returns (uint256)
    {
        // prohibit to withdraw on current day - supply of neumarks may change at current day
        require(day < currentDay());
        // needs payout that day
        uint256 totalPayout = payouts[day];
        require(totalPayout > 0);
        // check if withdrawal done
        require(!withdrawals[day][msg.sender]);
        // did sender has neumarks that day ?
        uint256 balanceAtDay = distributionToken.balanceOfAt(msg.sender, day);
        if (balanceAtDay == 0)
            return 0;
        // this total supply will not change
        uint256 neumarkSupplyAtDay = distributionToken.totalSupplyAt(day);
        uint256 claimAmount = proportion(totalPayout, balanceAtDay, neumarkSupplyAtDay);
        uint256 feeBalance = feeToken.balanceOf(address(this));
        // transfer out with numeric precision checks
        if (claimAmount > 0) {
            // now modify payout within 1000 'weis' as we had rounding errors coming from pro-rata amounts
            if ( absDiff(feeBalance, claimAmount) < 1000 wei )
                claimAmount = feeBalance; // send all
            // todo: withelding the revenue
            // var lockedNeumarks = allLocks.lockedNeumarksOf(msg.sender);
            // var witheldAmount = (lockedNeumarks / balanceAtDay) * claimAmount; // this is simple as that!
            // if (witheldAmount >= claimAmount)
            //  claimAmount = 0 else
            // claimAmount = claimAmount - witheldAmount
            require(feeToken.transfer(msg.sender, claimAmount));
            withdrawals[day][msg.sender] = true;
        }

        // here we could even detect if all payments for given day are done but this needs more info (current day balance) in storage
        // since it is virtually impossible to have all people to claim we should skip this
        return claimAmount;
    }

    function FeeDistributionPool(ERC20 _feeToken, ISnapshotToken _distributionToken) {
        feeToken = _feeToken;
        distributionToken = _distributionToken;
    }
}
