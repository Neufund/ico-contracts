pragma solidity 0.4.15;


contract MStateMachine {

    ////////////////////////
    // Types
    ////////////////////////

    enum State {
        Before,
        Whitelist,
        Pause,
        Public,
        Rollback,
        Finished
    }

    ////////////////////////
    // Internal functions
    ////////////////////////

    /// @notice Get's called after every state transition.
    ///     It's guaranteed that `oldState != newState` and
    //      `state() == oldState`.
    function mBeforeTransition(State oldState, State newState)
        internal;

    /// @notice Get's called after every state transition.
    ///     It's guaranteed that `oldState != newState` and
    //      `state() == newState`.
    function mAfterTransition(State oldState, State newState)
        internal;
}
