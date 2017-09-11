pragma solidity 0.4.15;

import './MStateMachine.sol';


/// @notice Prevents a transaction from being executed twice.
contract StateMachine is MStateMachine {

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
    // Mutable state
    ////////////////////////

    State _state;

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

    modifier onlyStates(State state0, State state1, State state2) {
        require(_state == state0 || _state == state1 || _state == state2);
        _;
    }

    /// @dev Multiple states can be handled by adding more modifiers.
    modifier notInState(State state) {
        require(_state != state);
        _;
    }

    modifier transitionsTo(State nextState) {
        _;
        transitionTo(nextState);
    }

    ////////////////////////
    // Constructor
    ////////////////////////

    function StateMachine() {
        _state = Before;
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

    function transitionTo(State newState)
        internal
        returns (State)
    {
        State oldState = _state;
        if (oldState == newState) {
            return;
        }
        mOnTransition(oldState, newState);
        _state = newState;
        LogStateTransition(oldState, newState);
        return oldState;
    }
}
