pragma solidity 0.4.15;


contract MStateMachine {

    ////////////////////////
    // Internal functions
    ////////////////////////

    /// @notice Get's called for every state transition.
    //      It's guaranteed that `oldState != newState`.
    function mOnTransition(State oldState, State newState);
}
