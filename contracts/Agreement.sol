pragma solidity 0.4.15;

import './Standards/IEthereumForkArbiter.sol';
import './AccessControl/AccessControlled.sol';
import './AccessRoles.sol';


/**
 * @title legally binding smart contract
 * @dev General approach to paring legal and smart contracts:
 * 1. All terms and agreement are between two parties: here between legal representation of platform operator representative and platform investor.
 * 2. Parties are represented by public Ethereum addresses. Platform investor is and address that holds and controls funds and receives and controls Neumark token
 * 3. Legal agreement has immutable part that corresponds to smart contract code and mutable part that may change for example due to changing regulations or other externalities that smart contract does not control.
 * 4. There should be a provision in legal document that future changes in mutable part cannot change terms of immutable part.
 * 5. Immutable part links to corresponding smart contract via its address.
 * 6. Additional provision should be added if smart contract supports it
 *  a. Fork provision
 *  b. Bugfixing provision (unilateral code update mechanism)
 *  c. Migration provision (bilateral code update mechanism)
 *
 * Details on Agreement base class:
 * 1. We bind smart contract to legal contract by storing uri (preferably ipfs or hash) of the legal contract in the smart contract. It is however crucial that such binding is done by platform operator representation so transaction establishing the link must be signed by respective wallet ('amendAgreement')
 * 2. Mutable part of agreement may change. We should be able to amend the uri later. Previous amendments should not be lost and should be retrievable (`amendAgreement` and 'pastAgreement' functions).
 * 3. It is up to deriving contract to decide where to put 'acceptAgreement' modifier. However situation where there is no cryptographic proof that given address was really acting in the transaction should be avoided, simplest example being 'to' address in `transfer` function of ERC20.
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
        uint256 signedBlockTimestamp;
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
    mapping(address => bool) private _signatories;

    ////////////////////////
    // Events
    ////////////////////////

    event LogAgreementAccepted(
        address indexed accepter
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
        if(!_signatories[accepter]) {
            require(_amendments.length > 0);
            _signatories[accepter] = true;
            LogAgreementAccepted(accepter);
        }
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
            signedBlockTimestamp: block.timestamp,
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
        returns
        (
            address platformOperatorRepresentative,
            uint256 signedBlockTimestamp,
            string agreementUri,
            uint256 index
        )
    {
        require(_amendments.length > 0);
        uint256 last = _amendments.length - 1;
        SignedAgreement storage amendment = _amendments[last];
        return (
            amendment.platformOperatorRepresentative,
            amendment.signedBlockTimestamp,
            amendment.agreementUri,
            last
        );
    }

    function pastAgreement(uint256 amendmentIndex)
        public
        constant
        returns
        (
            address platformOperatorRepresentative,
            uint256 signedBlockTimestamp,
            string agreementUri,
            uint256 index
        )
    {
        SignedAgreement storage amendment = _amendments[amendmentIndex];
        return (
            amendment.platformOperatorRepresentative,
            amendment.signedBlockTimestamp,
            amendment.agreementUri,
            amendmentIndex
        );
    }

    function isAgreementSignedBy(address signatory)
        public
        constant
        returns (bool signed)
    {
        return _signatories[signatory];
    }
}
