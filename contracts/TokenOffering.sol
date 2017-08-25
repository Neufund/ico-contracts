pragma solidity 0.4.15;

/// Base class for any token offering on Neufund platform
contract TokenOffering {
    /// on every investment transaction
    /// `investor` invested `amount` in `paymentToken` currency which was converted to `eurEquivalent` that purchases `purchasedAmount` of `ofToken`
    event FundsInvested(address indexed investor, uint256 amount, address paymentToken, uint256 eurEquivalent, uint256 purchasedAmount, address ofToken);
    /// on completed offering
    event CommitmentCompleted(bool isSuccess);

    /// says if end criteria are met
    function hasEnded() constant public returns(bool);
    /// says if offering was finalized and post-finalization operations can be performed (like claims etc)
    function isFinalized() constant public returns (bool);
    /// says if offering is, will be or was successful - may not ended yet
    function wasSuccessful() constant public returns (bool);
}
