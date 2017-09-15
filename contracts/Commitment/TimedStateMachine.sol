pragma solidity 0.4.15;

import './StateMachine.sol';


//  ------ time ----->
//  +--------+-----------+-------+----------------+----------+
//  |        |           |       | Public         |          |
//  | Before | Whitelist | Pause |     +----------| Finished |
//  |        |           |       |     | Rollback |          |
//  +--------+-----------+-------+-----+----------+----------+
//           | EUR                     |
//           +-----------+-------+-----+----------+
//           | ETH       |       | ETH            |
//           +-----------+       +----------------+
contract TimedStateMachine is StateMachine {

    ////////////////////////
    // Constants
    ////////////////////////

    int256 internal constant MIN_BEFORE_DURATION = 1 days;

    int256 internal constant WHITELIST_DURATION = 5 days;

    int256 internal constant PAUSE_DURATION = 1 days;

    int256 internal constant PUBLIC_DURATION = 30 days;

    int256 internal constant ROLLBACK_DURATION = 7 days;

    //
    // Starting time relative to WHITELIST_START
    //

    int256 internal constant PAUSE_START = WHITELIST_DURATION;

    int256 internal constant PUBLIC_START = PAUSE_START + PAUSE_DURATION;

    int256 internal constant PUBLIC_END = PUBLIC_START + PUBLIC_DURATION;

    int256 internal constant ROLLBACK_START = PUBLIC_END - ROLLBACK_DURATION;

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

    function TimedStateMachine(int256 whitelistStart) {
        int256 beforeDuration  = whitelistStart - int256(block.timestamp);
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
        int256 T = int256(block.timestamp) - WHITELIST_START;

        // Time induced state transitions.
        // @dev Don't use `else if` and keep sorted by time and call `state()`
        //     or else multiple transitions won't cascade properly.
        if (state() == State.Before && T >= 0) {
            transitionTo(State.Whitelist);
        }
        if (state() == State.Whitelist && T >= PAUSE_START) {
            transitionTo(State.Pause);
        }
        if (state() == State.Pause && T >= PUBLIC_START) {
            transitionTo(State.Public);
        }
        if (state() == State.Public && T >= ROLLBACK_START) {
            transitionTo(State.Rollback);
        }
        if (state() == State.Rollback && T >= PUBLIC_END) {
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
        if (state == State.Pause) {
            return WHITELIST_START + PAUSE_START;
        }
        if (state == State.Public) {
            return WHITELIST_START + PUBLIC_START;
        }
        if (state == State.Rollback) {
            return WHITELIST_START + ROLLBACK_START;
        }
        if (state == State.Finished) {
            return WHITELIST_START + PUBLIC_END;
        }
    }
}
