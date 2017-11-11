pragma solidity 0.4.15;

import '../Standards/IERC677Token.sol';
import '../Standards/IERC677Callback.sol';


contract TestERC677Callback is IERC677Callback {

    ////////////////////////
    // Mutable state
    ////////////////////////
    bool private _returnOnCallback;
    bytes32 private _acceptedExtraData;

    ////////////////////////
    // Constructor
    ////////////////////////
    function TestERC677Callback() public {
        _acceptedExtraData = sha3("");
    }

    ////////////////////////
    // Public functions
    ////////////////////////
    function receiveApproval(
        address from,
        uint256 amount,
        address token, // IERC667Token
        bytes data
    )
        public
        returns (bool)
    {
        require(token == msg.sender);
        require(sha3(data) == _acceptedExtraData);
        bool success = IERC677Token(token).transferFrom(from, address(this), amount);
        require(success);
        return _returnOnCallback;
    }

    function setCallbackReturnValue(bool success)
        public
    {
        _returnOnCallback = success;
    }

    function setAcceptedExtraData(bytes acceptedExtraData)
        public
    {
        _acceptedExtraData = sha3(acceptedExtraData);
    }
}
