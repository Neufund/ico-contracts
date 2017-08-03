pragma solidity ^0.4.11;

import 'zeppelin-solidity/contracts/token/ERC20.sol';
import 'zeppelin-solidity/contracts/token/StandardToken.sol';
import 'zeppelin-solidity/contracts/math/SafeMath.sol';


contract MutableToken is ERC20 {
    // todo: do smth about payable which is force to be part of interface by compiler!
    function deposit(address to, uint256 amount) payable returns (bool);
    function withdraw(uint256 amount);

    // EVENTS

    event Deposit(address indexed who, uint amount);
    event Withdrawal(address indexed who, uint amount);
}

library Math {
    // todo: propose changes to zeppelin, I want this function
    function divRound(uint v, uint d) public constant returns(uint) {
        // round up if % is half or more
        return (v + (d/2)) / d;
    }

    function absDiff(uint v1, uint v2) public constant returns(uint) {
        return v1 > v2 ? v1 - v2 : v2 - v1;
    }
}


/// @title EtherToken Contract.
/// @author Melonport AG <team@melonport.com>
/// @notice Make Ether into a ERC20 compliant token
/// @notice Compliant to https://github.com/nexusdev/dappsys/blob/04451acf23f017beecb1a4cad4702deadc929811/contracts/token/base.sol
contract EtherToken is StandardToken, MutableToken {
    using SafeMath for uint256;

    // FIELDS

    // Constant token specific fields
    string public constant name = "Ether Token";
    string public constant symbol = "ETH-T";
    uint public constant decimals = 18;

    // METHODS

    modifier balances_msg_sender_at_least(uint x) {
        assert(balances[msg.sender] >= x);
        _;
    }

    // disable default function
    function() { revert(); }

    /// Post: Exchanged Ether against Token
    /// todo: only depositors should have right to store new ether!
    function deposit(address to, uint256 amount)
        payable
        // onlyDepositors
        public
        returns (bool)
    {
        // must have as much ether as declared
        require(msg.value == amount);
        balances[to] = balances[to].add(amount);
        totalSupply = totalSupply.add(amount);
        Deposit(to, amount);
        return true;
    }

    /// Post: Exchanged Token against Ether
    /// always withdraw to the sender!
    function withdraw(uint256 amount)
        balances_msg_sender_at_least(amount)
        public
    {
        assert(msg.sender.send(amount));
        balances[msg.sender] = balances[msg.sender].sub(amount);
        totalSupply = totalSupply.sub(amount);
        Withdrawal(msg.sender, amount);
    }
}
