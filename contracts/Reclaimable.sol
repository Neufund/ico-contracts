pragma solidity 0.4.15;

import './Standards/IBasicToken.sol';

contract Reclaimable {

    function reclaim(IBasicToken token)
        public
        returns (bool)
    {
        address receiver = msg.sender;
        if(address(token) == 0x0) {
            uint256 balance = this.balance;
            bool success = receiver.send(balance);
            return success;
        } else {
            uint256 balance = token.balanceOf(this);
            bool success = token.transfer(receiver, balance);
            return success;
        }
    }
}
