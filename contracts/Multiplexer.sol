pragma solidity ^0.4.8;

/// @title Address multiplexer
/// @author Remco Bloemen <remco@neufund.org>
///
/// This contract can be used when a smart contract has a role that can be
/// fullfilled by only one address, but you would like multiple addresses to
/// fullfill the role.
///
/// @dev Any public or external function defined in this contract will no
///      not be forwarded. For that reason, we prefix all public interfaces with
///      `multiplex`. We also implement our own ownership  mechanism (as opposed
///      to inheriting from Ownable). This allows the Multiplexer to be used in
///      the owner role.
contract Multiplexer {

    address private owner;
    address private ownerCandidate;
    address private target;
    mapping (address => bool) private managers;

    modifier onlyOwner() {
        if (msg.sender != owner) {
            throw;
        }
        _;
    }

    modifier onlyManagers() {
        if(managers[msg.sender]) {
            _;
        }
    }

    function Multiplexer(address target_, address[] managers_) {
        target = target;
        for(uint i = 0; i < managers_.length; i++) {
            managers[managers_[i]] = true;
        }
    }

    // Proxy/relay the target contract
    function () external payable onlyManagers() {
        if(!target.call.value(msg.value)(msg.data)) {
            throw;
        }
    }

    //
    function multiplexTransferOwnership(address newOwner) external onlyOwner {

    }

    function multiplexAcceptOwnership() external {

    }

    function multiplexRetarget(address target_) external onlyOwner {
        target = target_;
    }

    function multiplexAdd(address manager) external onlyOwner {
        managers[manager] = true;
    }

    function multiplexRemove(address manager) external onlyOwner {
        delete managers[manager];
    }
}
