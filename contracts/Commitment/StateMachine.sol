pragma solidity 0.4.15;

import './MStateMachine.sol';


// AUDIT[CHF-06]: Missing documenting comment, but the contract name
//                tells a lot what this is about.
//
// Before --> Whitelist --> Public --> Finished
//
contract StateMachine is MStateMachine {

    ////////////////////////
    // Mutable state
    ////////////////////////

    State internal _state;

    ////////////////////////
    // Events
    ////////////////////////

    event LogStateTransition(
        State oldState,
        State newState
    );

    ////////////////////////
    // Modifiers
    ////////////////////////

    modifier onlyState(State state) {
        require(_state == state);
        _;
    }

    modifier onlyStates(State state0, State state1) {
        require(_state == state0 || _state == state1);
        _;
    }

    modifier onlyStates3(State state0, State state1, State state2) {
        require(_state == state0 || _state == state1 || _state == state2);
        _;
    }

    /// @dev Multiple states can be handled by adding more modifiers.
    modifier notInState(State state) {
        require(_state != state);
        _;
    }

    modifier transitionsTo(State newState) {
        _;
        transitionTo(newState);
    }

    ////////////////////////
    // Constructor
    ////////////////////////

    function StateMachine() {
        _state = State.Before;
    }

    ////////////////////////
    // Public functions
    ////////////////////////

    function state()
        public
        constant
        returns (State)
    {
        return _state;
    }

    ////////////////////////
    // Internal functions
    ////////////////////////

    // @dev Transitioning to the same state is silently ignored, no log events
    //  or handlers are called.
    function transitionTo(State newState)
        internal
        returns (State oldState)
    {
        oldState = _state;
        if (oldState == newState) {
            return;
        }
        require(validTransition(oldState, newState));
        mBeforeTransition(oldState, newState);
        _state = newState;
        LogStateTransition(oldState, newState);

        // TODO: What if mOnAfterTransition wants to transition
        // further?
        mAfterTransition(oldState, newState);
        return oldState;
    }

    function validTransition(State oldState, State newState)
        private
        constant
        returns (bool valid)
    {
        return (
            oldState == State.Before && newState == State.Whitelist) || (
            oldState == State.Whitelist && newState == State.Public) || (
            oldState == State.Public && newState == State.Finished
        );
    }

    //
    // MStateMachine default implementations
    //

    function mBeforeTransition(State /* oldState */, State /* newState */)
        internal
    {
    }

    function mAfterTransition(State /* oldState */, State /* newState */)
        internal
    {
    }
}
