pragma solidity ^0.4.11;

import 'zeppelin-solidity/contracts/ownership/Ownable.sol';
import 'minimetoken/contracts/MiniMeToken.sol';
import './Neumark.sol';

contract NeumarkController is Ownable, TokenController {

    Neumark public TOKEN;

    modifier onlyToken() {
        require(msg.sender == address(TOKEN));
        _;
    }

    function NeumarkController(Neumark _TOKEN) {
        TOKEN = _TOKEN;
    }

    function generateTokens(address _holder, uint _value)
        //onlyOwner()
        returns (bool)
    {
        // _value *= 10 ** TOKEN.decimals();
        return TOKEN.generateTokens(_holder, _value);
    }

    function destroyTokens(address _owner, uint _value)
        //onlyOwner()
        returns (bool)
    {
        // _value *= 10 ** TOKEN.decimals();
        return TOKEN.destroyTokens(_owner, _value);
    }

    function enableTransfers(bool _transfersEnabled)
        //onlyOwner()
    {
        TOKEN.enableTransfers(_transfersEnabled);
    }

    //
    // Implementation of the MiniMe TokenController
    //

    /// @notice Called when `_owner` sends ether to the MiniMe Token contract
    /// @param _owner The address that sent the ether to create tokens
    /// @return True if the ether is accepted, false if it throws
    function proxyPayment(address _owner)
        payable
        onlyToken()
        returns(bool)
    {
        // We don't accept ether
        revert();
    }

    /// @notice Notifies the controller about a token transfer allowing the
    ///  controller to react if desired
    /// @param _from The origin of the transfer
    /// @param _to The destination of the transfer
    /// @param _amount The amount of the transfer
    /// @return False if the controller does not authorize the transfer
    function onTransfer(address _from, address _to, uint _amount)
        onlyToken()
        returns(bool)
    {
        return true; // Accept all transactions
    }

    /// @notice Notifies the controller about an approval allowing the
    ///  controller to react if desired
    /// @param _owner The address that calls `approve()`
    /// @param _spender The spender in the `approve()` call
    /// @param _amount The amount in the `approve()` call
    /// @return False if the controller does not authorize the approval
    function onApprove(address _owner, address _spender, uint _amount)
        onlyToken()
        returns(bool)
    {
        return true; // Accept all approvals
    }
}
