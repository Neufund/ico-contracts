pragma solidity 0.4.15;

import "../LockedAccount.sol";


contract TestLockedAccount is LockedAccount {

    ////////////////////////
    // Public functions
    ////////////////////////

    // invests in equity token ICO
    function invest(address ico, uint256 amount)
        onlyState(LockState.AcceptingUnlocks)
        public
        returns (Status)
    {
        require(amount > 0);
        require(ico != address(0));
        Account storage a = _accounts[msg.sender];
        if (amount > a.balance)
            return logError(Status.INSUFFICIENT_FUNDS);
        //if (canInvest(ico) {
            // or whatever interface we'll have here to notify of balance change!
        //    ico.invest(amount);
        //}
        // decrease neumarks due pro rata - high precision may overflow @todo testing
        uint256 freedNeumarks = proportion(a.neumarksDue, amount, a.balance);
        a.balance -= amount;
        // possible precision problems
        if (a.balance == 0 || a.neumarksDue < freedNeumarks)
            a.neumarksDue = 0;
        else
            a.neumarksDue -= freedNeumarks;
        _accounts[msg.sender] = a;

        return Status.SUCCESS;
    }

}
