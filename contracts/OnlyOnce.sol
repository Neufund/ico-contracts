pragma solidity 0.4.15;


/// @notice Prevents a transaction from being executed twice.
contract OnlyOnce {

    ////////////////////////
    // Mutable state
    ////////////////////////

    mapping (bytes4 => bool) private _hasBeenCalledBefore;

    ////////////////////////
    // Modifiers
    ////////////////////////

    /// @notice An *external* call to a function with this modifier can
    ///     only happen once. Whe the function is called internally, it
    ///     will count as a different transaction, but also only allowed
    ///     once. Mark any `onlyOnce` functions as `external` to avoid any
    ///     confusion.
    modifier onlyOnce() {
        require(_hasBeenCalledBefore[msg.sig] == false);
        _hasBeenCalledBefore[msg.sig] = true;
        _;
    }
}
