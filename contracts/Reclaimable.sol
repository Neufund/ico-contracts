pragma solidity 0.4.15;

import './Standards/IBasicToken.sol';
import './AccessControl/AccessControlled.sol';
import './AccessRoles.sol';


/// @title allows contract to reclaim ether or any token sent to it
/// @dev requires ROLE_RECLAIMER permission, tokens must implement IBasicToken which defines 'balanceOf' and 'transfer'
contract Reclaimable is AccessControlled, AccessRoles {

    ////////////////////////
    // Constants
    ////////////////////////

    IBasicToken constant internal RECLAIM_ETHER = IBasicToken(0x0);

    ////////////////////////
    // Public functions
    ////////////////////////

    function reclaim(IBasicToken token)
        public
        only(ROLE_RECLAIMER)
    {
        uint256 balance;
        bool success;
        address receiver = msg.sender;
        if(token == RECLAIM_ETHER) {
            balance = this.balance;
            receiver.transfer(balance);
        } else {
            balance = token.balanceOf(this);
            success = token.transfer(receiver, balance);
            require(success);
        }
    }
}
