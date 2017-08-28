pragma solidity 0.4.15;

import './SnapshotToken/SnapshotToken.sol';
import './NeumarkIssuanceCurve.sol';

contract Neumark is SnapshotToken, NeumarkIssuanceCurve {

    string constant TOKEN_NAME     = "Neumark";
    uint8  constant TOKEN_DECIMALS = 18;
    string constant TOKEN_SYMBOL   = "NMK";

    bool public transferEnabled;
    uint256 public totalEuroUlps;

    event NeumarksIssued(
        address indexed owner,
        uint256 euroUlp,
        uint256 neumarkUlp);

    event NeumarksBurned(
        address indexed owner,
        uint256 euroUlp,
        uint256 neumarkUlp);

    function Neumark()
        SnapshotToken(
            ISnapshotTokenParent(0x0), // Address of the parent token, set to 0x0 if it is a new token
            0, // Snapshot of the parent token, set to 0 if it is a new token
            TOKEN_NAME,
            TOKEN_DECIMALS,
            TOKEN_SYMBOL
        )
        NeumarkIssuanceCurve()
    {
        transferEnabled = false;
        totalEuroUlps = 0;
    }

    function issueForEuro(uint256 euroUlps)
        public
        returns (uint256)
    {
        require(totalEuroUlps + euroUlps >= totalEuroUlps);
        address beneficiary = msg.sender;
        uint256 neumarkUlps = incremental(totalEuroUlps, euroUlps);

        totalEuroUlps = totalEuroUlps + euroUlps;

        assert(mGenerateTokens(beneficiary, neumarkUlps));

        NeumarksIssued(beneficiary, euroUlps, neumarkUlps);
        return neumarkUlps;
    }

    function burnNeumark(uint256 neumarkUlps)
        public
        returns (uint256)
    {
        address owner = msg.sender;
        uint256 euroUlps = incrementalInverse(totalEuroUlps, neumarkUlps);

        totalEuroUlps -= euroUlps;

        assert(mDestroyTokens(owner, neumarkUlps));

        NeumarksBurned(owner, euroUlps, neumarkUlps);
        return euroUlps;
    }

    function enableTransfer(bool enabled)
        public
        // TODO Roles
    {
        transferEnabled = enabled;
    }

    /// @notice Notifies the controller about a token transfer allowing the
    ///  controller to react if desired
    /// @param from The origin of the transfer
    /// @param to The destination of the transfer
    /// @param amount The amount of the transfer
    /// @return False if the controller does not authorize the transfer
    function mOnTransfer(
        address from,
        address to,
        uint amount
    )
        internal
        returns (bool allow)
    {
        return transferEnabled;
    }

    /// @notice Notifies the controller about an approval allowing the
    ///  controller to react if desired
    /// @param owner The address that calls `approve()`
    /// @param spender The spender in the `approve()` call
    /// @param amount The amount in the `approve()` call
    /// @return False if the controller does not authorize the approval
    function mOnApprove(
        address owner,
        address spender,
        uint amount
    )
        internal
        returns (bool allow)
    {
        return true;
    }

}
