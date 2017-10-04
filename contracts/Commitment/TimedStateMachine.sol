pragma solidity 0.4.15;

import './StateMachine.sol';

// AUDIT[CHF-17]: Please add a bit more documentation about this contract.
//  ------ time ----->
//  +--------+-----------+--------+------------
//  | Before | Whitelist | Public | Finished …
//  +--------+-----------+--------+------------
contract TimedStateMachine is StateMachine {

    ////////////////////////
    // Constants
    ////////////////////////

    // AUDIT[CHF-19]: The following constants require comments explaining what
    //                they are for. If the numeric values are described in any
    //                external document, the reference to this document would
    //                be also helpful.
    int256 internal constant MIN_BEFORE_DURATION = 1 days;

    int256 internal constant WHITELIST_DURATION = 5 days;

    int256 internal constant PUBLIC_DURATION = 30 days;

    int256 internal constant PUBLIC_FROM_START = WHITELIST_DURATION;

    int256 internal constant FINISH_FROM_START = PUBLIC_FROM_START + PUBLIC_DURATION;

    ////////////////////////
    // Immutable state
    ////////////////////////

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

    // AUDIT[CHF-18]: Missing visibility specifier. Use `internal`.
    //                See also AUDIT[CHF-08]. Already fixed.
    function TimedStateMachine(int256 whitelistStart)
        internal
    {
        int256 beforeDuration = whitelistStart - int256(block.timestamp);
        require(beforeDuration >= MIN_BEFORE_DURATION);
        WHITELIST_START = whitelistStart;
    }

    ////////////////////////
    // Public functions
    ////////////////////////

    // @notice This function is public so that it can be called independently.
    function handleTimedTransitions()
        public
    {
        // Time relative to WHITELIST_START
        int256 t = int256(block.timestamp) - WHITELIST_START;

        // Time induced state transitions.
        // @dev Don't use `else if` and keep sorted by time and call `state()`
        //     or else multiple transitions won't cascade properly.
        if (state() == State.Before && t >= 0) {
            transitionTo(State.Whitelist);
        }
        if (state() == State.Whitelist && t >= PUBLIC_FROM_START) {
            transitionTo(State.Public);
        }
        if (state() == State.Public && t >= FINISH_FROM_START) {
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
            return WHITELIST_START + PUBLIC_FROM_START;
        }
        if (state == State.Finished) {
            return WHITELIST_START + FINISH_FROM_START;
        }
    }
}
