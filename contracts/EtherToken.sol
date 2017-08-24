pragma solidity 0.4.15;

import 'zeppelin-solidity/contracts/token/StandardToken.sol';
import './Math.sol';
import './TokenWithDeposit.sol';
import './ApproveAndCallCallback.sol';

contract EtherToken is StandardToken, TokenWithDeposit, Math {

    // Constant token specific fields
    string public constant name = "Ether Token";
    string public constant symbol = "ETH-T";
    uint public constant decimals = 18;

    // disable default function
    function() { revert(); }

    function approveAndCall(address _spender, uint256 _amount, bytes _extraData)
        returns (bool success)
    {
        require(approve(_spender, _amount));

        success = ApproveAndCallFallBack(_spender).receiveApproval(
            msg.sender,
            _amount,
            this,
            _extraData
        );

        return success;
    }

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
        assert(msg.sender.send(amount));
        balances[msg.sender] -= amount;
        totalSupply -= amount;
        Withdrawal(msg.sender, amount);
    }
}
