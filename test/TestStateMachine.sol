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

    function testStateOrdering()
    {
        assert(State.Before == State.Before);
        assert(State.Before <  State.Whitelist);
        assert(State.Before <  State.Public);
        assert(State.Before <  State.Finished);

        assert(State.Whitelist >  State.Before);
        assert(State.Whitelist == State.Whitelist);
        assert(State.Whitelist <  State.Public);
        assert(State.Whitelist <  State.Finished);

        assert(State.Public >  State.Before);
        assert(State.Public >  State.Whitelist);
        assert(State.Public == State.Public);
        assert(State.Public <  State.Finished);

        assert(State.Finished >  State.Before);
        assert(State.Finished >  State.Whitelist);
        assert(State.Finished >  State.Public);
        assert(State.Finished == State.Finished);

        assert(State.Public <= State.Public);
        assert(State.Public >= State.Public);

        assert(int(State.Before) + 1 == int(State.Whitelist));
        assert(int(State.Whitelist) + 1 == int(State.Public));
        assert(int(State.Public) + 1 == int(State.Finished));
    }
}