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

    // AUDIT[CHF-07]: Change visibility from "internal" to "private".
    //                Derived contracts does not need access to this variable.
    //                Already fixed.
    State private _state;

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

    // AUDIT[CHF-10]: A suggestion for renaming modifiers:
    //                inState, inAnyState, notInState.
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


    // AUDIT[CHF-08]: Missing visibility specifier. Use `internal`.
    //                The visibility specifiers should be explicit. This applies
    //                also to constructors. Solidity 0.4.17 starts warn about
    //                not using specifiers explicitly.
    //                A constructor can have public or internal visibility.
    //                In case of this "abstract" contract the internal
    //                visibility should be good choice.
    //                Already fixed.
    function StateMachine() internal {
        // AUDIT[CHF-09]: This initialization can be moved to the declaration of
        //                _state member. Having the init value next to the
        //                variable declaration is always better.
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
