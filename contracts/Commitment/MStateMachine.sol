pragma solidity 0.4.15;


contract MStateMachine {

    ////////////////////////
    // Types
    ////////////////////////

    enum State {
        Before,
        Whitelist,
        Public,
        Finished
    }

    ////////////////////////
    // Internal functions
    ////////////////////////

    /// @notice Get's called before every state transition.
    ///     It's guaranteed that `oldState != newState` and
    //      `state() == oldState`.
    // AUDIT[CHF-01]: Should have been "get's called before" instead of
    //                "get's called after". Already fixed.
    function mBeforeTransition(State oldState, State newState)
        internal;

    /// @notice Get's called after every state transition.
    ///     It's guaranteed that `oldState != newState` and
    //      `state() == newState`.
    function mAfterTransition(State oldState, State newState)
        internal;
}
