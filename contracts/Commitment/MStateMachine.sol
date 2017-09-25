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
    // AUDIT[CHF-02]: The comment above MStateMachine.mBeforeTransition()
    //                references a method state() from the contract StateMachine
    //                implementing this interface. The same in
    //                MStateMachine.mAfterTransition().
    // AUDIT[CHF-03]: The comment "It's guaranteed" may be understand as
    //                the method requirement, but probably describes the
    //                guarantees given by the StateMachine contract. The same in
    //                MStateMachine.mAfterTransition().
    function mBeforeTransition(State oldState, State newState)
        internal;

    /// @notice Get's called after every state transition.
    ///     It's guaranteed that `oldState != newState` and
    //      `state() == newState`.
    function mAfterTransition(State oldState, State newState)
        internal;
}
