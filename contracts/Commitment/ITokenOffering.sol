pragma solidity 0.4.15;


/// Base class for any token offering on Neufund platform
contract ITokenOffering {

    ////////////////////////
    // Events
    ////////////////////////

    /// on every investment transaction
    /// `investor` invested `amount` in `paymentToken` currency which was converted to `eurEquivalent` that purchases `purchasedAmount` of `ofToken`
    event LogFundsInvested(
        address indexed investor,
        uint256 amount,
        address paymentToken,
        uint256 eurEquivalent,
        uint256 purchasedAmount,
        address ofToken
    );

    /// on completed offering
    event LogCommitmentCompleted(
        bool isSuccess
    );

    ////////////////////////
    // Public functions
    ////////////////////////

    /// says if end criteria are met
    function hasEnded()
        public
        constant
        returns(bool);

    /// says if offering was finalized and post-finalization operations can be performed (like claims etc)
    function isFinalized()
        public
        constant
        returns (bool);

    /// says if offering is, will be or was successful - may not ended yet
    function wasSuccessful()
        public
        constant
        returns (bool);
}
