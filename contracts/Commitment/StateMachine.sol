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

    // AUDIT[CHF-11]: This is unused. Remove.
    modifier onlyStates3(State state0, State state1, State state2) {
        require(_state == state0 || _state == state1 || _state == state2);
        _;
    }

    /// @dev Multiple states can be handled by adding more modifiers.
    // AUDIT[CHF-11]: This is unused. Remove.
    modifier notInState(State state) {
        require(_state != state);
        _;
    }

    // AUDIT[CHF-11]: This is unused. Remove.
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
    // AUDIT[CHF-12]: The returned old state is never used by any caller.
    //                This function should return nothing.
    function transitionTo(State newState)
        internal
        returns (State oldState)
    {
        oldState = _state;
        // AUDIT[CHF-13]: This defensive check can be removed. None of the
        //                callers depends on this. Also remember to remove
        //                the @dev node above.
        if (oldState == newState) {
            // AUDIT[CHF-14]: For consistency with the second return statement
            //                change it to `return oldState`.
            return;
        }
        require(validTransition(oldState, newState));

        // AUDIT[CHF-15]: First of all, this is not used anywhere. Such features
        //                should be introduced when needed for the first time,
        //                not for hypothetical future uses.
        //                Moreover, this can cause race conditions. Consider
        //                case when we are in Before state and
        //                mBeforeTransition() will execute transitionTo() twice:
        //                for Before -> Whitelist and Whitelist -> Public
        //                (assume infinite recursion is handled).
        //                The final _state being Public will be overwrite
        //                after mBeforeTransition returns.
        //                Without any protection from mBeforeTransition
        //                modifying the _state, this feature does not seem to
        //                be a good idea.
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
