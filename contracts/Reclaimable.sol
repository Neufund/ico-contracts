pragma solidity 0.4.15;

import './Standards/IBasicToken.sol';

contract Reclaimable {

    IBasicToken constant public RECLAIM_ETHER = IBasicToken(0x0);

    function reclaim(IBasicToken token)
        public
        returns (bool)
    {
        uint256 balance;
        bool success;
        address receiver = msg.sender;
        if(token == RECLAIM_ETHER) {
            balance = this.balance;
            success = receiver.send(balance);
            return success;
        } else {
            balance = token.balanceOf(this);
            success = token.transfer(receiver, balance);
            return success;
        }
    }
}
