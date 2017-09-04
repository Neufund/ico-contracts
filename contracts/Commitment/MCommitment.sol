pragma solidity 0.4.15;


contract MCommitment {

    ////////////////////////
    // Internal functions
    ////////////////////////

    /// called by finalize() so may be called by ANYONE
    /// intended to be overriden
    function onCommitmentSuccessful()
        internal;

    /// called by finalize() so may be called by ANYONE
    /// intended to be overriden
    function onCommitmentFailed()
        internal;

    /// awards investor with Neumarks computed along curve for `amount`
    /// this function modifies state of curve
    /// return amount of investor's Neumark reward
    function giveNeumarks(address investor, uint256 amount)
        internal
        returns (uint256);

    /// tells if commitment may be executed ie. investor is whitelisted
    function validCommitment()
        internal
        constant
        returns (bool);
}
