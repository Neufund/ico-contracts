pragma solidity 0.4.15;

import './AccessControl/AccessControlled.sol';
import './Math.sol';
import './Reclaimable.sol';
import './Standards/IERC677Token.sol';
import './Standards/IERC677Callback.sol';
import './SnapshotToken/Helpers/TokenMetadata.sol';
import './Zeppelin/StandardToken.sol';


contract EtherToken is
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
    // Events
    ////////////////////////

    event LogDeposit(
        address indexed to,
        uint256 amount
    );

    event LogWithdrawal(
        address indexed to,
        uint256 amount
    );

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
    function deposit()
        payable
        public
    {
        _balances[msg.sender] = add(_balances[msg.sender], msg.value);
        _totalSupply = add(_totalSupply, msg.value);
        LogDeposit(msg.sender, msg.value);
    }

    /// withdraws and sends 'amount' of ether to msg.sender
    function withdraw(uint256 amount)
        public
    {
        require(_balances[msg.sender] >= amount);
        _balances[msg.sender] = sub(_balances[msg.sender], amount);
        _totalSupply = sub(_totalSupply, amount);
        msg.sender.transfer(amount);
        LogWithdrawal(msg.sender, amount);
    }

    //
    // Implements IERC677Token
    //

    function approveAndCall(address spender, uint256 amount, bytes extraData)
        returns (bool success)
    {
        require(approve(spender, amount));

        success = IERC677Callback(spender).receiveApproval(
            msg.sender,
            amount,
            this,
            extraData
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
