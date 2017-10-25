pragma solidity 0.4.15;

import './AccessControl/AccessControlled.sol';
import './AccessRoles.sol';
import './Agreement.sol';
import './Snapshot/DailyAndSnapshotable.sol';
import './SnapshotToken/Helpers/TokenMetadata.sol';
import './SnapshotToken/StandardSnapshotToken.sol';
import './NeumarkIssuanceCurve.sol';
import './Reclaimable.sol';


contract Neumark is
    AccessControlled,
    AccessRoles,
    Agreement,
    DailyAndSnapshotable,
    StandardSnapshotToken,
    TokenMetadata,
    NeumarkIssuanceCurve,
    Reclaimable
{

    ////////////////////////
    // Constants
    ////////////////////////

    string private constant TOKEN_NAME = "Neumark";

    uint8  private constant TOKEN_DECIMALS = 18;

    string private constant TOKEN_SYMBOL = "NMK";

    string private constant VERSION = "NMK_1.0";

    ////////////////////////
    // Mutable state
    ////////////////////////

    // disable transfers when Neumark is created
    bool private _transferEnabled = false;

    // at which point on curve new Neumarks will be created, see NeumarkIssuanceCurve contract
    uint256 private _totalEurUlps;

    ////////////////////////
    // Events
    ////////////////////////

    event LogNeumarksIssued(
        address indexed owner,
        uint256 euroUlps,
        uint256 neumarkUlps
    );

    event LogNeumarksBurned(
        address indexed owner,
        uint256 euroUlps,
        uint256 neumarkUlps
    );

    ////////////////////////
    // Constructor
    ////////////////////////

    function Neumark(
        IAccessPolicy accessPolicy,
        IEthereumForkArbiter forkArbiter
    )
        AccessControlled(accessPolicy)
        AccessRoles()
        Agreement(accessPolicy, forkArbiter)
        StandardSnapshotToken(
            IClonedTokenParent(0x0),
            0
        )
        TokenMetadata(
            TOKEN_NAME,
            TOKEN_DECIMALS,
            TOKEN_SYMBOL,
            VERSION
        )
        DailyAndSnapshotable(0)
        NeumarkIssuanceCurve()
        Reclaimable()
    {}

    ////////////////////////
    // Public functions
    ////////////////////////

    /// @notice issues new Neumarks to msg.sender with cost at current curve position
    ///     moves curve position by euroUlps
    ///     callable only by ROLE_NEUMARK_ISSUER
    function issueForEuro(uint256 euroUlps)
        public
        only(ROLE_NEUMARK_ISSUER)
        acceptAgreement(msg.sender)
        returns (uint256)
    {
        require(_totalEurUlps + euroUlps >= _totalEurUlps);
        uint256 neumarkUlps = incremental(euroUlps);
        _totalEurUlps += euroUlps;
        mGenerateTokens(msg.sender, neumarkUlps);
        LogNeumarksIssued(msg.sender, euroUlps, neumarkUlps);
        return neumarkUlps;
    }

    /// @notice used by ROLE_NEUMARK_ISSUER to transer newly issued neumarks
    ///     typically to the investor and platform operator
    function distribute(address to, uint256 neumarkUlps)
        public
        only(ROLE_NEUMARK_ISSUER)
        acceptAgreement(to)
    {
        mTransfer(msg.sender, to, neumarkUlps);
    }

    /// @notice msg.sender can burn their Neumarks, curve is rolled back using inverse
    ///     curve. as a result cost of Neumark gets lower (reward is higher)
    function burn(uint256 neumarkUlps)
        public
        only(ROLE_NEUMARK_BURNER)
        returns (uint256)
    {
        uint256 euroUlps = incrementalInverse(neumarkUlps);
        _totalEurUlps -= euroUlps;
        mDestroyTokens(msg.sender, neumarkUlps);
        LogNeumarksBurned(msg.sender, euroUlps, neumarkUlps);
        return euroUlps;
    }

    function enableTransfer(bool enabled)
        public
        only(ROLE_TRANSFER_ADMIN)
    {
        _transferEnabled = enabled;
    }

    function createSnapshot()
        public
        only(ROLE_SNAPSHOT_CREATOR)
        returns (uint256)
    {
        return DailyAndSnapshotable.createSnapshot();
    }

    function transferEnabled()
        public
        constant
        returns (bool)
    {
        return _transferEnabled;
    }

    function totalEuroUlps()
        public
        constant
        returns (uint256)
    {
        return _totalEurUlps;
    }

    function incremental(uint256 euroUlps)
        public
        constant
        returns (uint256 neumarkUlps)
    {
        return incremental(_totalEurUlps, euroUlps);
    }

    /// @dev The result is rounded down.
    function incrementalInverse(uint256 neumarkUlps)
        public
        constant
        returns (uint256 euroUlps)
    {
        return incrementalInverse(_totalEurUlps, neumarkUlps);
    }

    ////////////////////////
    // Internal functions
    ////////////////////////

    //
    // Implements MTokenController
    //

    function mOnTransfer(
        address from,
        address, // to
        uint256 // amount
    )
        internal
        acceptAgreement(from)
        returns (bool allow)
    {
        // must have transfer enabled or msg.sender is Neumark issuer
        return _transferEnabled || accessPolicy().allowed(msg.sender, ROLE_NEUMARK_ISSUER, this, msg.sig);
    }

    function mOnApprove(
        address owner,
        address, // spender,
        uint256 // amount
    )
        internal
        acceptAgreement(owner)
        returns (bool allow)
    {
        return true;
    }
}
