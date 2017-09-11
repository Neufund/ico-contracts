pragma solidity 0.4.15;

import './StateMachine.sol';


/// @notice Prevents a transaction from being executed twice.
contract TimedStateMachine is StateMachine {

    ////////////////////////
    // Constants
    ////////////////////////

    int256 internal constant WHITELIST_DURATION = 5 days;

    int256 internal constant PAUSE_DURATION = 1 days;

    int256 internal constant PUBLIC_DURATION = 30 days;

    int256 internal constant ROLLBACK_DURATION = 7 days;

    //  +------------+-----------+-------+-------------------------+----------+
    //  | ... before | whitelist | pause |  public ico             | finished |
    //  |            |           |       |              +----------|          |
    //  |            |           |       |              | rollback |          |
    //  +------------+-----------+-------+--------------+----------+----------+

    // Starting times are relative to WHITELIST_START

    int256 internal constant PAUSE_START = WHITELIST_DURATION;

    int256 internal constant PUBLIC_START = PAUSE_START + PAUSE_DURATION;

    int256 internal constant PUBLIC_END = PUBLIC_START + PUBLIC_DURATION;

    int256 internal constant ROLLBACK_START = PUBLIC_END - ROLLBACK_DURATION;

    ////////////////////////
    // Immutable state
    ////////////////////////

    int256 internal constant WHITELIST_START;

    ////////////////////////
    // Modifiers
    ////////////////////////

    // @dev this modifier goes _before_ other state modifiers like `onlyState`.
    modifier withTimedTransitions() {
        handleTimedTransition();
        _;
    }

    ////////////////////////
    // Constructor
    ////////////////////////

    function TimedStateMachine(uint256 whitelistStart) {
        WHITELIST_START = whitelistStart;
    }

    ////////////////////////
    // Public functions
    ////////////////////////

    // @notice This function is public so that it can be called independantly.
    function handleTimedTransition()
        public
    {
        // Time relative to WHITELIST_START
        int256 T = int256(block.timestamp) - WHITELIST_START;

        // Time induced state transitions.
        // @dev Don't use `else if` and keep them sorted by time or multiple
        //     transitions won't cascade properly.
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
        returns (uint256)
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
