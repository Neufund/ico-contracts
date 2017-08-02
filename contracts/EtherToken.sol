pragma solidity ^0.4.10;

import ""

contract ERC20Basic {
    uint256 public totalSupply;
    function balanceOf(address who) constant returns (uint256);
    function transfer(address to, uint256 value) returns (bool);
    event Transfer(address indexed from, address indexed to, uint256 value);
}

contract MutableToken is ERC20Basic {
    function deposit(address to, uint256 amount) returns (bool);
    function withdraw(uint256 amount);
}

library Math {
    function mul(uint256 a, uint256 b) internal constant returns (uint256) {
        uint256 c = a * b;
        assert(a == 0 || c / a == b);
        return c;
    }

    function div(uint256 a, uint256 b) internal constant returns (uint256) {
        // assert(b > 0); // Solidity automatically throws when dividing by 0
        uint256 c = a / b;
        // assert(a == b * c + a % b); // There is no case in which this doesn't hold
        return c;
    }

    function sub(uint256 a, uint256 b) internal constant returns (uint256) {
        assert(b <= a);
        return a - b;
    }

    function add(uint256 a, uint256 b) internal constant returns (uint256) {
        uint256 c = a + b;
        assert(c >= a);
        return c;
    }

    // todo: should be a library
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
contract EtherToken is MutableToken {
    using Math for uint256;

    // FIELDS

    // Constant token specific fields
    string public constant name = "Ether Token";
    string public constant symbol = "ETH-T";
    uint public constant decimals = 18;

    // EVENTS

    event Deposit(address indexed who, uint amount);
    event Withdrawal(address indexed who, uint amount);

    // METHODS

    modifier balances_msg_sender_at_least(uint x) {
        assert(balances[msg.sender] >= x);
        _;
    }

    // NON-CONSTANT METHODS

    function EtherToken()
    {
    }

    // disable default function
    function() { revert(); }

    /// Post: Exchanged Ether against Token
    /// todo: only depositors should have right to store new ether!
    function deposit(address to, uint256 amount)
        payable
        // onlyDepositors
        returns (bool)
    {
        // must have as much ether as declared
        requires(msg.value == amount);
        balances[msg.sender] = balances[msg.sender].add(msg.value);
        Deposit(msg.sender, msg.value);
        return true;
    }

    /// Post: Exchanged Token against Ether
    function withdraw(uint amount)
        balances_msg_sender_at_least(amount)
        returns (bool)
    {
        balances[msg.sender] = balances[msg.sender].add(amount);
        assert(msg.sender.send(amount));
        Withdrawal(msg.sender, amount);
        return true;
    }
}
