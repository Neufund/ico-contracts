pragma solidity ^0.4.15;

import "truffle/Assert.sol";  //< Truffle requires this to be included.
import "../contracts/Commitment/StateMachine.sol";

contract TestStateMachine is
    StateMachine
{
    function testInitialState()
    {
        assert(state() == State.Before);
    }
}