pragma solidity 0.4.15;

import './Standards/IEthereumForkArbiter.sol';
import './AccessControl/AccessControlled.sol';
import './AccessRoles.sol';


/**
 * @title legally binding smart contract
 * @dev General approach to paring legal and smart contracts:
 * 1.    All terms and agreement are between two parties: here between legal representation of platform operator and platform user.
 * 2.    Parties are represented by public Ethereum address.
 * 3.    Legal agreement has immutable part that corresponds to smart contract code and mutable part that may change for example due to changing regulations or other externalities that smart contract does not control.
 * 4.    There should be a provision in legal document that future changes in mutable part cannot change terms of immutable part.
 * 5.    Immutable part links to corresponding smart contract via its address.
 * 6.    Additional provision should be added if smart contract supports it
 *  a.    Fork provision
 *  b.    Bugfixing provision (unilateral code update mechanism)
 *  c.    Migration provision (bilateral code update mechanism)
 *
 * Details on Agreement base class:
 * 1.    We bind smart contract to legal contract by storing uri (preferably ipfs or hash) of the legal contract in the smart contract. It is however crucial that such binding is done by platform operator representation so transaction establishing the link must be signed by respective wallet ('amendAgreement')
 * 2.    Mutable part of agreement may change. We should be able to amend the uri later. Previous amendments should not be lost and should be retrievable (`amendAgreement` and 'pastAgreement' functions).
 * 3.    There should be a way to opt out of the terms if they are implicit. Example: in case of Neumark any public address that receives transfer (NEU balance > 0) is implicity signing the agreement. We allow such users to opt out of Neumark Holder Agreement by burning all neumarks – that should generate rejection event. Please note that transfer by such party to ther party will explicitly sign terms so just zeroing balance is not enough.
 *
**/
contract Agreement is
    AccessControlled,
    AccessRoles
{

    ////////////////////////
    // Type declarations
    ////////////////////////

    /// @notice agreement with signature of the platform operator representative
    struct SignedAgreement {
        address platformOperatorRepresentative;
        bytes32 signedBlockHash;
        uint256 signedTimestamp;
        string agreementUri;
    }

    ////////////////////////
    // Immutable state
    ////////////////////////

    IEthereumForkArbiter private ETHEREUM_FORK_ARBITER;

    ////////////////////////
    // Mutable state
    ////////////////////////

    SignedAgreement[] private _amendments;

    ////////////////////////
    // Events
    ////////////////////////

    event LogAgreementAccepted(
        address indexed accepter
    );

    event LogAgreementCancelled(
        address indexed rejector
    );

    event LogAgreementAmended(
        address platformOperatorRepresentative,
        string agreementUri
    );

    ////////////////////////
    // Modifiers
    ////////////////////////

    /// @notice logs that agreement was accepted by platform user
    /// @dev intended to be added to functions that if used make 'accepter' origin to enter legally binding agreement
    modifier acceptAgreement(address accepter) {
        require(hasSignedAgreement());
        LogAgreementAccepted(accepter);
        _;
    }

    /// @notice logs that agreement was cancelled by platform user
    /// @dev intended to be added to functions that result in cancellation of the agreement for 'rejector', see top of this file for details
    modifier cancelAgreement(address rejector) {
        require(hasSignedAgreement());
        LogAgreementCancelled(rejector);
        _;
    }

    ////////////////////////
    // Constructor
    ////////////////////////

    function Agreement(IAccessPolicy accessPolicy, IEthereumForkArbiter forkArbiter)
        AccessControlled(accessPolicy)
    {
        require(forkArbiter != IEthereumForkArbiter(0x0));
        ETHEREUM_FORK_ARBITER = forkArbiter;
    }

    ////////////////////////
    // Public functions
    ////////////////////////

    function amendAgreement(string agreementUri)
        public
        only(ROLE_PLATFORM_OPERATOR_REPRESENTATIVE)
    {
        SignedAgreement memory amendment = SignedAgreement({
            platformOperatorRepresentative: msg.sender,
            signedTimestamp: block.timestamp,
            signedBlockHash: block.blockhash(block.number),
            agreementUri: agreementUri
        });
        _amendments.push(amendment);
        LogAgreementAmended(msg.sender, agreementUri);
    }

    function ethereumForkArbiter()
        public
        constant
        returns (IEthereumForkArbiter)
    {
        return ETHEREUM_FORK_ARBITER;
    }

    function currentAgreement()
        public
        constant
        returns (address, uint256, bytes32, string, uint256)
    {
        require(hasSignedAgreement());
        uint256 amendmentIndex = _amendments.length - 1;
        SignedAgreement storage amendment = _amendments[amendmentIndex];
        return (
            amendment.platformOperatorRepresentative,
            amendment.signedTimestamp,
            amendment.signedBlockHash,
            amendment.agreementUri,
            amendmentIndex
        );
    }

    function pastAgreement(uint256 amendmentIndex)
        public
        constant
        returns (address, uint256, bytes32, string, uint256)
    {
        SignedAgreement storage amendment = _amendments[amendmentIndex];
        return (
            amendment.platformOperatorRepresentative,
            amendment.signedTimestamp,
            amendment.signedBlockHash,
            amendment.agreementUri,
            amendmentIndex
        );
    }

    ////////////////////////
    // Private functions
    ////////////////////////

    function hasSignedAgreement()
        private
        returns (bool)
    {
        return _amendments.length > 0;
    }
}
