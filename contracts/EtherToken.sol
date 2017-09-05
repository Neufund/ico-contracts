pragma solidity 0.4.15;

import './AccessControl/AccessControlled.sol';
import './Math.sol';
import './Reclaimable.sol';
import './Standards/IERC677Token.sol';
import './Standards/IERC677Callback.sol';
import './Standards/ITokenWithDeposit.sol';
import './SnapshotToken/Helpers/TokenMetadata.sol';
import './Zeppelin/StandardToken.sol';


contract EtherToken is
    ITokenWithDeposit,
    IERC677Token,
    AccessControlled,
    StandardToken,
    TokenMetadata,
    Reclaimable
{
    ////////////////////////
    // Constants
    ////////////////////////

    string private constant NAME = "Ether Token";

    string private constant SYMBOL = "ETH-T";

    uint8 private constant DECIMALS = 18;

    ////////////////////////
    // Constructor
    ////////////////////////

    function EtherToken(IAccessPolicy accessPolicy)
        AccessControlled(accessPolicy)
        StandardToken()
        TokenMetadata(NAME, DECIMALS, SYMBOL, "")
        Reclaimable()
    {
    }

    ////////////////////////
    // Public functions
    ////////////////////////

    /// deposit 'amount' of Ether to account 'to'
    function deposit(address to, uint256 amount)
        payable
        public
        returns (bool)
    {
        // must have as much ether as declared
        require(msg.value == amount);
        balances[to] = add(balances[to], amount);
        totalSupply = add(totalSupply, amount);
        Deposit(to, amount);
        return true;
    }

    /// withdraws and sends 'amount' of ether to msg.sender
    function withdraw(uint256 amount)
        public
    {
        require(balances[msg.sender] >= amount);
        balances[msg.sender] -= amount;
        totalSupply -= amount;
        msg.sender.transfer(amount);
        Withdrawal(msg.sender, amount);
    }

    //
    // Implements IERC677Token
    //

    function approveAndCall(address _spender, uint256 _amount, bytes _extraData)
        returns (bool success)
    {
        require(approve(_spender, _amount));

        success = IERC677Callback(_spender).receiveApproval(
            msg.sender,
            _amount,
            this,
            _extraData
        );

        return success;
    }

    //
    // Overrides Reclaimable
    //

    function reclaim(IBasicToken token)
        public
    {
        // This contract holds Ether
        require(token != RECLAIM_ETHER);
        Reclaimable.reclaim(token);
    }
}
