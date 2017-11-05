pragma solidity 0.4.15;

import './StateMachine.sol';


/// @title time induced state machine
/// @notice ------ time ----->
///
///  +--------+-----------+--------+------------
///  | Before | Whitelist | Public | Finished …
///  +--------+-----------+--------+------------
/// @dev intended usage via 'withTimedTransitions' modifier which makes sure that state machine transitions into
///     correct state before executing function body. note that this is contract state changing modifier so use with care
/// @dev state change request is publicly accessible via 'handleTimedTransitions'
/// @dev time is based on block.timestamp
contract TimedStateMachine is StateMachine {

    ////////////////////////
    // Constants
    ////////////////////////

    // duration of Whitelist state
    int256 private constant WHITELIST_DURATION = 1 hours;

    // duration of Public state
    int256 private constant PUBLIC_DURATION = 30 days;

    ////////////////////////
    // Immutable state
    ////////////////////////

    // timestamp at which Whitelist phase of Commitment starts
    // @dev set in TimedStateMachine constructor, it is an exclusive reference point
    //      to all time induced state changes in this contract
    int256 internal WHITELIST_START;

    ////////////////////////
    // Modifiers
    ////////////////////////

    // @dev This modifier needs to be applied to all external non-constant
    //     functions.
    // @dev This modifier goes _before_ other state modifiers like `onlyState`.
    modifier withTimedTransitions() {
        handleTimedTransitions();
        _;
    }

    ////////////////////////
    // Constructor
    ////////////////////////

    function TimedStateMachine(int256 whitelistStart)
        internal
    {
        WHITELIST_START = whitelistStart;
    }

    ////////////////////////
    // Public functions
    ////////////////////////

    // @notice This function is public so that it can be called independently.
    function handleTimedTransitions()
        public
    {
        int256 t = int256(block.timestamp);

        // Time induced state transitions.
        // @dev Don't use `else if` and keep sorted by time and call `state()`
        //     or else multiple transitions won't cascade properly.
        if (state() == State.Before && t >= startOf(State.Whitelist)) {
            transitionTo(State.Whitelist);
        }
        if (state() == State.Whitelist && t >= startOf(State.Public)) {
            transitionTo(State.Public);
        }
        if (state() == State.Public && t >= startOf(State.Finished)) {
            transitionTo(State.Finished);
        }
    }

    function startOf(State state)
        public
        constant
        returns (int256)
    {
        if (state == State.Before) {
            return 0;
        }
        if (state == State.Whitelist) {
            return WHITELIST_START;
        }
        if (state == State.Public) {
            return WHITELIST_START + WHITELIST_DURATION;
        }
        if (state == State.Finished) {
            return WHITELIST_START + WHITELIST_DURATION + PUBLIC_DURATION;
        }
    }
}
