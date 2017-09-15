pragma solidity 0.4.15;

import './AccessControl/AccessControlled.sol';
import './AccessRoles.sol';
import './Agreement.sol';
import './SnapshotToken/SnapshotToken.sol';
import './NeumarkIssuanceCurve.sol';
import './Reclaimable.sol';


contract Neumark is
    AccessControlled,
    AccessRoles,
    Agreement,
    SnapshotToken,
    NeumarkIssuanceCurve,
    Reclaimable
{

    ////////////////////////
    // Constants
    ////////////////////////

    string private constant TOKEN_NAME = "Neumark";

    uint8  private constant TOKEN_DECIMALS = 18;

    string private constant TOKEN_SYMBOL = "NMK";

    ////////////////////////
    // Mutable state
    ////////////////////////

    bool private _transferEnabled;

    uint256 private _totalEuroUlps;

    ////////////////////////
    // Events
    ////////////////////////

    event LogNeumarksIssued(
        address indexed owner,
        uint256 euroUlp,
        uint256 neumarkUlp
    );

    event LogNeumarksBurned(
        address indexed owner,
        uint256 euroUlp,
        uint256 neumarkUlp
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
        SnapshotToken(
            TOKEN_NAME,
            TOKEN_DECIMALS,
            TOKEN_SYMBOL
        )
        NeumarkIssuanceCurve()
        Reclaimable()
    {
        _transferEnabled = false;
        _totalEuroUlps = 0;
    }

    ////////////////////////
    // Public functions
    ////////////////////////

    function issueForEuro(uint256 euroUlps)
        public
        only(ROLE_NEUMARK_ISSUER)
        acceptAgreement(msg.sender)
        returns (uint256)
    {
        require(_totalEuroUlps + euroUlps >= _totalEuroUlps);
        address beneficiary = msg.sender;
        uint256 neumarkUlps = incremental(_totalEuroUlps, euroUlps);

        _totalEuroUlps = _totalEuroUlps + euroUlps;

        assert(mGenerateTokens(beneficiary, neumarkUlps));

        LogNeumarksIssued(beneficiary, euroUlps, neumarkUlps);
        return neumarkUlps;
    }

    function burnNeumark(uint256 neumarkUlps)
        public
        only(ROLE_NEUMARK_BURNER)
        returns (uint256)
    {
        address owner = msg.sender;
        uint256 euroUlps = incrementalInverse(_totalEuroUlps, neumarkUlps);

        _totalEuroUlps -= euroUlps;

        assert(mDestroyTokens(owner, neumarkUlps));

        LogNeumarksBurned(owner, euroUlps, neumarkUlps);
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
        return _totalEuroUlps;
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
        return _transferEnabled;
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
