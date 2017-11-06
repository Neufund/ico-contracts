pragma solidity ^0.4.15;

import "../Commitment/TimedStateMachine.sol";


contract TestTimedStateMachine is
    TimedStateMachine
{
    ////////////////////////
    // Constructor
    ////////////////////////

    function TestTimedStateMachine(int256 whitelistStart)
        TimedStateMachine(whitelistStart)
        public
    {
    }

    ////////////////////////
    // Public Methods
    ////////////////////////

    function testStateOrdering()
        public
    {
        assert(State.Before == State.Before);
        assert(State.Before < State.Whitelist);
        assert(State.Before < State.Public);
        assert(State.Before < State.Finished);

        assert(State.Whitelist > State.Before);
        assert(State.Whitelist == State.Whitelist);
        assert(State.Whitelist < State.Public);
        assert(State.Whitelist < State.Finished);

        assert(State.Public > State.Before);
        assert(State.Public > State.Whitelist);
        assert(State.Public == State.Public);
        assert(State.Public < State.Finished);

        assert(State.Finished > State.Before);
        assert(State.Finished > State.Whitelist);
        assert(State.Finished > State.Public);
        assert(State.Finished == State.Finished);

        assert(State.Public <= State.Public);
        assert(State.Public >= State.Public);

        assert(int(State.Before) + 1 == int(State.Whitelist));
        assert(int(State.Whitelist) + 1 == int(State.Public));
        assert(int(State.Public) + 1 == int(State.Finished));
    }

    //
    // MStateMachine default implementations
    //

    function mAfterTransition(State /* oldState */, State /* newState */)
        internal
    {
    }
}
