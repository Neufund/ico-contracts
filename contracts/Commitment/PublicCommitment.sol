pragma solidity 0.4.15;

import "./CommitmentBase.sol";
import "./MCommitment.sol";


/// public capital commitment for general public
/// Implements MCommitment
/// Consumes CommitmentBase (neumark, lockedAccount, distributeAndReturnInvestorNeumarks)
contract PublicCommitment is
    MCommitment,
    CommitmentBase
{
    ////////////////////////
    // Constructor
    ////////////////////////

    function PublicCommitment(
        IAccessPolicy _policy,
        EtherToken _ethToken,
        LockedAccount _lockedAccount,
        Neumark _neumark
    )
         CommitmentBase(_policy, _ethToken, _lockedAccount, _neumark)
    {
    }

    ////////////////////////
    // Internal functions
    ////////////////////////

    //
    // Implement MCommitment
    //

    function onCommitmentSuccessful()
        internal
    {
        // enable Neumark trading in token controller
        NEUMARK.enableTransfer(true);

        // enable escape hatch and end locking funds phase
        LOCKED_ACCOUNT.controllerSucceeded();
    }

    function onCommitmentFailed()
        internal
    {
        // unlock all accounts in lockedAccount
        LOCKED_ACCOUNT.controllerFailed();
    }

    function giveNeumarks(address investor, uint256 amount)
        internal
        returns (uint256)
    {
        uint256 euroUlps = convertToEUR(amount);

        // issue to self
        uint256 neumarkUlps = NEUMARK.issueForEuro(euroUlps);
        return distributeAndReturnInvestorNeumarks(investor, neumarkUlps);
    }

    function validCommitment()
        internal
        constant
        returns (bool)
    {
        return true;
    }
}
