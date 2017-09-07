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
        IAccessPolicy policy,
        EtherToken ethToken,
        LockedAccount lockedAccount,
        Neumark neumark,
        uint256 startDate,
        uint256 endDate,
        uint256 minAbsCap,
        uint256 maxAbsCap,
        uint256 minTicket,
        uint256 ethEurFraction,
        address platformOperatorWallet
    )
         CommitmentBase(
            policy,
            ethToken,
            lockedAccount,
            neumark,
            startDate,
            endDate,
            minAbsCap,
            maxAbsCap,
            minTicket,
            ethEurFraction,
            platformOperatorWallet
        )
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
